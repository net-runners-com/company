"""Auth setup — called after Supabase signup to initialize user resources."""

import json
import time as _time

from fastapi import APIRouter
from app.db import query, execute
from app.r2 import r2_write
from app.routes.employees import save_employee

router = APIRouter()

INITIAL_EMPLOYEES = [
    {"id": "emp-1", "name": "さくら", "role": "秘書", "department": "総務部", "tone": "やさしい敬語", "skills": ["スケジュール管理", "メモ整理", "相談相手"]},
    {"id": "emp-2", "name": "りく", "role": "営業", "department": "営業部", "tone": "元気で前向き", "skills": ["メール作成", "提案書", "フォローアップ"]},
    {"id": "emp-3", "name": "あおい", "role": "経理", "department": "経理部", "tone": "丁寧で正確", "skills": ["経費処理", "仕訳入力", "請求書発行"]},
]


@router.post("/auth/setup")
async def setup_user(payload: dict):
    """新規ユーザーの初期セットアップ: 初期社員作成 + プロフィール生成"""
    user_id = payload.get("userId", "")
    name = payload.get("name", "")

    if not user_id:
        return {"error": "userId required"}

    # 既にセットアップ済みかチェック
    existing = query("SELECT id FROM employees WHERE user_id = %s LIMIT 1", (user_id,))
    if existing:
        return {"status": "already_setup"}

    # 初期社員を作成
    for emp in INITIAL_EMPLOYEES:
        emp_data = {
            **emp,
            "updatedAt": _time.strftime("%Y-%m-%dT%H:%M:%S"),
        }
        execute(
            """INSERT INTO employees (id, user_id, data, updated_at) VALUES (%s, %s, %s, now())
               ON CONFLICT (id) DO NOTHING""",
            (emp["id"], user_id, json.dumps(emp_data, ensure_ascii=False))
        )

        # R2にプロフィール生成
        try:
            profile_md = f"# 自己紹介\n\n| 項目 | 内容 |\n|------|------|\n| 名前 | {emp['name']} |\n| 役職 | {emp['role']} |\n| 所属 | {emp['department']} |\n| 着任日 | {_time.strftime('%Y年%m月%d日')} |\n\n{emp['name']}です。{emp['role']}として働いています。よろしくお願いします！\n"
            r2_write(emp["id"], "自己紹介.md", profile_md.encode("utf-8"), "text/markdown; charset=utf-8")

            claude_md = f"# {emp['name']} の個人ルール\n\n## 性格・口調\n- {emp['tone']}な口調で話す\n- {emp['role']}としての専門性を活かして回答する\n\n## 専門知識\n" + "\n".join(f"- {s}" for s in emp["skills"]) + "\n"
            r2_write(emp["id"], "CLAUDE.md", claude_md.encode("utf-8"), "text/markdown; charset=utf-8")
        except Exception as e:
            print(f"[auth/setup] R2 write error for {emp['id']}: {e}")

    # TODO: Fly.io Machine作成（本番用）
    # container_url = await _ensure_container_running(user_id)

    return {"status": "setup_complete", "employees": len(INITIAL_EMPLOYEES)}
