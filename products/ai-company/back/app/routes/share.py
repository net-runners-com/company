"""Public share pages — PostgreSQL (read-only)."""

import json

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.db import query

router = APIRouter()

DEV_USER_ID = "00000000-0000-0000-0000-000000000001"


@router.get("/share/{page_id}")
async def get_shared_page(page_id: str):
    row = query(
        "SELECT data FROM data_store WHERE id = %s AND collection = 'dashboards' AND user_id = %s",
        (page_id, DEV_USER_ID), one=True
    )
    if not row:
        return JSONResponse({"error": "Not found"}, status_code=404)
    data = row["data"] if isinstance(row["data"], dict) else json.loads(row["data"])
    if not data.get("public"):
        return JSONResponse({"error": "Not public"}, status_code=403)
    return data


@router.get("/share/{page_id}/data/{collection}")
async def get_shared_data(page_id: str, collection: str):
    # Verify page is public
    page = query(
        "SELECT data FROM data_store WHERE id = %s AND collection = 'dashboards' AND user_id = %s",
        (page_id, DEV_USER_ID), one=True
    )
    if not page:
        return JSONResponse({"error": "Not found"}, status_code=404)
    page_data = page["data"] if isinstance(page["data"], dict) else json.loads(page["data"])
    if not page_data.get("public"):
        return JSONResponse({"error": "Not public"}, status_code=403)

    rows = query(
        "SELECT id, data, created_at FROM data_store WHERE collection = %s AND user_id = %s ORDER BY created_at DESC LIMIT 100",
        (collection, DEV_USER_ID)
    )
    entries = []
    for r in rows:
        d = r["data"] if isinstance(r["data"], dict) else json.loads(r["data"])
        d["_id"] = r["id"]
        entries.append(d)
    return {"entries": entries}
