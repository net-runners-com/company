"""Schedule CRUD + APScheduler — PostgreSQL. Task execution via Worker /agent/run."""

import importlib
import json
import os
import uuid
import urllib.request
import urllib.error

from fastapi import APIRouter, Request
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.db import query, execute

router = APIRouter()

DEV_USER_ID = "00000000-0000-0000-0000-000000000001"

scheduler = AsyncIOScheduler(timezone="Asia/Tokyo")

# Worker URL for task execution (dynamic per user in production)
DEV_WORKER_URL = os.environ.get("DEV_WORKER_URL", "http://worker:8000")

SYSTEM_JOBS = [
    {"id": "news_auto_update", "name": "ニュース自動更新", "cron": "0 7 * * *", "type": "system", "handler": "news_update"},
]


def _call_worker(path: str, data: dict, timeout: int = 200) -> dict:
    """Worker APIにHTTPリクエスト"""
    url = f"{DEV_WORKER_URL}{path}"
    body = json.dumps(data, ensure_ascii=False).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"[scheduler] Worker call failed: {e}")
        return {"error": str(e)}


def _run_scheduled_task(schedule_id: str, emp_id: str, task: str, name: str):
    """スケジュールされた社員タスクをWorkerに投げる"""
    print(f"[scheduler] Firing: {name} (emp={emp_id})")
    result = _call_worker("/agent/run", {
        "empId": emp_id,
        "task": task,
        "threadTitle": f"定期: {name}",
        "systemPromptExtra": "# 定期実行タスク\nこれはスケジュールされた自動実行です。",
    })
    print(f"[scheduler] Result: {name} → {result.get('status', 'unknown')}")


NEWS_FETCH_PROMPT = """今日のニュースを6件取得してJSON配列で返してください。
カテゴリ: tech, business, industry, market
Web検索で実際の最新ニュースを取得すること。

出力形式（JSONのみ）:
```json
[{"title":"タイトル","source":"ソース","category":"tech","summary":"要約","url":"URL","publishedAt":"ISO日時"}]
```"""


def _run_system_job(handler_id: str, name: str):
    """システムジョブを実行 — workerの/agent/runに投げる"""
    print(f"[scheduler] System job: {name}")
    if handler_id == "news_update":
        # 秘書（emp-1）にニュース取得させる
        result = _call_worker("/agent/run", {
            "empId": "emp-1",
            "task": NEWS_FETCH_PROMPT,
            "threadTitle": "ニュース自動取得",
            "maxTurns": 5,
            "timeout": 60,
        })
        print(f"[scheduler] News update result: {result.get('status', 'unknown')}")
    else:
        print(f"[scheduler] Unknown handler: {handler_id}")


def _register_job(sched_id: str, sched: dict):
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
            scheduler.add_job(
                _run_system_job, trigger=trigger,
                id=f"sched_{sched_id}", args=[handler, name], replace_existing=True,
            )
        else:
            emp_id = sched.get("empId", "")
            task = sched.get("task", "")
            if not emp_id or not task:
                return
            scheduler.add_job(
                _run_scheduled_task, trigger=trigger,
                id=f"sched_{sched_id}", args=[sched_id, emp_id, task, name], replace_existing=True,
            )

        print(f"[scheduler] Registered: {name} ({cron}) [{job_type}]")
    except Exception as e:
        print(f"[scheduler] Failed to register {name}: {e}")


def seed_system_jobs():
    for job in SYSTEM_JOBS:
        rows = query(
            "SELECT id FROM data_store WHERE id = %s AND collection = 'schedules' AND user_id = %s",
            (job["id"], DEV_USER_ID)
        )
        if not rows:
            execute(
                """INSERT INTO data_store (id, collection, user_id, data)
                   VALUES (%s, 'schedules', %s, %s)""",
                (job["id"], DEV_USER_ID, json.dumps(job, ensure_ascii=False))
            )
            print(f"[scheduler] Seeded: {job['name']}")


