"""AI Company — Shared API Server (back)."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="AI Company API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "back"}


# Routes will be added as they are migrated from worker
# from app.routes import employees, data, projects, chat, ...
# app.include_router(employees.router)
