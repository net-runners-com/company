"""Connector CRUD + Google OAuth — PostgreSQL."""

import json
import os
import time as _time
import uuid

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, Response

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


@router.get("/connectors/providers")
async def list_providers(locale: str = "en"):
    """R2からプラグイン一覧を動的取得"""
    from app.r2 import _get_r2, R2_BUCKET, r2_plugins_prefix
    s3 = _get_r2()
    prefix = r2_plugins_prefix()
    try:
        resp = s3.list_objects_v2(Bucket=R2_BUCKET, Prefix=prefix, Delimiter="/")
    except Exception as e:
        return {"providers": [], "error": str(e)}

    providers = []
    for cp in resp.get("CommonPrefixes", []):
        plugin_id = cp["Prefix"][len(prefix):].rstrip("/")
        if not plugin_id:
            continue
        # manifest.json を読む
        try:
            obj = s3.get_object(Bucket=R2_BUCKET, Key=f"{prefix}{plugin_id}/manifest.json")
            manifest = json.loads(obj["Body"].read())
        except Exception:
            continue

        # icon.svg を読む
        icon_svg = ""
        try:
            obj = s3.get_object(Bucket=R2_BUCKET, Key=f"{prefix}{plugin_id}/icon.svg")
            icon_svg = obj["Body"].read().decode("utf-8")
        except Exception:
            pass

        display = manifest.get("display", {})
        providers.append({
            "id": manifest.get("id", plugin_id),
            "type": manifest.get("type", "webhook"),
            "name": display.get("name", {}).get(locale, display.get("name", {}).get("en", plugin_id)),
            "description": display.get("description", {}).get(locale, display.get("description", {}).get("en", "")),
            "color": display.get("color", "#6366f1"),
            "bgColor": display.get("bgColor", "#eef2ff"),
            "iconSvg": icon_svg,
            "fields": [{
                "key": f["key"],
                "label": f["label"].get(locale, f["label"].get("en", f["key"])),
                "type": f.get("type", "text"),
                "required": f.get("required", False),
            } for f in manifest.get("fields", [])],
            "auth": manifest.get("auth", {}),
        })

    return {"providers": providers}


@router.get("/connectors")
async def list_connectors():
    connectors = load_connectors()
    public_url = os.environ.get("PUBLIC_URL", "").strip().rstrip("/")
    for cid, conn in connectors.items():
        if public_url and conn.get("webhookPath"):
            conn["webhookUrl"] = f"{public_url}{conn['webhookPath']}"
    return {"connectors": connectors, "publicUrl": public_url or None}


@router.get("/connectors/{connector_id}")
async def get_connector(connector_id: str):
    row = query(
        "SELECT data FROM connectors WHERE id = %s AND user_id = %s",
        (connector_id, DEV_USER_ID), one=True
    )
    if not row:
        return {"error": "Not found"}
    return row["data"] if isinstance(row["data"], dict) else json.loads(row["data"])


