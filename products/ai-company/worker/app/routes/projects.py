"""Projects, pipeline, directive — background execution with cancellation."""

import asyncio
import json
import os
import re
import signal
import uuid
import time as _time

from fastapi import APIRouter, Request

from app.db import _get_db
from app.employee import (
    load_employees, _get_employee_workdir, _build_employee_system_prompt,
)
from app.r2 import _r2_sync_to_local, _r2_sync_from_local
from app.routes.chat import _create_thread, _append_chat_log

router = APIRouter()

_HEAVY_KEYWORDS = ["実装", "開発", "コーディング", "制作", "構築", "デザイン"]
_STEP_TIMEOUT = int(os.environ.get("STEP_TIMEOUT", 600))

# --- Running task registry (for cancellation) ---
# key: "project_id-step_num", value: asyncio.Task
_running_tasks: dict[str, asyncio.Task] = {}
# subprocess references for kill
_running_procs: dict[str, list[asyncio.subprocess.Process]] = {}


def _save_project(project_id: str, project: dict):
    conn = _get_db()
    try:
        conn.execute(
            "UPDATE data_store SET data = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%S','now','localtime') WHERE id = ? AND collection = 'projects'",
            [json.dumps(project, ensure_ascii=False), project_id]
        )
        conn.commit()
    finally:
        conn.close()


def _load_project(project_id: str) -> dict | None:
    conn = _get_db()
    try:
        row = conn.execute(
            "SELECT data FROM data_store WHERE collection = 'projects' AND id = ?", [project_id]
        ).fetchone()
        return json.loads(row["data"]) if row else None
    finally:
        conn.close()


# ─── Directive ───

