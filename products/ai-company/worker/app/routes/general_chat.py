"""General chat — /chat, /chat/stream, /playwright/*."""

import asyncio
import json
import os
import subprocess
import time

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter()


@router.post("/chat")
async def chat(payload: dict):
    """Claude Code CLI でメッセージを処理して返す"""
    message = payload.get("message", "")
    if not message:
        return {"error": "message is required"}

    try:
        result = subprocess.run(
            ["claude", "--dangerously-skip-permissions", "-p", message],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode != 0 and not result.stdout:
            return {"error": result.stderr or f"Exit code {result.returncode}"}
        return {"response": result.stdout.strip()}
    except subprocess.TimeoutExpired:
        return {"error": "Timeout: Claude Code took too long (120s)"}
    except Exception as e:
        return {"error": str(e)}


BROWSER_SYSTEM_PROMPT = """ブラウザ自動化エージェント。Playwright(async_api)でブラウザ操作。

環境: DISPLAY=:99, headless=False, args=["--no-sandbox"]必須。timeout=30000。
セレクタ優先順: get_by_role > get_by_label > get_by_placeholder > locator(CSS)
遷移: goto(url, wait_until="networkidle")。遷移後wait_for_load_state("networkidle")。
入力: click() → fill()の2ステップ。submit=ボタンclick、失敗ならkeyboard.press("Enter")。
エラー: screenshot("/tmp/debug.png")で確認→リトライ(3回まで)。完了後/tmp/一時ファイル削除。
SPA: wait_for_selector/wait_for_load_state使用。要素なしは1秒待機でリトライ。
操作完了後はasyncio.sleep(30)でブラウザ維持。"""


@router.post("/chat/stream")
async def chat_stream(payload: dict):
    """Claude Code CLI のストリーミング出力を SSE で返す"""
    message = payload.get("message", "")
    if not message:
        return {"error": "message is required"}

    async def generate():
        proc = await asyncio.create_subprocess_exec(
            "claude", "--dangerously-skip-permissions", "-p", message,
            "--system-prompt", BROWSER_SYSTEM_PROMPT,
            "--output-format", "stream-json", "--verbose",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            async for line in proc.stdout:
                text = line.decode().strip()
                if not text:
                    continue
                try:
                    event = json.loads(text)
                    # stream-json の content_block_delta からテキストを抽出
                    if event.get("type") == "content_block_delta":
                        delta = event.get("delta", {})
                        chunk = delta.get("text", "")
                        if chunk:
                            yield f"data: {json.dumps({'text': chunk})}\n\n"
                    elif event.get("type") == "result":
                        # 最終結果
                        result_text = event.get("result", "")
                        if result_text:
                            yield f"data: {json.dumps({'text': result_text})}\n\n"
                except json.JSONDecodeError:
                    # JSON でないプレーンテキスト行
                    yield f"data: {json.dumps({'text': text})}\n\n"

            await proc.wait()
            stderr_out = await proc.stderr.read()
            if proc.returncode != 0 and stderr_out:
                yield f"data: {json.dumps({'error': stderr_out.decode().strip()})}\n\n"
        except asyncio.CancelledError:
            proc.kill()
            raise
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ============================================
# Playwright API
# ============================================

@router.post("/playwright/navigate")
async def playwright_navigate(payload: dict):
    """ブラウザで URL を開く（VNC で確認可能）"""
    url = payload.get("url", "")
    if not url:
        return {"error": "url is required"}

    # まず既存の chromium を閉じる
    subprocess.run(["pkill", "-f", "chromium"], capture_output=True)
    time.sleep(1)

    script = (
        "import asyncio\n"
        "from playwright.async_api import async_playwright\n"
        "\n"
        "async def main():\n"
        "    async with async_playwright() as p:\n"
        "        browser = await p.chromium.launch(\n"
        "            headless=False,\n"
        '            args=["--no-sandbox", "--disable-gpu", "--window-size=1280,720"]\n'
        "        )\n"
        "        page = await browser.new_page(viewport={'width': 1280, 'height': 720})\n"
        f'        await page.goto("{url}", wait_until="domcontentloaded", timeout=30000)\n'
        "        title = await page.title()\n"
        "        print(title)\n"
        "        await asyncio.sleep(600)\n"
        "        await browser.close()\n"
        "\n"
        "asyncio.run(main())\n"
    )
    try:
        env = {**os.environ, "DISPLAY": ":99"}
        proc = subprocess.Popen(
            ["python3", "-c", script],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            env=env,
        )
        time.sleep(3)
        return {
            "status": "opened",
            "pid": proc.pid,
            "url": url,
        }
    except Exception as e:
        return {"error": str(e)}


@router.post("/playwright/close")
async def playwright_close(payload: dict):
    """開いているブラウザを閉じる"""
    try:
        subprocess.run(["pkill", "-f", "chromium"], capture_output=True)
        return {"status": "closed"}
    except Exception as e:
        return {"error": str(e)}


@router.post("/playwright/run")
async def playwright_run(payload: dict):
    """Playwrightスクリプトを実行"""
    script = payload.get("script", "")
    if not script:
        return {"error": "script is required"}

    try:
        env = {**os.environ, "DISPLAY": ":99"}
        result = subprocess.run(
            ["python3", "-c", script],
            capture_output=True, text=True, timeout=120, env=env,
        )
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"error": "Timeout (120s)"}
    except Exception as e:
        return {"error": str(e)}


@router.get("/playwright/status")
async def playwright_status():
    """VNC/ブラウザの状態確認"""
    xvfb = subprocess.run(["pgrep", "-f", "Xvfb"], capture_output=True).returncode == 0
    vnc = subprocess.run(["pgrep", "-f", "x11vnc"], capture_output=True).returncode == 0
    novnc = subprocess.run(["pgrep", "-f", "websockify"], capture_output=True).returncode == 0
    return {
        "xvfb": xvfb,
        "vnc": vnc,
        "novnc": novnc,
        "novnc_url": "http://localhost:6080",
        "display": os.environ.get("DISPLAY", "not set"),
    }


