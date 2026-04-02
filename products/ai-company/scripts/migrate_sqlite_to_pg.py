"""Migrate data from Worker SQLite to PostgreSQL (back service).

Usage: docker compose exec worker python /app/scripts/migrate_sqlite_to_pg.py
  Or:  python scripts/migrate_sqlite_to_pg.py  (if SQLite is accessible locally)
"""

import json
import sqlite3
import psycopg2
import os
import sys

SQLITE_PATH = os.environ.get("SQLITE_PATH", "/workspace/data/store.db")
PG_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@db:5432/aicompany")
DEV_USER_ID = "00000000-0000-0000-0000-000000000001"


def migrate():
    if not os.path.exists(SQLITE_PATH):
        print(f"[migrate] SQLite not found: {SQLITE_PATH}")
        sys.exit(1)

    sq = sqlite3.connect(SQLITE_PATH)
    sq.row_factory = sqlite3.Row
    pg = psycopg2.connect(PG_URL)
    cur = pg.cursor()

    # ─── employees ───
    rows = sq.execute("SELECT id, data, created_at, updated_at FROM employees").fetchall()
    for r in rows:
        cur.execute(
            """INSERT INTO employees (id, user_id, data, created_at, updated_at)
               VALUES (%s, %s, %s, COALESCE(%s::timestamptz, now()), COALESCE(%s::timestamptz, now()))
               ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()""",
            (r["id"], DEV_USER_ID, r["data"], r["created_at"], r["updated_at"])
        )
    print(f"[migrate] employees: {len(rows)}")

    # ─── data_store ───
    rows = sq.execute("SELECT id, collection, data, created_at, updated_at FROM data_store").fetchall()
    for r in rows:
        cur.execute(
            """INSERT INTO data_store (id, collection, user_id, data, created_at, updated_at)
               VALUES (%s, %s, %s, %s, COALESCE(%s::timestamptz, now()), COALESCE(%s::timestamptz, now()))
               ON CONFLICT (id, collection, user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()""",
            (r["id"], r["collection"], DEV_USER_ID, r["data"], r["created_at"], r["updated_at"])
        )
    print(f"[migrate] data_store: {len(rows)}")

    # ─── chat_threads ───
    rows = sq.execute("SELECT id, emp_id, title, created_at FROM chat_threads").fetchall()
    for r in rows:
        cur.execute(
            """INSERT INTO chat_threads (id, user_id, emp_id, title, created_at)
               VALUES (%s, %s, %s, %s, COALESCE(%s::timestamptz, now()))
               ON CONFLICT (id) DO NOTHING""",
            (r["id"], DEV_USER_ID, r["emp_id"], r["title"], r["created_at"])
        )
    print(f"[migrate] chat_threads: {len(rows)}")

    # ─── chat_messages ───
    # Ensure "default" thread exists for each emp_id that has messages with thread_id="default"
    orphan_emps = sq.execute(
        "SELECT DISTINCT emp_id FROM chat_messages WHERE thread_id = 'default'"
    ).fetchall()
    for oe in orphan_emps:
        cur.execute(
            """INSERT INTO chat_threads (id, user_id, emp_id, title)
               VALUES ('default-' || %s, %s, %s, 'General')
               ON CONFLICT (id) DO NOTHING""",
            (oe["emp_id"], DEV_USER_ID, oe["emp_id"])
        )
    # Also remap thread_id="default" to "default-{emp_id}"
    rows = sq.execute("SELECT thread_id, emp_id, role, content, created_at FROM chat_messages ORDER BY id").fetchall()
    for r in rows:
        tid = r["thread_id"] if r["thread_id"] != "default" else f"default-{r['emp_id']}"
        cur.execute(
            """INSERT INTO chat_messages (thread_id, user_id, emp_id, role, content, created_at)
               VALUES (%s, %s, %s, %s, %s, COALESCE(%s::timestamptz, now()))""",
            (tid, DEV_USER_ID, r["emp_id"], r["role"], r["content"], r["created_at"])
        )
    print(f"[migrate] chat_messages: {len(rows)}")

    # ─── connectors ───
    rows = sq.execute("SELECT id, data, created_at, updated_at FROM connectors").fetchall()
    for r in rows:
        cur.execute(
            """INSERT INTO connectors (id, user_id, data, created_at, updated_at)
               VALUES (%s, %s, %s, COALESCE(%s::timestamptz, now()), COALESCE(%s::timestamptz, now()))
               ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()""",
            (r["id"], DEV_USER_ID, r["data"], r["created_at"], r["updated_at"])
        )
    print(f"[migrate] connectors: {len(rows)}")

    pg.commit()
    cur.close()
    pg.close()
    sq.close()
    print("[migrate] Done!")


if __name__ == "__main__":
    migrate()
