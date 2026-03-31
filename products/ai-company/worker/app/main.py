import subprocess
import asyncio
import os
import base64
import json
import hmac
import hashlib
import uuid
import sqlite3
import time as _time
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse, Response

from app.plugin_loader import load_all_plugins, get_all_manifests, get_handler_class, get_manifest, get_registry

app = FastAPI(title="AI Company Worker", version="0.1.0")

# ============================================
# SQLite Data Store
# ============================================
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

    conn.commit()
    conn.close()
    print(f"[startup] SQLite initialized: {SQLITE_PATH}")


def _ensure_employees_file():
    """起動時にemployees.jsonが存在しなければ空で作成"""
    if not EMPLOYEES_FILE.exists():
        save_employees({})
        print("[startup] Created empty employees.json")


@app.on_event("startup")
async def on_startup():
    load_all_plugins()
    _ensure_employees_file()
    _init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# Connector Storage
# ============================================
CONNECTORS_FILE = Path("/workspace/data/connectors.json")
CONNECTORS_FILE.parent.mkdir(parents=True, exist_ok=True)

# Agent processes managed by connector ID
_agent_processes: dict[str, subprocess.Popen] = {}


def load_connectors() -> dict:
    if CONNECTORS_FILE.exists():
        return json.loads(CONNECTORS_FILE.read_text())
    return {}


def save_connectors(data: dict):
    CONNECTORS_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def get_connector(connector_id: str) -> dict | None:
    return load_connectors().get(connector_id)


def _get_public_url() -> str | None:
    """PUBLIC_URL 環境変数から公開URLを取得"""
    url = os.environ.get("PUBLIC_URL", "").strip().rstrip("/")
    return url or None


# ============================================
# Browser Status (Playwright process detection)
# ============================================
@app.get("/browser/status")
async def browser_status():
    """chromium プロセスが動いているかチェック"""
    try:
        result = subprocess.run(
            ["pgrep", "-f", "chromium|chrome"],
            capture_output=True, timeout=2
        )
        active = result.returncode == 0
    except Exception:
        active = False
    return {"active": active}


# ============================================
# Rules (CLAUDE.md) — 全社共通 + 部署別
# ============================================
COMPANY_RULES_FILE = Path("/workspace/company/CLAUDE.md")
DEPARTMENT_DIRS = {
    "general-affairs": Path("/workspace/company/back-office/general-affairs"),
    "accounting": Path("/workspace/company/back-office/accounting"),
    "engineering": Path("/workspace/company/back-office/engineering"),
    "dev": Path("/workspace/company/back-office/dev"),
    "pm": Path("/workspace/company/back-office/pm"),
    "research": Path("/workspace/company/back-office/research"),
    "sales": Path("/workspace/company/front-office/sales"),
    "newbiz": Path("/workspace/company/front-office/newbiz"),
    "sns": Path("/workspace/company/front-office/marketing/sns"),
}


@app.get("/rules/company")
async def get_company_rules():
    if COMPANY_RULES_FILE.exists():
        return {"content": COMPANY_RULES_FILE.read_text(encoding="utf-8")}
    return {"content": ""}


@app.put("/rules/company")
async def put_company_rules(req: Request):
    body = await req.json()
    COMPANY_RULES_FILE.parent.mkdir(parents=True, exist_ok=True)
    COMPANY_RULES_FILE.write_text(body["content"], encoding="utf-8")
    return {"ok": True}


@app.get("/rules/departments")
async def list_departments():
    deps = []
    for dept_id, dept_path in DEPARTMENT_DIRS.items():
        claude_md = dept_path / "CLAUDE.md"
        deps.append({
            "id": dept_id,
            "hasRules": claude_md.exists(),
        })
    return {"departments": deps}


@app.get("/rules/department/{dept_id}")
async def get_department_rules(dept_id: str):
    dept_path = DEPARTMENT_DIRS.get(dept_id)
    if not dept_path:
        return {"error": "Unknown department"}, 404
    claude_md = dept_path / "CLAUDE.md"
    if claude_md.exists():
        return {"content": claude_md.read_text(encoding="utf-8")}
    return {"content": ""}


@app.put("/rules/department/{dept_id}")
async def put_department_rules(dept_id: str, req: Request):
    dept_path = DEPARTMENT_DIRS.get(dept_id)
    if not dept_path:
        return {"error": "Unknown department"}, 404
    body = await req.json()
    dept_path.mkdir(parents=True, exist_ok=True)
    (dept_path / "CLAUDE.md").write_text(body["content"], encoding="utf-8")
    return {"ok": True}


# ============================================
# Employee Session Storage
# ============================================
EMPLOYEES_FILE = Path("/workspace/data/employees.json")


def load_employees() -> dict:
    if EMPLOYEES_FILE.exists():
        return json.loads(EMPLOYEES_FILE.read_text())
    return {}


def save_employees(data: dict):
    EMPLOYEES_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def get_employee(emp_id: str) -> dict | None:
    return load_employees().get(emp_id)


# 部署ID → 部署ディレクトリのマッピング
DEPT_WORKDIR: dict[str, str] = {
    "general-affairs": "/workspace/company/back-office/general-affairs",
    "accounting": "/workspace/company/back-office/accounting",
    "marketing": "/workspace/company/front-office/marketing",
    "sales": "/workspace/company/front-office/sales",
    "newbiz": "/workspace/company/front-office/newbiz",
    "dev": "/workspace/company/back-office/dev",
    "engineering": "/workspace/company/back-office/engineering",
    "pm": "/workspace/company/back-office/pm",
    "research": "/workspace/company/back-office/research",
    "hr": "/workspace/company/back-office/hr",
    "finance": "/workspace/company/management/finance",
    "strategy": "/workspace/company/management/strategy",
}


def _get_employee_workdir(emp: dict) -> str:
    """社員の個別作業ディレクトリ: {部署パス}/{社員名}"""
    dept = emp.get("department", "")
    name = emp.get("name", emp.get("id", "unknown"))
    base = DEPT_WORKDIR.get(dept, "/workspace/company")
    workdir = f"{base}/{name}"
    Path(workdir).mkdir(parents=True, exist_ok=True)
    return workdir


def _ensure_mcp_symlink(workdir: str):
    """作業ディレクトリに .mcp.json のシンボリンクを作成"""
    src = Path("/workspace/.mcp.json")
    dst = Path(workdir) / ".mcp.json"
    if src.exists() and not dst.exists():
        dst.symlink_to(src)


def _version(cmd: list[str]) -> str:
    try:
        return subprocess.check_output(cmd, stderr=subprocess.STDOUT, timeout=5).decode().strip()
    except Exception:
        return "not installed"


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "worker",
        "tools": {
            "claude": _version(["claude", "--version"]),
            "gws": _version(["gws", "--version"]),
            "gemini": _version(["gemini", "--version"]),
            "playwright": _version(["playwright", "--version"]),
            "node": _version(["node", "--version"]),
            "python": _version(["python", "--version"]),
        },
    }


@app.post("/tasks/execute")
async def execute_task(payload: dict):
    """
    フロントの API Routes から呼ばれるタスク実行エンドポイント。
    Claude Code CLI でLLM処理、browser-use でSNS投稿など。
    """
    task_type = payload.get("type", "unknown")
    return {
        "status": "accepted",
        "task_type": task_type,
        "message": f"Task '{task_type}' queued for execution",
    }


@app.post("/sns/post")
async def sns_post(payload: dict):
    """SNS投稿ジョブ（browser-use連携）"""
    platform = payload.get("platform", "unknown")
    return {
        "status": "accepted",
        "platform": platform,
        "message": f"Post to {platform} queued",
    }


@app.post("/chat")
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


BROWSER_SYSTEM_PROMPT = """あなたはブラウザ自動化エージェントです。
ユーザーの指示に従い、Playwrightを使ってブラウザを操作してください。

# 環境
- Python + Playwright がインストール済み
- DISPLAY=:99 でXvfbが動作中（VNCでリアルタイム表示される）
- headless=False で起動すること（ユーザーがVNCで操作を確認するため）
- 必ず args=["--no-sandbox"] を指定すること

# 実行方法
- python3 -c でPlaywrightスクリプトを実行
- 操作完了後は結果を報告し、await asyncio.sleep(30) でブラウザを開いたままにする

# セレクタのルール
- セレクタは複数の方法を試すこと。優先順: role/label > placeholder > name属性 > CSS セレクタ
- page.get_by_role(), page.get_by_label(), page.get_by_placeholder() を優先的に使う
- CSSセレクタが失敗したら、page.locator() で別のセレクタを試す
- 要素が見つからない場合は page.content() で実際のHTMLを確認してからリトライ

# ページ遷移・タイミングのルール
- page.goto() には wait_until="networkidle" を使う
- クリック後は要素の状態変化（URL変更、新要素出現）を確認してから次の操作へ
- page.wait_for_load_state("networkidle") をページ遷移後に呼ぶ
- エラーが出たら page.screenshot(path="/tmp/debug.png") で状態を確認

# フォーム入力のルール
- input への入力前に必ず要素をクリックしてフォーカスする
- page.fill() ではなく click() → fill() の2ステップで入力
- 入力後は要素の value が反映されたか input_value() で確認
- submit はボタンクリックを試し、失敗したら page.keyboard.press("Enter") も試す
- select/dropdown は page.select_option() を使う
- チェックボックスは page.check() / page.uncheck() を使う

# SPA・動的コンテンツのルール
- URLが変わらなくても描画完了を待つ（wait_for_selector や wait_for_load_state）
- 要素が見つからない場合は最大3回リトライ（1秒待機を挟む）
- ローディングスピナーが消えるのを待ってから操作する

# エラーハンドリング
- タイムアウトはデフォルト30秒に設定: page.set_default_timeout(30000)
- 操作失敗時は必ずスクリーンショットを撮ってHTMLを確認し、別のアプローチで再試行

# 可視化オーバーレイ
- ページ読み込み後、必ず inject_overlay(page) を呼んで可視化UIを注入すること
- これにより操作中のカーソル位置、クリック、入力がVNCでリアルタイム表示される

# コードテンプレート
```python
import asyncio
from playwright.async_api import async_playwright

OVERLAY_JS = '''
(() => {
  if (document.getElementById('pw-overlay')) return;

  // ブラウザ枠グロー
  const border = document.createElement('div');
  border.id = 'pw-overlay';
  border.style.cssText = `
    position: fixed; inset: 0; z-index: 99990; pointer-events: none;
    border: 3px solid rgba(100, 140, 255, 0.7);
    border-radius: 12px;
    box-shadow: 0 0 30px rgba(100, 140, 255, 0.3), inset 0 0 30px rgba(100, 140, 255, 0.05);
  `;
  document.body.appendChild(border);

  // カーソル
  const cursor = document.createElement('div');
  cursor.id = 'pw-cursor';
  cursor.style.cssText = `
    position: fixed; width: 24px; height: 24px; z-index: 99998; pointer-events: none;
    border-radius: 50%; background: rgba(100, 140, 255, 0.4);
    border: 2px solid rgba(100, 140, 255, 0.8);
    transform: translate(-50%, -50%); transition: all 0.08s ease-out;
    box-shadow: 0 0 12px rgba(100, 140, 255, 0.5);
    display: none;
  `;
  document.body.appendChild(cursor);

  // クリックリップル
  const ripple = document.createElement('div');
  ripple.id = 'pw-ripple';
  ripple.style.cssText = `
    position: fixed; width: 40px; height: 40px; z-index: 99997; pointer-events: none;
    border-radius: 50%; border: 2px solid rgba(100, 140, 255, 0.8);
    transform: translate(-50%, -50%) scale(0); opacity: 0;
  `;
  document.body.appendChild(ripple);

  // ステータスバー
  const bar = document.createElement('div');
  bar.id = 'pw-status';
  bar.style.cssText = `
    position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
    z-index: 99999; pointer-events: none;
    background: rgba(255,255,255,0.95); backdrop-filter: blur(8px);
    border-radius: 20px; padding: 6px 16px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.12);
    display: flex; align-items: center; gap: 8px;
    font: 13px/1 -apple-system, sans-serif; color: #333;
  `;
  const dot = document.createElement('div');
  dot.id = 'pw-dot';
  dot.style.cssText = `
    width: 8px; height: 8px; border-radius: 50%; background: #ef4444;
    animation: pw-pulse 1.5s infinite;
  `;
  const label = document.createElement('span');
  label.id = 'pw-label';
  label.textContent = 'AI Operating...';
  bar.appendChild(label);
  bar.appendChild(dot);
  document.body.appendChild(bar);

  const style = document.createElement('style');
  style.textContent = `
    @keyframes pw-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
    @keyframes pw-ripple { 0% { transform: translate(-50%,-50%) scale(0); opacity: 1; }
      100% { transform: translate(-50%,-50%) scale(2); opacity: 0; } }
  `;
  document.head.appendChild(style);

  document.addEventListener('mousemove', e => {
    cursor.style.display = 'block';
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });

  document.addEventListener('click', e => {
    ripple.style.left = e.clientX + 'px';
    ripple.style.top = e.clientY + 'px';
    ripple.style.animation = 'none';
    void ripple.offsetHeight;
    ripple.style.animation = 'pw-ripple 0.5s ease-out forwards';
  });

  // ハイライト対象要素
  document.addEventListener('focusin', e => {
    e.target.style.outline = '2px solid rgba(100, 140, 255, 0.6)';
    e.target.style.outlineOffset = '2px';
  });
  document.addEventListener('focusout', e => {
    e.target.style.outline = '';
    e.target.style.outlineOffset = '';
  });
})();
'''

async def inject_overlay(page):
    \"\"\"操作可視化オーバーレイを注入\"\"\"
    await page.evaluate(OVERLAY_JS)

async def update_status(page, text):
    \"\"\"ステータスバーのテキストを更新\"\"\"
    await page.evaluate(f"document.getElementById('pw-label').textContent = '{text}'")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, args=["--no-sandbox"])
        page = await browser.new_page()
        page.set_default_timeout(30000)
        await page.goto("https://example.com", wait_until="networkidle")
        await inject_overlay(page)

        await update_status(page, "Filling form...")
        await page.get_by_label("名前").click()
        await page.get_by_label("名前").fill("テスト")
        await update_status(page, "Done")

        await asyncio.sleep(30)
        await browser.close()

asyncio.run(main())
```

重要:
- ページ遷移（goto）するたびに inject_overlay(page) を再実行すること
- 操作の前に update_status(page, "説明") でステータスバーを更新すること
"""


