"""AI Company Worker — FastAPI application entry point."""

import asyncio
import subprocess

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.plugin_loader import load_all_plugins
from app.db import _init_db
from app.employee import _ensure_employees_file

# Route modules
from app.routes.health import router as health_router
from app.routes.employees import router as employees_router
from app.routes.chat import router as chat_router
from app.routes.data import router as data_router
from app.routes.files import router as files_router
from app.routes.accounting import router as accounting_router
from app.routes.projects import router as projects_router
from app.routes.pages import router as pages_router
from app.routes.nango import router as nango_router
from app.routes.connectors import router as connectors_router
from app.routes.schedules import router as schedules_router, _scheduler, _load_schedules_to_scheduler
from app.routes.news import router as news_router
from app.routes.user import router as user_router
from app.routes.share import router as share_router
from app.routes.line import router as line_router
from app.routes.rules import router as rules_router
from app.routes.general_chat import router as general_chat_router

app = FastAPI(title="AI Company Worker", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(health_router)
app.include_router(employees_router)
app.include_router(chat_router)
app.include_router(data_router)
app.include_router(files_router)
app.include_router(accounting_router)
app.include_router(projects_router)
app.include_router(pages_router)
app.include_router(nango_router)
app.include_router(connectors_router)
app.include_router(schedules_router)
app.include_router(news_router)
app.include_router(user_router)
app.include_router(share_router)
app.include_router(line_router)
app.include_router(rules_router)
app.include_router(general_chat_router)


@app.on_event("startup")
async def on_startup():
    load_all_plugins()
    _ensure_employees_file()
    _init_db()


@app.on_event("startup")
async def start_scheduler():
    _load_schedules_to_scheduler()
    _scheduler.start()
    print("[scheduler] Started")



async def _cleanup_zombie_chrome():
    """起動から5分経過したchromeプロセスを kill"""
    try:
        result = subprocess.run(
            ["bash", "-c", "ps -eo pid,etimes,comm | grep chromium | grep -v grep"],
            capture_output=True, text=True, timeout=5,
        )
        for line in result.stdout.strip().split("\n"):
            if not line.strip():
                continue
            parts = line.split()
            if len(parts) < 3:
                continue
            pid, elapsed = int(parts[0]), int(parts[1])
            if elapsed > 300:  # 5分
                subprocess.run(["kill", "-9", str(pid)], capture_output=True)
                print(f"[cleanup] Killed chrome PID {pid} (alive {elapsed}s)")
    except Exception:
        pass


@app.on_event("startup")
async def start_chrome_cleaner():
    """30秒ごとにアイドルchromeを掃除"""
    async def loop():
        while True:
            await asyncio.sleep(30)
            await _cleanup_zombie_chrome()
    asyncio.create_task(loop())
    print("[cleanup] Chrome cleaner started (every 30s)")
