"""Schedule CRUD — PostgreSQL. Cron execution stays in worker."""

import json
import uuid

from fastapi import APIRouter, Request
from app.db import query, execute

router = APIRouter()

DEV_USER_ID = "00000000-0000-0000-0000-000000000001"


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
        entries.append(d)
    return {"schedules": entries}


@router.post("/schedules")
async def upsert_schedule(request: Request):
    body = await request.json()
    schedule_id = body.pop("id", None) or body.pop("_id", None) or str(uuid.uuid4())[:8]
    execute(
        """INSERT INTO data_store (id, collection, user_id, data, updated_at)
           VALUES (%s, 'schedules', %s, %s, now())
           ON CONFLICT (id, collection, user_id) DO UPDATE
           SET data = EXCLUDED.data, updated_at = now()""",
        (schedule_id, DEV_USER_ID, json.dumps(body, ensure_ascii=False))
    )
    return {"id": schedule_id, "status": "saved"}


@router.delete("/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str):
    execute(
        "DELETE FROM data_store WHERE id = %s AND collection = 'schedules' AND user_id = %s",
        (schedule_id, DEV_USER_ID)
    )
    return {"id": schedule_id, "status": "deleted"}
