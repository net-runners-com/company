"""News — fetch, update, cron setup."""

import asyncio
import json
import re
import time as _time

from fastapi import APIRouter

import app.back_client as back

router = APIRouter()

_news_update_lock = False


async def _fetch_news():
    """Claude CLI でニュースを取得してSQLiteに保存"""
    global _news_update_lock
    if _news_update_lock:
        return
    _news_update_lock = True

    prompt = f"""今日は{_time.strftime('%Y年%m月%d日')}です。
以下のカテゴリから最新ニュースを6件取得してJSON配列で返してください。
カテゴリ: tech（テック）, business（ビジネス）, industry（業界）, market（マーケット）

Web検索やブラウザを使って実際の最新ニュースを取得してください。

出力形式（JSONのみ、他の文字不要）:
```json
[
  {{"title":"ニュースタイトル","source":"ソース名","category":"tech","summary":"要約2-3文","url":"https://記事のURL","publishedAt":"{_time.strftime('%Y-%m-%d')}T06:00:00Z"}}
]
```"""

    try:
        proc = await asyncio.create_subprocess_exec(
            "claude", "--dangerously-skip-permissions", "-p", prompt, "--max-turns", "5",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=60)
        output = stdout.decode().strip()
        match = re.search(r'```json\s*(\[.*?\])\s*```', output, re.DOTALL)
        if not match:
            match = re.search(r'\[.*\]', output, re.DOTALL)
        if match:
            news = json.loads(match.group(1) if '```' in output else match.group(0))
            back.post("/news", {"items": news})
            print(f"[news] Updated: {len(news)} articles")
    except Exception as e:
        print(f"[news] Error: {e}")
    finally:
        _news_update_lock = False


@router.post("/news/update")
async def update_news():
    """ニュースを手動更新"""
    asyncio.create_task(_fetch_news())
    return {"status": "updating"}


