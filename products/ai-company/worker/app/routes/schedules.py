"""APScheduler — scheduled task management."""

import asyncio
import importlib
import json
import uuid
import time as _time

from fastapi import APIRouter, Request
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

import app.back_client as back
from app.employee import (
    load_employees, _get_employee_workdir, _build_employee_system_prompt,
)
from app.r2 import _r2_sync_to_local, _r2_sync_from_local
from app.routes.chat import _create_thread, _append_chat_log

router = APIRouter()

_scheduler = AsyncIOScheduler(timezone="Asia/Tokyo")

# システムジョブ: handler は "module:function" 形式
# 起動時にDBになければ自動シード
SYSTEM_JOBS = [
    {"id": "news_auto_update", "name": "ニュース自動更新", "cron": "0 7 * * *", "type": "system", "handler": "app.routes.news:_fetch_news"},
]


def _run_scheduled_task(schedule_id: str, emp_id: str, task: str, name: str):
    """スケジュールされたタスクを実行（同期ラッパー）"""

    async def _exec():
        employees = load_employees()
        emp = employees.get(emp_id)
        if not emp:
            print(f"[scheduler] Employee {emp_id} not found for schedule {schedule_id}")
            return

        thread = _create_thread(emp_id, f"定期: {name}")
        _append_chat_log(emp_id, "user", f"[定期実行] {task}", thread["id"])

        workdir = _get_employee_workdir(emp)
        system_prompt = _build_employee_system_prompt(emp)
        system_prompt += f"\n# 定期実行タスク\nこれはスケジュールされた自動実行です。今日は{_time.strftime('%Y-%m-%d')}です。\n"

        try:
            _r2_sync_to_local(emp_id, workdir)
            proc = await asyncio.create_subprocess_exec(
                "claude", "--dangerously-skip-permissions", "-p", task,
                "--system-prompt", system_prompt, "--max-turns", "15",
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, cwd=workdir,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=180)
            reply = stdout.decode().strip()
            _r2_sync_from_local(emp_id, workdir)
            if reply:
                _append_chat_log(emp_id, "assistant", reply, thread["id"])
            print(f"[scheduler] Done: {name} ({emp_id})")
        except Exception as e:
            print(f"[scheduler] Error: {name} — {e}")
            _append_chat_log(emp_id, "assistant", f"定期実行エラー: {e}", thread["id"])

    loop = asyncio.get_event_loop()
    if loop.is_running():
        asyncio.ensure_future(_exec())
    else:
        loop.run_until_complete(_exec())


def _run_system_job(handler_path: str, name: str):
    """システムジョブを実行（handler_path = "module:function"）"""
    try:
        mod_path, func_name = handler_path.rsplit(":", 1)
        mod = importlib.import_module(mod_path)
        func = getattr(mod, func_name)
        result = func()
        if asyncio.iscoroutine(result):
            asyncio.ensure_future(result)
        print(f"[scheduler] System job done: {name}")
    except Exception as e:
        print(f"[scheduler] System job error: {name} — {e}")


def _register_job(sched_id: str, sched: dict):
    """1件のスケジュールをAPSchedulerに登録"""
    cron = sched.get("cron", "")
    name = sched.get("name", "")
    job_type = sched.get("type", "employee")

    if not cron:
        return

    try:
        parts = cron.split()
        trigger = CronTrigger(
            minute=parts[0] if len(parts) > 0 else "*",
            hour=parts[1] if len(parts) > 1 else "*",
            day=parts[2] if len(parts) > 2 else "*",
            month=parts[3] if len(parts) > 3 else "*",
            day_of_week=parts[4] if len(parts) > 4 else "*",
            timezone="Asia/Tokyo",
        )

        if job_type == "system":
            handler = sched.get("handler", "")
            if not handler:
                return
            _scheduler.add_job(
                _run_system_job,
                trigger=trigger,
                id=f"sched_{sched_id}",
                args=[handler, name],
                replace_existing=True,
            )
        else:
            emp_id = sched.get("empId", "")
            task = sched.get("task", "")
            if not emp_id or not task:
                return
            _scheduler.add_job(
                _run_scheduled_task,
                trigger=trigger,
                id=f"sched_{sched_id}",
                args=[sched_id, emp_id, task, name],
                replace_existing=True,
            )

        print(f"[scheduler] Registered: {name} ({cron}) [{job_type}]")
    except Exception as e:
        print(f"[scheduler] Failed to register {name}: {e}")


def _seed_system_jobs():
    """システムジョブがDBになければシード"""
    for job in SYSTEM_JOBS:
        existing = back.get_data("schedules", job["id"])
        if not existing:
            back.save_data("schedules", job["id"], job)
            print(f"[scheduler] Seeded system job: {job['name']}")


def _load_schedules_to_scheduler():
    """Back APIからスケジュールを読み込んでAPSchedulerに登録"""
    _seed_system_jobs()

    rows = back.list_data("schedules")

    # 既存ジョブをクリア（sched_プレフィックスのもの）
    for job in _scheduler.get_jobs():
        if job.id.startswith("sched_"):
            _scheduler.remove_job(job.id)

    for sched in rows:
        sid = sched.pop("_id", None) or sched.get("id", "")
        _register_job(sid, sched)


@router.post("/schedules")
async def create_schedule(request: Request):
    """定期実行スケジュールを登録（社員タスク or システムジョブ）"""
    body = await request.json()
    name = body.get("name", "")
    cron = body.get("cron", "")
    job_type = body.get("type", "employee")
    sched_id = body.get("id", str(uuid.uuid4())[:8])

    if job_type == "system":
        handler = body.get("handler", "")
        if not cron or not handler:
            return {"error": "cron and handler are required for system jobs"}
        data = {"name": name, "cron": cron, "type": "system", "handler": handler}
    else:
        emp_id = body.get("empId", "")
        task = body.get("task", "")
        if not cron or not emp_id or not task:
            return {"error": "cron, empId, task are required"}
        data = {"name": name, "cron": cron, "empId": emp_id, "task": task}

    back.save_data("schedules", sched_id, data)
    _register_job(sched_id, data)
    return {"id": sched_id, "name": name, "cron": cron, "type": job_type, "status": "registered"}


@router.get("/schedules")
async def list_schedules():
    """スケジュール一覧"""
    entries = back.list_data("schedules")
    for s in entries:
        sid = s.get("_id", "")
        job = _scheduler.get_job(f"sched_{sid}")
        s["nextRun"] = str(job.next_run_time) if job and job.next_run_time else None
    return {"schedules": entries}


@router.delete("/schedules/{sched_id}")
async def delete_schedule(sched_id: str):
    """スケジュール削除"""
    back.delete_data("schedules", sched_id)
    try:
        _scheduler.remove_job(f"sched_{sched_id}")
    except Exception:
        pass
    return {"status": "deleted", "id": sched_id}