def load_and_start_scheduler():
    """DBからスケジュールを読み込んでAPScheduler起動"""
    seed_system_jobs()

    rows = query(
        "SELECT id, data FROM data_store WHERE collection = 'schedules' AND user_id = %s",
        (DEV_USER_ID,)
    )

    for job in scheduler.get_jobs():
        if job.id.startswith("sched_"):
            scheduler.remove_job(job.id)

    for r in rows:
        d = r["data"] if isinstance(r["data"], dict) else json.loads(r["data"])
        _register_job(r["id"], d)

    if not scheduler.running:
        scheduler.start()
        print("[scheduler] Started")


# ─── CRUD endpoints ───

@router.get("/schedules")
async def list_schedules():
    rows = query(
        "SELECT id, data, created_at FROM data_store WHERE collection = 'schedules' AND user_id = %s ORDER BY created_at DESC",
        (DEV_USER_ID,)
    )
    entries = []
    for r in rows:
        d = r["data"] if isinstance(r["data"], dict) else json.loads(r["data"])
        d["_id"] = r["id"]
        job = scheduler.get_job(f"sched_{r['id']}")
        d["nextRun"] = str(job.next_run_time) if job and job.next_run_time else None
        entries.append(d)
    return {"schedules": entries}


@router.post("/schedules")
async def upsert_schedule(request: Request):
    body = await request.json()
    name = body.get("name", "")
    cron = body.get("cron", "")
    job_type = body.get("type", "employee")
    schedule_id = body.pop("id", None) or body.pop("_id", None) or str(uuid.uuid4())[:8]

    if job_type == "system":
        handler = body.get("handler", "")
        if not cron or not handler:
            return {"error": "cron and handler required"}
        data = {"name": name, "cron": cron, "type": "system", "handler": handler}
    else:
        emp_id = body.get("empId", "")
        task = body.get("task", "")
        if not cron or not emp_id or not task:
            return {"error": "cron, empId, task required"}
        data = {"name": name, "cron": cron, "empId": emp_id, "task": task}

    execute(
        """INSERT INTO data_store (id, collection, user_id, data, updated_at)
           VALUES (%s, 'schedules', %s, %s, now())
           ON CONFLICT (id, collection, user_id) DO UPDATE
           SET data = EXCLUDED.data, updated_at = now()""",
        (schedule_id, DEV_USER_ID, json.dumps(data, ensure_ascii=False))
    )
    _register_job(schedule_id, data)
    return {"id": schedule_id, "name": name, "cron": cron, "type": job_type, "status": "registered"}


@router.post("/schedules/trigger")
async def trigger_schedule(request: Request):
    """Cloud Schedulerから呼ばれる。job_idに該当するジョブを即時実行"""
    body = await request.json()
    job_id = body.get("job_id", "")
    if not job_id:
        return {"error": "job_id required"}

    row = query(
        "SELECT id, data FROM data_store WHERE id = %s AND collection = 'schedules' AND user_id = %s",
        (job_id, DEV_USER_ID), one=True
    )
    if not row:
        return {"error": f"Schedule {job_id} not found"}

    d = row["data"] if isinstance(row["data"], dict) else json.loads(row["data"])
    job_type = d.get("type", "employee")
    name = d.get("name", job_id)

    if job_type == "system":
        _run_system_job(d.get("handler", ""), name)
    else:
        emp_id = d.get("empId", "")
        task = d.get("task", "")
        if emp_id and task:
            _run_scheduled_task(job_id, emp_id, task, name)

    return {"status": "triggered", "job_id": job_id, "name": name}


@router.delete("/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str):
    execute(
        "DELETE FROM data_store WHERE id = %s AND collection = 'schedules' AND user_id = %s",
        (schedule_id, DEV_USER_ID)
    )
    try:
        scheduler.remove_job(f"sched_{schedule_id}")
    except Exception:
        pass
    return {"id": schedule_id, "status": "deleted"}
