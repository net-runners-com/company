"""Connector runtime — agent processes + webhook handling. CRUD is in back."""

import base64
import hashlib
import hmac
import json
import os
import subprocess
import time as _time
from pathlib import Path

from fastapi import APIRouter, Request

import app.back_client as back
from app.plugin_loader import get_handler_class

router = APIRouter()

_agent_processes: dict[str, subprocess.Popen] = {}


@router.post("/connectors/{connector_id}/start")
async def start_connector(connector_id: str):
    """コネクタのエージェントプロセスを起動"""
    conn = back.get(f"/connectors/{connector_id}")
    if not conn or conn.get("error"):
        return {"error": "Not found"}

    provider = conn.get("provider", "")
    config = conn.get("config", {})
    await _stop_agent(connector_id)

    result = {"status": "started", "id": connector_id}
    if provider == "line":
        agent_result = await _start_line_agent(connector_id, config)
        result.update(agent_result)

    return result


@router.post("/connectors/{connector_id}/stop")
async def stop_connector(connector_id: str):
    await _stop_agent(connector_id)
    return {"status": "stopped"}


@router.post("/connectors/{connector_id}/verify")
async def verify_connector(connector_id: str):
    conn = back.get(f"/connectors/{connector_id}")
    if not conn or conn.get("error"):
        return {"error": "Not found"}

    provider = conn.get("provider", "")
    config = conn.get("config", {})
    checks = {"provider": provider}

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
            except Exception as e:
                checks["botVerified"] = False
                checks["botError"] = str(e)

    checks["status"] = "ok" if checks.get("botVerified", True) else "warning"
    return checks


# ─── Webhook (stays in worker — writes to local filesystem) ───

@router.get("/{connector_id}/webhook")
async def webhook_health(connector_id: str):
    conn = back.get(f"/connectors/{connector_id}")
    if not conn or conn.get("error"):
        return {"error": "Invalid connector"}
    return {"status": "ok", "provider": conn.get("provider", ""), "connectorId": connector_id}


@router.post("/{connector_id}/webhook")
async def webhook_handler(connector_id: str, request: Request):
    conn = back.get(f"/connectors/{connector_id}")
    if not conn or conn.get("error"):
        return {"error": "Invalid connector"}

    provider = conn.get("provider", "")

    handler_cls = get_handler_class(provider)
    if handler_cls:
        try:
            handler = handler_cls(connector_id=connector_id, config=conn.get("config", {}))
            return await handler.receive_webhook(request)
        except Exception as e:
            return {"error": f"Plugin handler error: {e}"}

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

        return {"status": "ok"}

    if provider == "slack":
        body = await request.json()
        if body.get("type") == "url_verification":
            return {"challenge": body.get("challenge", "")}
        return {"status": "ok"}

    if provider == "discord":
        body = await request.json()
        if body.get("type") == 1:
            return {"type": 1}
        return {"status": "ok"}

    return {"error": f"Unknown provider: {provider}"}


# ─── Agent process management ───

async def _stop_agent(connector_id: str):
    proc = _agent_processes.pop(connector_id, None)
    if proc and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


async def _start_line_agent(connector_id: str, config: dict):
    channel_secret = config.get("channelSecret", "")
    access_token = config.get("accessToken", "")
    if not channel_secret or not access_token:
        return {"error": "channelSecret and accessToken are required"}

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
    proc = subprocess.Popen(["bash", agent_script], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    _agent_processes[connector_id] = proc
    return {"status": "started", "pid": proc.pid}
