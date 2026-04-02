"""Worker Proxy — routes requests to the correct user's Fly.io container."""

import os
import urllib.request
import urllib.error
import json

from fastapi import APIRouter, Request
from fastapi.responses import Response, StreamingResponse

from app.db import query, execute

router = APIRouter()

DEV_USER_ID = "00000000-0000-0000-0000-000000000001"
# Dev fallback: local worker
DEV_WORKER_URL = os.environ.get("DEV_WORKER_URL", "http://worker:8000")


def _get_worker_url(user_id: str) -> str | None:
    """ユーザーのWorkerコンテナURLをDBから取得。なければdev fallback。"""
    row = query(
        "SELECT container_url, container_status FROM users WHERE id = %s",
        (user_id,), one=True
    )
    if row and row.get("container_url"):
        return row["container_url"].rstrip("/")
    # Dev fallback
    return DEV_WORKER_URL


def _update_container(user_id: str, url: str | None = None, status: str = "running", container_id: str | None = None):
    """ユーザーのコンテナ情報を更新"""
    execute(
        "UPDATE users SET container_url = %s, container_status = %s, container_id = %s WHERE id = %s",
        (url, status, container_id, user_id)
    )


# ─── Fly.io Machines API ───

FLY_API_TOKEN = os.environ.get("FLY_API_TOKEN", "")
FLY_APP_NAME = os.environ.get("FLY_APP_NAME", "ai-company-workers")
FLY_API_BASE = "https://api.machines.dev/v1"


async def _ensure_container_running(user_id: str) -> str:
    """ユーザーのコンテナが起動していなければ起動し、URLを返す"""
    row = query(
        "SELECT container_url, container_id, container_status FROM users WHERE id = %s",
        (user_id,), one=True
    )

    # 既に起動中
    if row and row.get("container_status") == "running" and row.get("container_url"):
        return row["container_url"]

    # Fly API Token がなければ dev fallback
    if not FLY_API_TOKEN:
        return DEV_WORKER_URL

    machine_id = row.get("container_id") if row else None

    if machine_id:
        # 既存マシンを起動
        _fly_request("POST", f"/apps/{FLY_APP_NAME}/machines/{machine_id}/start")
        machine = _fly_request("GET", f"/apps/{FLY_APP_NAME}/machines/{machine_id}")
    else:
        # 新規マシンを作成
        machine = _fly_request("POST", f"/apps/{FLY_APP_NAME}/machines", {
            "config": {
                "image": os.environ.get("FLY_WORKER_IMAGE", "registry.fly.io/ai-company-workers:latest"),
                "env": {
                    "BACK_URL": os.environ.get("PUBLIC_BACK_URL", "http://back:8001"),
                    "ANTHROPIC_API_KEY": os.environ.get("ANTHROPIC_API_KEY", ""),
                    "TZ": "Asia/Tokyo",
                    "IS_SANDBOX": "1",
                },
                "services": [{
                    "ports": [{"port": 443, "handlers": ["tls", "http"]}],
                    "internal_port": 8000,
                    "protocol": "tcp",
                }],
                "guest": {"cpu_kind": "shared", "cpus": 1, "memory_mb": 512},
            },
            "name": f"worker-{user_id[:8]}",
        })
        machine_id = machine.get("id")

    # URLを構築して保存
    container_url = f"https://{machine_id}.fly.dev"
    _update_container(user_id, container_url, "running", machine_id)
    return container_url


def _fly_request(method: str, path: str, data: dict | None = None) -> dict:
    url = f"{FLY_API_BASE}{path}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Authorization", f"Bearer {FLY_API_TOKEN}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": str(e), "status": e.code}
    except Exception as e:
        return {"error": str(e)}


# ─── Proxy endpoint ───

@router.api_route("/worker/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_to_worker(path: str, request: Request):
    """フロントからのリクエストをユーザーのWorkerコンテナに転送"""
    # TODO: 認証からuser_idを取得。今はdev固定
    user_id = request.headers.get("X-User-Id", DEV_USER_ID)

    worker_url = await _ensure_container_running(user_id)
    target_url = f"{worker_url}/{path}"

    # Query params
    if request.url.query:
        target_url += f"?{request.url.query}"

    # Forward request
    body = await request.body() if request.method in ("POST", "PUT") else None

    try:
        req = urllib.request.Request(target_url, data=body, method=request.method)
        req.add_header("Content-Type", request.headers.get("content-type", "application/json"))

        with urllib.request.urlopen(req, timeout=300) as resp:
            content = resp.read()
            content_type = resp.headers.get("Content-Type", "application/json")
            return Response(content=content, media_type=content_type)
    except urllib.error.HTTPError as e:
        return Response(content=e.read(), status_code=e.code, media_type="application/json")
    except Exception as e:
        return Response(
            content=json.dumps({"error": str(e)}),
            status_code=502,
            media_type="application/json"
        )


# ─── Container management ───

@router.post("/containers/{user_id}/start")
async def start_container(user_id: str):
    """ユーザーのコンテナを起動"""
    url = await _ensure_container_running(user_id)
    return {"status": "running", "url": url}


@router.post("/containers/{user_id}/stop")
async def stop_container(user_id: str):
    """ユーザーのコンテナを停止"""
    row = query("SELECT container_id FROM users WHERE id = %s", (user_id,), one=True)
    if row and row.get("container_id") and FLY_API_TOKEN:
        _fly_request("POST", f"/apps/{FLY_APP_NAME}/machines/{row['container_id']}/stop")
    _update_container(user_id, status="stopped")
    return {"status": "stopped"}


@router.get("/containers/{user_id}/status")
async def container_status(user_id: str):
    """ユーザーのコンテナ状態"""
    row = query(
        "SELECT container_url, container_id, container_status FROM users WHERE id = %s",
        (user_id,), one=True
    )
    if not row:
        return {"status": "unknown"}
    return {
        "status": row.get("container_status", "stopped"),
        "url": row.get("container_url"),
        "containerId": row.get("container_id"),
    }