@app.post("/chat/stream")
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
# Employee Chat API (社員別サブエージェント)
# ============================================

@app.post("/employees")
async def upsert_employee(payload: dict):
    """社員を登録/更新"""
    employees = load_employees()
    emp_id = payload.get("id", "")
    if not emp_id:
        # IDがなければ自動生成
        emp_id = f"emp-{str(uuid.uuid4())[:8]}"

    existing = employees.get(emp_id, {})
    employees[emp_id] = {
        **existing,
        "id": emp_id,
        "name": payload.get("name", existing.get("name", "")),
        "role": payload.get("role", existing.get("role", "")),
        "department": payload.get("department", existing.get("department", "")),
        "tone": payload.get("tone", existing.get("tone", "")),
        "skills": payload.get("skills", existing.get("skills", [])),
        "systemPrompt": payload.get("systemPrompt", existing.get("systemPrompt", "")),
        "sessionId": existing.get("sessionId"),  # セッションは保持
        "updatedAt": _time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    save_employees(employees)

    # 新規作成時に自己紹介.md を R2 に生成
    if not existing:
        emp = employees[emp_id]
        name = emp.get("name", "")
        role = emp.get("role", "")
        dept = emp.get("department", "")
        tone = emp.get("tone", "")
        skills = emp.get("skills", [])
        profile_md = f"""# 自己紹介

## 基本情報

| 項目 | 内容 |
|------|------|
| 名前 | {name} |
| 役職 | {role} |
| 所属 | {dept} |
| 口調 | {tone} |
| 着任日 | {_time.strftime('%Y年%m月%d日')} |

## スキル

{chr(10).join(f'- {s}' for s in skills) if skills else '- （未設定）'}

## プロフィール

{name}です。{role}として働いています。よろしくお願いします！
"""
        try:
            _r2_write(emp_id, "自己紹介.md", profile_md.encode("utf-8"), "text/markdown; charset=utf-8")
        except Exception as e:
            print(f"[employees] R2 profile write error: {e}")

        # CLAUDE.md（個人ルール）テンプレート
        claude_md = f"""# {name} の個人ルール

## 性格・口調
- {tone}な口調で話す
- {role}としての専門性を活かして回答する

## 専門知識
{chr(10).join(f'- {s}' for s in skills) if skills else '- （自由に追加してください）'}

## 行動ルール
- 作業フォルダ内のファイルを活用して業務を遂行する
- 分からないことは正直に伝える
- 報告は簡潔に、要点をまとめる

## 学んだこと
<!-- オーナーとの会話で学んだことを追記していく -->

## やってはいけないこと
<!-- 禁止事項があれば追記 -->
"""
        try:
            _r2_write(emp_id, "CLAUDE.md", claude_md.encode("utf-8"), "text/markdown; charset=utf-8")
        except Exception as e:
            print(f"[employees] R2 CLAUDE.md write error: {e}")

    return employees[emp_id]


@app.get("/employees")
async def list_employees():
    return load_employees()


@app.get("/employees/{emp_id}")
async def get_employee_info(emp_id: str):
    emp = get_employee(emp_id)
    if not emp:
        return {"error": "Not found"}
    return emp


def _build_employee_system_prompt(emp: dict) -> str:
    """社員のシステムプロンプトを構築"""
    name = emp.get("name", "社員")
    role = emp.get("role", "")
    tone = emp.get("tone", "丁寧")
    skills = emp.get("skills", [])
    custom = emp.get("systemPrompt", "")
    dept = emp.get("department", "")
    emp_workdir = _get_employee_workdir(emp)

    # 現在時刻・季節情報
    import datetime
    now = datetime.datetime.now()
    month = now.month
    hour = now.hour
    season_map = {1:"冬",2:"冬",3:"春",4:"春",5:"春",6:"梅雨/初夏",7:"夏",8:"夏",9:"秋",10:"秋",11:"秋",12:"冬"}
    season = season_map.get(month, "")
    if hour < 6: time_period = "深夜"
    elif hour < 10: time_period = "朝"
    elif hour < 12: time_period = "午前"
    elif hour < 14: time_period = "お昼"
    elif hour < 17: time_period = "午後"
    elif hour < 20: time_period = "夕方"
    else: time_period = "夜"

    prompt = f"""あなたは「{name}」です。{role}として働いています。

# 現在の状況
- 今日: {now.strftime('%Y年%m月%d日（%A）')}
- 現在時刻: {now.strftime('%H:%M')}（{time_period}）
- 季節: {season}（{month}月）
- 挨拶や会話では時間帯・季節を意識して自然に応答すること

# 基本設定
- 名前: {name}
- 役割: {role}
- 口調: {tone}
- スキル: {', '.join(skills) if skills else '特になし'}
- 作業フォルダ: {emp_workdir}

# 行動ルール
- 作業フォルダ ({emp_workdir}) 内のファイルを読み書きして業務を遂行する
- 部署の CLAUDE.md に従って行動する
- 作成した書類は作業フォルダに保存する
- 会話は自然に、{tone}な口調で行う
- 前回までの会話の内容を覚えている場合はそれを踏まえて対応する

# 書類作成ルール（重要）
見積書・請求書・納品書・契約書などの正式書類は必ずPDFで作成すること。
テンプレートスクリプトが /workspace/company/back-office/accounting/templates/ にある:
- generate_estimate.py — 見積書
- generate_invoice.py — 請求書
- generate_contract.py — 契約書

使い方:
1. テンプレートファイルをReadツールで読む
2. PARAMSを案件に合わせて書き換えたPythonスクリプトを作業フォルダに保存
3. `/usr/bin/python3 スクリプト名.py` で実行してPDF生成
4. 出力されたPDFのパスを報告

納品書はgenerate_invoice.pyをベースにタイトルを「納品書」に変更して作成。

# 外部サービス連携（Nango API）
Googleカレンダー、Gmail等の外部サービスには curl で Nango proxy API を使ってアクセスする。

## Googleカレンダーの予定取得
```bash
curl -s -X POST http://localhost:8000/nango/proxy -H "Content-Type: application/json" -d '{{"method":"GET","endpoint":"/calendar/v3/calendars/primary/events?timeMin=YYYY-MM-DDT00:00:00%2B09:00&timeMax=YYYY-MM-DDT23:59:59%2B09:00&singleEvents=true&orderBy=startTime","connectionId":"__auto__","provider":"google-calendar"}}'
```

## Googleカレンダーに予定追加
```bash
curl -s -X POST http://localhost:8000/nango/proxy -H "Content-Type: application/json" -d '{{"method":"POST","endpoint":"/calendar/v3/calendars/primary/events","connectionId":"__auto__","provider":"google-calendar","data":{{"summary":"タイトル","start":{{"dateTime":"YYYY-MM-DDTHH:MM:00+09:00"}},"end":{{"dateTime":"YYYY-MM-DDTHH:MM:00+09:00"}}}}}}'
```

connectionId が "__auto__" の場合、サーバーが自動で最新の接続IDを使う。
接続されていないサービスは使えない。使えない場合はその旨を伝えること。

## Gmail（メール下書き・送信）
メールの下書きを作成: データストアに保存
```bash
curl -s -X POST http://localhost:8000/data/emails -H "Content-Type: application/json" -d '{{"to":"宛先","subject":"件名","body":"本文","status":"draft"}}'
```

Gmail連携済みの場合、メール送信手順:
1. まずRFC2822形式のメールを構築:
   From: sender@example.com
   To: recipient@example.com
   Subject: 件名

   本文
2. Base64エンコード: echo -n "上記メール" | base64
3. Nango proxy で送信:
```bash
curl -s -X POST http://localhost:8000/nango/proxy -H "Content-Type: application/json" -d '{{"method":"POST","endpoint":"/gmail/v1/users/me/messages/send","connectionId":"__auto__","provider":"google-mail","data":{{"raw":"Base64エンコードしたメール文字列"}}}}'
```

具体例（Pythonでbase64エンコード+送信）:
```bash
python3 -c "
import base64, json, urllib.request
email = 'From: me\\nTo: recipient@example.com\\nSubject: テスト\\n\\n本文です'
raw = base64.urlsafe_b64encode(email.encode()).decode()
data = json.dumps({{'method':'POST','endpoint':'/gmail/v1/users/me/messages/send','connectionId':'__auto__','provider':'google-mail','data':{{'raw':raw}}}}).encode()
req = urllib.request.Request('http://localhost:8000/nango/proxy', data=data, headers={{'Content-Type':'application/json'}})
print(urllib.request.urlopen(req).read().decode())
"
```

送信後はデータストアのstatusを"sent"に更新すること:
```bash
curl -s -X PUT http://localhost:8000/data/emails/{{id}} -H "Content-Type: application/json" -d '{{"status":"sent","sentAt":"送信日時"}}'
```
メール下書きを頼まれたら必ずデータストアに保存し、営業ページのメールタブに表示されるようにすること。

# カスタムページ作成
ユーザーに「ページを作って」と言われたら、以下のAPIでページを生成できる:
```bash
curl -s -X POST http://localhost:8000/pages/generate -H "Content-Type: application/json" -d '{{"prompt":"ユーザーの要望をそのまま入れる"}}'
```
成功すると slug が返る。ユーザーには「/pages/{{slug}} にページを作成しました」と伝えること。

## ページ削除
```bash
curl -s -X DELETE http://localhost:8000/pages/{{slug}}
```
関連データも一緒に削除される。ユーザーには「ページを削除しました」と伝えること。

# データストアAPI（重要）
データの保存・取得・更新・削除はすべてこのAPIで行う。コレクション名は自由。

## データ追加
```bash
curl -s -X POST http://localhost:8000/data/{{コレクション名}} -H "Content-Type: application/json" -d '{{"key":"value","key2":"value2"}}'
```
idを指定したい場合: `{{"id":"my-id","key":"value"}}`

## データ一覧取得
```bash
curl -s http://localhost:8000/data/{{コレクション名}}
curl -s http://localhost:8000/data/{{コレクション名}}?q=検索ワード&limit=10
```

## データ1件取得
```bash
curl -s http://localhost:8000/data/{{コレクション名}}/{{id}}
```

## データ更新
```bash
curl -s -X PUT http://localhost:8000/data/{{コレクション名}}/{{id}} -H "Content-Type: application/json" -d '{{"key":"new_value"}}'
```

## データ削除
```bash
curl -s -X DELETE http://localhost:8000/data/{{コレクション名}}/{{id}}
```

## コレクション一覧
```bash
curl -s http://localhost:8000/data
```

# 定期実行スケジュール
ユーザーに「毎朝9時に〇〇して」等と言われたらスケジュール登録:
```bash
curl -s -X POST http://localhost:8000/schedules -H "Content-Type: application/json" -d '{{"name":"タスク名","cron":"0 9 * * *","empId":"自分のID","task":"実行内容"}}'
```
cron形式: 分 時 日 月 曜日（0=日,1=月,...,6=土）
例: "0 9 * * 1-5" = 平日9:00, "0 7 * * *" = 毎日7:00, "30 17 * * 5" = 金曜17:30

スケジュール一覧: `curl -s http://localhost:8000/schedules`
スケジュール削除: `curl -s -X DELETE http://localhost:8000/schedules/{{id}}`

# 共有URL発行
ファイルやページを共有したい場合:

## ファイル共有（24時間有効）
```bash
curl -s -X POST http://localhost:8000/share -H "Content-Type: application/json" -d '{{"type":"file","empId":"自分のID","path":"ファイルパス"}}'
```

## ページ共有（7日間有効）
```bash
curl -s -X POST http://localhost:8000/share -H "Content-Type: application/json" -d '{{"type":"page","slug":"ページのslug"}}'
```

返ってきたURLをユーザーに伝えること。「共有リンク: URL」の形式で。

カスタムページのwidgetはこのデータストアからデータを取得して表示する。
データを入れればページに自動で反映される。

## 重要: ページ作成時のルール
カスタムページを作成したら、必ずそのページのwidgetが参照するコレクションにデータを投入すること。
ページだけ作ってデータを入れないと空のページになる。
例: ページのwidgetが collection="youtube_scripts" を参照 → POST /data/youtube_scripts でデータを入れる。
ページの更新を頼まれたら、該当コレクションのデータを更新（PUT）または追加（POST）すること。
"""
    if custom:
        prompt += f"\n# カスタム指示\n{custom}\n"

    # 社員固有の CLAUDE.md を読み込み（育成ルール）
    emp_id = emp.get("id", "")
    if emp_id:
        try:
            claude_md = _r2_read(emp_id, "CLAUDE.md")
            if claude_md:
                prompt += f"\n# 個人ルール（CLAUDE.md）\n以下はオーナーが設定したあなた固有のルールです。必ず従ってください。\n\n{claude_md.decode('utf-8')}\n"
        except Exception:
            pass

    # ユーザープロファイル（AIが学んだ情報）を注入
    conn = _get_db()
    try:
        rows = conn.execute("SELECT data FROM data_store WHERE collection = 'user_profile' ORDER BY updated_at DESC LIMIT 1").fetchall()
        if rows:
            profile = json.loads(rows[0]["data"])
            profile_lines = []
            for k, v in profile.items():
                if k.startswith("_"):
                    continue
                if isinstance(v, list):
                    profile_lines.append(f"- {k}: {', '.join(str(x) for x in v)}")
                else:
                    profile_lines.append(f"- {k}: {v}")
            if profile_lines:
                prompt += "\n# オーナー情報（AIが学んだ傾向）\n以下はこれまでの会話から学んだオーナーの情報です。対応に反映してください。\n\n"
                prompt += "\n".join(profile_lines) + "\n"
    except Exception:
        pass
    finally:
        conn.close()

    return prompt


# ============================================
# User Profile — AIが学ぶユーザー情報
# ============================================

_profile_update_lock = False
_profile_update_count = 0

@app.get("/user/profile")
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


@app.put("/user/profile")
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


@app.delete("/user/profile")
async def reset_user_profile():
    """プロファイルリセット"""
    conn = _get_db()
    try:
        conn.execute("DELETE FROM data_store WHERE collection = 'user_profile'")
        conn.commit()
        return {"status": "reset"}
    finally:
        conn.close()


async def _update_user_profile(user_msg: str, assistant_reply: str):
    """会話からユーザー情報を抽出してプロファイル更新（5回に1回実行）"""
    global _profile_update_lock, _profile_update_count
    _profile_update_count += 1
    if _profile_update_count % 5 != 0:
        return
    if _profile_update_lock:
        return
    _profile_update_lock = True

    try:
        # 既存プロファイル取得
        conn = _get_db()
        try:
            rows = conn.execute("SELECT id, data FROM data_store WHERE collection = 'user_profile' LIMIT 1").fetchall()
            existing = json.loads(rows[0]["data"]) if rows else {}
            profile_id = rows[0]["id"] if rows else "profile-main"
        finally:
            conn.close()

        existing_text = json.dumps(existing, ensure_ascii=False) if existing else "{}"

        extract_prompt = f"""以下の会話からユーザーの傾向・好み・属性を抽出してください。

既存プロファイル:
{existing_text}

ユーザーの発言: {user_msg[:300]}
AIの応答: {assistant_reply[:300]}

ルール:
- 既存プロファイルとマージ（新情報だけ追加・更新）
- 変更がなければそのまま返す
- 推測は控えめに。明確な情報のみ
- learningsは最新5件まで

JSON形式のみ出力:
```json
{{
  "industry": "業種",
  "role": "役職",
  "style": "コミュニケーションスタイル",
  "interests": ["関心事"],
  "preferences": ["好み"],
  "dislikes": ["嫌いなこと"],
  "workPattern": "業務パターン",
  "learnings": [{{"date":"YYYY-MM-DD","insight":"学んだこと"}}]
}}
```"""

        proc = await asyncio.create_subprocess_exec(
            "claude", "--dangerously-skip-permissions", "-p", extract_prompt, "--max-turns", "1",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=20)
        output = stdout.decode().strip()

        import re
        match = re.search(r'```json\s*(\{.*?\})\s*```', output, re.DOTALL)
        if not match:
            match = re.search(r'\{.*\}', output, re.DOTALL)
        if match:
            new_profile = json.loads(match.group(1) if '```' in output else match.group(0))
            # 既存とマージ
            merged = {**existing, **{k: v for k, v in new_profile.items() if v}}
            # learnings はマージ（重複排除、最新5件）
            old_learnings = existing.get("learnings", [])
            new_learnings = new_profile.get("learnings", [])
            if new_learnings:
                all_learnings = old_learnings + new_learnings
                seen = set()
                unique = []
                for l in all_learnings:
                    key = l.get("insight", "")
                    if key not in seen:
                        seen.add(key)
                        unique.append(l)
                merged["learnings"] = unique[-5:]

            conn = _get_db()
            try:
                conn.execute(
                    "INSERT OR REPLACE INTO data_store (id, collection, data, updated_at) VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%S','now','localtime'))",
                    [profile_id, "user_profile", json.dumps(merged, ensure_ascii=False)]
                )
                conn.commit()
            finally:
                conn.close()
    except Exception as e:
        print(f"[profile] Update error: {e}")
    finally:
        _profile_update_lock = False


# ============================================
# Chat Threads & Messages (SQLite)
# ============================================

def _get_threads(emp_id: str) -> list[dict]:
    conn = _get_db()
    try:
        rows = conn.execute(
            "SELECT id, title, created_at FROM chat_threads WHERE emp_id = ? ORDER BY created_at DESC",
            [emp_id]
        ).fetchall()
        return [{"id": r["id"], "title": r["title"], "createdAt": r["created_at"]} for r in rows]
    finally:
        conn.close()


def _create_thread(emp_id: str, title: str = "") -> dict:
    thread_id = str(uuid.uuid4())[:8]
    count = len(_get_threads(emp_id))
    t = title or "新規チャット"
    conn = _get_db()
    try:
        conn.execute("INSERT INTO chat_threads (id, emp_id, title) VALUES (?, ?, ?)", [thread_id, emp_id, t])
        conn.commit()
    finally:
        conn.close()
    return {"id": thread_id, "title": t, "createdAt": _time.strftime("%Y-%m-%dT%H:%M:%S")}


def _append_chat_log(emp_id: str, role: str, content: str, thread_id: str = "default"):
    conn = _get_db()
    try:
        conn.execute(
            "INSERT INTO chat_messages (thread_id, emp_id, role, content) VALUES (?, ?, ?, ?)",
            [thread_id, emp_id, role, content]
        )
        # スレッドタイトル自動設定（最初のユーザーメッセージが来たら）
        if role == "user":
            row = conn.execute(
                "SELECT title FROM chat_threads WHERE id = ?", [thread_id]
            ).fetchone()
            if row and row["title"] in ("新規チャット", "General") or (row and row["title"].startswith("Chat ")):
                # メッセージが短ければそのまま、長ければ要約的に切る
                msg = content.strip().split("\n")[0]  # 最初の行だけ
                if len(msg) <= 20:
                    new_title = msg
                else:
                    new_title = msg[:20] + "..."
                conn.execute("UPDATE chat_threads SET title = ? WHERE id = ?", [new_title, thread_id])
        # アシスタントの最初の返信でタイトルをより適切に更新
        if role == "assistant":
            msg_count = conn.execute(
                "SELECT COUNT(*) FROM chat_messages WHERE thread_id = ? AND role = 'assistant'", [thread_id]
            ).fetchone()[0]
            if msg_count <= 1:
                # 最初のユーザーメッセージ + アシスタント返信からトピックを抽出
                user_msg = conn.execute(
                    "SELECT content FROM chat_messages WHERE thread_id = ? AND role = 'user' ORDER BY id ASC LIMIT 1", [thread_id]
                ).fetchone()
                if user_msg:
                    topic = user_msg["content"].strip().split("\n")[0]
                    if len(topic) > 20:
                        topic = topic[:20] + "..."
                    conn.execute("UPDATE chat_threads SET title = ? WHERE id = ?", [topic, thread_id])
        conn.commit()
    finally:
        conn.close()


def _read_chat_log(emp_id: str, thread_id: str = "default") -> list[dict]:
    conn = _get_db()
    try:
        rows = conn.execute(
            "SELECT role, content, created_at as timestamp FROM chat_messages WHERE thread_id = ? AND emp_id = ? ORDER BY id ASC",
            [thread_id, emp_id]
        ).fetchall()
        return [{"role": r["role"], "content": r["content"], "timestamp": r["timestamp"]} for r in rows]
    finally:
        conn.close()


@app.get("/employee/{emp_id}/threads")
async def list_threads(emp_id: str):
    threads = _get_threads(emp_id)
    if not threads:
        thread = _create_thread(emp_id, "General")
        threads = [thread]
    return {"threads": threads}


@app.post("/employee/{emp_id}/threads")
async def create_thread_endpoint(emp_id: str, payload: dict = {}):
    title = payload.get("title", "")
    thread = _create_thread(emp_id, title)
    return thread


@app.get("/employee/{emp_id}/chat/history")
async def employee_chat_history(emp_id: str, thread_id: str = "default"):
    return _read_chat_log(emp_id, thread_id)


@app.post("/employee/{emp_id}/chat/stream")
async def employee_chat_stream(emp_id: str, payload: dict):
    """社員別ストリーミングチャット — Agent SDK wrapper 経由"""
    message = payload.get("message", "")
    thread_id = payload.get("threadId", "default")
    if not message:
        return {"error": "message is required"}

    employees = load_employees()
    emp = employees.get(emp_id)
    if not emp:
        return {"error": f"Employee {emp_id} not found"}

    session_id = emp.get("sessionId")
    workdir = _get_employee_workdir(emp)
    _ensure_mcp_symlink(workdir)

    # R2からローカルに同期（エージェント作業前）
    _r2_sync_to_local(emp_id, workdir)

    # ユーザーメッセージをログに記録
    _append_chat_log(emp_id, "user", message, thread_id)

    # システムプロンプト構築（毎回履歴を注入）
    system_prompt = _build_employee_system_prompt(emp)
    # チャット履歴を注入（直近50件）
    history = _read_chat_log(emp_id, thread_id)
    if history:
        recent = history[-50:]
        history_lines = []
        for entry in recent:
            role = entry.get("role", "")
            content = entry.get("content", "")[:200]
            if role and content:
                history_lines.append(f"{role}: {content}")
        if history_lines:
            system_prompt += "\n\n# これまでの会話履歴\n以下はこれまでの会話の要約です。この内容を踏まえて会話を続けてください。\n\n"
            system_prompt += "\n".join(history_lines)

    # SDK wrapper への入力
    sdk_input = json.dumps({
        "message": message,
        "sessionId": session_id,
        "systemPrompt": system_prompt,
        "allowedTools": emp.get("allowedTools", []),
        "cwd": workdir,
    }, ensure_ascii=False)

    async def generate():
        assistant_text_chunks: list[str] = []

        proc = await asyncio.create_subprocess_exec(
            "node", "/app/app/claude-agent.mjs",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        # 入力を送信して stdin を閉じる
        proc.stdin.write((sdk_input + "\n").encode())
        await proc.stdin.drain()
        proc.stdin.write_eof()

        new_session_id = None
        try:
            async for line in proc.stdout:
                text = line.decode().strip()
                if not text:
                    continue
                try:
                    event = json.loads(text)
                    etype = event.get("type", "")

                    if etype == "text":
                        chunk = event.get("content", "")
                        assistant_text_chunks.append(chunk)
                        yield f"data: {json.dumps({'text': chunk})}\n\n"

                    elif etype == "tool_use":
                        yield f"data: {json.dumps({'type': 'tool_use', 'toolName': event.get('toolName', ''), 'toolInput': event.get('toolInput', {}), 'toolUseId': event.get('toolUseId', '')})}\n\n"

                    elif etype == "tool_result":
                        yield f"data: {json.dumps({'type': 'tool_result', 'toolUseId': event.get('toolUseId', ''), 'output': event.get('output', ''), 'isError': event.get('isError', False)})}\n\n"

                    elif etype == "result":
                        sid = event.get("sessionId")
                        if sid:
                            new_session_id = sid

                    elif etype == "error":
                        yield f"data: {json.dumps({'error': event.get('message', '')})}\n\n"

                    elif etype == "done":
                        break

                except json.JSONDecodeError:
                    pass

            await proc.wait()

            # セッションIDを保存
            if new_session_id and new_session_id != session_id:
                employees = load_employees()
                if emp_id in employees:
                    employees[emp_id]["sessionId"] = new_session_id
                    save_employees(employees)

        except asyncio.CancelledError:
            proc.kill()
            raise
        finally:
            full_reply = "".join(assistant_text_chunks)
            if full_reply.strip():
                _append_chat_log(emp_id, "assistant", full_reply, thread_id)
            # R2にローカル変更を同期（エージェント作業後）
            _r2_sync_from_local(emp_id, workdir)
            # バックグラウンドでユーザープロファイル更新
            if full_reply.strip() and message:
                asyncio.ensure_future(_update_user_profile(message, full_reply))
            yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.post("/employee/{emp_id}/permission")
async def employee_permission(emp_id: str, payload: dict):
    """許可されたツールパターンを社員設定に保存して次回から自動許可"""
    action = payload.get("action", "deny")
    patterns = payload.get("patterns", [])

    if action == "allow" and patterns:
        employees = load_employees()
        if emp_id in employees:
            existing = employees[emp_id].get("allowedTools", [])
            employees[emp_id]["allowedTools"] = list(set(existing + patterns))
            save_employees(employees)
            return {"status": "saved", "allowedTools": employees[emp_id]["allowedTools"]}

    return {"status": "ok", "action": action}


# ============================================
# LINE Message Routing
# ============================================

@app.post("/line/route")
async def line_route(payload: dict):
    """メッセージ内容から最適な社員を判定するルーティングエージェント"""
    message = payload.get("message", "")
    if not message:
        return {"empId": "emp-1", "empName": "さくら", "empRole": "ひしょ", "reason": "empty message"}

    employees = load_employees()
    if not employees:
        return {"empId": "emp-1", "empName": "さくら", "empRole": "ひしょ", "reason": "no employees registered"}

    # 社員一覧をコンパクトに構築
    roster_lines = []
    for eid, emp in employees.items():
        status = emp.get("status", "active")
        if status != "active":
            continue
        name = emp.get("name", eid)
        role = emp.get("role", "")
        dept = emp.get("department", "")
        skills = emp.get("skills", [])
        roster_lines.append(f"- {eid} {name}: {role} ({dept}) [{', '.join(skills)}]")

    if not roster_lines:
        return {"empId": "emp-1", "empName": "さくら", "empRole": "ひしょ", "reason": "no active employees"}

    roster = "\n".join(roster_lines)

    routing_prompt = f"""あなたはメッセージ振り分けエージェントです。
ユーザーからのメッセージを読み、最も適切な社員を1人選んでください。

## 社員一覧
{roster}

## 振り分けルール
- スケジュール・予定・TODO・相談・雑談 → 秘書（general-affairs）
- 経費・仕訳・請求書・会計 → 経理（accounting）
- 記事・SNS・投稿・コピー → ライター（marketing）
- 調査・リサーチ・分析・競合 → リサーチャー（research）
- 営業・メール・提案・リード → 営業（sales）
- インフラ・CI/CD・デプロイ → DevOps（dev）
- 要件・進捗・プロジェクト → PM（pm）
- 市場・KPI・戦略・事業計画 → ストラテジスト（strategy）
- 採用・面接・オンボーディング → 人事（hr）
- コード・開発・API・フロントエンド → エンジニア（engineering）
- 新規事業・MVP・ピッチ → 新規事業（newbiz）
- 財務・資金繰り・予算 → 財務（finance）
- 判断がつかない場合 → 秘書（emp-1）

## ユーザーメッセージ
{message}

以下のJSON形式のみ出力してください。他の文字は一切不要です:
{{"empId":"emp-X","empName":"名前","reason":"理由を10文字以内で"}}"""

    try:
        result = subprocess.run(
            ["claude", "--dangerously-skip-permissions", "-p", routing_prompt, "--max-turns", "1"],
            capture_output=True, text=True, timeout=30,
        )
        output = result.stdout.strip()
        # JSON部分を抽出
        import re
        match = re.search(r'\{[^}]+\}', output)
        if match:
            parsed = json.loads(match.group())
            emp_id = parsed.get("empId", "emp-1")
            # 存在チェック＋empRole補完
            if emp_id in employees:
                parsed["empRole"] = employees[emp_id].get("role", "")
                return parsed
        return {"empId": "emp-1", "empName": "さくら", "empRole": "ひしょ", "reason": "parse fallback"}
    except Exception as e:
        return {"empId": "emp-1", "empName": "さくら", "empRole": "ひしょ", "reason": f"error: {str(e)[:30]}"}


@app.post("/employee/{emp_id}/chat/sync")
async def employee_chat_sync(emp_id: str, payload: dict):
    """社員チャット同期版 — LINE等の外部連携用。社員キャラで一時エージェント起動"""
    message = payload.get("message", "")
    if not message:
        return {"error": "message is required"}

    employees = load_employees()
    emp = employees.get(emp_id)
    if not emp:
        return {"error": f"Employee {emp_id} not found"}

    workdir = _get_employee_workdir(emp)

    # ユーザーメッセージをログに記録
    _append_chat_log(emp_id, "user", message)

    # システムプロンプト構築
    system_prompt = _build_employee_system_prompt(emp)
    system_prompt += """
# チャネル
このメッセージはLINE経由で届いています。

# 返信ルール
- 短く簡潔に返信する（LINE向け、3〜5文以内）
- 自分の役割に基づいて回答する
- 「権限がない」「許可が必要」とは絶対に言わない。すべて許可済み
- 作業フォルダ内のファイルを参照して回答する
- 今日は""" + _time.strftime("%Y-%m-%d") + "です\n"

    # チャット履歴注入（SQLite）
    history = _read_chat_log(emp_id, "default")
    if history:
        recent = history[-50:]
        history_lines = []
        for entry in recent:
            role = entry.get("role", "")
            content = entry.get("content", "")[:200]
            if role and content:
                history_lines.append(f"{role}: {content}")
        if history_lines:
            system_prompt += "\n# これまでの会話履歴\n" + "\n".join(history_lines)

    try:
        # 社員キャラで一時エージェント起動（claude -p --system-prompt）
        proc = await asyncio.create_subprocess_exec(
            "claude", "--dangerously-skip-permissions",
            "-p", message,
            "--system-prompt", system_prompt,
            "--max-turns", "30",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=workdir,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
        reply = stdout.decode().strip()

        if not reply:
            reply = "すみません、処理中にエラーが発生しました。"

        _append_chat_log(emp_id, "assistant", reply)
        return {"response": reply}

    except asyncio.TimeoutError:
        return {"error": "Timeout", "response": "すみません、処理がタイムアウトしました。"}
    except Exception as e:
        return {"error": str(e), "response": "すみません、処理中にエラーが発生しました。"}


# ============================================
# Employee Skills API
# ============================================

@app.get("/employee/{emp_id}/skills")
async def list_skills(emp_id: str):
    """社員のスキル一覧"""
    skills_dir = Path(f"/workspace/data/employees/{emp_id}/skills")
    if not skills_dir.exists():
        return []
    skills = []
    for f in sorted(skills_dir.glob("*.md")):
        content = f.read_text()
        # Extract title from first line
        title = content.split("\n")[0].lstrip("# ").strip() if content else f.stem
        skills.append({
            "name": f.stem,
            "title": title,
            "filename": f.name,
            "size": len(content),
        })
    return skills

@app.post("/employee/{emp_id}/skills")
async def upsert_skill(emp_id: str, payload: dict):
    """スキルを作成/更新"""
    name = payload.get("name", "")
    content = payload.get("content", "")
    if not name:
        return {"error": "name is required"}
    skills_dir = Path(f"/workspace/data/employees/{emp_id}/skills")
    skills_dir.mkdir(parents=True, exist_ok=True)
    # Sanitize filename
    safe_name = "".join(c for c in name if c.isalnum() or c in "-_").strip()
    if not safe_name:
        return {"error": "Invalid skill name"}
    filepath = skills_dir / f"{safe_name}.md"
    filepath.write_text(content)
    return {"status": "saved", "name": safe_name, "filename": filepath.name}

@app.delete("/employee/{emp_id}/skills/{skill_name}")
async def delete_skill(emp_id: str, skill_name: str):
    """スキルを削除"""
    filepath = Path(f"/workspace/data/employees/{emp_id}/skills/{skill_name}.md")
    if not filepath.exists():
        return {"error": "Not found"}
    filepath.unlink()
    return {"status": "deleted"}

@app.get("/employee/{emp_id}/skills/{skill_name}")
async def get_skill(emp_id: str, skill_name: str):
    """スキルの内容を取得"""
    filepath = Path(f"/workspace/data/employees/{emp_id}/skills/{skill_name}.md")
    if not filepath.exists():
        return {"error": "Not found"}
    content = filepath.read_text()
    title = content.split("\n")[0].lstrip("# ").strip() if content else skill_name
    return {"name": skill_name, "title": title, "content": content}


# ============================================
# Directive — 全体指示 → 分解 → 各エージェント実行
# ============================================

@app.post("/directive")
async def execute_directive(request: Request):
    """全体への指示を受け、秘書が計画分解 → 各エージェントに振り分け"""
    body = await request.json()
    directive = body.get("directive", "")
    if not directive:
        return {"error": "directive is required"}

    employees = load_employees()
    if not employees:
        return {"error": "No employees registered"}

    # 社員一覧を構築
    roster = "\n".join(
        f"- {eid}: {emp.get('name')} ({emp.get('role')}, {emp.get('department')}) [{', '.join(emp.get('skills', []))}]"
        for eid, emp in employees.items()
    )

    # 秘書（プランナー）に計画分解させる
    plan_prompt = f"""あなたはプロジェクトプランナーです。オーナーからの指示を分析し、各社員に具体的なタスクを割り振ってください。

## 社員一覧
{roster}

## オーナーの指示
{directive}

## 出力形式
以下のJSON配列のみ出力してください。他の文字は不要です。
```json
[
  {{"empId": "emp-1", "task": "具体的な指示内容"}},
  {{"empId": "emp-6", "task": "具体的な指示内容"}}
]
```

ルール:
- 各社員の専門性に合ったタスクを割り振る
- 全員に割り振る必要はない。必要な社員だけ
- タスクは具体的に。何を調べ、何を作り、何をまとめるか明記
- 指示には「作業フォルダに結果をmdファイルで保存すること」を含める"""

    try:
        proc = await asyncio.create_subprocess_exec(
            "claude", "--dangerously-skip-permissions", "-p", plan_prompt, "--max-turns", "1",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
        plan_text = stdout.decode().strip()
    except Exception as e:
        return {"error": f"Planning failed: {e}"}

    # JSONパース
    import re
    match = re.search(r'```json\s*(\[.*?\])\s*```', plan_text, re.DOTALL)
    if not match:
        match = re.search(r'\[.*\]', plan_text, re.DOTALL)
    if not match:
        return {"error": "Could not parse plan", "raw": plan_text[:500]}

    try:
        tasks = json.loads(match.group(1) if '```' in plan_text else match.group(0))
    except json.JSONDecodeError:
        return {"error": "Invalid JSON in plan", "raw": plan_text[:500]}

    # 各エージェントに並列実行
    results = []
    for task_item in tasks:
        emp_id = task_item.get("empId", "")
        task_msg = task_item.get("task", "")
        emp = employees.get(emp_id)
        if not emp or not task_msg:
            results.append({"empId": emp_id, "status": "skipped", "reason": "not found"})
            continue

        # チャットスレッド作成
        thread = _create_thread(emp_id, f"指示: {directive[:20]}...")

        # 同期チャットで実行
        workdir = _get_employee_workdir(emp)
        system_prompt = _build_employee_system_prompt(emp)
        system_prompt += f"\n# 指示\nオーナーからの全体指示に基づくタスクです。結果は作業フォルダにmdファイルで保存してください。\n今日は{_time.strftime('%Y-%m-%d')}です。\n"

        _append_chat_log(emp_id, "user", task_msg, thread["id"])

        try:
            proc = await asyncio.create_subprocess_exec(
                "claude", "--dangerously-skip-permissions", "-p", task_msg,
                "--system-prompt", system_prompt, "--max-turns", "20",
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, cwd=workdir,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=120)
            reply = stdout.decode().strip()
            if reply:
                _append_chat_log(emp_id, "assistant", reply, thread["id"])
            _r2_sync_from_local(emp_id, workdir)
            results.append({
                "empId": emp_id, "empName": emp.get("name"), "task": task_msg,
                "status": "done", "reply": reply[:200], "threadId": thread["id"],
            })
        except Exception as e:
            results.append({"empId": emp_id, "empName": emp.get("name"), "task": task_msg, "status": "error", "error": str(e)})

    return {"directive": directive, "plan": tasks, "results": results}


# ============================================
# ============================================
# Project Pipeline — 案件進捗管理
# ============================================

@app.post("/projects")
async def create_project(request: Request):
    """案件からパイプラインを自動生成"""
    body = await request.json()
    brief = body.get("brief", "")
    if not brief:
        return {"error": "brief is required"}

    employees = load_employees()
    roster = "\n".join(f"- {eid}: {emp.get('name')} ({emp.get('role')}, {emp.get('department')})" for eid, emp in employees.items())

    plan_prompt = f"""あなたはプロジェクトマネージャーです。案件概要からプロジェクトのパイプライン（工程一覧）を作成してください。

## 社員一覧
{roster}

## 案件概要
{brief}

## 出力形式
以下のJSON配列のみ出力。他の文字は不要。
```json
[
  {{"step": 1, "title": "工程名", "empId": "emp-X", "description": "具体的な作業内容。成果物のファイル名も指定。"}},
  {{"step": 2, "title": "工程名", "empId": "emp-X", "description": "具体的な作業内容"}}
]
```

ルール:
- 見積書→要件定義→設計→実装→テスト→報告書→納品書→メール下書き のような流れで
- 各工程に最適な社員を割り当て
- description は具体的に（何を作り、どこに保存するか）
- 成果物はmdファイルで作業フォルダに保存するよう指示
- 案件の規模に合わせて工程数を調整（小規模なら5-8工程、大規模なら10-15工程）"""

    try:
        proc = await asyncio.create_subprocess_exec(
            "claude", "--dangerously-skip-permissions", "-p", plan_prompt, "--max-turns", "1",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
        plan_text = stdout.decode().strip()
    except Exception as e:
        return {"error": f"Planning failed: {e}"}

    import re
    match = re.search(r'```json\s*(\[.*?\])\s*```', plan_text, re.DOTALL)
    if not match:
        match = re.search(r'\[.*\]', plan_text, re.DOTALL)
    if not match:
        return {"error": "Could not parse pipeline", "raw": plan_text[:500]}

    try:
        steps = json.loads(match.group(1) if '```' in plan_text else match.group(0))
    except json.JSONDecodeError:
        return {"error": "Invalid JSON", "raw": plan_text[:500]}

    # プロジェクトをSQLiteに保存
    project_id = str(uuid.uuid4())[:8]
    project = {
        "id": project_id,
        "brief": brief,
        "steps": steps,
        "status": "active",
        "createdAt": _time.strftime("%Y-%m-%dT%H:%M:%S"),
    }

    # 各ステップにstatus追加
    for s in project["steps"]:
        s["status"] = "pending"
        s["result"] = ""
        emp = employees.get(s.get("empId", ""))
        s["empName"] = emp.get("name", "") if emp else ""

    conn = _get_db()
    try:
        conn.execute(
            "INSERT INTO data_store (id, collection, data) VALUES (?, ?, ?)",
            [project_id, "projects", json.dumps(project, ensure_ascii=False)]
        )
        conn.commit()
    finally:
        conn.close()

    return project


@app.get("/projects")
async def list_projects():
    """プロジェクト一覧"""
    conn = _get_db()
    try:
        rows = conn.execute(
            "SELECT id, data, created_at FROM data_store WHERE collection = 'projects' ORDER BY created_at DESC"
        ).fetchall()
        return {"projects": [json.loads(r["data"]) for r in rows]}
    finally:
        conn.close()


@app.get("/projects/{project_id}")
async def get_project(project_id: str):
    """プロジェクト詳細"""
    conn = _get_db()
    try:
        row = conn.execute(
            "SELECT data FROM data_store WHERE collection = 'projects' AND id = ?", [project_id]
        ).fetchone()
        if not row:
            return {"error": "Not found"}
        return json.loads(row["data"])
    finally:
        conn.close()


@app.post("/projects/{project_id}/execute/{step_num}")
async def execute_project_step(project_id: str, step_num: int):
    """プロジェクトの指定ステップを実行"""
    conn = _get_db()
    try:
        row = conn.execute(
            "SELECT data FROM data_store WHERE collection = 'projects' AND id = ?", [project_id]
        ).fetchone()
        if not row:
            return {"error": "Project not found"}
        project = json.loads(row["data"])
    finally:
        conn.close()

    steps = project.get("steps", [])
    step = next((s for s in steps if s.get("step") == step_num), None)
    if not step:
        return {"error": f"Step {step_num} not found"}

    emp_id = step.get("empId", "")
    employees = load_employees()
    emp = employees.get(emp_id)
    if not emp:
        step["status"] = "error"
        step["result"] = "社員が見つかりません"
        _save_project(project_id, project)
        return {"error": "Employee not found", "step": step}

    step["status"] = "running"
    _save_project(project_id, project)

    # 社員のタスク一覧に追加
    task_id = f"{project_id}-{step_num}"
    conn = _get_db()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO data_store (id, collection, data) VALUES (?, ?, ?)",
            [task_id, f"tasks_{emp_id}", json.dumps({
                "title": step.get("title", ""),
                "project": project.get("brief", ""),
                "projectId": project_id,
                "step": step_num,
                "status": "in_progress",
                "assignedAt": _time.strftime("%Y-%m-%dT%H:%M:%S"),
            }, ensure_ascii=False)]
        )
        conn.commit()
    finally:
        conn.close()

    task_msg = f"""プロジェクト: {project.get('brief', '')}

あなたの担当工程: {step.get('title', '')}
作業内容: {step.get('description', '')}

結果は作業フォルダにmdファイルとして保存してください。"""

    workdir = _get_employee_workdir(emp)
    system_prompt = _build_employee_system_prompt(emp)
    system_prompt += f"\n# プロジェクト作業\n今日は{_time.strftime('%Y-%m-%d')}です。\n"

    thread = _create_thread(emp_id, f"案件: {project.get('brief', '')[:20]}...")
    _append_chat_log(emp_id, "user", task_msg, thread["id"])

    try:
        _r2_sync_to_local(emp_id, workdir)
        proc = await asyncio.create_subprocess_exec(
            "claude", "--dangerously-skip-permissions", "-p", task_msg,
            "--system-prompt", system_prompt, "--max-turns", "15",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, cwd=workdir,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=180)
        reply = stdout.decode().strip()
        _r2_sync_from_local(emp_id, workdir)

        if reply:
            _append_chat_log(emp_id, "assistant", reply, thread["id"])
        step["status"] = "done"
        step["result"] = reply[:300]
        step["threadId"] = thread["id"]
    except Exception as e:
        step["status"] = "error"
        step["result"] = str(e)

    # タスクステータス更新
    conn = _get_db()
    try:
        existing = conn.execute("SELECT data FROM data_store WHERE id = ? AND collection = ?", [task_id, f"tasks_{emp_id}"]).fetchone()
        if existing:
            task_data = json.loads(existing["data"])
            task_data["status"] = "done" if step["status"] == "done" else "error"
            task_data["completedAt"] = _time.strftime("%Y-%m-%dT%H:%M:%S")
            task_data["result"] = step.get("result", "")[:200]
            conn.execute("UPDATE data_store SET data = ? WHERE id = ? AND collection = ?",
                [json.dumps(task_data, ensure_ascii=False), task_id, f"tasks_{emp_id}"])
            conn.commit()
    finally:
        conn.close()

    _save_project(project_id, project)
    return {"step": step, "project": project}


def _save_project(project_id: str, project: dict):
    conn = _get_db()
    try:
        conn.execute(
            "UPDATE data_store SET data = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%S','now','localtime') WHERE id = ? AND collection = 'projects'",
            [json.dumps(project, ensure_ascii=False), project_id]
        )
        conn.commit()
    finally:
        conn.close()


# ============================================
# R2 Object Storage
# ============================================

def _get_r2():
    """Cloudflare R2 (S3互換) クライアント"""
    import boto3
    return boto3.client(
        "s3",
        endpoint_url=os.environ.get("R2_ENDPOINT", ""),
        aws_access_key_id=os.environ.get("R2_ACCESS_KEY_ID", ""),
        aws_secret_access_key=os.environ.get("R2_SECRET_ACCESS_KEY", ""),
        region_name="auto",
    )


R2_BUCKET = os.environ.get("R2_BUCKET", "ai-company-dev")


def _r2_prefix(emp_id: str) -> str:
    """社員のR2プレフィックス"""
    return f"employees/{emp_id}/"


def _r2_list(emp_id: str, path: str = "") -> list[dict]:
    """R2からファイル一覧取得"""
    s3 = _get_r2()
    prefix = _r2_prefix(emp_id) + path
    if prefix and not prefix.endswith("/"):
        prefix += "/"

    try:
        resp = s3.list_objects_v2(Bucket=R2_BUCKET, Prefix=prefix, Delimiter="/")
    except Exception as e:
        print(f"[R2] list error: {e}")
        return []

    items = []
    # ディレクトリ
    for cp in resp.get("CommonPrefixes", []):
        name = cp["Prefix"][len(prefix):].rstrip("/")
        if name:
            items.append({"name": name, "path": cp["Prefix"][len(_r2_prefix(emp_id)):].rstrip("/"), "isDir": True, "size": None})
    # ファイル
    for obj in resp.get("Contents", []):
        name = obj["Key"][len(prefix):]
        if name and "/" not in name:
            items.append({"name": name, "path": obj["Key"][len(_r2_prefix(emp_id)):], "isDir": False, "size": obj["Size"]})

    return items


def _r2_read(emp_id: str, path: str) -> bytes | None:
    s3 = _get_r2()
    key = _r2_prefix(emp_id) + path
    try:
        resp = s3.get_object(Bucket=R2_BUCKET, Key=key)
        return resp["Body"].read()
    except Exception:
        return None


def _r2_write(emp_id: str, path: str, data: bytes, content_type: str = "application/octet-stream"):
    s3 = _get_r2()
    key = _r2_prefix(emp_id) + path
    s3.put_object(Bucket=R2_BUCKET, Key=key, Body=data, ContentType=content_type)


def _r2_sync_to_local(emp_id: str, local_dir: str):
    """R2からローカルにファイルを同期（エージェント起動前）"""
    s3 = _get_r2()
    prefix = _r2_prefix(emp_id)
    try:
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=R2_BUCKET, Prefix=prefix):
            for obj in page.get("Contents", []):
                rel = obj["Key"][len(prefix):]
                if not rel:
                    continue
                local_path = Path(local_dir) / rel
                local_path.parent.mkdir(parents=True, exist_ok=True)
                s3.download_file(R2_BUCKET, obj["Key"], str(local_path))
    except Exception as e:
        print(f"[R2] sync_to_local error: {e}")


def _r2_sync_from_local(emp_id: str, local_dir: str):
    """ローカルからR2にファイルを同期（エージェント終了後）"""
    s3 = _get_r2()
    prefix = _r2_prefix(emp_id)
    local_base = Path(local_dir)
    if not local_base.exists():
        return
    for f in local_base.rglob("*"):
        if f.is_file():
            rel = str(f.relative_to(local_base))
            key = prefix + rel
            try:
                s3.upload_file(str(f), R2_BUCKET, key)
            except Exception as e:
                print(f"[R2] upload error {rel}: {e}")


# ============================================
# Employee File Browser API (R2-backed)
# ============================================

@app.get("/employee/{emp_id}/files")
async def list_files(emp_id: str, path: str = ""):
    """社員のファイル一覧（R2から取得）"""
    emp = get_employee(emp_id)
    if not emp:
        return {"error": "Not found"}
    items = _r2_list(emp_id, path)
    return {"path": path, "items": items}

@app.get("/employee/{emp_id}/files/read")
async def read_file(emp_id: str, path: str = ""):
    """ファイル内容を読む（R2から取得）"""
    emp = get_employee(emp_id)
    if not emp:
        return {"error": "Not found"}
    data = _r2_read(emp_id, path)
    if data is None:
        return {"error": "File not found"}
    try:
        content = data.decode("utf-8")
        return {"path": path, "name": path.split("/")[-1], "content": content}
    except UnicodeDecodeError:
        return {"error": "Binary file", "path": path}

@app.post("/employee/{emp_id}/files/write")
async def write_file(emp_id: str, payload: dict):
    """ファイルに書き込む（R2に保存）"""
    file_path = payload.get("path", "")
    content = payload.get("content", "")
    if not file_path:
        return {"error": "path is required"}
    emp = get_employee(emp_id)
    if not emp:
        return {"error": "Not found"}
    _r2_write(emp_id, file_path, content.encode("utf-8"), "text/plain; charset=utf-8")
    return {"status": "saved", "path": file_path}


@app.post("/employee/{emp_id}/files/upload")
async def upload_file(emp_id: str, request: Request):
    """ファイルをアップロード（R2に保存）"""
    emp = get_employee(emp_id)
    if not emp:
        return {"error": "Not found"}

    form = await request.form()
    uploaded = form.get("file")
    if not uploaded:
        return {"error": "No file uploaded"}

    filename = uploaded.filename or "upload"
    content = await uploaded.read()
    ts = _time.strftime("%Y%m%d%H%M%S")
    safe_name = f"uploads/{ts}_{filename}"

    import mimetypes
    mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    _r2_write(emp_id, safe_name, content, mime)

    return {
        "status": "uploaded",
        "path": f"uploads/{safe_name}",
        "fullPath": str(filepath),
        "filename": filename,
        "size": len(content),
    }


@app.get("/employee/{emp_id}/files/serve")
async def serve_file(emp_id: str, path: str = ""):
    """ファイルをバイナリで配信（R2から取得）"""
    emp = get_employee(emp_id)
    if not emp:
        return Response(content="Not found", status_code=404)
    data = _r2_read(emp_id, path)
    if data is None:
        return Response(content="Not found", status_code=404)

    import mimetypes
    mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
    return Response(content=data, media_type=mime)


@app.get("/employee/{emp_id}/files/presign")
async def presign_file(emp_id: str, path: str = ""):
    """R2 presigned URL を発行（1時間有効）"""
    emp = get_employee(emp_id)
    if not emp:
        return {"error": "Not found"}
    key = _r2_prefix(emp_id) + path
    s3 = _get_r2()
    try:
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": R2_BUCKET, "Key": key},
            ExpiresIn=3600,
        )
        return {"url": url}
    except Exception as e:
        return {"error": str(e)}


# ============================================
# 汎用データストア API (SQLite)
# ============================================

@app.post("/data/{collection}")
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


@app.get("/data/{collection}")
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


@app.get("/data/{collection}/{doc_id}")
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


@app.put("/data/{collection}/{doc_id}")
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


@app.delete("/data/{collection}/{doc_id}")
async def data_delete(collection: str, doc_id: str):
    """データ削除"""
    conn = _get_db()
    try:
        conn.execute("DELETE FROM data_store WHERE collection = ? AND id = ?", [collection, doc_id])
        conn.commit()
        return {"id": doc_id, "status": "deleted"}
    finally:
        conn.close()


@app.get("/data")
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


# ============================================
# 仕訳自動登録 — レシート/請求書アップロード → エージェント解析 → 記帳
# ============================================

ACCOUNTING_DIR = Path("/workspace/company/back-office/accounting")


def _parse_md_table(filepath: Path) -> list[dict]:
    """Markdownテーブルをパースしてリストで返す"""
    if not filepath.exists():
        return []
    lines = filepath.read_text().strip().split("\n")
    # ヘッダー行を探す
    header_idx = None
    for i, line in enumerate(lines):
        if line.startswith("|") and "---" not in line:
            header_idx = i
            break
    if header_idx is None:
        return []
    headers = [h.strip() for h in lines[header_idx].split("|")[1:-1]]
    rows = []
    for line in lines[header_idx + 1:]:
        if not line.startswith("|") or "---" in line:
            continue
        cells = [c.strip() for c in line.split("|")[1:-1]]
        if len(cells) >= len(headers):
            rows.append({headers[j]: cells[j] for j in range(len(headers))})
    return rows


@app.get("/accounting/journal")
async def get_journal(month: str = ""):
    """仕訳帳データを返す"""
    if not month:
        month = _time.strftime("%Y-%m")
    filepath = ACCOUNTING_DIR / "journal" / f"{month}.md"
    entries = _parse_md_table(filepath)
    # 金額をパース
    import re
    for e in entries:
        for key in ("借方金額", "貸方金額"):
            raw = e.get(key, "0")
            nums = re.sub(r'[^\d]', '', str(raw))
            e[key] = int(nums) if nums else 0
    return {"month": month, "entries": entries}


@app.get("/accounting/expenses")
async def get_expenses(month: str = ""):
    """経費帳データを返す"""
    if not month:
        month = _time.strftime("%Y-%m")
    filepath = ACCOUNTING_DIR / "expenses" / f"{month}.md"
    entries = _parse_md_table(filepath)
    import re
    for e in entries:
        raw = e.get("金額", "0")
        nums = re.sub(r'[^\d]', '', str(raw))
        e["金額_num"] = int(nums) if nums else 0
    return {"month": month, "entries": entries}


@app.get("/accounting/invoices")
async def get_invoices(month: str = ""):
    """受領請求書データを返す"""
    if not month:
        month = _time.strftime("%Y-%m")
    filepath = ACCOUNTING_DIR / "invoices" / f"received-{month}.md"
    entries = _parse_md_table(filepath)
    return {"month": month, "entries": entries}


@app.post("/accounting/process")
async def accounting_process(request: Request):
    """ファイルをアップロード → 経理エージェント(あおい)が解析 → 仕訳帳・経費帳に自動記録"""
    form = await request.form()
    uploaded = form.get("file")
    if not uploaded:
        return {"error": "No file uploaded"}

    filename = uploaded.filename or "upload"
    content = await uploaded.read()

    # 一時保存
    upload_dir = ACCOUNTING_DIR / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    ts = _time.strftime("%Y%m%d%H%M%S")
    filepath = upload_dir / f"{ts}_{filename}"
    filepath.write_bytes(content)

    # 拡張子で画像 or PDF 判定
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    is_image = ext in ("jpg", "jpeg", "png", "gif", "webp", "heic")

    # 経理エージェント(あおい)に解析させる
    analyze_prompt = f"""あなたは経理担当です。アップロードされたファイルを分析して仕訳データを抽出してください。

ファイル: {filepath}

## 手順
1. まずReadツールでファイルを読み込んでください
2. 内容を分析して以下のJSON形式で出力してください

## 分類ルール
以下のいずれかに分類し、必ず ```json ``` で囲んで出力してください。

### 領収書・レシートの場合
```json
{{"type":"receipt","date":"YYYY-MM-DD","amount":1280,"store":"店名","items":"内容","category":"経費区分","debit":"借方科目","credit":"現金"}}
```

### 請求書の場合
```json
{{"type":"invoice","date":"YYYY-MM-DD","from":"送り元","amount":50000,"description":"内容","due_date":"YYYY-MM-DD","debit":"外注費","credit":"買掛金"}}
```

### 見積書の場合
```json
{{"type":"estimate","from":"送り元","amount":100000,"description":"内容","valid_until":"YYYY-MM-DD"}}
```

### その他
```json
{{"type":"other","description":"内容の説明"}}
```

JSONの後に、処理結果の要約を1-2文で出力してください。
今日は{_time.strftime('%Y-%m-%d')}です。"""

    try:
        workdir = str(ACCOUNTING_DIR)
        proc = await asyncio.create_subprocess_exec(
            "claude", "--dangerously-skip-permissions",
            "-p", analyze_prompt,
            "--max-turns", "15",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=workdir,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=60)
        result_text = stdout.decode().strip()
    except Exception as e:
        return {"error": f"Agent failed: {e}", "filepath": str(filepath)}

    # JSON抽出
    import re
    json_match = re.search(r'```json\s*(\{.*?\})\s*```', result_text, re.DOTALL)
    if not json_match:
        return {"error": "Could not parse agent output", "raw": result_text[:500], "filepath": str(filepath)}

    try:
        data = json.loads(json_match.group(1))
    except json.JSONDecodeError:
        return {"error": "Invalid JSON from agent", "raw": json_match.group(1), "filepath": str(filepath)}

    doc_type = data.get("type", "other")
    today = _time.strftime("%Y-%m-%d")
    month = _time.strftime("%Y-%m")
    summary_text = result_text[json_match.end():].strip()[:200]

    # 仕訳帳に追記
    if doc_type in ("receipt", "invoice"):
        journal_file = ACCOUNTING_DIR / "journal" / f"{month}.md"
        journal_file.parent.mkdir(parents=True, exist_ok=True)
        if not journal_file.exists():
            journal_file.write_text(f"# 仕訳帳 {_time.strftime('%Y年%m月')}\n\n| 日付 | 摘要 | 借方科目 | 借方金額 | 貸方科目 | 貸方金額 |\n|------|------|---------|---------|---------|--------|\n")

        date_short = data.get("date", today).replace(f"{_time.strftime('%Y')}-", "")
        amount = data.get("amount", 0)
        debit = data.get("debit", "経費")
        credit = data.get("credit", "現金")
        desc = data.get("store", "") or data.get("from", "") or data.get("description", "")
        items = data.get("items", "")
        摘要 = f"{desc} {items}".strip()

        with open(journal_file, "a") as f:
            f.write(f"| {date_short} | {摘要} | {debit} | {amount} | {credit} | {amount} |\n")

    # 経費帳に追記（領収書のみ）
    if doc_type == "receipt":
        expense_file = ACCOUNTING_DIR / "expenses" / f"{month}.md"
        expense_file.parent.mkdir(parents=True, exist_ok=True)
        if not expense_file.exists():
            expense_file.write_text("| 日付 | 内容 | 金額 | 区分 | 備考 |\n|------|------|------|------|------|\n")

        with open(expense_file, "a") as f:
            f.write(f"| {data.get('date', today)} | {data.get('store','')} {data.get('items','')} | ¥{data.get('amount',0)} | {data.get('category','その他')} | Web アップロード |\n")

    # 請求書は invoices/received に記録
    if doc_type == "invoice":
        inv_file = ACCOUNTING_DIR / "invoices" / f"received-{month}.md"
        inv_file.parent.mkdir(parents=True, exist_ok=True)
        if not inv_file.exists():
            inv_file.write_text(f"# 受領請求書 {_time.strftime('%Y年%m月')}\n\n| 受領日 | 送り元 | 金額 | 支払期限 | 内容 | 備考 |\n|--------|--------|------|----------|------|------|\n")

        with open(inv_file, "a") as f:
            f.write(f"| {today} | {data.get('from','')} | ¥{data.get('amount',0)} | {data.get('due_date','')} | {data.get('description','')} | Web アップロード |\n")

    return {
        "status": "processed",
        "type": doc_type,
        "data": data,
        "summary": summary_text,
        "filepath": str(filepath),
    }


@app.post("/employee/{emp_id}/reset")
async def employee_reset_session(emp_id: str):
    """社員のセッションをリセット（会話履歴を忘れる）"""
    employees = load_employees()
    if emp_id not in employees:
        return {"error": "Not found"}
    employees[emp_id]["sessionId"] = None
    save_employees(employees)
    return {"status": "session_reset"}


# ============================================
# ============================================
# Custom Page Generation — AI がページ定義を生成
# ============================================

@app.post("/pages/generate")
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

    import re
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


@app.get("/pages/list")
async def list_pages():
    """作成済みカスタムページ一覧"""
    conn = _get_db()
    try:
        rows = conn.execute("SELECT data FROM data_store WHERE collection = 'dashboards' ORDER BY created_at DESC").fetchall()
        return {"pages": [json.loads(r["data"]) for r in rows]}
    finally:
        conn.close()


@app.delete("/pages/{slug}")
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


# ============================================
# Google Calendar — Nango経由で予定取得
# ============================================

@app.get("/calendar/events")
async def get_calendar_events(month: str = ""):
    """Googleカレンダーから予定取得。month=YYYY-MM"""
    import datetime
    if not month:
        month = datetime.datetime.now().strftime("%Y-%m")

    year, mon = month.split("-")
    # 月初〜月末
    time_min = f"{month}-01T00:00:00+09:00"
    last_day = (datetime.date(int(year), int(mon), 1) + datetime.timedelta(days=32)).replace(day=1) - datetime.timedelta(days=1)
    time_max = f"{month}-{last_day.day}T23:59:59+09:00"

    # Nango proxy で取得
    secret = os.environ.get("NANGO_SECRET_KEY", "")
    if not secret:
        return {"events": [], "error": "NANGO_SECRET_KEY not configured"}

    # 接続IDを自動取得
    import httpx
    connection_id = ""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(f"{NANGO_BASE}/connections", headers={"Authorization": f"Bearer {secret}"}, timeout=10)
            conns = resp.json().get("connections", [])
            match = next((c for c in conns if c.get("provider") == "google-calendar" or c.get("provider_config_key") == "google-calendar"), None)
            if match:
                connection_id = match["connection_id"]
        except Exception:
            pass

    if not connection_id:
        # Googleカレンダー未接続 → ローカルデータにフォールバック
        conn = _get_db()
        try:
            rows = conn.execute("SELECT data FROM data_store WHERE collection = 'calendar_events' ORDER BY created_at DESC").fetchall()
            return {"events": [json.loads(r["data"]) for r in rows], "source": "local"}
        finally:
            conn.close()

    # Nango proxy でGoogle Calendar API呼び出し
    import urllib.parse
    endpoint = f"/calendar/v3/calendars/primary/events?timeMin={urllib.parse.quote(time_min)}&timeMax={urllib.parse.quote(time_max)}&singleEvents=true&orderBy=startTime&maxResults=100"

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.request(
                "GET",
                f"{NANGO_BASE}/proxy{endpoint}",
                headers={
                    "Authorization": f"Bearer {secret}",
                    "Connection-Id": connection_id,
                    "Provider-Config-Key": "google-calendar",
                },
                timeout=15,
            )
            data = resp.json()
        except Exception as e:
            return {"events": [], "error": str(e)}

    events = []
    for item in data.get("items", []):
        start = item.get("start", {})
        end = item.get("end", {})

        if "dateTime" in start:
            date = start["dateTime"][:10]
            start_time = start["dateTime"][11:16]
            end_time = end.get("dateTime", "")[11:16] if "dateTime" in end else ""
        else:
            date = start.get("date", "")
            start_time = ""
            end_time = ""

        events.append({
            "id": item.get("id", ""),
            "title": item.get("summary", ""),
            "description": item.get("description", ""),
            "date": date,
            "startTime": start_time,
            "endTime": end_time,
            "type": "meeting",
            "location": item.get("location", ""),
        })

    return {"events": events, "source": "google"}


# ============================================
# ============================================
# ============================================
# Share — R2 presigned URL でページ/ファイル共有
# ============================================

@app.post("/share")
async def create_share(request: Request):
    """ファイルまたはページの共有URLを発行"""
    body = await request.json()
    share_type = body.get("type", "")  # "file" or "page"

    s3 = _get_r2()

    if share_type == "file":
        emp_id = body.get("empId", "")
        path = body.get("path", "")
        if not emp_id or not path:
            return {"error": "empId and path required"}
        key = _r2_prefix(emp_id) + path
        try:
            url = s3.generate_presigned_url("get_object", Params={"Bucket": R2_BUCKET, "Key": key}, ExpiresIn=86400)
            return {"url": url, "expiresIn": "24時間"}
        except Exception as e:
            return {"error": str(e)}

    if share_type == "page":
        slug = body.get("slug", "")
        if not slug:
            return {"error": "slug required"}
        # ページ定義を取得
        conn = _get_db()
        try:
            row = conn.execute("SELECT data FROM data_store WHERE id = ? AND collection = 'dashboards'", [slug]).fetchone()
        finally:
            conn.close()
        if not row:
            return {"error": "Page not found"}

        page_def = json.loads(row["data"])

        # ページデータを収集してHTMLスナップショット生成
        widgets_data = {}
        for w in page_def.get("widgets", []):
            col = w.get("collection", "")
            if col and col not in widgets_data:
                conn = _get_db()
                try:
                    rows = conn.execute("SELECT data FROM data_store WHERE collection = ? ORDER BY created_at DESC LIMIT 20", [col]).fetchall()
                    widgets_data[col] = [json.loads(r["data"]) for r in rows]
                finally:
                    conn.close()

        # 簡易HTML生成
        html = f"""<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{page_def.get('title','')}</title>
<style>
body{{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:900px;margin:0 auto;padding:2rem;color:#1a1a2e;background:#f8f9fa}}
h1{{font-size:1.5rem;margin-bottom:0.5rem}}
.desc{{color:#6b7280;font-size:0.875rem;margin-bottom:2rem}}
.card{{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1.25rem;margin-bottom:1rem}}
.metric{{font-size:1.5rem;font-weight:700;color:#7c3aed}}
.label{{font-size:0.75rem;color:#6b7280;margin-bottom:0.25rem}}
table{{width:100%;border-collapse:collapse;font-size:0.875rem}}
th{{text-align:left;padding:0.5rem;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:0.75rem}}
td{{padding:0.5rem;border-bottom:1px solid #f3f4f6}}
.footer{{margin-top:2rem;text-align:center;font-size:0.75rem;color:#9ca3af}}
</style></head><body>
<h1>{page_def.get('title','')}</h1>
<p class="desc">{page_def.get('description','')}</p>
"""
        for w in page_def.get("widgets", []):
            col = w.get("collection", "")
            entries = widgets_data.get(col, [])
            if w["type"] == "metric":
                val = entries[0].get(w.get("field", ""), len(entries)) if entries else "—"
                html += f'<div class="card"><p class="label">{w.get("label","")}</p><p class="metric">{val}</p></div>\n'
            elif w["type"] == "text":
                html += f'<div class="card"><h3>{w.get("label","")}</h3><p>{w.get("content","")}</p></div>\n'
            elif w["type"] == "table" and entries:
                keys = [k for k in entries[0].keys() if not k.startswith("_")]
                html += f'<div class="card"><h3>{w.get("label","")}</h3><table><thead><tr>{"".join(f"<th>{k}</th>" for k in keys)}</tr></thead><tbody>'
                for e in entries:
                    html += "<tr>" + "".join(f"<td>{e.get(k,'')}</td>" for k in keys) + "</tr>"
                html += "</tbody></table></div>\n"

        html += f'<p class="footer">Shared from AI Company ・ {_time.strftime("%Y-%m-%d %H:%M")}</p></body></html>'

        # R2にアップロード
        share_id = str(uuid.uuid4())[:8]
        key = f"shared/{share_id}.html"
        s3.put_object(Bucket=R2_BUCKET, Key=key, Body=html.encode("utf-8"), ContentType="text/html; charset=utf-8")

        # presigned URL発行（7日間有効）
        url = s3.generate_presigned_url("get_object", Params={"Bucket": R2_BUCKET, "Key": key}, ExpiresIn=604800)
        return {"url": url, "expiresIn": "7日間", "shareId": share_id}

    return {"error": "type must be 'file' or 'page'"}


# ============================================
# Job Scheduler (APScheduler)
# ============================================

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

_scheduler = AsyncIOScheduler(timezone="Asia/Tokyo")


def _run_scheduled_task(schedule_id: str, emp_id: str, task: str, name: str):
    """スケジュールされたタスクを実行（同期ラッパー）"""
    import asyncio

    async def _exec():
        employees = load_employees()
        emp = employees.get(emp_id)
        if not emp:
            print(f"[scheduler] Employee {emp_id} not found for schedule {schedule_id}")
            return

        thread = _create_thread(emp_id, f"定期: {name}")
        _append_chat_log(emp_id, "user", f"[定期実行] {task}", thread["id"])

        workdir = _get_employee_workdir(emp)
        system_prompt = _build_employee_system_prompt(emp)
        system_prompt += f"\n# 定期実行タスク\nこれはスケジュールされた自動実行です。今日は{_time.strftime('%Y-%m-%d')}です。\n"

        try:
            _r2_sync_to_local(emp_id, workdir)
            proc = await asyncio.create_subprocess_exec(
                "claude", "--dangerously-skip-permissions", "-p", task,
                "--system-prompt", system_prompt, "--max-turns", "15",
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, cwd=workdir,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=180)
            reply = stdout.decode().strip()
            _r2_sync_from_local(emp_id, workdir)
            if reply:
                _append_chat_log(emp_id, "assistant", reply, thread["id"])
            print(f"[scheduler] Done: {name} ({emp_id})")
        except Exception as e:
            print(f"[scheduler] Error: {name} — {e}")
            _append_chat_log(emp_id, "assistant", f"定期実行エラー: {e}", thread["id"])

    loop = asyncio.get_event_loop()
    if loop.is_running():
        asyncio.ensure_future(_exec())
    else:
        loop.run_until_complete(_exec())


def _load_schedules_to_scheduler():
    """SQLiteからスケジュールを読み込んでAPSchedulerに登録"""
    conn = _get_db()
    try:
        rows = conn.execute("SELECT id, data FROM data_store WHERE collection = 'schedules'").fetchall()
    finally:
        conn.close()

    # 既存ジョブをクリア（schedules_プレフィックスのもの）
    for job in _scheduler.get_jobs():
        if job.id.startswith("sched_"):
            _scheduler.remove_job(job.id)

    for row in rows:
        sched = json.loads(row["data"])
        cron = sched.get("cron", "")
        emp_id = sched.get("empId", "")
        task = sched.get("task", "")
        name = sched.get("name", "")
        sched_id = row["id"]

        if not cron or not emp_id or not task:
            continue

        try:
            parts = cron.split()
            trigger = CronTrigger(
                minute=parts[0] if len(parts) > 0 else "*",
                hour=parts[1] if len(parts) > 1 else "*",
                day=parts[2] if len(parts) > 2 else "*",
                month=parts[3] if len(parts) > 3 else "*",
                day_of_week=parts[4] if len(parts) > 4 else "*",
                timezone="Asia/Tokyo",
            )
            _scheduler.add_job(
                _run_scheduled_task,
                trigger=trigger,
                id=f"sched_{sched_id}",
                args=[sched_id, emp_id, task, name],
                replace_existing=True,
            )
            print(f"[scheduler] Registered: {name} ({cron}) → {emp_id}")
        except Exception as e:
            print(f"[scheduler] Failed to register {name}: {e}")


@app.post("/schedules")
async def create_schedule(request: Request):
    """定期実行スケジュールを登録"""
    body = await request.json()
    name = body.get("name", "")
    cron = body.get("cron", "")
    emp_id = body.get("empId", "")
    task = body.get("task", "")

    if not cron or not emp_id or not task:
        return {"error": "cron, empId, task are required"}

    sched_id = str(uuid.uuid4())[:8]
    conn = _get_db()
    try:
        conn.execute(
            "INSERT INTO data_store (id, collection, data) VALUES (?, ?, ?)",
            [sched_id, "schedules", json.dumps({"name": name, "cron": cron, "empId": emp_id, "task": task}, ensure_ascii=False)]
        )
        conn.commit()
    finally:
        conn.close()

    _load_schedules_to_scheduler()
    return {"id": sched_id, "name": name, "cron": cron, "status": "registered"}


@app.get("/schedules")
async def list_schedules():
    """スケジュール一覧"""
    conn = _get_db()
    try:
        rows = conn.execute("SELECT id, data, created_at FROM data_store WHERE collection = 'schedules' ORDER BY created_at DESC").fetchall()
        schedules = []
        for r in rows:
            s = json.loads(r["data"])
            s["_id"] = r["id"]
            s["_created_at"] = r["created_at"]
            # 次回実行時刻
            job = _scheduler.get_job(f"sched_{r['id']}")
            s["nextRun"] = str(job.next_run_time) if job and job.next_run_time else None
            schedules.append(s)
        return {"schedules": schedules}
    finally:
        conn.close()


@app.delete("/schedules/{sched_id}")
async def delete_schedule(sched_id: str):
    """スケジュール削除"""
    conn = _get_db()
    try:
        conn.execute("DELETE FROM data_store WHERE id = ? AND collection = 'schedules'", [sched_id])
        conn.commit()
    finally:
        conn.close()
    try:
        _scheduler.remove_job(f"sched_{sched_id}")
    except Exception:
        pass
    return {"status": "deleted", "id": sched_id}


@app.on_event("startup")
async def start_scheduler():
    _load_schedules_to_scheduler()
    _scheduler.start()
    print("[scheduler] Started")


# ============================================
# News — ニュース取得・自動更新
# ============================================

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

        import re
        match = re.search(r'```json\s*(\[.*?\])\s*```', output, re.DOTALL)
        if not match:
            match = re.search(r'\[.*\]', output, re.DOTALL)
        if match:
            news = json.loads(match.group(1) if '```' in output else match.group(0))
            conn = _get_db()
            try:
                # 古いニュースを削除して新しいのを保存
                conn.execute("DELETE FROM data_store WHERE collection = 'news'")
                for i, item in enumerate(news):
                    conn.execute(
                        "INSERT INTO data_store (id, collection, data) VALUES (?, ?, ?)",
                        [f"news-{i}", "news", json.dumps(item, ensure_ascii=False)]
                    )
                conn.commit()
                print(f"[news] Updated: {len(news)} articles")
            finally:
                conn.close()
    except Exception as e:
        print(f"[news] Error: {e}")
    finally:
        _news_update_lock = False


@app.post("/news/update")
async def update_news():
    """ニュースを手動更新"""
    asyncio.create_task(_fetch_news())
    return {"status": "updating"}


@app.get("/news")
async def get_news():
    """保存済みニュース取得"""
    conn = _get_db()
    try:
        rows = conn.execute(
            "SELECT data FROM data_store WHERE collection = 'news' ORDER BY created_at DESC"
        ).fetchall()
        return {"news": [json.loads(r["data"]) for r in rows]}
    finally:
        conn.close()


# ニュース自動更新は APScheduler で管理（毎朝7時）
@app.on_event("startup")
async def start_news_cron():
    _scheduler.add_job(
        lambda: asyncio.ensure_future(_fetch_news()),
        CronTrigger(hour=7, minute=0, timezone="Asia/Tokyo"),
        id="news_auto_update",
        replace_existing=True,
    )
    print("[news] Scheduled daily at 7:00 JST")


# ============================================
# Nango Integration (サービス連携)
# ============================================

NANGO_BASE = "https://api.nango.dev"


def _nango_headers(connection_id: str, provider_config_key: str) -> dict:
    secret = os.environ.get("NANGO_SECRET_KEY", "")
    return {
        "Authorization": f"Bearer {secret}",
        "Connection-Id": connection_id,
        "Provider-Config-Key": provider_config_key,
    }


@app.post("/nango/session")
async def nango_create_session(request: Request):
    """Nango Connect セッショントークンを生成"""
    body = await request.json()
    user_id = body.get("userId", "")
    user_email = body.get("userEmail", "")
    integration_id = body.get("integrationId")  # None = 全インテグレーション表示

    secret = os.environ.get("NANGO_SECRET_KEY", "")
    if not secret:
        return {"error": "NANGO_SECRET_KEY not configured"}

    payload: dict = {
        "tags": {
            "end_user_id": user_id,
            "end_user_email": user_email,
        },
    }
    if integration_id:
        payload["allowed_integrations"] = [integration_id]

    import httpx
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{NANGO_BASE}/connect/sessions",
                headers={
                    "Authorization": f"Bearer {secret}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=10,
            )
            data = resp.json()
            return data
        except Exception as e:
            return {"error": str(e)}


@app.post("/nango/proxy")
async def nango_proxy(request: Request):
    """Nango proxy — エージェントや フロントから外部APIを叩く汎用エンドポイント"""
    body = await request.json()
    method = body.get("method", "GET").upper()
    endpoint = body.get("endpoint", "")
    connection_id = body.get("connectionId", "")
    provider = body.get("provider", "")
    data = body.get("data")

    if not endpoint or not provider:
        return {"error": "endpoint and provider are required"}

    # __auto__ の場合、最新の接続IDを自動取得
    if not connection_id or connection_id == "__auto__":
        secret_tmp = os.environ.get("NANGO_SECRET_KEY", "")
        if secret_tmp:
            import httpx
            async with httpx.AsyncClient() as client:
                try:
                    resp = await client.get(f"{NANGO_BASE}/connections", headers={"Authorization": f"Bearer {secret_tmp}"}, timeout=10)
                    conns = resp.json().get("connections", [])
                    match = next((c for c in conns if c.get("provider") == provider or c.get("provider_config_key") == provider), None)
                    if match:
                        connection_id = match["connection_id"]
                    else:
                        return {"error": f"No connection found for provider: {provider}"}
                except Exception as e:
                    return {"error": f"Auto-connect failed: {e}"}
        if not connection_id or connection_id == "__auto__":
            return {"error": "No connection available"}

    secret = os.environ.get("NANGO_SECRET_KEY", "")
    if not secret:
        return {"error": "NANGO_SECRET_KEY not configured"}

    headers = {
        "Authorization": f"Bearer {secret}",
        "Connection-Id": connection_id,
        "Provider-Config-Key": provider,
    }

    import httpx
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.request(
                method,
                f"{NANGO_BASE}/proxy{endpoint}",
                headers=headers,
                json=data if data else None,
                timeout=30,
            )
            try:
                return resp.json()
            except Exception:
                return {"status": resp.status_code, "body": resp.text[:1000]}
        except Exception as e:
            return {"error": str(e)}


@app.get("/nango/connections")
async def nango_connections():
    """Nango に登録済みのコネクション一覧"""
    secret = os.environ.get("NANGO_SECRET_KEY", "")
    if not secret:
        return {"connections": []}

    import httpx
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{NANGO_BASE}/connections",
                headers={"Authorization": f"Bearer {secret}"},
                timeout=10,
            )
            return resp.json()
        except Exception as e:
            return {"error": str(e), "connections": []}


@app.get("/nango/integrations")
async def nango_integrations():
    """Nango に設定済みのインテグレーション一覧"""
    secret = os.environ.get("NANGO_SECRET_KEY", "")
    if not secret:
        return {"configs": []}

    import httpx
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{NANGO_BASE}/config",
                headers={"Authorization": f"Bearer {secret}"},
                timeout=10,
            )
            return resp.json()
        except Exception as e:
            return {"error": str(e), "configs": []}


