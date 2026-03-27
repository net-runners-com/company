import subprocess
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="AI Company Worker", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _version(cmd: list[str]) -> str:
    try:
        return subprocess.check_output(cmd, stderr=subprocess.STDOUT, timeout=5).decode().strip()
    except Exception:
        return "not installed"


@app.get("/health")
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


@app.post("/tasks/execute")
async def execute_task(payload: dict):
    """
    フロントの API Routes から呼ばれるタスク実行エンドポイント。
    Claude Code CLI でLLM処理、browser-use でSNS投稿など。
    """
    task_type = payload.get("type", "unknown")
    return {
        "status": "accepted",
        "task_type": task_type,
        "message": f"Task '{task_type}' queued for execution",
    }


@app.post("/sns/post")
async def sns_post(payload: dict):
    """SNS投稿ジョブ（browser-use連携）"""
    platform = payload.get("platform", "unknown")
    return {
        "status": "accepted",
        "platform": platform,
        "message": f"Post to {platform} queued",
    }
