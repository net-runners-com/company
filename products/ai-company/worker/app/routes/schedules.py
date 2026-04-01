"""APScheduler — scheduled task management."""

import asyncio
import json
import uuid
import time as _time

from fastapi import APIRouter, Request
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.db import _get_db
from app.employee import (
    load_employees, _get_employee_workdir, _build_employee_system_prompt,
)
from app.r2 import _r2_sync_to_local, _r2_sync_from_local
from app.routes.chat import _create_thread, _append_chat_log

router = APIRouter()

_scheduler = AsyncIOScheduler(timezone="Asia/Tokyo")


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


def _load_schedules_to_scheduler():
    """SQLiteからスケジュールを読み込んでAPSchedulerに登録"""
    conn = _get_db()
    try:
        rows = conn.execute("SELECT id, data FROM data_store WHERE collection = 'schedules'").fetchall()
    finally:
        conn.close()

    # 既存ジョブをクリア（schedules_プレフィックスのもの）
    for job in _scheduler.get_jobs():
        if job.id.startswith("sched_"):
            _scheduler.remove_job(job.id)

    for row in rows:
        sched = json.loads(row["data"])
        cron = sched.get("cron", "")
        emp_id = sched.get("empId", "")
        task = sched.get("task", "")
        name = sched.get("name", "")
        sched_id = row["id"]

        if not cron or not emp_id or not task:
            continue

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
            _scheduler.add_job(
                _run_scheduled_task,
                trigger=trigger,
                id=f"sched_{sched_id}",
                args=[sched_id, emp_id, task, name],
                replace_existing=True,
            )
            print(f"[scheduler] Registered: {name} ({cron}) → {emp_id}")
        except Exception as e:
            print(f"[scheduler] Failed to register {name}: {e}")


@router.post("/schedules")
async def create_schedule(request: Request):
    """定期実行スケジュールを登録"""
    body = await request.json()
    name = body.get("name", "")
    cron = body.get("cron", "")
    emp_id = body.get("empId", "")
    task = body.get("task", "")

    if not cron or not emp_id or not task:
        return {"error": "cron, empId, task are required"}

    sched_id = str(uuid.uuid4())[:8]
    conn = _get_db()
    try:
        conn.execute(
            "INSERT INTO data_store (id, collection, data) VALUES (?, ?, ?)",
            [sched_id, "schedules", json.dumps({"name": name, "cron": cron, "empId": emp_id, "task": task}, ensure_ascii=False)]
        )
        conn.commit()
    finally:
        conn.close()

    _load_schedules_to_scheduler()
    return {"id": sched_id, "name": name, "cron": cron, "status": "registered"}


@router.get("/schedules")
async def list_schedules():
    """スケジュール一覧"""
    conn = _get_db()
    try:
        rows = conn.execute("SELECT id, data, created_at FROM data_store WHERE collection = 'schedules' ORDER BY created_at DESC").fetchall()
        schedules = []
        for r in rows:
            s = json.loads(r["data"])
            s["_id"] = r["id"]
            s["_created_at"] = r["created_at"]
            # 次回実行時刻
            job = _scheduler.get_job(f"sched_{r['id']}")
            s["nextRun"] = str(job.next_run_time) if job and job.next_run_time else None
            schedules.append(s)
        return {"schedules": schedules}
    finally:
        conn.close()


@router.delete("/schedules/{sched_id}")
async def delete_schedule(sched_id: str):
    """スケジュール削除"""
    conn = _get_db()
    try:
        conn.execute("DELETE FROM data_store WHERE id = ? AND collection = 'schedules'", [sched_id])
        conn.commit()
    finally:
        conn.close()
    try:
        _scheduler.remove_job(f"sched_{sched_id}")
    except Exception:
        pass
    return {"status": "deleted", "id": sched_id}
