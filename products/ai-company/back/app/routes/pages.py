"""Custom pages — CRUD + generate/update via worker agent."""

import json
import os
import re
import uuid
import urllib.request
import urllib.error

from fastapi import APIRouter, Request
from app.db import query, execute

router = APIRouter()

DEV_USER_ID = "00000000-0000-0000-0000-000000000001"
DEV_WORKER_URL = os.environ.get("DEV_WORKER_URL", "http://worker:8000")


def _call_worker(path: str, data: dict, timeout: int = 60) -> dict:
    url = f"{DEV_WORKER_URL}{path}"
    body = json.dumps(data, ensure_ascii=False).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"error": str(e)}


def _extract_html(text: str) -> str | None:
    match = re.search(r'```html\s*(<!DOCTYPE.*?</html>)\s*```', text, re.DOTALL | re.IGNORECASE)
    if not match:
        match = re.search(r'(<!DOCTYPE.*?</html>)', text, re.DOTALL | re.IGNORECASE)
    return match.group(1) if match else None


# ─── CRUD ───

@router.get("/pages/list")
async def list_pages():
    rows = query(
        "SELECT data FROM data_store WHERE collection = 'dashboards' AND user_id = %s ORDER BY created_at DESC",
        (DEV_USER_ID,)
    )
    return {"pages": [r["data"] if isinstance(r["data"], dict) else json.loads(r["data"]) for r in rows]}


@router.get("/pages/{slug}")
async def get_page(slug: str):
    row = query(
        "SELECT data FROM data_store WHERE id = %s AND collection = 'dashboards' AND user_id = %s",
        (slug, DEV_USER_ID), one=True
    )
    if not row:
        return {"error": "Not found"}
    return row["data"] if isinstance(row["data"], dict) else json.loads(row["data"])


@router.post("/pages/{slug}/save")
async def save_page(slug: str, payload: dict = {}):
    execute(
        """INSERT INTO data_store (id, collection, user_id, data, updated_at)
           VALUES (%s, 'dashboards', %s, %s, now())
           ON CONFLICT (id, collection, user_id) DO UPDATE
           SET data = EXCLUDED.data, updated_at = now()""",
        (slug, DEV_USER_ID, json.dumps(payload, ensure_ascii=False))
    )
    return {"slug": slug, "status": "saved"}


@router.delete("/pages/{slug}")
async def delete_page(slug: str):
    execute(
        "DELETE FROM data_store WHERE id = %s AND collection = 'dashboards' AND user_id = %s",
        (slug, DEV_USER_ID)
    )
    return {"status": "deleted", "slug": slug}


# ─── Generate / Update (via worker /agent/run) ───

PAGE_GEN_PROMPT_TEMPLATE = """ユーザーの要望から完全なHTMLページを生成してください。

## 利用可能なデータコレクション
{collections}

## データAPI（fetch で呼べます）
- GET /api/data/{{collection}} → {{"collection":"...","count":N,"entries":[...]}}
- entries の各エントリには _id, _created_at 等のメタフィールドあり（表示時は除外推奨）

## 技術スタック（CDN）
- Tailwind CSS: <script src="https://cdn.tailwindcss.com"></script>
- Chart.js / marked.js は必要時のみ

## ユーザーの要望
{prompt}

## 出力ルール
- <!DOCTYPE html>〜</html> の完全なHTMLのみ出力
- Tailwind CDN を head に含める
- データは fetch("/api/data/コレクション名") で取得
- レスポンシブ対応、UIは日本語
- _始まりフィールドは非表示
- Markdown描画には marked.parse() を使用

```html
<!-- HTMLを出力 -->
```"""


@router.post("/pages/generate")
async def generate_page(request: Request):
    body = await request.json()
    prompt = body.get("prompt", "")
    if not prompt:
        return {"error": "prompt is required"}

    # コレクション情報取得
    rows = query(
        "SELECT collection, COUNT(*) as count FROM data_store WHERE user_id = %s GROUP BY collection",
        (DEV_USER_ID,)
    )
    collections_text = "\n".join(f"- {r['collection']} ({r['count']}件)" for r in rows) if rows else "（まだなし）"

    gen_prompt = PAGE_GEN_PROMPT_TEMPLATE.format(collections=collections_text, prompt=prompt)

    # Worker /agent/run で生成
    result = _call_worker("/agent/run", {
        "empId": "emp-1",
        "task": gen_prompt,
        "threadTitle": f"ページ生成: {prompt[:20]}",
        "maxTurns": 1,
        "timeout": 60,
    })

    reply = result.get("reply", "")
    html = _extract_html(reply)
    if not html:
        return {"error": "Could not parse HTML", "raw": reply[:500]}

    slug = body.get("slug") or str(uuid.uuid4())[:8]
    title = body.get("title") or prompt[:40].replace("\n", " ").strip()

    page_def = {"slug": slug, "title": title, "description": body.get("description", ""), "mode": "html", "html": html}
    execute(
        """INSERT INTO data_store (id, collection, user_id, data, updated_at)
           VALUES (%s, 'dashboards', %s, %s, now())
           ON CONFLICT (id, collection, user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()""",
        (slug, DEV_USER_ID, json.dumps(page_def, ensure_ascii=False))
    )

    return {"slug": slug, "title": title, "mode": "html", "status": "created"}


@router.post("/pages/{slug}/update")
async def update_page(slug: str, request: Request):
    body = await request.json()
    prompt = body.get("prompt", "")
    if not prompt:
        return {"error": "prompt is required"}

    page_def = await get_page(slug)
    if not page_def or page_def.get("error"):
        return {"error": "Page not found", "slug": slug}

    current_html = page_def.get("html", "")

    update_prompt = f"""以下の既存HTMLページを修正してください。

## 修正指示
{prompt}

## 現在のHTML
```html
{current_html}
```

## 出力ルール
- 修正後の完全な<!DOCTYPE html>〜</html>のみ出力
- 既存の機能やデザインは維持しつつ、指示された修正のみ適用

```html
<!-- 修正後のHTMLを出力 -->
```"""

    result = _call_worker("/agent/run", {
        "empId": "emp-1",
        "task": update_prompt,
        "threadTitle": f"ページ修正: {slug}",
        "maxTurns": 1,
        "timeout": 60,
    })

    reply = result.get("reply", "")
    html = _extract_html(reply)
    if not html:
        return {"error": "Could not parse HTML", "raw": reply[:500]}

    page_def["html"] = html
    execute(
        """UPDATE data_store SET data = %s, updated_at = now()
           WHERE id = %s AND collection = 'dashboards' AND user_id = %s""",
        (json.dumps(page_def, ensure_ascii=False), slug, DEV_USER_ID)
    )

    return {"slug": slug, "title": page_def.get("title", ""), "mode": "html", "status": "updated"}
