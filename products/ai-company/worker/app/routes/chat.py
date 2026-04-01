"""Chat threads, messages, stream, sync, permission, reset, user profile update."""

import asyncio
import json
import re
import uuid
import time as _time

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.db import _get_db
from app.employee import (
    load_employees, save_employees, get_employee,
    _get_employee_workdir, _ensure_mcp_symlink,
    _build_employee_system_prompt,
)
from app.r2 import _r2_sync_to_local, _r2_sync_from_local

router = APIRouter()

# ============================================
# Chat Threads & Messages (SQLite)
# ============================================


def _get_threads(emp_id: str) -> list[dict]:
    conn = _get_db()
    try:
        rows = conn.execute(
            "SELECT id, title, created_at FROM chat_threads WHERE emp_id = ? ORDER BY created_at DESC",
            [emp_id]
        ).fetchall()
        return [{"id": r["id"], "title": r["title"], "createdAt": r["created_at"]} for r in rows]
    finally:
        conn.close()


def _create_thread(emp_id: str, title: str = "") -> dict:
    thread_id = str(uuid.uuid4())[:8]
    count = len(_get_threads(emp_id))
    t = title or "新規チャット"
    conn = _get_db()
    try:
        conn.execute("INSERT INTO chat_threads (id, emp_id, title) VALUES (?, ?, ?)", [thread_id, emp_id, t])
        conn.commit()
    finally:
        conn.close()
    return {"id": thread_id, "title": t, "createdAt": _time.strftime("%Y-%m-%dT%H:%M:%S")}


def _append_chat_log(emp_id: str, role: str, content: str, thread_id: str = "default"):
    conn = _get_db()
    try:
        conn.execute(
            "INSERT INTO chat_messages (thread_id, emp_id, role, content) VALUES (?, ?, ?, ?)",
            [thread_id, emp_id, role, content]
        )
        # スレッドタイトル自動設定（最初のユーザーメッセージが来たら）
        if role == "user":
            row = conn.execute(
                "SELECT title FROM chat_threads WHERE id = ?", [thread_id]
            ).fetchone()
            if row and row["title"] in ("新規チャット", "General") or (row and row["title"].startswith("Chat ")):
                # メッセージが短ければそのまま、長ければ要約的に切る
                msg = content.strip().split("\n")[0]  # 最初の行だけ
                if len(msg) <= 20:
                    new_title = msg
                else:
                    new_title = msg[:20] + "..."
                conn.execute("UPDATE chat_threads SET title = ? WHERE id = ?", [new_title, thread_id])
        # アシスタントの最初の返信でタイトルをより適切に更新
        if role == "assistant":
            msg_count = conn.execute(
                "SELECT COUNT(*) FROM chat_messages WHERE thread_id = ? AND role = 'assistant'", [thread_id]
            ).fetchone()[0]
            if msg_count <= 1:
                # 最初のユーザーメッセージ + アシスタント返信からトピックを抽出
                user_msg = conn.execute(
                    "SELECT content FROM chat_messages WHERE thread_id = ? AND role = 'user' ORDER BY id ASC LIMIT 1", [thread_id]
                ).fetchone()
                if user_msg:
                    topic = user_msg["content"].strip().split("\n")[0]
                    if len(topic) > 20:
                        topic = topic[:20] + "..."
                    conn.execute("UPDATE chat_threads SET title = ? WHERE id = ?", [topic, thread_id])
        conn.commit()
    finally:
        conn.close()


def _read_chat_log(emp_id: str, thread_id: str = "default") -> list[dict]:
    conn = _get_db()
    try:
        rows = conn.execute(
            "SELECT role, content, created_at as timestamp FROM chat_messages WHERE thread_id = ? AND emp_id = ? ORDER BY id ASC",
            [thread_id, emp_id]
        ).fetchall()
        return [{"role": r["role"], "content": r["content"], "timestamp": r["timestamp"]} for r in rows]
    finally:
        conn.close()


# ============================================
# User Profile — AIが学ぶユーザー情報
# ============================================

_profile_update_lock = False
_profile_update_count = 0


