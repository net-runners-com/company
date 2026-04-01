"""AI Company Worker — FastAPI application entry point."""

import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.triggers.cron import CronTrigger

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
from app.routes.news import router as news_router, _fetch_news
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


@app.on_event("startup")
async def start_news_cron():
    _scheduler.add_job(
        lambda: asyncio.ensure_future(_fetch_news()),
        CronTrigger(hour=7, minute=0, timezone="Asia/Tokyo"),
        id="news_auto_update",
        replace_existing=True,
    )
    print("[news] Scheduled daily at 7:00 JST")
