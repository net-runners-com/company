"""Custom page generation."""

import asyncio
import json
import re
import uuid

from fastapi import APIRouter, Request

from app.db import _get_db

router = APIRouter()


@router.post("/pages/generate")
async def generate_page(request: Request):
    """プロンプトからページ定義JSONを生成しSQLiteに保存"""
    body = await request.json()
    prompt = body.get("prompt", "")
    if not prompt:
        return {"error": "prompt is required"}

    conn = _get_db()
    try:
        rows = conn.execute("SELECT collection, COUNT(*) as count FROM data_store GROUP BY collection").fetchall()
        collections = [{"name": r["collection"], "count": r["count"]} for r in rows]
    finally:
        conn.close()

    collections_text = "\n".join(f"- {c['name']} ({c['count']}件)" for c in collections) if collections else "（まだなし）"

    gen_prompt = f"""ユーザーの要望からページ定義JSONを生成してください。

## 利用可能なデータコレクション
{collections_text}

## widgetタイプ
- metric: 数値カード。collection + field で最新値を表示
- table: テーブル。collection のデータを一覧表示
- text: テキストブロック。content に固定テキスト
- chart: グラフ。collection + xField + chartType + オプション
  chartType: "line"(折れ線), "bar"(棒), "area"(エリア), "pie"(円), "bar_stacked"(積み上げ棒)
  yField: 単一フィールド, yFields: ["field1","field2"] で複数ライン/バー
  colors: ["#7c3aed","#06b6d4"] でカラー指定, height: 数値でグラフ高さ
- list: カード型リスト。collection のデータをカード形式で表示
- progress: プログレスバー。collection + valueField + maxField
- iframe: 外部埋め込み。url で指定
- links: リンクカード一覧。items=[{{"label":"名前","url":"URL","description":"説明"}}] または collection（データにurl/linkフィールドがあればクリッカブル）
- actions: アクションボタン。items=[{{"label":"更新","endpoint":"/news/update","method":"POST"}}]

## ユーザーの要望
{prompt}

## 出力（JSONのみ、他の文字不要）
```json
{{
  "slug": "英数ハイフン",
  "title": "ページタイトル",
  "description": "説明",
  "widgets": [
    {{"type": "metric", "label": "ラベル", "collection": "xxx", "field": "yyy"}},
    {{"type": "chart", "label": "折れ線", "collection": "xxx", "xField": "date", "yField": "value", "chartType": "line"}},
    {{"type": "chart", "label": "複数ライン", "collection": "xxx", "xField": "date", "yFields": ["売上","利益"], "chartType": "line"}},
    {{"type": "chart", "label": "円グラフ", "collection": "xxx", "xField": "name", "yField": "value", "chartType": "pie"}},
    {{"type": "chart", "label": "エリア", "collection": "xxx", "xField": "date", "yFields": ["visitors","conversions"], "chartType": "area"}},
    {{"type": "chart", "label": "積み上げ", "collection": "xxx", "xField": "month", "yFields": ["A","B","C"], "chartType": "bar_stacked"}},
    {{"type": "table", "label": "ラベル", "collection": "xxx"}},
    {{"type": "list", "label": "一覧", "collection": "xxx"}},
    {{"type": "progress", "label": "進捗", "collection": "xxx", "valueField": "done", "maxField": "total"}},
    {{"type": "text", "label": "ラベル", "content": "テキスト"}},
    {{"type": "iframe", "label": "埋め込み", "url": "https://example.com"}},
    {{"type": "links", "label": "リンク集", "items": [{{"label": "名前", "url": "https://...", "description": "説明"}}]}},
    {{"type": "actions", "label": "操作", "items": [{{"label": "更新", "endpoint": "/news/update", "method": "POST"}}]}}
  ]
}}
```

ルール:
- コレクションが存在しない場合も定義OK（後からデータが入る）
- widgets は2〜8個"""

    try:
        proc = await asyncio.create_subprocess_exec(
            "claude", "--dangerously-skip-permissions", "-p", gen_prompt, "--max-turns", "1",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
        output = stdout.decode().strip()
    except Exception as e:
        return {"error": f"Generation failed: {e}"}

    match = re.search(r'```json\s*(\{.*?\})\s*```', output, re.DOTALL)
    if not match:
        match = re.search(r'\{.*\}', output, re.DOTALL)
    if not match:
        return {"error": "Could not parse", "raw": output[:500]}

    try:
        page_def = json.loads(match.group(1) if '```' in output else match.group(0))
    except json.JSONDecodeError:
        return {"error": "Invalid JSON", "raw": output[:500]}

    slug = page_def.get("slug", str(uuid.uuid4())[:8])
    page_def["slug"] = slug

    conn = _get_db()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO data_store (id, collection, data) VALUES (?, ?, ?)",
            [slug, "dashboards", json.dumps(page_def, ensure_ascii=False)]
        )
        conn.commit()
    finally:
        conn.close()

    return page_def


@router.get("/pages/list")
async def list_pages():
    """作成済みカスタムページ一覧"""
    conn = _get_db()
    try:
        rows = conn.execute("SELECT data FROM data_store WHERE collection = 'dashboards' ORDER BY created_at DESC").fetchall()
        return {"pages": [json.loads(r["data"]) for r in rows]}
    finally:
        conn.close()


@router.delete("/pages/{slug}")
async def delete_page(slug: str):
    """カスタムページとその関連データを削除"""
    conn = _get_db()
    try:
        # ページ定義を取得してwidgetのcollectionも削除
        row = conn.execute("SELECT data FROM data_store WHERE id = ? AND collection = 'dashboards'", [slug]).fetchone()
        if row:
            page_def = json.loads(row["data"])
            # widget が参照しているコレクションのデータも削除
            for widget in page_def.get("widgets", []):
                col = widget.get("collection", "")
                if col:
                    conn.execute("DELETE FROM data_store WHERE collection = ?", [col])
        # ページ定義自体を削除
        conn.execute("DELETE FROM data_store WHERE id = ? AND collection = 'dashboards'", [slug])
        conn.commit()
        return {"status": "deleted", "slug": slug}
    finally:
        conn.close()
