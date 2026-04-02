"""Employee CRUD endpoints."""

import uuid
import time as _time

from fastapi import APIRouter

from app.employee import load_employees, save_employees, get_employee
from app.r2 import _r2_write

router = APIRouter()


@router.post("/employees")
async def upsert_employee(payload: dict):
    """社員を登録/更新"""
    employees = load_employees()
    emp_id = payload.get("id", "")
    if not emp_id:
        # IDがなければ自動生成
        emp_id = f"emp-{str(uuid.uuid4())[:8]}"

    existing = employees.get(emp_id, {})
    employees[emp_id] = {
        **existing,
        "id": emp_id,
        "name": payload.get("name", existing.get("name", "")),
        "role": payload.get("role", existing.get("role", "")),
        "department": payload.get("department", existing.get("department", "")),
        "tone": payload.get("tone", existing.get("tone", "")),
        "skills": payload.get("skills", existing.get("skills", [])),
        "systemPrompt": payload.get("systemPrompt", existing.get("systemPrompt", "")),
        "sessionId": existing.get("sessionId"),  # セッションは保持
        "avatarConfig": payload.get("avatarConfig", existing.get("avatarConfig")),
        "updatedAt": _time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    save_employees(employees)

    # 新規作成時に自己紹介.md を R2 に生成
    if not existing:
        emp = employees[emp_id]
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
        try:
            _r2_write(emp_id, "自己紹介.md", profile_md.encode("utf-8"), "text/markdown; charset=utf-8")
        except Exception as e:
            print(f"[employees] R2 profile write error: {e}")

        # CLAUDE.md（個人ルール）テンプレート
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

## 学んだこと
<!-- オーナーとの会話で学んだことを追記していく -->

## やってはいけないこと
<!-- 禁止事項があれば追記 -->
"""
        try:
            _r2_write(emp_id, "CLAUDE.md", claude_md.encode("utf-8"), "text/markdown; charset=utf-8")
        except Exception as e:
            print(f"[employees] R2 CLAUDE.md write error: {e}")

    return employees[emp_id]


@router.get("/employees")
async def list_employees():
    return load_employees()


@router.get("/employees/{emp_id}")
async def get_employee_info(emp_id: str):
    emp = get_employee(emp_id)
    if not emp:
        return {"error": "Not found"}
    return emp


@router.delete("/employees/{emp_id}")
async def delete_employee(emp_id: str):
    """社員を削除（解雇）— Back API経由"""
    import app.back_client as back
    return back.delete(f"/employees/{emp_id}")
