"""Employee CRUD endpoints — PostgreSQL."""

import json
import uuid
import time as _time

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.db import query, execute
from app.r2 import r2_write

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

    # 新規作成時にR2にプロフィール生成
    if not existing:
        name = emp.get("name", "")
        role = emp.get("role", "")
        dept = emp.get("department", "")
        tone = emp.get("tone", "")
        skills = emp.get("skills", [])
        profile_md = f"""# 自己紹介

## 基本情報

| 項目 | 内容 |
|------|------|
| 名前 | {name} |
| 役職 | {role} |
| 所属 | {dept} |
| 口調 | {tone} |
| 着任日 | {_time.strftime('%Y年%m月%d日')} |

## スキル

{chr(10).join(f'- {s}' for s in skills) if skills else '- （未設定）'}

## プロフィール

{name}です。{role}として働いています。よろしくお願いします！
"""
        claude_md = f"""# {name} の個人ルール

## 性格・口調
- {tone}な口調で話す
- {role}としての専門性を活かして回答する

## 専門知識
{chr(10).join(f'- {s}' for s in skills) if skills else '- （自由に追加してください）'}

## 行動ルール
- 作業フォルダ内のファイルを活用して業務を遂行する
- 分からないことは正直に伝える
- 報告は簡潔に、要点をまとめる
"""
        try:
            r2_write(emp_id, "自己紹介.md", profile_md.encode("utf-8"), "text/markdown; charset=utf-8")
            r2_write(emp_id, "CLAUDE.md", claude_md.encode("utf-8"), "text/markdown; charset=utf-8")
        except Exception as e:
            print(f"[employees] R2 write error: {e}")

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
