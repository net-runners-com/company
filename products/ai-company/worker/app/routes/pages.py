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
    """プロンプトからHTML+Tailwindページを生成しSQLiteに保存"""
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

    return await _generate_html_page(prompt, collections_text, body)


async def _generate_html_page(prompt: str, collections_text: str, body: dict):
    """HTML+Tailwind+JSでページを丸ごと生成"""
    gen_prompt = f"""ユーザーの要望から完全なHTMLページを生成してください。

## 利用可能なデータコレクション
{collections_text}

## データAPI（fetch で呼べます）
- GET /api/data/{{collection}} → {{"collection":"...","count":N,"entries":[...]}}
- GET /api/data/{{collection}}?limit=50&q=検索語
- entries の各エントリには _id, _created_at 等のメタフィールドあり（表示時は除外推奨）

## 技術スタック（CDNで読み込み、ビルド不要）
- Tailwind CSS: <script src="https://cdn.tailwindcss.com"></script>
- Chart.js: <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
- marked.js: <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

## ユーザーの要望
{prompt}

## 出力ルール
1. <!DOCTYPE html>〜</html> の完全なHTMLを出力（他の文字は一切不要）
2. Tailwind CDN を <head> に含める
3. Chart.js/marked.js は必要な場合のみ読み込む
4. データは fetch("/api/data/コレクション名") で取得。async/await使用
5. カード/行はクリックでモーダル表示（HTML内にモーダルUIを実装）
6. .md表示が必要ならfetchで取得しmarked.parse()で描画
7. レスポンシブ対応（Tailwindのgrid/flex）
8. ページ読み込み完了時とDOM変更後に以下を実行:
   window.parent.postMessage({{type:'resize',height:document.body.scrollHeight}},'*')
9. デザイン: 背景bg-gray-50、カード白、テキストgray-800、アクセントviolet-600
10. UIは日本語
11. _id, _created_at 等の_始まりフィールドは非表示にする
12. モーダル実装の重要ルール（iframe内で動作するため必須。これを守らないとモーダルが正しく表示されない）:
    - モーダル表示関数の冒頭で: window.scrollTo(0,0); document.body.style.overflow='hidden'; document.documentElement.style.height='100vh'; window.parent.postMessage({{type:'modal-open'}},'*');
    - モーダル非表示関数の冒頭で: document.body.style.overflow=''; document.documentElement.style.height=''; window.parent.postMessage({{type:'modal-close'}},'*');
    - モーダルのオーバーレイCSS: position:fixed; top:0; left:0; right:0; bottom:0; z-index:9999; display:flex; align-items:center; justify-content:center;
    - モーダル内コンテンツは max-height:80vh; overflow-y:auto; にする
13. Markdown描画ルール:
    - データ内にMarkdown記法（##, ```, - 等）を含むフィールドがある場合、必ず marked.js CDN を読み込み marked.parse() でHTMLに変換して表示する
    - モーダル内でもカード内でも、Markdownテキストは必ずパースしてからinnerHTMLで描画する
    - 生テキストのまま表示してはいけない

```html
<!-- ここに完全なHTMLを出力 -->
```"""

    try:
        proc = await asyncio.create_subprocess_exec(
            "claude", "--dangerously-skip-permissions", "-p", gen_prompt, "--max-turns", "1",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=60)
        output = stdout.decode().strip()
    except Exception as e:
        return {"error": f"Generation failed: {e}"}

    # HTMLブロック抽出
    match = re.search(r'```html\s*(<!DOCTYPE.*?</html>)\s*```', output, re.DOTALL | re.IGNORECASE)
    if not match:
        match = re.search(r'(<!DOCTYPE.*?</html>)', output, re.DOTALL | re.IGNORECASE)
    if not match:
        return {"error": "Could not parse HTML", "raw": output[:500]}

    html_content = match.group(1)
    slug = body.get("slug") or str(uuid.uuid4())[:8]
    title = body.get("title", "")
    if not title:
        # プロンプトからタイトル推定
        title = prompt[:40].replace("\n", " ").strip()

    page_def = {
        "slug": slug,
        "title": title,
        "description": body.get("description", ""),
        "mode": "html",
        "html": html_content,
    }

    conn = _get_db()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO data_store (id, collection, data) VALUES (?, ?, ?)",
            [slug, "dashboards", json.dumps(page_def, ensure_ascii=False)]
        )
        conn.commit()
    finally:
        conn.close()

    return {"slug": slug, "title": title, "mode": "html", "status": "created"}




