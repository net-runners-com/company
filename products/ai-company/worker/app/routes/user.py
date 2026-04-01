"""User profile — GET/PUT/DELETE."""

import json

from fastapi import APIRouter, Request

from app.db import _get_db

router = APIRouter()


@router.get("/user/profile")
async def get_user_profile():
    """AIが学んだユーザー情報を取得"""
    conn = _get_db()
    try:
        rows = conn.execute("SELECT data FROM data_store WHERE collection = 'user_profile' LIMIT 1").fetchall()
        if rows:
            return json.loads(rows[0]["data"])
        return {}
    finally:
        conn.close()


@router.put("/user/profile")
async def update_user_profile_manual(request: Request):
    """ユーザーが手動でプロファイル編集"""
    body = await request.json()
    conn = _get_db()
    try:
        rows = conn.execute("SELECT id FROM data_store WHERE collection = 'user_profile' LIMIT 1").fetchall()
        profile_id = rows[0]["id"] if rows else "profile-main"
        conn.execute(
            "INSERT OR REPLACE INTO data_store (id, collection, data, updated_at) VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%S','now','localtime'))",
            [profile_id, "user_profile", json.dumps(body, ensure_ascii=False)]
        )
        conn.commit()
        return {"status": "updated"}
    finally:
        conn.close()


@router.delete("/user/profile")
async def reset_user_profile():
    """プロファイルリセット"""
    conn = _get_db()
    try:
        conn.execute("DELETE FROM data_store WHERE collection = 'user_profile'")
        conn.commit()
        return {"status": "reset"}
    finally:
        conn.close()
