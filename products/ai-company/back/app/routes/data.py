"""Generic data store CRUD endpoints — PostgreSQL."""

import json
import uuid

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.db import query, execute

router = APIRouter()

DEV_USER_ID = "00000000-0000-0000-0000-000000000001"


def _parse_entry(r: dict) -> dict:
    data = r["data"] if isinstance(r["data"], dict) else json.loads(r["data"])
    data["_id"] = r["id"]
    data["_created_at"] = r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else r["created_at"]
    return data


@router.post("/data/{collection}")
async def data_create(collection: str, request: Request):
    body = await request.json()
    doc_id = body.pop("id", None) or str(uuid.uuid4())[:8]
    execute(
        """INSERT INTO data_store (id, collection, user_id, data, updated_at)
           VALUES (%s, %s, %s, %s, now())
           ON CONFLICT (id, collection, user_id) DO UPDATE
           SET data = EXCLUDED.data, updated_at = now()""",
        (doc_id, collection, DEV_USER_ID, json.dumps(body, ensure_ascii=False))
    )
    return {"id": doc_id, "collection": collection, "status": "created"}


@router.get("/data/{collection}")
async def data_list(collection: str, q: str = "", limit: int = 100, offset: int = 0):
    if q:
        rows = query(
            """SELECT id, data, created_at FROM data_store
               WHERE collection = %s AND user_id = %s AND data::text LIKE %s
               ORDER BY created_at DESC LIMIT %s OFFSET %s""",
            (collection, DEV_USER_ID, f"%{q}%", limit, offset)
        )
    else:
        rows = query(
            """SELECT id, data, created_at FROM data_store
               WHERE collection = %s AND user_id = %s
               ORDER BY created_at DESC LIMIT %s OFFSET %s""",
            (collection, DEV_USER_ID, limit, offset)
        )

    count_row = query(
        "SELECT COUNT(*) as count FROM data_store WHERE collection = %s AND user_id = %s",
        (collection, DEV_USER_ID), one=True
    )
    count = count_row["count"] if count_row else 0

    return {"collection": collection, "count": count, "entries": [_parse_entry(r) for r in rows]}


@router.get("/data/{collection}/{doc_id}")
async def data_get(collection: str, doc_id: str):
    row = query(
        "SELECT id, data, created_at FROM data_store WHERE collection = %s AND id = %s AND user_id = %s",
        (collection, doc_id, DEV_USER_ID), one=True
    )
    if not row:
        return JSONResponse({"error": "Not found"}, status_code=404)
    return _parse_entry(row)


@router.put("/data/{collection}/{doc_id}")
async def data_update(collection: str, doc_id: str, request: Request):
    body = await request.json()
    existing = query(
        "SELECT data FROM data_store WHERE collection = %s AND id = %s AND user_id = %s",
        (collection, doc_id, DEV_USER_ID), one=True
    )
    if not existing:
        return JSONResponse({"error": "Not found"}, status_code=404)

    old = existing["data"] if isinstance(existing["data"], dict) else json.loads(existing["data"])
    merged = {**old, **body}
    execute(
        "UPDATE data_store SET data = %s, updated_at = now() WHERE collection = %s AND id = %s AND user_id = %s",
        (json.dumps(merged, ensure_ascii=False), collection, doc_id, DEV_USER_ID)
    )
    return {"id": doc_id, "status": "updated"}


@router.delete("/data/{collection}/{doc_id}")
async def data_delete(collection: str, doc_id: str):
    execute(
        "DELETE FROM data_store WHERE collection = %s AND id = %s AND user_id = %s",
        (collection, doc_id, DEV_USER_ID)
    )
    return {"id": doc_id, "status": "deleted"}


@router.get("/data")
async def data_collections():
    rows = query(
        "SELECT collection, COUNT(*) as count FROM data_store WHERE user_id = %s GROUP BY collection ORDER BY collection",
        (DEV_USER_ID,)
    )
    return {"collections": [{"name": r["collection"], "count": r["count"]} for r in rows]}