async def _update_user_profile(user_msg: str, assistant_reply: str):
    """会話からユーザー情報を抽出してプロファイル更新（5回に1回実行）"""
    global _profile_update_lock, _profile_update_count
    _profile_update_count += 1
    if _profile_update_count % 5 != 0:
        return
    if _profile_update_lock:
        return
    _profile_update_lock = True

    try:
        # 既存プロファイル取得
        conn = _get_db()
        try:
            rows = conn.execute("SELECT id, data FROM data_store WHERE collection = 'user_profile' LIMIT 1").fetchall()
            existing = json.loads(rows[0]["data"]) if rows else {}
            profile_id = rows[0]["id"] if rows else "profile-main"
        finally:
            conn.close()

        existing_text = json.dumps(existing, ensure_ascii=False) if existing else "{}"

        extract_prompt = f"""以下の会話からユーザーの傾向・好み・属性を抽出してください。

既存プロファイル:
{existing_text}

ユーザーの発言: {user_msg[:300]}
AIの応答: {assistant_reply[:300]}

ルール:
- 既存プロファイルとマージ（新情報だけ追加・更新）
- 変更がなければそのまま返す
- 推測は控えめに。明確な情報のみ
- learningsは最新5件まで

JSON形式のみ出力:
```json
{{
  "industry": "業種",
  "role": "役職",
  "style": "コミュニケーションスタイル",
  "interests": ["関心事"],
  "preferences": ["好み"],
  "dislikes": ["嫌いなこと"],
  "workPattern": "業務パターン",
  "learnings": [{{"date":"YYYY-MM-DD","insight":"学んだこと"}}]
}}
```"""

        proc = await asyncio.create_subprocess_exec(
            "claude", "--dangerously-skip-permissions", "-p", extract_prompt, "--max-turns", "1",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=20)
        output = stdout.decode().strip()

        match = re.search(r'```json\s*(\{.*?\})\s*```', output, re.DOTALL)
        if not match:
            match = re.search(r'\{.*\}', output, re.DOTALL)
        if match:
            new_profile = json.loads(match.group(1) if '```' in output else match.group(0))
            # 既存とマージ
            merged = {**existing, **{k: v for k, v in new_profile.items() if v}}
            # learnings はマージ（重複排除、最新5件）
            old_learnings = existing.get("learnings", [])
            new_learnings = new_profile.get("learnings", [])
            if new_learnings:
                all_learnings = old_learnings + new_learnings
                seen = set()
                unique = []
                for l in all_learnings:
                    key = l.get("insight", "")
                    if key not in seen:
                        seen.add(key)
                        unique.append(l)
                merged["learnings"] = unique[-5:]

            conn = _get_db()
            try:
                conn.execute(
                    "INSERT OR REPLACE INTO data_store (id, collection, data, updated_at) VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%S','now','localtime'))",
                    [profile_id, "user_profile", json.dumps(merged, ensure_ascii=False)]
                )
                conn.commit()
            finally:
                conn.close()
    except Exception as e:
        print(f"[profile] Update error: {e}")
    finally:
        _profile_update_lock = False


# ============================================
# Endpoints
# ============================================


@router.get("/employee/{emp_id}/threads")
async def list_threads(emp_id: str):
    threads = _get_threads(emp_id)
    if not threads:
        thread = _create_thread(emp_id, "General")
        threads = [thread]
    return {"threads": threads}


@router.post("/employee/{emp_id}/threads")
async def create_thread_endpoint(emp_id: str, payload: dict = {}):
    title = payload.get("title", "")
    thread = _create_thread(emp_id, title)
    return thread


@router.get("/employee/{emp_id}/chat/history")
async def employee_chat_history(emp_id: str, thread_id: str = "default"):
    return _read_chat_log(emp_id, thread_id)