@router.get("/pages/list")
async def list_pages():
    """作成済みカスタムページ一覧"""
    conn = _get_db()
    try:
        rows = conn.execute("SELECT data FROM data_store WHERE collection = 'dashboards' ORDER BY created_at DESC").fetchall()
        return {"pages": [json.loads(r["data"]) for r in rows]}
    finally:
        conn.close()


@router.post("/pages/{slug}/update")
async def update_page(slug: str, request: Request):
    """既存ページのHTMLを修正プロンプトで更新"""
    body = await request.json()
    prompt = body.get("prompt", "")
    if not prompt:
        return {"error": "prompt is required"}

    # 既存ページ取得
    conn = _get_db()
    try:
        row = conn.execute("SELECT data FROM data_store WHERE id = ? AND collection = 'dashboards'", [slug]).fetchone()
    finally:
        conn.close()

    if not row:
        return {"error": "Page not found", "slug": slug}

    page_def = json.loads(row["data"])
    current_html = page_def.get("html", "")

    # コレクション情報取得
    conn = _get_db()
    try:
        rows = conn.execute("SELECT collection, COUNT(*) as count FROM data_store GROUP BY collection").fetchall()
        collections = [{"name": r["collection"], "count": r["count"]} for r in rows]
    finally:
        conn.close()

    collections_text = "\n".join(f"- {c['name']} ({c['count']}件)" for c in collections) if collections else "（まだなし）"

    update_prompt = f"""以下の既存HTMLページを修正してください。

## 修正指示
{prompt}

## 利用可能なデータコレクション
{collections_text}

## 現在のHTML
```html
{current_html}
```

## 出力ルール
- 修正後の完全な<!DOCTYPE html>〜</html>を出力（他の文字は不要）
- 既存の機能やデザインは維持しつつ、指示された修正のみ適用
- モーダル表示時: window.parent.postMessage({{type:'modal-open'}},'*')
- モーダル非表示時: window.parent.postMessage({{type:'modal-close'}},'*')
- Markdown描画には marked.parse() を使用

```html
<!-- 修正後のHTMLを出力 -->
```"""

    try:
        proc = await asyncio.create_subprocess_exec(
            "claude", "--dangerously-skip-permissions", "-p", update_prompt, "--max-turns", "1",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=60)
        output = stdout.decode().strip()
    except Exception as e:
        return {"error": f"Update failed: {e}"}

    match = re.search(r'```html\s*(<!DOCTYPE.*?</html>)\s*```', output, re.DOTALL | re.IGNORECASE)
    if not match:
        match = re.search(r'(<!DOCTYPE.*?</html>)', output, re.DOTALL | re.IGNORECASE)
    if not match:
        return {"error": "Could not parse HTML", "raw": output[:500]}

    page_def["html"] = match.group(1)

    conn = _get_db()
    try:
        conn.execute(
            "UPDATE data_store SET data = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%S','now','localtime') WHERE id = ? AND collection = 'dashboards'",
            [json.dumps(page_def, ensure_ascii=False), slug]
        )
        conn.commit()
    finally:
        conn.close()

    return {"slug": slug, "title": page_def.get("title", ""), "mode": "html", "status": "updated"}


@router.delete("/pages/{slug}")
async def delete_page(slug: str):
    """カスタムページを削除"""
    conn = _get_db()
    try:
        conn.execute("DELETE FROM data_store WHERE id = ? AND collection = 'dashboards'", [slug])
        conn.commit()
        return {"status": "deleted", "slug": slug}
    finally:
        conn.close()