@router.post("/directive")
async def execute_directive(request: Request):
    """全体への指示を受け、秘書が計画分解 → 各エージェントに振り分け"""
    body = await request.json()
    directive = body.get("directive", "")
    if not directive:
        return {"error": "directive is required"}

    employees = load_employees()
    if not employees:
        return {"error": "No employees registered"}

    roster = "\n".join(
        f"- {eid}: {emp.get('name')} ({emp.get('role')}, {emp.get('department')}) [{', '.join(emp.get('skills', []))}]"
        for eid, emp in employees.items()
    )

    plan_prompt = f"""あなたはプロジェクトプランナーです。オーナーからの指示を分析し、各社員に具体的なタスクを割り振ってください。

## 社員一覧
{roster}

## オーナーの指示
{directive}

## 出力形式
以下のJSON配列のみ出力してください。他の文字は不要です。
```json
[
  {{"empId": "emp-1", "task": "具体的な指示内容"}},
  {{"empId": "emp-6", "task": "具体的な指示内容"}}
]
```

ルール:
- 各社員の専門性に合ったタスクを割り振る
- 全員に割り振る必要はない。必要な社員だけ
- タスクは具体的に。何を調べ、何を作り、何をまとめるか明記
- 指示には「作業フォルダに結果をmdファイルで保存すること」を含める"""

    try:
        proc = await asyncio.create_subprocess_exec(
            "claude", "--dangerously-skip-permissions", "-p", plan_prompt, "--max-turns", "1",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
        plan_text = stdout.decode().strip()
    except Exception as e:
        return {"error": f"Planning failed: {e}"}

    match = re.search(r'```json\s*(\[.*?\])\s*```', plan_text, re.DOTALL)
    if not match:
        match = re.search(r'\[.*\]', plan_text, re.DOTALL)
    if not match:
        return {"error": "Could not parse plan", "raw": plan_text[:500]}

    try:
        tasks = json.loads(match.group(1) if '```' in plan_text else match.group(0))
    except json.JSONDecodeError:
        return {"error": "Invalid JSON in plan", "raw": plan_text[:500]}

    results = []
    for task_item in tasks:
        emp_id = task_item.get("empId", "")
        task_msg = task_item.get("task", "")
        emp = employees.get(emp_id)
        if not emp or not task_msg:
            results.append({"empId": emp_id, "status": "skipped", "reason": "not found"})
            continue

        thread = _create_thread(emp_id, f"指示: {directive[:20]}...")
        workdir = _get_employee_workdir(emp)
        system_prompt = _build_employee_system_prompt(emp)
        system_prompt += f"\n# 指示\nオーナーからの全体指示に基づくタスクです。結果は作業フォルダにmdファイルで保存してください。\n今日は{_time.strftime('%Y-%m-%d')}です。\n"
        _append_chat_log(emp_id, "user", task_msg, thread["id"])

        try:
            proc = await asyncio.create_subprocess_exec(
                "claude", "--dangerously-skip-permissions", "-p", task_msg,
                "--system-prompt", system_prompt, "--max-turns", "20",
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, cwd=workdir,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=120)
            reply = stdout.decode().strip()
            if reply:
                _append_chat_log(emp_id, "assistant", reply, thread["id"])
            _r2_sync_from_local(emp_id, workdir)
            results.append({
                "empId": emp_id, "empName": emp.get("name"), "task": task_msg,
                "status": "done", "reply": reply[:200], "threadId": thread["id"],
            })
        except Exception as e:
            results.append({"empId": emp_id, "empName": emp.get("name"), "task": task_msg, "status": "error", "error": str(e)})

    return {"directive": directive, "plan": tasks, "results": results}


# ─── Project CRUD ───

@router.post("/projects")
async def create_project(request: Request):
    """案件からパイプラインを自動生成"""
    body = await request.json()
    brief = body.get("brief", "")
    if not brief:
        return {"error": "brief is required"}

    employees = load_employees()
    roster = "\n".join(f"- {eid}: {emp.get('name')} ({emp.get('role')}, {emp.get('department')})" for eid, emp in employees.items())

    plan_prompt = f"""あなたはプロジェクトマネージャーです。案件概要からプロジェクトのパイプライン（工程一覧）を作成してください。

## 社員一覧
{roster}

## 案件概要
{brief}

## 出力形式
以下のJSON配列のみ出力。他の文字は不要。
```json
[
  {{"step": 1, "title": "工程名", "empId": "emp-X", "description": "具体的な作業内容。成果物のファイル名も指定。"}},
  {{"step": 2, "title": "工程名", "empId": "emp-X", "description": "具体的な作業内容"}}
]
```

ルール:
- 見積書→要件定義→設計→実装→テスト→報告書→納品書→メール下書き のような流れで
- 各工程に最適な社員を割り当て
- description は具体的に（何を作り、どこに保存するか）
- 成果物はmdファイルで作業フォルダに保存するよう指示
- 案件の規模に合わせて工程数を調整（小規模なら5-8工程、大規模なら10-15工程）"""

    try:
        proc = await asyncio.create_subprocess_exec(
            "claude", "--dangerously-skip-permissions", "-p", plan_prompt, "--max-turns", "1",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
        plan_text = stdout.decode().strip()
    except Exception as e:
        return {"error": f"Planning failed: {e}"}

    match = re.search(r'```json\s*(\[.*?\])\s*```', plan_text, re.DOTALL)
    if not match:
        match = re.search(r'\[.*\]', plan_text, re.DOTALL)
    if not match:
        return {"error": "Could not parse pipeline", "raw": plan_text[:500]}

    try:
        steps = json.loads(match.group(1) if '```' in plan_text else match.group(0))
    except json.JSONDecodeError:
        return {"error": "Invalid JSON", "raw": plan_text[:500]}

    project_id = str(uuid.uuid4())[:8]
    project = {
        "id": project_id,
        "brief": brief,
        "steps": steps,
        "status": "active",
        "createdAt": _time.strftime("%Y-%m-%dT%H:%M:%S"),
    }

    for s in project["steps"]:
        s["status"] = "pending"
        s["result"] = ""
        emp = employees.get(s.get("empId", ""))
        s["empName"] = emp.get("name", "") if emp else ""

    conn = _get_db()
    try:
        conn.execute(
            "INSERT INTO data_store (id, collection, data) VALUES (?, ?, ?)",
            [project_id, "projects", json.dumps(project, ensure_ascii=False)]
        )
        conn.commit()
    finally:
        conn.close()

    return project


@router.get("/projects")
async def list_projects():
    conn = _get_db()
    try:
        rows = conn.execute(
            "SELECT id, data, created_at FROM data_store WHERE collection = 'projects' ORDER BY created_at DESC"
        ).fetchall()
        return {"projects": [json.loads(r["data"]) for r in rows]}
    finally:
        conn.close()


@router.get("/projects/{project_id}")
async def get_project(project_id: str):
    project = _load_project(project_id)
    if not project:
        return {"error": "Not found"}
    return project


# ─── Agent helpers ───

def _is_heavy_step(step: dict) -> bool:
    text = (step.get("title", "") + step.get("description", "")).lower()
    return any(kw in text for kw in _HEAVY_KEYWORDS)


async def _run_single_agent(task_msg: str, system_prompt: str, workdir: str, max_turns: str = "15", task_key: str = "") -> tuple[str, str]:
    """単一エージェント実行。task_key があればプロセスを登録（cancel用）"""
    proc = await asyncio.create_subprocess_exec(
        "claude", "--dangerously-skip-permissions", "-p", task_msg,
        "--system-prompt", system_prompt, "--max-turns", max_turns,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, cwd=workdir,
    )
    if task_key:
        _running_procs.setdefault(task_key, []).append(proc)
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=_STEP_TIMEOUT)
        return stdout.decode().strip(), stderr.decode().strip() if stderr else ""
    finally:
        if task_key and task_key in _running_procs:
            try:
                _running_procs[task_key].remove(proc)
            except ValueError:
                pass


async def _split_and_run_parallel(step: dict, project: dict, emp: dict, emp_id: str, workdir: str, system_prompt: str, task_key: str = "") -> str:
    employees = load_employees()
    roster = "\n".join(f"- {eid}: {e.get('name')} ({e.get('role')})" for eid, e in employees.items())

    split_prompt = f"""あなたはタスク分割の専門家です。以下の工程を2〜4個の並列実行可能なサブタスクに分解してください。

## 工程
タイトル: {step.get('title', '')}
内容: {step.get('description', '')}
プロジェクト: {project.get('brief', '')}

## 社員一覧
{roster}

## 出力形式（JSON配列のみ）
```json
[
  {{"subtask": "具体的なサブタスク内容", "empId": "{emp_id}"}},
  {{"subtask": "具体的なサブタスク内容", "empId": "emp-XXX"}}
]
```

ルール:
- 各サブタスクは独立して並列実行可能であること
- メイン担当({emp_id})には中核作業を割り当て
- 他の社員には補助的な作業（調査・素材準備・レビュー等）を割り当て可
- 全成果物はmdファイルで保存するよう指示に含める"""

    try:
        stdout, _ = await _run_single_agent(split_prompt, "タスク分割エージェント", workdir, "1", task_key)
    except Exception:
        return ""

    match = re.search(r'```json\s*(\[.*?\])\s*```', stdout, re.DOTALL)
    if not match:
        match = re.search(r'\[.*\]', stdout, re.DOTALL)
    if not match:
        return ""

    try:
        subtasks = json.loads(match.group(1) if '```' in stdout else match.group(0))
    except json.JSONDecodeError:
        return ""

    if len(subtasks) < 2:
        return ""

    print(f"[project] Heavy step split into {len(subtasks)} parallel subtasks")

    async def _exec_subtask(st: dict) -> str:
        st_emp_id = st.get("empId", emp_id)
        st_emp = employees.get(st_emp_id, emp)
        st_workdir = _get_employee_workdir(st_emp)
        st_sys = _build_employee_system_prompt(st_emp)
        st_sys += f"\n# プロジェクト作業（サブタスク）\n今日は{_time.strftime('%Y-%m-%d')}です。\n"

        msg = f"""プロジェクト: {project.get('brief', '')}
工程: {step.get('title', '')}

あなたの担当サブタスク: {st.get('subtask', '')}

結果は作業フォルダにmdファイルとして保存してください。"""

        try:
            _r2_sync_to_local(st_emp_id, st_workdir)
            out, _ = await _run_single_agent(msg, st_sys, st_workdir, "15", task_key)
            _r2_sync_from_local(st_emp_id, st_workdir)
            return out
        except Exception as e:
            return f"[エラー] {e}"

    results = await asyncio.gather(*[_exec_subtask(st) for st in subtasks])

    combined = []
    for st, res in zip(subtasks, results):
        st_emp = employees.get(st.get("empId", emp_id), emp)
        combined.append(f"【{st_emp.get('name', '?')}】{st.get('subtask', '')}\n{res[:300]}")

    return "\n\n---\n\n".join(combined)


# ─── Background step execution ───

async def _execute_step_bg(project_id: str, step_num: int):
    """バックグラウンドでステップを実行"""
    task_key = f"{project_id}-{step_num}"
    try:
        project = _load_project(project_id)
        if not project:
            return

        steps = project.get("steps", [])
        step = next((s for s in steps if s.get("step") == step_num), None)
        if not step:
            return

        emp_id = step.get("empId", "")
        employees = load_employees()
        emp = employees.get(emp_id)
        if not emp:
            step["status"] = "error"
            step["result"] = "社員が見つかりません"
            _save_project(project_id, project)
            return

        step["status"] = "running"
        _save_project(project_id, project)

        # タスク追加
        conn = _get_db()
        try:
            conn.execute(
                "INSERT OR REPLACE INTO data_store (id, collection, data) VALUES (?, ?, ?)",
                [task_key, f"tasks_{emp_id}", json.dumps({
                    "title": step.get("title", ""),
                    "project": project.get("brief", ""),
                    "projectId": project_id,
                    "step": step_num,
                    "status": "in_progress",
                    "assignedAt": _time.strftime("%Y-%m-%dT%H:%M:%S"),
                }, ensure_ascii=False)]
            )
            conn.commit()
        finally:
            conn.close()

        workdir = _get_employee_workdir(emp)
        system_prompt = _build_employee_system_prompt(emp)
        system_prompt += f"\n# プロジェクト作業\n今日は{_time.strftime('%Y-%m-%d')}です。\n"

        thread = _create_thread(emp_id, f"案件: {project.get('brief', '')[:20]}...")

        task_msg = f"""プロジェクト: {project.get('brief', '')}

あなたの担当工程: {step.get('title', '')}
作業内容: {step.get('description', '')}

結果は作業フォルダにmdファイルとして保存してください。"""

        _append_chat_log(emp_id, "user", task_msg, thread["id"])

        try:
            is_heavy = _is_heavy_step(step)
            if is_heavy:
                print(f"[project] Step {step_num} detected as heavy — attempting parallel split")
                parallel_result = await _split_and_run_parallel(step, project, emp, emp_id, workdir, system_prompt, task_key)
            else:
                parallel_result = ""

            if parallel_result:
                reply = parallel_result
            else:
                _r2_sync_to_local(emp_id, workdir)
                reply_out, err_out = await _run_single_agent(task_msg, system_prompt, workdir, "15", task_key)
                reply = reply_out
                _r2_sync_from_local(emp_id, workdir)

                if not reply:
                    err_msg = err_out[:200] if err_out else "No output"
                    # re-read project to avoid stale data
                    project = _load_project(project_id) or project
                    step = next((s for s in project.get("steps", []) if s.get("step") == step_num), step)
                    step["status"] = "error"
                    step["result"] = f"エージェント出力なし: {err_msg}"
                    step["threadId"] = thread["id"]
                    _save_project(project_id, project)
                    return

            # re-read to avoid overwriting concurrent changes
            project = _load_project(project_id) or project
            step = next((s for s in project.get("steps", []) if s.get("step") == step_num), step)

            _append_chat_log(emp_id, "assistant", reply, thread["id"])
            step["status"] = "done"
            step["result"] = reply[:300]
            step["threadId"] = thread["id"]

        except asyncio.CancelledError:
            project = _load_project(project_id) or project
            step = next((s for s in project.get("steps", []) if s.get("step") == step_num), step)
            step["status"] = "cancelled"
            step["result"] = "中断されました"
            print(f"[project] Step {step_num} cancelled for {emp_id}")
        except asyncio.TimeoutError:
            project = _load_project(project_id) or project
            step = next((s for s in project.get("steps", []) if s.get("step") == step_num), step)
            step["status"] = "error"
            step["result"] = f"タイムアウト（{_STEP_TIMEOUT // 60}分）"
            print(f"[project] Step {step_num} timed out for {emp_id}")
        except Exception as e:
            project = _load_project(project_id) or project
            step = next((s for s in project.get("steps", []) if s.get("step") == step_num), step)
            step["status"] = "error"
            step["result"] = str(e) or type(e).__name__

        # タスクステータス更新
        final_status = step.get("status", "error")
        conn = _get_db()
        try:
            existing = conn.execute("SELECT data FROM data_store WHERE id = ? AND collection = ?", [task_key, f"tasks_{emp_id}"]).fetchone()
            if existing:
                task_data = json.loads(existing["data"])
                task_data["status"] = "done" if final_status == "done" else ("cancelled" if final_status == "cancelled" else "error")
                task_data["completedAt"] = _time.strftime("%Y-%m-%dT%H:%M:%S")
                task_data["result"] = step.get("result", "")[:200]
                conn.execute("UPDATE data_store SET data = ? WHERE id = ? AND collection = ?",
                    [json.dumps(task_data, ensure_ascii=False), task_key, f"tasks_{emp_id}"])
                conn.commit()
        finally:
            conn.close()

        _save_project(project_id, project)

    finally:
        _running_tasks.pop(task_key, None)
        _running_procs.pop(task_key, None)


# ─── Step Execution (fire-and-forget) ───

@router.post("/projects/{project_id}/execute/{step_num}")
async def execute_project_step(project_id: str, step_num: int):
    """ステップをバックグラウンドで実行開始し、即座にレスポンスを返す"""
    task_key = f"{project_id}-{step_num}"

    # 既に実行中なら拒否
    if task_key in _running_tasks and not _running_tasks[task_key].done():
        return {"status": "already_running", "step": step_num}

    project = _load_project(project_id)
    if not project:
        return {"error": "Project not found"}

    step = next((s for s in project.get("steps", []) if s.get("step") == step_num), None)
    if not step:
        return {"error": f"Step {step_num} not found"}

    emp_id = step.get("empId", "")
    employees = load_employees()
    if emp_id not in employees:
        step["status"] = "error"
        step["result"] = "社員が見つかりません"
        _save_project(project_id, project)
        return {"error": "Employee not found"}

    # バックグラウンドタスクとして起動
    task = asyncio.create_task(_execute_step_bg(project_id, step_num))
    _running_tasks[task_key] = task

    # 即座にrunningを返す
    step["status"] = "running"
    _save_project(project_id, project)
    return {"status": "started", "step": step_num, "projectId": project_id}


# ─── Cancel ───

@router.post("/projects/{project_id}/cancel/{step_num}")
async def cancel_project_step(project_id: str, step_num: int):
    """実行中のステップを中断"""
    task_key = f"{project_id}-{step_num}"

    # サブプロセスをkill
    procs = _running_procs.get(task_key, [])
    for proc in procs:
        try:
            os.kill(proc.pid, signal.SIGTERM)
        except (ProcessLookupError, OSError):
            pass

    # asyncio.Taskをcancel
    task = _running_tasks.get(task_key)
    if task and not task.done():
        task.cancel()
        # cancelが反映されるまで少し待つ
        try:
            await asyncio.wait_for(asyncio.shield(task), timeout=3)
        except (asyncio.CancelledError, asyncio.TimeoutError, Exception):
            pass

    # ステータスを強制更新
    project = _load_project(project_id)
    if project:
        step = next((s for s in project.get("steps", []) if s.get("step") == step_num), None)
        if step and step["status"] == "running":
            step["status"] = "cancelled"
            step["result"] = "中断されました"
            _save_project(project_id, project)

    _running_tasks.pop(task_key, None)
    _running_procs.pop(task_key, None)

    return {"status": "cancelled", "step": step_num}


# ─── Running status ───

@router.get("/projects/{project_id}/status")
async def get_project_status(project_id: str):
    """プロジェクトの最新状態 + 実行中ステップ情報"""
    project = _load_project(project_id)
    if not project:
        return {"error": "Not found"}

    running_steps = []
    for s in project.get("steps", []):
        task_key = f"{project_id}-{s['step']}"
        if task_key in _running_tasks and not _running_tasks[task_key].done():
            running_steps.append(s["step"])

    return {"project": project, "runningSteps": running_steps}
