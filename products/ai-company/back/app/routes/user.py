"""User profile — GET/PUT/DELETE — PostgreSQL."""

import json

from fastapi import APIRouter, Request
from app.db import query, execute

router = APIRouter()

DEV_USER_ID = "00000000-0000-0000-0000-000000000001"


@router.get("/user/profile")
async def get_user_profile():
    row = query(
        "SELECT data FROM data_store WHERE collection = 'user_profile' AND user_id = %s LIMIT 1",
        (DEV_USER_ID,), one=True
    )
    if row:
        return row["data"] if isinstance(row["data"], dict) else json.loads(row["data"])
    return {}


@router.put("/user/profile")
async def update_user_profile_manual(request: Request):
    body = await request.json()
    row = query(
        "SELECT id FROM data_store WHERE collection = 'user_profile' AND user_id = %s LIMIT 1",
        (DEV_USER_ID,), one=True
    )
    profile_id = row["id"] if row else "profile-main"
    execute(
        """INSERT INTO data_store (id, collection, user_id, data, updated_at)
           VALUES (%s, 'user_profile', %s, %s, now())
           ON CONFLICT (id, collection, user_id) DO UPDATE
           SET data = EXCLUDED.data, updated_at = now()""",
        (profile_id, DEV_USER_ID, json.dumps(body, ensure_ascii=False))
    )
    return {"status": "updated"}


@router.delete("/user/profile")
async def reset_user_profile():
    execute(
        "DELETE FROM data_store WHERE collection = 'user_profile' AND user_id = %s",
        (DEV_USER_ID,)
    )
    return {"status": "reset"}
