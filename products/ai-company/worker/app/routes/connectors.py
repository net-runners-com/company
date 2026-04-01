"""Connector management — CRUD, start/stop, webhook handler, Google OAuth."""

import base64
import hashlib
import hmac
import json
import os
import subprocess
import time as _time
import uuid
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, Response

from app.db import _get_db
from app.plugin_loader import get_all_manifests, get_handler_class, get_manifest, get_registry

router = APIRouter()

# Agent processes managed by connector ID
_agent_processes: dict[str, subprocess.Popen] = {}


def load_connectors() -> dict:
    conn = _get_db()
    try:
        rows = conn.execute("SELECT id, data FROM connectors").fetchall()
        return {r["id"]: json.loads(r["data"]) for r in rows}
    finally:
        conn.close()


def save_connectors(data: dict):
    conn = _get_db()
    try:
        for cid, c in data.items():
            conn.execute(
                "INSERT OR REPLACE INTO connectors (id, data, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%S','now','localtime'))",
                [cid, json.dumps(c, ensure_ascii=False)])
        conn.commit()
    finally:
        conn.close()


def get_connector(connector_id: str) -> dict | None:
    conn = _get_db()
    try:
        row = conn.execute("SELECT data FROM connectors WHERE id = ?", [connector_id]).fetchone()
        return json.loads(row["data"]) if row else None
    finally:
        conn.close()


def _get_public_url() -> str | None:
    """PUBLIC_URL 環境変数から公開URLを取得"""
    url = os.environ.get("PUBLIC_URL", "").strip().rstrip("/")
    return url or None


@router.get("/connectors")
async def list_connectors():
    """全コネクタ設定を返す"""
    connectors = load_connectors()
    public_url = _get_public_url()
    for cid, conn in connectors.items():
        conn["status"] = "running" if cid in _agent_processes and _agent_processes[cid].poll() is None else "stopped"
        if public_url and conn.get("webhookPath"):
            conn["webhookUrl"] = f"{public_url}{conn['webhookPath']}"
    return {"connectors": connectors, "publicUrl": public_url}


@router.get("/connectors/providers")
async def list_providers(locale: str = "en"):
    """Return all plugin manifests with icon SVG content inline."""
    manifests = get_all_manifests()
    result = []
    for m in manifests:
        plugin_dir = Path(f"/workspace/data/connector-plugins/{m['id']}")
        icon_path = plugin_dir / m["display"].get("iconFile", "icon.svg")
        icon_svg = icon_path.read_text() if icon_path.exists() else ""
        result.append({
            "id": m["id"],
            "type": m["type"],
            "name": m["display"]["name"].get(locale, m["display"]["name"].get("en", m["id"])),
            "description": m["display"]["description"].get(locale, m["display"]["description"].get("en", "")),
            "color": m["display"]["color"],
            "bgColor": m["display"]["bgColor"],
            "iconSvg": icon_svg,
            "fields": [{
                "key": f["key"],
                "label": f["label"].get(locale, f["label"].get("en", f["key"])),
                "type": f.get("type", "text"),
                "required": f.get("required", False),
            } for f in m.get("fields", [])],
            "auth": m.get("auth", {}),
        })
    return {"providers": result}


