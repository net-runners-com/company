"""News CRUD — PostgreSQL. News fetching (claude -p) stays in worker."""

import json

from fastapi import APIRouter
from app.db import query, execute

router = APIRouter()

DEV_USER_ID = "00000000-0000-0000-0000-000000000001"


@router.get("/news")
async def get_news():
    rows = query(
        "SELECT id, data, created_at FROM data_store WHERE collection = 'news' AND user_id = %s ORDER BY created_at DESC LIMIT 30",
        (DEV_USER_ID,)
    )
    entries = []
    for r in rows:
        d = r["data"] if isinstance(r["data"], dict) else json.loads(r["data"])
        d["_id"] = r["id"]
        entries.append(d)
    return {"news": entries}


@router.post("/news")
async def save_news(payload: dict = {}):
    """Worker calls this to store fetched news."""
    items = payload.get("items", [])
    # Clear old news
    execute("DELETE FROM data_store WHERE collection = 'news' AND user_id = %s", (DEV_USER_ID,))
    # Insert new
    for i, item in enumerate(items):
        nid = item.get("id", f"news-{i}")
        execute(
            """INSERT INTO data_store (id, collection, user_id, data)
               VALUES (%s, 'news', %s, %s)
               ON CONFLICT (id, collection, user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()""",
            (nid, DEV_USER_ID, json.dumps(item, ensure_ascii=False))
        )
    return {"status": "saved", "count": len(items)}
