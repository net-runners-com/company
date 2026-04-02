"""Agent execution endpoint — runs claude CLI tasks on behalf of back service."""

import asyncio
import time as _time

from fastapi import APIRouter

import app.back_client as back
from app.employee import (
    load_employees, _get_employee_workdir, _build_employee_system_prompt,
)
from app.r2 import _r2_sync_to_local, _r2_sync_from_local
from app.routes.chat import _create_thread, _append_chat_log

router = APIRouter()


@router.post("/agent/run")
async def run_agent(payload: dict):
    """汎用エージェント実行。backから呼ばれる。

    payload:
      empId: str — 社員ID
      task: str — タスク内容
      threadTitle: str — チャットスレッドタイトル (optional)
      maxTurns: int — 最大ターン数 (default 15)
      timeout: int — タイムアウト秒 (default 180)
      systemPromptExtra: str — 追加プロンプト (optional)
    """
    emp_id = payload.get("empId", "")
    task = payload.get("task", "")
    if not emp_id or not task:
        return {"error": "empId and task are required"}

    employees = load_employees()
    emp = employees.get(emp_id)
    if not emp:
        return {"error": f"Employee {emp_id} not found"}

    max_turns = str(payload.get("maxTurns", 15))
    timeout = payload.get("timeout", 180)
    thread_title = payload.get("threadTitle", f"タスク: {task[:20]}...")

    # Create thread and log
    thread = _create_thread(emp_id, thread_title)
    _append_chat_log(emp_id, "user", task, thread["id"])

    # Build prompt
    workdir = _get_employee_workdir(emp)
    system_prompt = _build_employee_system_prompt(emp)
    extra = payload.get("systemPromptExtra", "")
    if extra:
        system_prompt += f"\n{extra}\n"
    system_prompt += f"\n今日は{_time.strftime('%Y-%m-%d')}です。\n"

    # Execute
    try:
        _r2_sync_to_local(emp_id, workdir)
        proc = await asyncio.create_subprocess_exec(
            "claude", "--dangerously-skip-permissions", "-p", task,
            "--system-prompt", system_prompt, "--max-turns", max_turns,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, cwd=workdir,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        reply = stdout.decode().strip()
        _r2_sync_from_local(emp_id, workdir)

        if reply:
            _append_chat_log(emp_id, "assistant", reply, thread["id"])

        return {
            "status": "done",
            "threadId": thread["id"],
            "reply": reply[:500],
        }
    except asyncio.TimeoutError:
        _append_chat_log(emp_id, "assistant", f"タイムアウト（{timeout}秒）", thread["id"])
        return {"status": "error", "error": f"Timeout ({timeout}s)", "threadId": thread["id"]}
    except Exception as e:
        _append_chat_log(emp_id, "assistant", f"エラー: {e}", thread["id"])
        return {"status": "error", "error": str(e), "threadId": thread["id"]}
