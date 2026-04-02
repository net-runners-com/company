"""Custom pages CRUD — PostgreSQL. HTML generation (claude -p) stays in worker."""

import json

from fastapi import APIRouter
from app.db import query, execute

router = APIRouter()

DEV_USER_ID = "00000000-0000-0000-0000-000000000001"


@router.get("/pages/list")
async def list_pages():
    rows = query(
        "SELECT data FROM data_store WHERE collection = 'dashboards' AND user_id = %s ORDER BY created_at DESC",
        (DEV_USER_ID,)
    )
    pages = []
    for r in rows:
        d = r["data"] if isinstance(r["data"], dict) else json.loads(r["data"])
        pages.append(d)
    return {"pages": pages}


@router.get("/pages/{slug}")
async def get_page(slug: str):
    row = query(
        "SELECT data FROM data_store WHERE id = %s AND collection = 'dashboards' AND user_id = %s",
        (slug, DEV_USER_ID), one=True
    )
    if not row:
        return {"error": "Not found"}
    return row["data"] if isinstance(row["data"], dict) else json.loads(row["data"])


@router.post("/pages/{slug}/save")
async def save_page(slug: str, payload: dict = {}):
    """Worker calls this to save generated/updated page HTML."""
    execute(
        """INSERT INTO data_store (id, collection, user_id, data, updated_at)
           VALUES (%s, 'dashboards', %s, %s, now())
           ON CONFLICT (id, collection, user_id) DO UPDATE
           SET data = EXCLUDED.data, updated_at = now()""",
        (slug, DEV_USER_ID, json.dumps(payload, ensure_ascii=False))
    )
    return {"slug": slug, "status": "saved"}


@router.delete("/pages/{slug}")
async def delete_page(slug: str):
    execute(
        "DELETE FROM data_store WHERE id = %s AND collection = 'dashboards' AND user_id = %s",
        (slug, DEV_USER_ID)
    )
    return {"status": "deleted", "slug": slug}