@router.post("/connectors")
async def upsert_connector(payload: dict):
    connectors = load_connectors()
    provider = payload.get("provider", "")
    connector_id = payload.get("id") or f"{provider}-{uuid.uuid4().hex[:8]}"
    existing = connectors.get(connector_id, {})
    webhook_path = f"/{connector_id}/webhook"
    public_url = os.environ.get("PUBLIC_URL", "").strip().rstrip("/")

    data = {
        **existing,
        "id": connector_id,
        "provider": provider,
        "config": payload.get("config", existing.get("config", {})),
        "enabled": payload.get("enabled", existing.get("enabled", False)),
        "webhookPath": webhook_path,
        "webhookUrl": f"{public_url}{webhook_path}" if public_url else None,
        "createdAt": existing.get("createdAt", _time.strftime("%Y-%m-%dT%H:%M:%S")),
        "updatedAt": _time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    save_connector(connector_id, data)
    return {**data, "publicUrl": public_url or None}


@router.delete("/connectors/{connector_id}")
async def delete_connector(connector_id: str):
    execute("DELETE FROM connectors WHERE id = %s AND user_id = %s", (connector_id, DEV_USER_ID))
    return {"status": "deleted"}


# ─── Google OAuth2 ───

GOOGLE_SCOPES = {
    "google-calendar": "https://www.googleapis.com/auth/calendar",
    "google-drive": "https://www.googleapis.com/auth/drive",
    "gmail": "https://www.googleapis.com/auth/gmail.modify",
}


@router.get("/oauth/google/auth-url")
async def google_auth_url(provider: str = ""):
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
    if not client_id:
        return {"error": "GOOGLE_CLIENT_ID not configured"}

    scope = GOOGLE_SCOPES.get(provider, "")
    if not scope:
        return {"error": f"Unknown provider: {provider}"}

    all_scopes = " ".join(GOOGLE_SCOPES.values()) if provider == "all" else scope
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8001/oauth/google/callback")
    state = json.dumps({"provider": provider})

    import urllib.parse
    params = urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": all_scopes,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    })
    return {"url": f"https://accounts.google.com/o/oauth2/v2/auth?{params}"}


@router.get("/oauth/google/callback")
async def google_callback(code: str = "", state: str = "", error: str = ""):
    if error:
        return Response(
            content=f"<html><body><h2>Error: {error}</h2><script>setTimeout(()=>window.close(),2000)</script></body></html>",
            media_type="text/html",
        )

    client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "")
    redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:8001/oauth/google/callback")

    import urllib.request, urllib.parse
    token_data = urllib.parse.urlencode({
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }).encode()

    try:
        req = urllib.request.Request("https://oauth2.googleapis.com/token", data=token_data, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        res = urllib.request.urlopen(req, timeout=10)
        tokens = json.loads(res.read())
    except Exception as e:
        return Response(
            content=f"<html><body><h2>Token Error: {e}</h2></body></html>",
            media_type="text/html",
        )

    provider = "all"
    try:
        provider = json.loads(state).get("provider", "all")
    except Exception:
        pass

    # Save tokens to data_store
    from app.db import execute as db_execute
    token_record = {
        "access_token": tokens.get("access_token"),
        "refresh_token": tokens.get("refresh_token"),
        "expires_in": tokens.get("expires_in"),
        "scope": tokens.get("scope"),
        "created_at": _time.strftime("%Y-%m-%dT%H:%M:%S"),
    }

    target_providers = list(GOOGLE_SCOPES.keys()) if provider == "all" else [provider]
    for p in target_providers:
        # Save token
        db_execute(
            """INSERT INTO data_store (id, collection, user_id, data, updated_at)
               VALUES (%s, 'google_tokens', %s, %s, now())
               ON CONFLICT (id, collection, user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()""",
            (p, DEV_USER_ID, json.dumps(token_record, ensure_ascii=False))
        )
        # Update connector
        save_connector(f"{p}-google", {
            "id": f"{p}-google", "provider": p,
            "config": {"authenticated": True}, "enabled": True, "webhookPath": "",
            "updatedAt": _time.strftime("%Y-%m-%dT%H:%M:%S"),
        })

    return HTMLResponse(content="""
    <html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8f9fc">
    <div style="text-align:center">
        <div style="font-size:48px;margin-bottom:16px">&#10003;</div>
        <h2 style="color:#1a1d26;margin:0">接続完了</h2>
        <p style="color:#6b7280;margin-top:8px">このタブは自動で閉じます</p>
    </div>
    <script>setTimeout(()=>window.close(),2000)</script>
    </body></html>
    """)


@router.get("/oauth/google/status")
async def google_status():
    rows = query(
        "SELECT id, data FROM data_store WHERE collection = 'google_tokens' AND user_id = %s",
        (DEV_USER_ID,)
    )
    result = {}
    for provider in GOOGLE_SCOPES:
        token = next((r for r in rows if r["id"] == provider), None)
        if token:
            d = token["data"] if isinstance(token["data"], dict) else json.loads(token["data"])
            result[provider] = {"connected": True, "created_at": d.get("created_at")}
        else:
            result[provider] = {"connected": False}
    return result
