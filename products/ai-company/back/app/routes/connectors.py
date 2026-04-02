"""Connector CRUD — PostgreSQL. Webhook handling & agent processes stay in worker."""

import json

from fastapi import APIRouter
from app.db import query, execute

router = APIRouter()

DEV_USER_ID = "00000000-0000-0000-0000-000000000001"


def load_connectors() -> dict:
    rows = query("SELECT id, data FROM connectors WHERE user_id = %s", (DEV_USER_ID,))
    result = {}
    for r in rows:
        data = r["data"] if isinstance(r["data"], dict) else json.loads(r["data"])
        result[r["id"]] = data
    return result


def save_connector(cid: str, data: dict):
    execute(
        """INSERT INTO connectors (id, user_id, data, updated_at) VALUES (%s, %s, %s, now())
           ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()""",
        (cid, DEV_USER_ID, json.dumps(data, ensure_ascii=False))
    )


@router.get("/connectors")
async def list_connectors():
    connectors = load_connectors()
    return {"connectors": connectors}


@router.get("/connectors/{connector_id}")
async def get_connector(connector_id: str):
    row = query(
        "SELECT data FROM connectors WHERE id = %s AND user_id = %s",
        (connector_id, DEV_USER_ID), one=True
    )
    if not row:
        return {"error": "Not found"}
    return row["data"] if isinstance(row["data"], dict) else json.loads(row["data"])


@router.delete("/connectors/{connector_id}")
async def delete_connector(connector_id: str):
    execute("DELETE FROM connectors WHERE id = %s AND user_id = %s", (connector_id, DEV_USER_ID))
    return {"status": "deleted"}