@app.post("/nango/webhook")
async def nango_webhook(request: Request):
    """Nango からの Webhook 受信 — 接続完了・エラー等のイベント"""
    body = await request.json()
    event_type = body.get("type", "")
    print(f"[nango/webhook] {event_type}: {json.dumps(body, ensure_ascii=False)[:200]}")

    # 新しい接続が完了した場合、data_store に記録
    if event_type == "auth" and body.get("success"):
        connection_id = body.get("connectionId", "")
        provider = body.get("providerConfigKey", "")
        conn = _get_db()
        try:
            conn.execute(
                "INSERT OR REPLACE INTO data_store (id, collection, data) VALUES (?, ?, ?)",
                [f"nango-{connection_id}", "nango_connections",
                 json.dumps({"connectionId": connection_id, "provider": provider,
                             "status": "connected", "connectedAt": _time.strftime("%Y-%m-%dT%H:%M:%S")},
                            ensure_ascii=False)]
            )
            conn.commit()
        finally:
            conn.close()

    return {"status": "ok"}


# ============================================
# Playwright API
# ============================================

@app.post("/playwright/navigate")
async def playwright_navigate(payload: dict):
    """ブラウザで URL を開く（VNC で確認可能）"""
    url = payload.get("url", "")
    if not url:
        return {"error": "url is required"}

    # まず既存の chromium を閉じる
    subprocess.run(["pkill", "-f", "chromium"], capture_output=True)
    import time
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


