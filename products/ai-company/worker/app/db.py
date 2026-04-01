"""SQLite Data Store — helpers for the shared database."""

import json
import sqlite3
from pathlib import Path

SQLITE_PATH = Path("/workspace/data/store.db")
SQLITE_PATH.parent.mkdir(parents=True, exist_ok=True)


def _get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(SQLITE_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _init_db():
    conn = _get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS data_store (
            id TEXT PRIMARY KEY,
            collection TEXT NOT NULL,
            data JSON NOT NULL,
            created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now','localtime')),
            updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now','localtime'))
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_collection ON data_store(collection)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_created ON data_store(collection, created_at)")

    # チャットスレッド
    conn.execute("""
        CREATE TABLE IF NOT EXISTS chat_threads (
            id TEXT PRIMARY KEY,
            emp_id TEXT NOT NULL,
            title TEXT NOT NULL DEFAULT '',
            created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now','localtime'))
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_threads_emp ON chat_threads(emp_id)")

    # チャットメッセージ
    conn.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            thread_id TEXT NOT NULL,
            emp_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now','localtime'))
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_msgs_thread ON chat_messages(thread_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_msgs_emp ON chat_messages(emp_id)")

    # 社員マスタ
    conn.execute("""
        CREATE TABLE IF NOT EXISTS employees (
            id TEXT PRIMARY KEY,
            data JSON NOT NULL,
            created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now','localtime')),
            updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now','localtime'))
        )
    """)

    # コネクタ設定
    conn.execute("""
        CREATE TABLE IF NOT EXISTS connectors (
            id TEXT PRIMARY KEY,
            data JSON NOT NULL,
            created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now','localtime')),
            updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S','now','localtime'))
        )
    """)

    conn.commit()

    # JSON → SQLite マイグレーション（初回のみ）
    _migrate_json_to_sqlite(conn)

    conn.close()
    print(f"[startup] SQLite initialized: {SQLITE_PATH}")


def _migrate_json_to_sqlite(conn):
    """既存JSONファイルをSQLiteに移行（初回起動時のみ）"""
    import os

    # employees.json → employees テーブル
    emp_file = Path("/workspace/data/employees.json")
    if emp_file.exists():
        count = conn.execute("SELECT COUNT(*) FROM employees").fetchone()[0]
        if count == 0:
            data = json.loads(emp_file.read_text())
            for eid, emp in data.items():
                conn.execute("INSERT OR IGNORE INTO employees (id, data) VALUES (?, ?)",
                    [eid, json.dumps(emp, ensure_ascii=False)])
            conn.commit()
            print(f"[migrate] employees.json → SQLite ({len(data)} records)")
            emp_file.rename(emp_file.with_suffix(".json.bak"))

    # connectors.json → connectors テーブル
    conn_file = Path("/workspace/data/connectors.json")
    if conn_file.exists():
        count = conn.execute("SELECT COUNT(*) FROM connectors").fetchone()[0]
        if count == 0:
            data = json.loads(conn_file.read_text())
            for cid, c in data.items():
                conn.execute("INSERT OR IGNORE INTO connectors (id, data) VALUES (?, ?)",
                    [cid, json.dumps(c, ensure_ascii=False)])
            conn.commit()
            print(f"[migrate] connectors.json → SQLite ({len(data)} records)")
            conn_file.rename(conn_file.with_suffix(".json.bak"))
