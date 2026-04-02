"""Employee CRUD endpoints — PostgreSQL."""

import json
import uuid
import time as _time

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.db import query, execute

router = APIRouter()

DEV_USER_ID = "00000000-0000-0000-0000-000000000001"


def load_employees() -> dict:
    rows = query("SELECT id, data FROM employees WHERE user_id = %s", (DEV_USER_ID,))
    result = {}
    for r in rows:
        data = r["data"] if isinstance(r["data"], dict) else json.loads(r["data"])
        result[r["id"]] = data
    return result


def get_employee(emp_id: str) -> dict | None:
    row = query("SELECT data FROM employees WHERE id = %s AND user_id = %s", (emp_id, DEV_USER_ID), one=True)
    if not row:
        return None
    return row["data"] if isinstance(row["data"], dict) else json.loads(row["data"])


def save_employee(emp_id: str, emp: dict):
    execute(
        """INSERT INTO employees (id, user_id, data, updated_at) VALUES (%s, %s, %s, now())
           ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()""",
        (emp_id, DEV_USER_ID, json.dumps(emp, ensure_ascii=False))
    )


@router.post("/employees")
async def upsert_employee(payload: dict):
    employees = load_employees()
    emp_id = payload.get("id", "")
    if not emp_id:
        emp_id = f"emp-{str(uuid.uuid4())[:8]}"

    existing = employees.get(emp_id, {})
    emp = {
        **existing,
        "id": emp_id,
        "name": payload.get("name", existing.get("name", "")),
        "role": payload.get("role", existing.get("role", "")),
        "department": payload.get("department", existing.get("department", "")),
        "tone": payload.get("tone", existing.get("tone", "")),
        "skills": payload.get("skills", existing.get("skills", [])),
        "systemPrompt": payload.get("systemPrompt", existing.get("systemPrompt", "")),
        "sessionId": existing.get("sessionId"),
        "avatarConfig": payload.get("avatarConfig", existing.get("avatarConfig")),
        "updatedAt": _time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    save_employee(emp_id, emp)

    # R2 profile generation stays in worker (needs filesystem)
    # Worker will call back to this API after creation

    return emp


@router.get("/employees")
async def list_employees():
    return load_employees()


@router.get("/employees/{emp_id}")
async def get_employee_info(emp_id: str):
    emp = get_employee(emp_id)
    if not emp:
        return JSONResponse({"error": "Not found"}, status_code=404)
    return emp


@router.delete("/employees/{emp_id}")
async def delete_employee(emp_id: str):
    # Delete employee
    execute("DELETE FROM employees WHERE id = %s AND user_id = %s", (emp_id, DEV_USER_ID))
    # Delete chat history
    execute("DELETE FROM chat_messages WHERE emp_id = %s AND user_id = %s", (emp_id, DEV_USER_ID))
    execute("DELETE FROM chat_threads WHERE emp_id = %s AND user_id = %s", (emp_id, DEV_USER_ID))
    # Delete tasks
    execute("DELETE FROM data_store WHERE collection = %s AND user_id = %s", (f"tasks_{emp_id}", DEV_USER_ID))
    # Delete related schedules
    rows = query(
        "SELECT id, data FROM data_store WHERE collection = 'schedules' AND user_id = %s",
        (DEV_USER_ID,)
    )
    for r in rows:
        d = r["data"] if isinstance(r["data"], dict) else json.loads(r["data"])
        if d.get("empId") == emp_id:
            execute(
                "DELETE FROM data_store WHERE id = %s AND collection = 'schedules' AND user_id = %s",
                (r["id"], DEV_USER_ID)
            )

    return {"status": "deleted", "id": emp_id}