@router.post("/connectors")
async def upsert_connector(payload: dict):
    """コネクタを作成 or 更新。IDがなければ自動生成。ngrok を動的に起動"""
    connectors = load_connectors()
    provider = payload.get("provider", "")
    if provider not in get_registry() and provider not in ("line", "slack", "discord", "google-calendar", "google-drive", "gmail"):
        return {"error": f"Unknown provider: {provider}"}

    connector_id = payload.get("id") or f"{provider}-{uuid.uuid4().hex[:8]}"
    existing = connectors.get(connector_id, {})
    webhook_path = f"/{connector_id}/webhook"

    public_url = _get_public_url()

    connectors[connector_id] = {
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
    save_connectors(connectors)

    result = connectors[connector_id].copy()
    result["publicUrl"] = public_url
    return result


@router.delete("/connectors/{connector_id}")
async def delete_connector(connector_id: str):
    """コネクタを削除"""
    connectors = load_connectors()
    if connector_id not in connectors:
        return {"error": "Not found"}
    # 動いてたら止める
    await _stop_agent(connector_id)
    del connectors[connector_id]
    save_connectors(connectors)
    return {"status": "deleted"}


@router.post("/connectors/{connector_id}/start")
async def start_connector(connector_id: str):
    """コネクタを起動 — 新しいwebhook URLを発行"""
    connectors = load_connectors()
    conn = connectors.get(connector_id)
    if not conn:
        return {"error": "Not found"}

    provider = conn["provider"]
    config = conn.get("config", {})

    # 既に動いてたら止める
    await _stop_agent(connector_id)

    # 新しいwebhook URLを発行（IDを再生成）
    new_id = f"{provider}-{uuid.uuid4().hex[:8]}"
    webhook_path = f"/{new_id}/webhook"
    public_url = _get_public_url()

    # 古いIDのデータを新しいIDに移行
    del connectors[connector_id]
    conn["id"] = new_id
    conn["webhookPath"] = webhook_path
    conn["webhookUrl"] = f"{public_url}{webhook_path}" if public_url else None
    conn["enabled"] = True
    conn["updatedAt"] = _time.strftime("%Y-%m-%dT%H:%M:%S")
    connectors[new_id] = conn
    save_connectors(connectors)

    # エージェント起動
    result = {"status": "started", "id": new_id, "webhookUrl": conn["webhookUrl"]}
    if provider == "line":
        agent_result = await _start_line_agent(new_id, config)
        result.update(agent_result)
    elif provider == "slack":
        result["warning"] = "Slack agent not yet implemented"
    elif provider == "discord":
        result["warning"] = "Discord agent not yet implemented"

    return result


@router.post("/connectors/{connector_id}/stop")
async def stop_connector(connector_id: str):
    """コネクタのエージェントプロセスを停止"""
    await _stop_agent(connector_id)
    return {"status": "stopped"}


async def _stop_agent(connector_id: str):
    proc = _agent_processes.pop(connector_id, None)
    if proc and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


async def _start_line_agent(connector_id: str, config: dict):
    """LINE エージェントを起動（webhook受信は FastAPI 側、ここはキュー監視のみ）"""
    channel_secret = config.get("channelSecret", "")
    access_token = config.get("accessToken", "")
    if not channel_secret or not access_token:
        return {"error": "channelSecret and accessToken are required"}

    # line-agent.sh に環境変数を渡して起動
    agent_script = "/workspace/features/line/line-agent.sh"
    if not Path(agent_script).exists():
        return {"error": "line-agent.sh not found"}

    inbox_dir = f"/workspace/data/connectors/{connector_id}/inbox"
    Path(inbox_dir).mkdir(parents=True, exist_ok=True)

    env = {
        **os.environ,
        "LINE_CHANNEL_SECRET": channel_secret,
        "LINE_ACCESS_TOKEN": access_token,
        "LINE_CHANNEL_ID": config.get("channelId", ""),
        "LINE_INBOX_DIR": inbox_dir,
        "LINE_QUEUE_FILE": f"{inbox_dir}/queue.jsonl",
    }
    proc = subprocess.Popen(
        ["bash", agent_script],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    _agent_processes[connector_id] = proc
    # enabled フラグを更新
    connectors = load_connectors()
    if connector_id in connectors:
        connectors[connector_id]["enabled"] = True
        save_connectors(connectors)
    return {"status": "started", "pid": proc.pid}


@router.post("/connectors/{connector_id}/verify")
async def verify_connector(connector_id: str):
    """コネクタの疎通確認 — 外部サービスにアクセスして接続を検証"""
    conn = get_connector(connector_id)
    if not conn:
        return {"error": "Not found"}

    provider = conn["provider"]
    config = conn.get("config", {})
    public_url = _get_public_url()
    webhook_url = conn.get("webhookUrl") or (f"{public_url}{conn.get('webhookPath', '')}" if public_url else None)

    checks = {"webhookUrl": webhook_url, "provider": provider}

    # 1. Webhook URL が外部からアクセスできるか
    if webhook_url:
        try:
            import urllib.request
            req = urllib.request.Request(webhook_url, method="GET")
            res = urllib.request.urlopen(req, timeout=5)
            checks["webhookReachable"] = res.status == 200
        except Exception as e:
            checks["webhookReachable"] = False
            checks["webhookError"] = str(e)
    else:
        checks["webhookReachable"] = False
        checks["webhookError"] = "No public URL configured"

    # 2. プロバイダー固有の疎通確認
    if provider == "line":
        access_token = config.get("accessToken", "")
        if access_token:
            try:
                import urllib.request
                req = urllib.request.Request(
                    "https://api.line.me/v2/bot/info",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                res = urllib.request.urlopen(req, timeout=5)
                bot_info = json.loads(res.read())
                checks["botVerified"] = True
                checks["botName"] = bot_info.get("displayName", "")
                checks["botId"] = bot_info.get("userId", "")
            except Exception as e:
                checks["botVerified"] = False
                checks["botError"] = str(e)
        else:
            checks["botVerified"] = False
            checks["botError"] = "No access token"

    checks["status"] = "ok" if checks.get("webhookReachable") and checks.get("botVerified", True) else "warning"
    return checks


@router.get("/{connector_id}/webhook")
async def webhook_health(connector_id: str):
    """Webhook 疎通確認"""
    conn = get_connector(connector_id)
    if not conn:
        return {"error": "Invalid connector"}
    return {"status": "ok", "provider": conn["provider"], "connectorId": connector_id}


@router.post("/{connector_id}/webhook")
async def webhook_handler(connector_id: str, request: Request):
    """統合Webhook受信 — provider をコネクタ設定から判別"""
    conn = get_connector(connector_id)
    if not conn:
        return {"error": "Invalid connector"}

    provider = conn["provider"]

    # --- Plugin dispatch ---
    handler_cls = get_handler_class(provider)
    if handler_cls:
        try:
            handler = handler_cls(connector_id=connector_id, config=conn.get("config", {}))
            return await handler.receive_webhook(request)
        except Exception as e:
            return {"error": f"Plugin handler error: {e}"}

    # --- Legacy fallback: LINE ---
    if provider == "line":
        config = conn.get("config", {})
        channel_secret = config.get("channelSecret", "")
        access_token = config.get("accessToken", "")

        body = await request.body()
        signature = request.headers.get("x-line-signature", "")

        expected = base64.b64encode(
            hmac.HMAC(channel_secret.encode(), body, hashlib.sha256).digest()
        ).decode()
        if not hmac.compare_digest(signature, expected):
            print(f"[webhook] Invalid signature for {connector_id}")
            return {"error": "Invalid signature"}

        data = json.loads(body)
        inbox_dir = Path(f"/workspace/data/connectors/{connector_id}/inbox")
        inbox_dir.mkdir(parents=True, exist_ok=True)

        for event in data.get("events", []):
            if event.get("type") != "message":
                continue
            user_id = event.get("source", {}).get("userId", "unknown")
            timestamp = _time.strftime("%Y-%m-%dT%H:%M:%S")
            msg_type = event.get("message", {}).get("type", "")

            if msg_type == "text":
                entry = json.dumps({
                    "timestamp": timestamp, "userId": user_id,
                    "message": event["message"]["text"],
                    "connectorId": connector_id,
                }, ensure_ascii=False) + "\n"
                with open(inbox_dir / "queue.jsonl", "a") as f:
                    f.write(entry)

            elif msg_type == "image":
                media_dir = inbox_dir / "media"
                media_dir.mkdir(exist_ok=True)
                msg_id = event["message"]["id"]
                try:
                    import httpx
                    resp = httpx.get(
                        f"https://api-data.line.me/v2/bot/message/{msg_id}/content",
                        headers={"Authorization": f"Bearer {access_token}"},
                    )
                    if resp.status_code == 200:
                        ts = _time.strftime("%Y%m%d%H%M%S")
                        filepath = media_dir / f"{ts}_{msg_id}.jpg"
                        filepath.write_bytes(resp.content)
                        entry = json.dumps({
                            "timestamp": timestamp, "userId": user_id,
                            "type": "image", "mediaPath": str(filepath),
                            "message": "[画像]", "connectorId": connector_id,
                        }, ensure_ascii=False) + "\n"
                        with open(inbox_dir / "queue.jsonl", "a") as f:
                            f.write(entry)
                except Exception:
                    pass

        return {"status": "ok"}

    # === Slack ===
    if provider == "slack":
        body = await request.json()
        if body.get("type") == "url_verification":
            return {"challenge": body.get("challenge", "")}
        return {"status": "ok"}

    # === Discord ===
    if provider == "discord":
        body = await request.json()
        if body.get("type") == 1:
            return {"type": 1}
        return {"status": "ok"}

    return {"error": f"Unknown provider: {provider}"}


# ============================================
# Google OAuth2
# ============================================

_GOOGLE_SCOPES_FALLBACK = {
    "google-calendar": "https://www.googleapis.com/auth/calendar",
    "google-drive": "https://www.googleapis.com/auth/drive",
    "gmail": "https://www.googleapis.com/auth/gmail.modify",
}


def _get_google_scopes() -> dict[str, str]:
    """Build Google scopes from plugin manifests, falling back to hardcoded defaults."""
    scopes: dict[str, str] = {}
    registry = get_registry()
    for pid, entry in registry.items():
        m = entry.get("manifest", {})
        auth = m.get("auth", {})
        if auth.get("type") == "oauth" and auth.get("provider") == "google":
            scope_list = auth.get("scopes", [])
            if scope_list:
                scopes[pid] = " ".join(scope_list)
    # Merge fallback for any missing
    for k, v in _GOOGLE_SCOPES_FALLBACK.items():
        if k not in scopes:
            scopes[k] = v
    return scopes


# Keep backward-compatible alias
GOOGLE_SCOPES = _GOOGLE_SCOPES_FALLBACK

GOOGLE_TOKEN_FILE = Path("/workspace/data/google_tokens.json")


def _load_google_tokens() -> dict:
    if GOOGLE_TOKEN_FILE.exists():
        return json.loads(GOOGLE_TOKEN_FILE.read_text())
    return {}


def _save_google_tokens(data: dict):
    GOOGLE_TOKEN_FILE.write_text(json.dumps(data, indent=2))


@router.get("/oauth/google/auth-url")
async def google_auth_url(provider: str = ""):
    """Google OAuth2 認証URLを生成"""
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
    if not client_id:
        return {"error": "GOOGLE_CLIENT_ID not configured"}

    google_scopes = _get_google_scopes()
    scope = google_scopes.get(provider, "")
    if not scope:
        return {"error": f"Unknown provider: {provider}"}

    # 複数サービスを一度に認証する場合はスコープを結合
    all_scopes = " ".join(google_scopes.values()) if provider == "all" else scope

    redirect_uri = "http://localhost:8000/oauth/google/callback"
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
    """Google OAuth2 コールバック — トークンを保存して完了画面を表示"""
    if error:
        return Response(
            content=f"<html><body><h2>Error: {error}</h2><script>setTimeout(()=>window.close(),2000)</script></body></html>",
            media_type="text/html",
        )

    client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "")

    # Authorization code → tokens
    import urllib.request
    import urllib.parse
    token_data = urllib.parse.urlencode({
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": "http://localhost:8000/oauth/google/callback",
        "grant_type": "authorization_code",
    }).encode()

    try:
        req = urllib.request.Request("https://oauth2.googleapis.com/token", data=token_data, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        res = urllib.request.urlopen(req, timeout=10)
        tokens = json.loads(res.read())
    except Exception as e:
        return Response(
            content=f"<html><body><h2>Token Error: {e}</h2><script>setTimeout(()=>window.close(),3000)</script></body></html>",
            media_type="text/html",
        )

    # プロバイダー情報を取得
    provider = "all"
    try:
        state_data = json.loads(state)
        provider = state_data.get("provider", "all")
    except Exception:
        pass

    # トークンを保存
    all_tokens = _load_google_tokens()
    all_tokens[provider] = {
        "access_token": tokens.get("access_token"),
        "refresh_token": tokens.get("refresh_token"),
        "expires_in": tokens.get("expires_in"),
        "scope": tokens.get("scope"),
        "token_type": tokens.get("token_type"),
        "created_at": _time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    # 全スコープの場合は各プロバイダーにもコピー
    google_scopes = _get_google_scopes()
    if provider == "all":
        for p in google_scopes:
            all_tokens[p] = all_tokens["all"].copy()
    _save_google_tokens(all_tokens)

    # コネクタ設定も更新
    connectors = load_connectors()
    target_providers = list(google_scopes.keys()) if provider == "all" else [provider]
    for p in target_providers:
        cid = f"{p}-google"
        connectors[cid] = {
            "id": cid,
            "provider": p,
            "config": {"authenticated": True},
            "enabled": True,
            "webhookPath": "",
            "createdAt": connectors.get(cid, {}).get("createdAt", _time.strftime("%Y-%m-%dT%H:%M:%S")),
            "updatedAt": _time.strftime("%Y-%m-%dT%H:%M:%S"),
        }
    save_connectors(connectors)

    return HTMLResponse(
        content="""
        <html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8f9fc">
        <div style="text-align:center">
            <div style="font-size:48px;margin-bottom:16px">&#10003;</div>
            <h2 style="color:#1a1d26;margin:0">接続完了</h2>
            <p style="color:#6b7280;margin-top:8px">このタブは自動で閉じます</p>
        </div>
        <script>setTimeout(()=>window.close(),2000)</script>
        </body></html>
        """,
    )


@router.get("/oauth/google/status")
async def google_status():
    """Google OAuth トークンの状態を確認"""
    tokens = _load_google_tokens()
    result = {}
    for provider, scope in _get_google_scopes().items():
        token = tokens.get(provider)
        if token and token.get("access_token"):
            result[provider] = {"connected": True, "created_at": token.get("created_at")}
        else:
            result[provider] = {"connected": False}
    return result
