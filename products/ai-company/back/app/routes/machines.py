"""Fly.io Machines management — create, start, stop, delete user containers."""

import json
import os
import urllib.request
import urllib.error

from fastapi import APIRouter
from app.db import query, execute

router = APIRouter()

FLY_API_TOKEN = os.environ.get("FLY_API_TOKEN", "")
FLY_APP_NAME = os.environ.get("FLY_APP_NAME", "eureka-workers")
FLY_API_BASE = "https://api.machines.dev/v1"
FLY_WORKER_IMAGE = os.environ.get("FLY_WORKER_IMAGE", "registry.fly.io/eureka-workers:latest")
FLY_REGION = os.environ.get("FLY_REGION", "nrt")  # Tokyo


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
        try:
            err_body = json.loads(e.read())
        except Exception:
            err_body = {}
        return {"error": str(e), "status": e.code, "detail": err_body}
    except Exception as e:
        return {"error": str(e)}


def _update_user_container(user_id: str, container_url: str | None = None, status: str = "stopped", container_id: str | None = None):
    execute(
        "UPDATE users SET container_url = %s, container_status = %s, container_id = %s WHERE id = %s",
        (container_url, status, container_id, user_id)
    )


def _get_user_container(user_id: str) -> dict | None:
    return query(
        "SELECT container_url, container_id, container_status FROM users WHERE id = %s",
        (user_id,), one=True
    )


# ─── API Endpoints ───

@router.post("/machines/create")
async def create_machine(payload: dict):
    """ユーザー用のFly Machineを新規作成"""
    user_id = payload.get("userId", "")
    if not user_id:
        return {"error": "userId required"}
    if not FLY_API_TOKEN:
        return {"error": "FLY_API_TOKEN not configured", "status": "skipped"}

    # 既にマシンがあるか
    existing = _get_user_container(user_id)
    if existing and existing.get("container_id"):
        return {"status": "already_exists", "containerId": existing["container_id"], "url": existing.get("container_url")}

    # Fly Machine作成
    result = _fly_request("POST", f"/apps/{FLY_APP_NAME}/machines", {
        "config": {
            "image": FLY_WORKER_IMAGE,
            "env": {
                "BACK_URL": os.environ.get("PUBLIC_BACK_URL", "https://eureka-back-staging-932022452995.asia-northeast1.run.app"),
                "ANTHROPIC_API_KEY": os.environ.get("ANTHROPIC_API_KEY", ""),
                "R2_ENDPOINT": os.environ.get("R2_ENDPOINT", ""),
                "R2_ACCESS_KEY_ID": os.environ.get("R2_ACCESS_KEY_ID", ""),
                "R2_SECRET_ACCESS_KEY": os.environ.get("R2_SECRET_ACCESS_KEY", ""),
                "R2_BUCKET": os.environ.get("R2_BUCKET", "eureka"),
                "R2_ENV": os.environ.get("R2_ENV", "development"),
                "TZ": "Asia/Tokyo",
                "IS_SANDBOX": "1",
            },
            "services": [{
                "ports": [{"port": 443, "handlers": ["tls", "http"]}],
                "internal_port": 8000,
                "protocol": "tcp",
            }],
            "guest": {"cpu_kind": "shared", "cpus": 1, "memory_mb": 512},
            "auto_destroy": False,
        },
        "region": FLY_REGION,
        "name": f"worker-{user_id[:8]}",
    })

    if result.get("error"):
        return {"error": result["error"], "detail": result.get("detail")}

    machine_id = result.get("id", "")
    container_url = f"https://{machine_id}.fly.dev"

    _update_user_container(user_id, container_url, "created", machine_id)

    return {"status": "created", "containerId": machine_id, "url": container_url}


@router.post("/machines/start")
async def start_machine(payload: dict):
    """ユーザーのFly Machineを起動"""
    user_id = payload.get("userId", "")
    if not user_id:
        return {"error": "userId required"}
    if not FLY_API_TOKEN:
        return {"error": "FLY_API_TOKEN not configured"}

    container = _get_user_container(user_id)
    if not container or not container.get("container_id"):
        return {"error": "No machine found for user"}

    machine_id = container["container_id"]
    result = _fly_request("POST", f"/apps/{FLY_APP_NAME}/machines/{machine_id}/start")

    if not result.get("error"):
        container_url = f"https://{machine_id}.fly.dev"
        _update_user_container(user_id, container_url, "running", machine_id)

    return {"status": "started", "containerId": machine_id}


@router.post("/machines/stop")
async def stop_machine(payload: dict):
    """ユーザーのFly Machineを停止"""
    user_id = payload.get("userId", "")
    if not user_id:
        return {"error": "userId required"}
    if not FLY_API_TOKEN:
        return {"error": "FLY_API_TOKEN not configured"}

    container = _get_user_container(user_id)
    if not container or not container.get("container_id"):
        return {"error": "No machine found for user"}

    machine_id = container["container_id"]
    result = _fly_request("POST", f"/apps/{FLY_APP_NAME}/machines/{machine_id}/stop")

    _update_user_container(user_id, None, "stopped", machine_id)

    return {"status": "stopped", "containerId": machine_id}


@router.delete("/machines")
async def delete_machine(payload: dict):
    """ユーザーのFly Machineを削除"""
    user_id = payload.get("userId", "")
    if not user_id:
        return {"error": "userId required"}
    if not FLY_API_TOKEN:
        return {"error": "FLY_API_TOKEN not configured"}

    container = _get_user_container(user_id)
    if not container or not container.get("container_id"):
        return {"error": "No machine found for user"}

    machine_id = container["container_id"]

    # 先に停止
    _fly_request("POST", f"/apps/{FLY_APP_NAME}/machines/{machine_id}/stop")
    # 削除
    result = _fly_request("DELETE", f"/apps/{FLY_APP_NAME}/machines/{machine_id}?force=true")

    _update_user_container(user_id, None, "deleted", None)

    return {"status": "deleted", "containerId": machine_id}


@router.get("/machines/status")
async def machine_status(userId: str = ""):
    """ユーザーのマシン状態"""
    if not userId:
        return {"error": "userId required"}

    container = _get_user_container(userId)
    if not container:
        return {"status": "none"}

    return {
        "status": container.get("container_status", "unknown"),
        "containerId": container.get("container_id"),
        "url": container.get("container_url"),
    }