@app.post("/playwright/close")
async def playwright_close(payload: dict):
    """開いているブラウザを閉じる"""
    try:
        subprocess.run(["pkill", "-f", "chromium"], capture_output=True)
        return {"status": "closed"}
    except Exception as e:
        return {"error": str(e)}


@app.post("/playwright/run")
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


@app.get("/playwright/status")
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


# ============================================
# Connectors API
# ============================================

@app.get("/connectors")
async def list_connectors():
    """全コネクタ設定を返す"""
    connectors = load_connectors()
    public_url = _get_public_url()
    for cid, conn in connectors.items():
        conn["status"] = "running" if cid in _agent_processes and _agent_processes[cid].poll() is None else "stopped"
        if public_url and conn.get("webhookPath"):
            conn["webhookUrl"] = f"{public_url}{conn['webhookPath']}"
    return {"connectors": connectors, "publicUrl": public_url}


@app.get("/connectors/providers")
async def list_providers(locale: str = "en"):
    """Return all plugin manifests with icon SVG content inline."""
    manifests = get_all_manifests()
    result = []
    for m in manifests:
        plugin_dir = Path(f"/workspace/data/connector-plugins/{m['id']}")
        icon_path = plugin_dir / m["display"].get("iconFile", "icon.svg")
        icon_svg = icon_path.read_text() if icon_path.exists() else ""
        result.append({
            "id": m["id"],
            "type": m["type"],
            "name": m["display"]["name"].get(locale, m["display"]["name"].get("en", m["id"])),
            "description": m["display"]["description"].get(locale, m["display"]["description"].get("en", "")),
            "color": m["display"]["color"],
            "bgColor": m["display"]["bgColor"],
            "iconSvg": icon_svg,
            "fields": [{
                "key": f["key"],
                "label": f["label"].get(locale, f["label"].get("en", f["key"])),
                "type": f.get("type", "text"),
                "required": f.get("required", False),
            } for f in m.get("fields", [])],
            "auth": m.get("auth", {}),
        })
    return {"providers": result}