@router.post("/employee/{emp_id}/chat/stream")
async def employee_chat_stream(emp_id: str, payload: dict):
    """社員別ストリーミングチャット — Agent SDK wrapper 経由"""
    message = payload.get("message", "")
    thread_id = payload.get("threadId", "default")
    if not message:
        return {"error": "message is required"}

    employees = load_employees()
    emp = employees.get(emp_id)
    if not emp:
        return {"error": f"Employee {emp_id} not found"}

    session_id = emp.get("sessionId")
    workdir = _get_employee_workdir(emp)
    _ensure_mcp_symlink(workdir)

    # R2からローカルに同期（エージェント作業前）
    _r2_sync_to_local(emp_id, workdir)

    # ユーザーメッセージをログに記録
    _append_chat_log(emp_id, "user", message, thread_id)

    # システムプロンプト構築（毎回履歴を注入）
    system_prompt = _build_employee_system_prompt(emp)
    # チャット履歴を注入（直近50件）
    history = _read_chat_log(emp_id, thread_id)
    if history:
        recent = history[-50:]
        history_lines = []
        for entry in recent:
            role = entry.get("role", "")
            content = entry.get("content", "")[:200]
            if role and content:
                history_lines.append(f"{role}: {content}")
        if history_lines:
            system_prompt += "\n\n# これまでの会話履歴\n以下はこれまでの会話の要約です。この内容を踏まえて会話を続けてください。\n\n"
            system_prompt += "\n".join(history_lines)

    # SDK wrapper への入力
    sdk_input = json.dumps({
        "message": message,
        "sessionId": session_id,
        "systemPrompt": system_prompt,
        "allowedTools": emp.get("allowedTools", []),
        "cwd": workdir,
    }, ensure_ascii=False)

    async def generate():
        assistant_text_chunks: list[str] = []

        proc = await asyncio.create_subprocess_exec(
            "node", "/app/app/claude-agent.mjs",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        # 入力を送信して stdin を閉じる
        proc.stdin.write((sdk_input + "\n").encode())
        await proc.stdin.drain()
        proc.stdin.write_eof()

        new_session_id = None
        try:
            async for line in proc.stdout:
                text = line.decode().strip()
                if not text:
                    continue
                try:
                    event = json.loads(text)
                    etype = event.get("type", "")

                    if etype == "text":
                        chunk = event.get("content", "")
                        assistant_text_chunks.append(chunk)
                        yield f"data: {json.dumps({'text': chunk})}\n\n"

                    elif etype == "tool_use":
                        yield f"data: {json.dumps({'type': 'tool_use', 'toolName': event.get('toolName', ''), 'toolInput': event.get('toolInput', {}), 'toolUseId': event.get('toolUseId', '')})}\n\n"

                    elif etype == "tool_result":
                        yield f"data: {json.dumps({'type': 'tool_result', 'toolUseId': event.get('toolUseId', ''), 'output': event.get('output', ''), 'isError': event.get('isError', False)})}\n\n"

                    elif etype == "result":
                        sid = event.get("sessionId")
                        if sid:
                            new_session_id = sid

                    elif etype == "error":
                        yield f"data: {json.dumps({'error': event.get('message', '')})}\n\n"

                    elif etype == "done":
                        break

                except json.JSONDecodeError:
                    pass

            await proc.wait()

            # セッションIDを保存
            if new_session_id and new_session_id != session_id:
                employees = load_employees()
                if emp_id in employees:
                    employees[emp_id]["sessionId"] = new_session_id
                    save_employees(employees)

        except asyncio.CancelledError:
            proc.kill()
            raise
        finally:
            full_reply = "".join(assistant_text_chunks)
            if full_reply.strip():
                _append_chat_log(emp_id, "assistant", full_reply, thread_id)
            # R2にローカル変更を同期（エージェント作業後）
            _r2_sync_from_local(emp_id, workdir)
            # バックグラウンドでユーザープロファイル更新
            if full_reply.strip() and message:
                asyncio.ensure_future(_update_user_profile(message, full_reply))
            yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/employee/{emp_id}/chat/sync")
async def employee_chat_sync(emp_id: str, payload: dict):
    """社員チャット同期版 — LINE等の外部連携用。社員キャラで一時エージェント起動"""
    message = payload.get("message", "")
    if not message:
        return {"error": "message is required"}

    employees = load_employees()
    emp = employees.get(emp_id)
    if not emp:
        return {"error": f"Employee {emp_id} not found"}

    workdir = _get_employee_workdir(emp)

    # ユーザーメッセージをログに記録
    _append_chat_log(emp_id, "user", message)

    # システムプロンプト構築
    system_prompt = _build_employee_system_prompt(emp)
    system_prompt += f"\nLINE経由。3〜5文で簡潔に返信。権限制限なし。今日={_time.strftime('%Y-%m-%d')}\n"

    # チャット履歴注入（SQLite）
    history = _read_chat_log(emp_id, "default")
    if history:
        recent = history[-50:]
        history_lines = []
        for entry in recent:
            role = entry.get("role", "")
            content = entry.get("content", "")[:200]
            if role and content:
                history_lines.append(f"{role}: {content}")
        if history_lines:
            system_prompt += "\n# これまでの会話履歴\n" + "\n".join(history_lines)

    try:
        # 社員キャラで一時エージェント起動（claude -p --system-prompt）
        proc = await asyncio.create_subprocess_exec(
            "claude", "--dangerously-skip-permissions",
            "-p", message,
            "--system-prompt", system_prompt,
            "--max-turns", "30",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=workdir,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
        reply = stdout.decode().strip()

        if not reply:
            reply = "すみません、処理中にエラーが発生しました。"

        _append_chat_log(emp_id, "assistant", reply)
        return {"response": reply}

    except asyncio.TimeoutError:
        return {"error": "Timeout", "response": "すみません、処理がタイムアウトしました。"}
    except Exception as e:
        return {"error": str(e), "response": "すみません、処理中にエラーが発生しました。"}


@router.post("/employee/{emp_id}/permission")
async def employee_permission(emp_id: str, payload: dict):
    """許可されたツールパターンを社員設定に保存して次回から自動許可"""
    action = payload.get("action", "deny")
    patterns = payload.get("patterns", [])

    if action == "allow" and patterns:
        employees = load_employees()
        if emp_id in employees:
            existing = employees[emp_id].get("allowedTools", [])
            employees[emp_id]["allowedTools"] = list(set(existing + patterns))
            save_employees(employees)
            return {"status": "saved", "allowedTools": employees[emp_id]["allowedTools"]}

    return {"status": "ok", "action": action}


@router.post("/employee/{emp_id}/reset")
async def employee_reset_session(emp_id: str):
    """社員のセッションをリセット（会話履歴を忘れる）"""
    employees = load_employees()
    if emp_id not in employees:
        return {"error": "Not found"}
    employees[emp_id]["sessionId"] = None
    save_employees(employees)
    return {"status": "session_reset"}
