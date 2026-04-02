"""Nango integration — session, connections, proxy, webhook — PostgreSQL."""

import json
import os

from fastapi import APIRouter, Request

from app.db import query, execute

router = APIRouter()

DEV_USER_ID = "00000000-0000-0000-0000-000000000001"
NANGO_BASE = "https://api.nango.dev"


@router.post("/nango/session")
async def nango_session():
    secret = os.environ.get("NANGO_SECRET_KEY", "")
    if not secret:
        return {"error": "NANGO_SECRET_KEY not set"}

    import httpx
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{NANGO_BASE}/connect/sessions",
                headers={"Authorization": f"Bearer {secret}"},
                json={"end_user": {"id": DEV_USER_ID}},
                timeout=10,
            )
            return resp.json()
        except Exception as e:
            return {"error": str(e)}


@router.post("/nango/proxy")
async def nango_proxy(request: Request):
    secret = os.environ.get("NANGO_SECRET_KEY", "")
    if not secret:
        return {"error": "NANGO_SECRET_KEY not set"}

    body = await request.json()
    method = body.get("method", "GET").upper()
    endpoint = body.get("endpoint", "")
    connection_id = body.get("connectionId", "")
    provider = body.get("provider", "")
    payload = body.get("body")

    if not endpoint or not connection_id or not provider:
        return {"error": "endpoint, connectionId, provider required"}

    import httpx
    headers = {
        "Authorization": f"Bearer {secret}",
        "Provider-Config-Key": provider,
        "Connection-Id": connection_id,
    }

    async with httpx.AsyncClient() as client:
        try:
            if method == "GET":
                resp = await client.get(f"{NANGO_BASE}/proxy{endpoint}", headers=headers, timeout=15)
            else:
                resp = await client.request(method, f"{NANGO_BASE}/proxy{endpoint}", headers=headers, json=payload, timeout=15)
            return resp.json()
        except Exception as e:
            return {"error": str(e)}


@router.get("/nango/connections")
async def nango_connections():
    secret = os.environ.get("NANGO_SECRET_KEY", "")
    if not secret:
        return {"connections": []}

    import httpx
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{NANGO_BASE}/connections",
                headers={"Authorization": f"Bearer {secret}"},
                timeout=10,
            )
            return resp.json()
        except Exception as e:
            return {"error": str(e), "connections": []}


@router.get("/nango/integrations")
async def nango_integrations():
    secret = os.environ.get("NANGO_SECRET_KEY", "")
    if not secret:
        return {"configs": []}

    import httpx
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{NANGO_BASE}/config",
                headers={"Authorization": f"Bearer {secret}"},
                timeout=10,
            )
            return resp.json()
        except Exception as e:
            return {"error": str(e), "configs": []}


@router.post("/nango/webhook")
async def nango_webhook(request: Request):
    body = await request.json()
    event_type = body.get("type", "")

    if event_type == "auth" and body.get("success"):
        connection_id = body.get("connectionId", "")
        provider = body.get("providerConfigKey", "")
        execute(
            """INSERT INTO data_store (id, collection, user_id, data)
               VALUES (%s, 'nango_connections', %s, %s)
               ON CONFLICT (id, collection, user_id) DO UPDATE
               SET data = EXCLUDED.data, updated_at = now()""",
            (f"nango-{connection_id}", DEV_USER_ID,
             json.dumps({"connectionId": connection_id, "provider": provider, "event": body}, ensure_ascii=False))
        )

    return {"status": "ok"}