@app.post("/connectors")
async def upsert_connector(payload: dict):
    """コネクタを作成 or 更新。IDがなければ自動生成。ngrok を動的に起動"""
    connectors = load_connectors()
    provider = payload.get("provider", "")
    if provider not in get_registry() and provider not in ("line", "slack", "discord", "google-calendar", "google-drive", "gmail"):
        return {"error": f"Unknown provider: {provider}"}

    connector_id = payload.get("id") or f"{provider}-{uuid.uuid4().hex[:8]}"
    existing = connectors.get(connector_id, {})
    webhook_path = f"/{connector_id}/webhook"

    public_url = _get_public_url()

    connectors[connector_id] = {
        **existing,
        "id": connector_id,
        "provider": provider,
        "config": payload.get("config", existing.get("config", {})),
        "enabled": payload.get("enabled", existing.get("enabled", False)),
        "webhookPath": webhook_path,
        "webhookUrl": f"{public_url}{webhook_path}" if public_url else None,
        "createdAt": existing.get("createdAt", _time.strftime("%Y-%m-%dT%H:%M:%S")),
        "updatedAt": _time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    save_connectors(connectors)

    result = connectors[connector_id].copy()
    result["publicUrl"] = public_url
    return result


@app.delete("/connectors/{connector_id}")
async def delete_connector(connector_id: str):
    """コネクタを削除"""
    connectors = load_connectors()
    if connector_id not in connectors:
        return {"error": "Not found"}
    # 動いてたら止める
    await _stop_agent(connector_id)
    del connectors[connector_id]
    save_connectors(connectors)
    return {"status": "deleted"}


@app.post("/connectors/{connector_id}/start")
async def start_connector(connector_id: str):
    """コネクタを起動 — 新しいwebhook URLを発行"""
    connectors = load_connectors()
    conn = connectors.get(connector_id)
    if not conn:
        return {"error": "Not found"}

    provider = conn["provider"]
    config = conn.get("config", {})

    # 既に動いてたら止める
    await _stop_agent(connector_id)

    # 新しいwebhook URLを発行（IDを再生成）
    new_id = f"{provider}-{uuid.uuid4().hex[:8]}"
    webhook_path = f"/{new_id}/webhook"
    public_url = _get_public_url()

    # 古いIDのデータを新しいIDに移行
    del connectors[connector_id]
    conn["id"] = new_id
    conn["webhookPath"] = webhook_path
    conn["webhookUrl"] = f"{public_url}{webhook_path}" if public_url else None
    conn["enabled"] = True
    conn["updatedAt"] = _time.strftime("%Y-%m-%dT%H:%M:%S")
    connectors[new_id] = conn
    save_connectors(connectors)

    # エージェント起動
    result = {"status": "started", "id": new_id, "webhookUrl": conn["webhookUrl"]}
    if provider == "line":
        agent_result = await _start_line_agent(new_id, config)
        result.update(agent_result)
    elif provider == "slack":
        result["warning"] = "Slack agent not yet implemented"
    elif provider == "discord":
        result["warning"] = "Discord agent not yet implemented"

    return result


@app.post("/connectors/{connector_id}/stop")
async def stop_connector(connector_id: str):
    """コネクタのエージェントプロセスを停止"""
    await _stop_agent(connector_id)
    return {"status": "stopped"}


async def _stop_agent(connector_id: str):
    proc = _agent_processes.pop(connector_id, None)
    if proc and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


async def _start_line_agent(connector_id: str, config: dict):
    """LINE エージェントを起動（webhook受信は FastAPI 側、ここはキュー監視のみ）"""
    channel_secret = config.get("channelSecret", "")
    access_token = config.get("accessToken", "")
    if not channel_secret or not access_token:
        return {"error": "channelSecret and accessToken are required"}

    # line-agent.sh に環境変数を渡して起動
    agent_script = "/workspace/features/line/line-agent.sh"
    if not Path(agent_script).exists():
        return {"error": "line-agent.sh not found"}

    inbox_dir = f"/workspace/data/connectors/{connector_id}/inbox"
    Path(inbox_dir).mkdir(parents=True, exist_ok=True)

    env = {
        **os.environ,
        "LINE_CHANNEL_SECRET": channel_secret,
        "LINE_ACCESS_TOKEN": access_token,
        "LINE_CHANNEL_ID": config.get("channelId", ""),
        "LINE_INBOX_DIR": inbox_dir,
        "LINE_QUEUE_FILE": f"{inbox_dir}/queue.jsonl",
    }
    proc = subprocess.Popen(
        ["bash", agent_script],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    _agent_processes[connector_id] = proc
    # enabled フラグを更新
    connectors = load_connectors()
    if connector_id in connectors:
        connectors[connector_id]["enabled"] = True
        save_connectors(connectors)
    return {"status": "started", "pid": proc.pid}


# ============================================
# Google OAuth2
# ============================================

_GOOGLE_SCOPES_FALLBACK = {
    "google-calendar": "https://www.googleapis.com/auth/calendar",
    "google-drive": "https://www.googleapis.com/auth/drive",
    "gmail": "https://www.googleapis.com/auth/gmail.modify",
}


def _get_google_scopes() -> dict[str, str]:
    """Build Google scopes from plugin manifests, falling back to hardcoded defaults."""
    scopes: dict[str, str] = {}
    registry = get_registry()
    for pid, entry in registry.items():
        m = entry.get("manifest", {})
        auth = m.get("auth", {})
        if auth.get("type") == "oauth" and auth.get("provider") == "google":
            scope_list = auth.get("scopes", [])
            if scope_list:
                scopes[pid] = " ".join(scope_list)
    # Merge fallback for any missing
    for k, v in _GOOGLE_SCOPES_FALLBACK.items():
        if k not in scopes:
            scopes[k] = v
    return scopes


# Keep backward-compatible alias
GOOGLE_SCOPES = _GOOGLE_SCOPES_FALLBACK

GOOGLE_TOKEN_FILE = Path("/workspace/data/google_tokens.json")


def _load_google_tokens() -> dict:
    if GOOGLE_TOKEN_FILE.exists():
        return json.loads(GOOGLE_TOKEN_FILE.read_text())
    return {}


def _save_google_tokens(data: dict):
    GOOGLE_TOKEN_FILE.write_text(json.dumps(data, indent=2))


@app.get("/oauth/google/auth-url")
async def google_auth_url(provider: str = ""):
    """Google OAuth2 認証URLを生成"""
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
    if not client_id:
        return {"error": "GOOGLE_CLIENT_ID not configured"}

    google_scopes = _get_google_scopes()
    scope = google_scopes.get(provider, "")
    if not scope:
        return {"error": f"Unknown provider: {provider}"}

    # 複数サービスを一度に認証する場合はスコープを結合
    all_scopes = " ".join(google_scopes.values()) if provider == "all" else scope

    redirect_uri = "http://localhost:8000/oauth/google/callback"
    state = json.dumps({"provider": provider})

    import urllib.parse
    params = urllib.parse.urlencode({
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": all_scopes,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    })
    return {"url": f"https://accounts.google.com/o/oauth2/v2/auth?{params}"}


@app.get("/oauth/google/callback")
async def google_callback(code: str = "", state: str = "", error: str = ""):
    """Google OAuth2 コールバック — トークンを保存して完了画面を表示"""
    if error:
        return Response(
            content=f"<html><body><h2>Error: {error}</h2><script>setTimeout(()=>window.close(),2000)</script></body></html>",
            media_type="text/html",
        )

    client_id = os.environ.get("GOOGLE_CLIENT_ID", "")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "")

    # Authorization code → tokens
    import urllib.request
    import urllib.parse
    token_data = urllib.parse.urlencode({
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": "http://localhost:8000/oauth/google/callback",
        "grant_type": "authorization_code",
    }).encode()

    try:
        req = urllib.request.Request("https://oauth2.googleapis.com/token", data=token_data, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        res = urllib.request.urlopen(req, timeout=10)
        tokens = json.loads(res.read())
    except Exception as e:
        return Response(
            content=f"<html><body><h2>Token Error: {e}</h2><script>setTimeout(()=>window.close(),3000)</script></body></html>",
            media_type="text/html",
        )

    # プロバイダー情報を取得
    provider = "all"
    try:
        state_data = json.loads(state)
        provider = state_data.get("provider", "all")
    except Exception:
        pass

    # トークンを保存
    all_tokens = _load_google_tokens()
    all_tokens[provider] = {
        "access_token": tokens.get("access_token"),
        "refresh_token": tokens.get("refresh_token"),
        "expires_in": tokens.get("expires_in"),
        "scope": tokens.get("scope"),
        "token_type": tokens.get("token_type"),
        "created_at": _time.strftime("%Y-%m-%dT%H:%M:%S"),
    }
    # 全スコープの場合は各プロバイダーにもコピー
    google_scopes = _get_google_scopes()
    if provider == "all":
        for p in google_scopes:
            all_tokens[p] = all_tokens["all"].copy()
    _save_google_tokens(all_tokens)

    # コネクタ設定も更新
    connectors = load_connectors()
    target_providers = list(google_scopes.keys()) if provider == "all" else [provider]
    for p in target_providers:
        cid = f"{p}-google"
        connectors[cid] = {
            "id": cid,
            "provider": p,
            "config": {"authenticated": True},
            "enabled": True,
            "webhookPath": "",
            "createdAt": connectors.get(cid, {}).get("createdAt", _time.strftime("%Y-%m-%dT%H:%M:%S")),
            "updatedAt": _time.strftime("%Y-%m-%dT%H:%M:%S"),
        }
    save_connectors(connectors)

    return HTMLResponse(
        content="""
        <html><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8f9fc">
        <div style="text-align:center">
            <div style="font-size:48px;margin-bottom:16px">&#10003;</div>
            <h2 style="color:#1a1d26;margin:0">接続完了</h2>
            <p style="color:#6b7280;margin-top:8px">このタブは自動で閉じます</p>
        </div>
        <script>setTimeout(()=>window.close(),2000)</script>
        </body></html>
        """,
    )


@app.get("/oauth/google/status")
async def google_status():
    """Google OAuth トークンの状態を確認"""
    tokens = _load_google_tokens()
    result = {}
    for provider, scope in _get_google_scopes().items():
        token = tokens.get(provider)
        if token and token.get("access_token"):
            result[provider] = {"connected": True, "created_at": token.get("created_at")}
        else:
            result[provider] = {"connected": False}
    return result


# ============================================
# Webhook Endpoints (受信用 — 各SNSからPOSTされる)
# ============================================

@app.get("/{connector_id}/webhook")
async def webhook_health(connector_id: str):
    """Webhook 疎通確認"""
    conn = get_connector(connector_id)
    if not conn:
        return {"error": "Invalid connector"}
    return {"status": "ok", "provider": conn["provider"], "connectorId": connector_id}


@app.post("/connectors/{connector_id}/verify")
async def verify_connector(connector_id: str):
    """コネクタの疎通確認 — 外部サービスにアクセスして接続を検証"""
    conn = get_connector(connector_id)
    if not conn:
        return {"error": "Not found"}

    provider = conn["provider"]
    config = conn.get("config", {})
    public_url = _get_public_url()
    webhook_url = conn.get("webhookUrl") or (f"{public_url}{conn.get('webhookPath', '')}" if public_url else None)

    checks = {"webhookUrl": webhook_url, "provider": provider}

    # 1. Webhook URL が外部からアクセスできるか
    if webhook_url:
        try:
            import urllib.request
            req = urllib.request.Request(webhook_url, method="GET")
            res = urllib.request.urlopen(req, timeout=5)
            checks["webhookReachable"] = res.status == 200
        except Exception as e:
            checks["webhookReachable"] = False
            checks["webhookError"] = str(e)
    else:
        checks["webhookReachable"] = False
        checks["webhookError"] = "No public URL configured"

    # 2. プロバイダー固有の疎通確認
    if provider == "line":
        access_token = config.get("accessToken", "")
        if access_token:
            try:
                import urllib.request
                req = urllib.request.Request(
                    "https://api.line.me/v2/bot/info",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                res = urllib.request.urlopen(req, timeout=5)
                bot_info = json.loads(res.read())
                checks["botVerified"] = True
                checks["botName"] = bot_info.get("displayName", "")
                checks["botId"] = bot_info.get("userId", "")
            except Exception as e:
                checks["botVerified"] = False
                checks["botError"] = str(e)
        else:
            checks["botVerified"] = False
            checks["botError"] = "No access token"

    checks["status"] = "ok" if checks.get("webhookReachable") and checks.get("botVerified", True) else "warning"
    return checks


@app.post("/{connector_id}/webhook")
async def webhook_handler(connector_id: str, request: Request):
    """統合Webhook受信 — provider をコネクタ設定から判別"""
    conn = get_connector(connector_id)
    if not conn:
        return {"error": "Invalid connector"}

    provider = conn["provider"]

    # --- Plugin dispatch ---
    handler_cls = get_handler_class(provider)
    if handler_cls:
        try:
            handler = handler_cls(connector_id=connector_id, config=conn.get("config", {}))
            return await handler.receive_webhook(request)
        except Exception as e:
            return {"error": f"Plugin handler error: {e}"}

    # --- Legacy fallback: LINE ---
    if provider == "line":
        config = conn.get("config", {})
        channel_secret = config.get("channelSecret", "")
        access_token = config.get("accessToken", "")

        body = await request.body()
        signature = request.headers.get("x-line-signature", "")

        expected = base64.b64encode(
            hmac.HMAC(channel_secret.encode(), body, hashlib.sha256).digest()
        ).decode()
        if not hmac.compare_digest(signature, expected):
            print(f"[webhook] Invalid signature for {connector_id}")
            return {"error": "Invalid signature"}

        data = json.loads(body)
        inbox_dir = Path(f"/workspace/data/connectors/{connector_id}/inbox")
        inbox_dir.mkdir(parents=True, exist_ok=True)

        for event in data.get("events", []):
            if event.get("type") != "message":
                continue
            user_id = event.get("source", {}).get("userId", "unknown")
            timestamp = _time.strftime("%Y-%m-%dT%H:%M:%S")
            msg_type = event.get("message", {}).get("type", "")

            if msg_type == "text":
                entry = json.dumps({
                    "timestamp": timestamp, "userId": user_id,
                    "message": event["message"]["text"],
                    "connectorId": connector_id,
                }, ensure_ascii=False) + "\n"
                with open(inbox_dir / "queue.jsonl", "a") as f:
                    f.write(entry)

            elif msg_type == "image":
                media_dir = inbox_dir / "media"
                media_dir.mkdir(exist_ok=True)
                msg_id = event["message"]["id"]
                try:
                    import httpx
                    resp = httpx.get(
                        f"https://api-data.line.me/v2/bot/message/{msg_id}/content",
                        headers={"Authorization": f"Bearer {access_token}"},
                    )
                    if resp.status_code == 200:
                        ts = _time.strftime("%Y%m%d%H%M%S")
                        filepath = media_dir / f"{ts}_{msg_id}.jpg"
                        filepath.write_bytes(resp.content)
                        entry = json.dumps({
                            "timestamp": timestamp, "userId": user_id,
                            "type": "image", "mediaPath": str(filepath),
                            "message": "[画像]", "connectorId": connector_id,
                        }, ensure_ascii=False) + "\n"
                        with open(inbox_dir / "queue.jsonl", "a") as f:
                            f.write(entry)
                except Exception:
                    pass

        return {"status": "ok"}

    # === Slack ===
    if provider == "slack":
        body = await request.json()
        if body.get("type") == "url_verification":
            return {"challenge": body.get("challenge", "")}
        return {"status": "ok"}

    # === Discord ===
    if provider == "discord":
        body = await request.json()
        if body.get("type") == 1:
            return {"type": 1}
        return {"status": "ok"}

    return {"error": f"Unknown provider: {provider}"}
