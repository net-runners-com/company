"""Health, browser status, browser stream endpoints."""

import asyncio
import subprocess

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

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
        "tools": {
            "claude": _version(["claude", "--version"]),
            "gws": _version(["gws", "--version"]),
            "gemini": _version(["gemini", "--version"]),
            "playwright": _version(["playwright", "--version"]),
            "node": _version(["node", "--version"]),
            "python": _version(["python", "--version"]),
        },
    }


@router.get("/browser/stream")
async def browser_stream():
    """Xvfb画面をMJPEGストリームで配信"""
    BOUNDARY = "frame"

    async def generate():
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-f", "x11grab", "-video_size", "1280x720",
            "-framerate", "8", "-i", ":99",
            "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "10", "pipe:1",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        try:
            buf = b""
            while True:
                chunk = await proc.stdout.read(8192)
                if not chunk:
                    break
                buf += chunk
                # JPEG フレームを検出 (SOI: ffd8, EOI: ffd9)
                while True:
                    start = buf.find(b"\xff\xd8")
                    end = buf.find(b"\xff\xd9", start + 2) if start >= 0 else -1
                    if start < 0 or end < 0:
                        break
                    frame = buf[start:end + 2]
                    buf = buf[end + 2:]
                    yield (
                        f"--{BOUNDARY}\r\n"
                        f"Content-Type: image/jpeg\r\n"
                        f"Content-Length: {len(frame)}\r\n\r\n"
                    ).encode() + frame + b"\r\n"
        except asyncio.CancelledError:
            proc.kill()
        finally:
            proc.kill()

    return StreamingResponse(generate(), media_type=f"multipart/x-mixed-replace; boundary={BOUNDARY}")


@router.get("/browser/status")
async def browser_status():
    """Playwright の chromium プロセスが動いているかチェック"""
    try:
        result = subprocess.run(
            ["pgrep", "-f", "chromium.*--disable-background"],
            capture_output=True, timeout=2
        )
        active = result.returncode == 0
    except Exception:
        active = False
    return {"active": active}
