"""AI Company — Shared API Server (back)."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import employees, data, chat, user, connectors, schedules, news, share, pages, nango, worker_proxy, files, calendar
from app.routes.schedules import load_and_start_scheduler

app = FastAPI(title="AI Company API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routes ───
app.include_router(employees.router)
app.include_router(data.router)
app.include_router(chat.router)
app.include_router(user.router)
app.include_router(connectors.router)
app.include_router(schedules.router)
app.include_router(news.router)
app.include_router(share.router)
app.include_router(pages.router)
app.include_router(nango.router)
app.include_router(files.router)
app.include_router(calendar.router)
app.include_router(worker_proxy.router)


@app.on_event("startup")
def on_startup():
    load_and_start_scheduler()


@app.get("/health")
def health():
    return {"status": "ok", "service": "back"}
