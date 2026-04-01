"""Projects, pipeline, directive."""

import asyncio
import json
import re
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

    # 社員一覧を構築
    roster = "\n".join(
        f"- {eid}: {emp.get('name')} ({emp.get('role')}, {emp.get('department')}) [{', '.join(emp.get('skills', []))}]"
        for eid, emp in employees.items()
    )

    # 秘書（プランナー）に計画分解させる
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

    # JSONパース
    match = re.search(r'```json\s*(\[.*?\])\s*```', plan_text, re.DOTALL)
    if not match:
        match = re.search(r'\[.*\]', plan_text, re.DOTALL)
    if not match:
        return {"error": "Could not parse plan", "raw": plan_text[:500]}

    try:
        tasks = json.loads(match.group(1) if '```' in plan_text else match.group(0))
    except json.JSONDecodeError:
        return {"error": "Invalid JSON in plan", "raw": plan_text[:500]}

    # 各エージェントに並列実行
    results = []
    for task_item in tasks:
        emp_id = task_item.get("empId", "")
        task_msg = task_item.get("task", "")
        emp = employees.get(emp_id)
        if not emp or not task_msg:
            results.append({"empId": emp_id, "status": "skipped", "reason": "not found"})
            continue

        # チャットスレッド作成
        thread = _create_thread(emp_id, f"指示: {directive[:20]}...")

        # 同期チャットで実行
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

    # プロジェクトをSQLiteに保存
    project_id = str(uuid.uuid4())[:8]
    project = {
        "id": project_id,
        "brief": brief,
        "steps": steps,
        "status": "active",
        "createdAt": _time.strftime("%Y-%m-%dT%H:%M:%S"),
    }

    # 各ステップにstatus追加
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
    """プロジェクト一覧"""
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
    """プロジェクト詳細"""
    conn = _get_db()
    try:
        row = conn.execute(
            "SELECT data FROM data_store WHERE collection = 'projects' AND id = ?", [project_id]
        ).fetchone()
        if not row:
            return {"error": "Not found"}
        return json.loads(row["data"])
    finally:
        conn.close()


@router.post("/projects/{project_id}/execute/{step_num}")
async def execute_project_step(project_id: str, step_num: int):
    """プロジェクトの指定ステップを実行"""
    conn = _get_db()
    try:
        row = conn.execute(
            "SELECT data FROM data_store WHERE collection = 'projects' AND id = ?", [project_id]
        ).fetchone()
        if not row:
            return {"error": "Project not found"}
        project = json.loads(row["data"])
    finally:
        conn.close()

    steps = project.get("steps", [])
    step = next((s for s in steps if s.get("step") == step_num), None)
    if not step:
        return {"error": f"Step {step_num} not found"}

    emp_id = step.get("empId", "")
    employees = load_employees()
    emp = employees.get(emp_id)
    if not emp:
        step["status"] = "error"
        step["result"] = "社員が見つかりません"
        _save_project(project_id, project)
        return {"error": "Employee not found", "step": step}

    step["status"] = "running"
    _save_project(project_id, project)

    # 社員のタスク一覧に追加
    task_id = f"{project_id}-{step_num}"
    conn = _get_db()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO data_store (id, collection, data) VALUES (?, ?, ?)",
            [task_id, f"tasks_{emp_id}", json.dumps({
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

    task_msg = f"""プロジェクト: {project.get('brief', '')}

あなたの担当工程: {step.get('title', '')}
作業内容: {step.get('description', '')}

結果は作業フォルダにmdファイルとして保存してください。"""

    workdir = _get_employee_workdir(emp)
    system_prompt = _build_employee_system_prompt(emp)
    system_prompt += f"\n# プロジェクト作業\n今日は{_time.strftime('%Y-%m-%d')}です。\n"

    thread = _create_thread(emp_id, f"案件: {project.get('brief', '')[:20]}...")
    _append_chat_log(emp_id, "user", task_msg, thread["id"])

    try:
        _r2_sync_to_local(emp_id, workdir)
        proc = await asyncio.create_subprocess_exec(
            "claude", "--dangerously-skip-permissions", "-p", task_msg,
            "--system-prompt", system_prompt, "--max-turns", "15",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, cwd=workdir,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=180)
        reply = stdout.decode().strip()
        _r2_sync_from_local(emp_id, workdir)

        if reply:
            _append_chat_log(emp_id, "assistant", reply, thread["id"])
        step["status"] = "done"
        step["result"] = reply[:300]
        step["threadId"] = thread["id"]
    except Exception as e:
        step["status"] = "error"
        step["result"] = str(e)

    # タスクステータス更新
    conn = _get_db()
    try:
        existing = conn.execute("SELECT data FROM data_store WHERE id = ? AND collection = ?", [task_id, f"tasks_{emp_id}"]).fetchone()
        if existing:
            task_data = json.loads(existing["data"])
            task_data["status"] = "done" if step["status"] == "done" else "error"
            task_data["completedAt"] = _time.strftime("%Y-%m-%dT%H:%M:%S")
            task_data["result"] = step.get("result", "")[:200]
            conn.execute("UPDATE data_store SET data = ? WHERE id = ? AND collection = ?",
                [json.dumps(task_data, ensure_ascii=False), task_id, f"tasks_{emp_id}"])
            conn.commit()
    finally:
        conn.close()

    _save_project(project_id, project)
    return {"step": step, "project": project}
