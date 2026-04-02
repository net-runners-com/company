"""Health check."""

import subprocess

from fastapi import APIRouter

router = APIRouter()


def _version(cmd: list[str]) -> str:
    try:
        return subprocess.check_output(cmd, stderr=subprocess.STDOUT, timeout=5).decode().strip()
    except Exception:
        return "not installed"


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "worker",
        "claude": _version(["claude", "--version"]),
    }
