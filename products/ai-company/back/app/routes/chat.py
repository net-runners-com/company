"""Chat threads & messages CRUD — PostgreSQL. Agent execution stays in worker."""

import json
import uuid
import time as _time

from fastapi import APIRouter
from app.db import query, execute

router = APIRouter()

DEV_USER_ID = "00000000-0000-0000-0000-000000000001"


# ─── Helper functions (also used by other routes) ───

def get_threads(emp_id: str) -> list[dict]:
    rows = query(
        "SELECT id, title, created_at FROM chat_threads WHERE emp_id = %s AND user_id = %s ORDER BY created_at DESC",
        (emp_id, DEV_USER_ID)
    )
    return [{"id": r["id"], "title": r["title"],
             "createdAt": r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else r["created_at"]}
            for r in rows]


def create_thread(emp_id: str, title: str = "") -> dict:
    thread_id = str(uuid.uuid4())[:8]
    t = title or "新規チャット"
    execute(
        "INSERT INTO chat_threads (id, user_id, emp_id, title) VALUES (%s, %s, %s, %s)",
        (thread_id, DEV_USER_ID, emp_id, t)
    )
    return {"id": thread_id, "title": t, "createdAt": _time.strftime("%Y-%m-%dT%H:%M:%S")}


def append_chat_log(emp_id: str, role: str, content: str, thread_id: str = "default"):
    execute(
        "INSERT INTO chat_messages (thread_id, user_id, emp_id, role, content) VALUES (%s, %s, %s, %s, %s)",
        (thread_id, DEV_USER_ID, emp_id, role, content)
    )
    # Auto-update thread title from first user message
    if role == "user":
        row = query("SELECT title FROM chat_threads WHERE id = %s", (thread_id,), one=True)
        if row and row["title"] in ("新規チャット", "General") or (row and row["title"].startswith("Chat ")):
            msg = content.strip().split("\n")[0]
            new_title = msg if len(msg) <= 20 else msg[:20] + "..."
            execute("UPDATE chat_threads SET title = %s WHERE id = %s", (new_title, thread_id))
    if role == "assistant":
        count_row = query(
            "SELECT COUNT(*) as cnt FROM chat_messages WHERE thread_id = %s AND role = 'assistant'",
            (thread_id,), one=True
        )
        if count_row and count_row["cnt"] <= 1:
            user_msg = query(
                "SELECT content FROM chat_messages WHERE thread_id = %s AND role = 'user' ORDER BY id ASC LIMIT 1",
                (thread_id,), one=True
            )
            if user_msg:
                topic = user_msg["content"].strip().split("\n")[0]
                if len(topic) > 20:
                    topic = topic[:20] + "..."
                execute("UPDATE chat_threads SET title = %s WHERE id = %s", (topic, thread_id))


def read_chat_log(emp_id: str, thread_id: str = "default") -> list[dict]:
    rows = query(
        "SELECT role, content, created_at FROM chat_messages WHERE thread_id = %s AND emp_id = %s ORDER BY id ASC",
        (thread_id, emp_id)
    )
    return [{"role": r["role"], "content": r["content"],
             "timestamp": r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else r["created_at"]}
            for r in rows]


# ─── Endpoints ───

@router.get("/employee/{emp_id}/threads")
async def list_threads(emp_id: str):
    threads = get_threads(emp_id)
    if not threads:
        thread = create_thread(emp_id, "General")
        threads = [thread]
    return {"threads": threads}


@router.post("/employee/{emp_id}/threads")
async def create_thread_endpoint(emp_id: str, payload: dict = {}):
    title = payload.get("title", "")
    return create_thread(emp_id, title)


@router.delete("/employee/{emp_id}/threads/{thread_id}")
async def delete_thread(emp_id: str, thread_id: str):
    execute("DELETE FROM chat_messages WHERE thread_id = %s AND emp_id = %s AND user_id = %s",
            (thread_id, emp_id, DEV_USER_ID))
    execute("DELETE FROM chat_threads WHERE id = %s AND emp_id = %s AND user_id = %s",
            (thread_id, emp_id, DEV_USER_ID))
    return {"ok": True}


@router.get("/employee/{emp_id}/chat/history")
async def employee_chat_history(emp_id: str, thread_id: str = "default"):
    return read_chat_log(emp_id, thread_id)


@router.post("/employee/{emp_id}/chat/log")
async def append_log(emp_id: str, payload: dict = {}):
    """Worker calls this to save chat messages."""
    role = payload.get("role", "")
    content = payload.get("content", "")
    thread_id = payload.get("threadId", "default")
    if role and content:
        append_chat_log(emp_id, role, content, thread_id)
    return {"ok": True}
