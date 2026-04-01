"""Generic data store CRUD endpoints."""

import json
import uuid

from fastapi import APIRouter, Request

from app.db import _get_db

router = APIRouter()


@router.post("/data/{collection}")
async def data_create(collection: str, request: Request):
    """データを追加。エージェントやフロントから自由に使える"""
    body = await request.json()
    doc_id = body.pop("id", None) or str(uuid.uuid4())[:8]
    conn = _get_db()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO data_store (id, collection, data, updated_at) VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%S','now','localtime'))",
            [doc_id, collection, json.dumps(body, ensure_ascii=False)]
        )
        conn.commit()
        return {"id": doc_id, "collection": collection, "status": "created"}
    finally:
        conn.close()


@router.get("/data/{collection}")
async def data_list(collection: str, q: str = "", limit: int = 100, offset: int = 0):
    """コレクション内のデータ一覧。q= で全文検索"""
    conn = _get_db()
    try:
        if q:
            rows = conn.execute(
                "SELECT id, data, created_at FROM data_store WHERE collection = ? AND data LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
                [collection, f"%{q}%", limit, offset]
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, data, created_at FROM data_store WHERE collection = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
                [collection, limit, offset]
            ).fetchall()

        count = conn.execute(
            "SELECT COUNT(*) FROM data_store WHERE collection = ?", [collection]
        ).fetchone()[0]

        entries = []
        for r in rows:
            entry = json.loads(r["data"])
            entry["_id"] = r["id"]
            entry["_created_at"] = r["created_at"]
            entries.append(entry)

        return {"collection": collection, "count": count, "entries": entries}
    finally:
        conn.close()


@router.get("/data/{collection}/{doc_id}")
async def data_get(collection: str, doc_id: str):
    """1件取得"""
    conn = _get_db()
    try:
        row = conn.execute(
            "SELECT id, data, created_at FROM data_store WHERE collection = ? AND id = ?",
            [collection, doc_id]
        ).fetchone()
        if not row:
            return {"error": "Not found"}, 404
        entry = json.loads(row["data"])
        entry["_id"] = row["id"]
        entry["_created_at"] = row["created_at"]
        return entry
    finally:
        conn.close()


@router.put("/data/{collection}/{doc_id}")
async def data_update(collection: str, doc_id: str, request: Request):
    """データ更新"""
    body = await request.json()
    conn = _get_db()
    try:
        existing = conn.execute(
            "SELECT data FROM data_store WHERE collection = ? AND id = ?",
            [collection, doc_id]
        ).fetchone()
        if not existing:
            return {"error": "Not found"}, 404

        merged = {**json.loads(existing["data"]), **body}
        conn.execute(
            "UPDATE data_store SET data = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%S','now','localtime') WHERE collection = ? AND id = ?",
            [json.dumps(merged, ensure_ascii=False), collection, doc_id]
        )
        conn.commit()
        return {"id": doc_id, "status": "updated"}
    finally:
        conn.close()


@router.delete("/data/{collection}/{doc_id}")
async def data_delete(collection: str, doc_id: str):
    """データ削除"""
    conn = _get_db()
    try:
        conn.execute("DELETE FROM data_store WHERE collection = ? AND id = ?", [collection, doc_id])
        conn.commit()
        return {"id": doc_id, "status": "deleted"}
    finally:
        conn.close()


@router.get("/data")
async def data_collections():
    """登録済みコレクション一覧"""
    conn = _get_db()
    try:
        rows = conn.execute(
            "SELECT collection, COUNT(*) as count FROM data_store GROUP BY collection ORDER BY collection"
        ).fetchall()
        return {"collections": [{"name": r["collection"], "count": r["count"]} for r in rows]}
    finally:
        conn.close()
