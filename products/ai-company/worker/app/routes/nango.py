"""Nango integration — session, proxy, connections, integrations, webhook."""

import json
import os
import time as _time

from fastapi import APIRouter, Request

import app.back_client as back

router = APIRouter()

NANGO_BASE = "https://api.nango.dev"


def _nango_headers(connection_id: str, provider_config_key: str) -> dict:
    secret = os.environ.get("NANGO_SECRET_KEY", "")
    return {
        "Authorization": f"Bearer {secret}",
        "Connection-Id": connection_id,
        "Provider-Config-Key": provider_config_key,
    }


@router.post("/nango/session")
async def nango_create_session(request: Request):
    """Nango Connect セッショントークンを生成"""
    body = await request.json()
    user_id = body.get("userId", "")
    user_email = body.get("userEmail", "")
    integration_id = body.get("integrationId")  # None = 全インテグレーション表示

    secret = os.environ.get("NANGO_SECRET_KEY", "")
    if not secret:
        return {"error": "NANGO_SECRET_KEY not configured"}

    payload: dict = {
        "tags": {
            "end_user_id": user_id,
            "end_user_email": user_email,
        },
    }
    if integration_id:
        payload["allowed_integrations"] = [integration_id]

    import httpx
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{NANGO_BASE}/connect/sessions",
                headers={
                    "Authorization": f"Bearer {secret}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=10,
            )
            data = resp.json()
            return data
        except Exception as e:
            return {"error": str(e)}


@router.post("/nango/proxy")
async def nango_proxy(request: Request):
    """Nango proxy — エージェントや フロントから外部APIを叩く汎用エンドポイント"""
    body = await request.json()
    method = body.get("method", "GET").upper()
    endpoint = body.get("endpoint", "")
    connection_id = body.get("connectionId", "")
    provider = body.get("provider", "")
    data = body.get("data")

    if not endpoint or not provider:
        return {"error": "endpoint and provider are required"}

    # __auto__ の場合、最新の接続IDを自動取得
    if not connection_id or connection_id == "__auto__":
        secret_tmp = os.environ.get("NANGO_SECRET_KEY", "")
        if secret_tmp:
            import httpx
            async with httpx.AsyncClient() as client:
                try:
                    resp = await client.get(f"{NANGO_BASE}/connections", headers={"Authorization": f"Bearer {secret_tmp}"}, timeout=10)
                    conns = resp.json().get("connections", [])
                    match = next((c for c in conns if c.get("provider") == provider or c.get("provider_config_key") == provider), None)
                    if match:
                        connection_id = match["connection_id"]
                    else:
                        return {"error": f"No connection found for provider: {provider}"}
                except Exception as e:
                    return {"error": f"Auto-connect failed: {e}"}
        if not connection_id or connection_id == "__auto__":
            return {"error": "No connection available"}

    secret = os.environ.get("NANGO_SECRET_KEY", "")
    if not secret:
        return {"error": "NANGO_SECRET_KEY not configured"}

    headers = {
        "Authorization": f"Bearer {secret}",
        "Connection-Id": connection_id,
        "Provider-Config-Key": provider,
    }

    import httpx
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.request(
                method,
                f"{NANGO_BASE}/proxy{endpoint}",
                headers=headers,
                json=data if data else None,
                timeout=30,
            )
            try:
                return resp.json()
            except Exception:
                return {"status": resp.status_code, "body": resp.text[:1000]}
        except Exception as e:
            return {"error": str(e)}


@router.get("/nango/connections")
async def nango_connections():
    """Nango に登録済みのコネクション一覧"""
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
    """Nango に設定済みのインテグレーション一覧"""
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
    """Nango からの Webhook 受信 — 接続完了・エラー等のイベント"""
    body = await request.json()
    event_type = body.get("type", "")
    print(f"[nango/webhook] {event_type}: {json.dumps(body, ensure_ascii=False)[:200]}")

    # 新しい接続が完了した場合、data_store に記録
    if event_type == "auth" and body.get("success"):
        connection_id = body.get("connectionId", "")
        provider = body.get("providerConfigKey", "")
        back.save_data("nango_connections", f"nango-{connection_id}", {
            "connectionId": connection_id, "provider": provider,
            "status": "connected", "connectedAt": _time.strftime("%Y-%m-%dT%H:%M:%S"),
        })

    return {"status": "ok"}
