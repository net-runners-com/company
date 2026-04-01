"""Employee management — file storage, workdir, system prompt builder."""

import json
import datetime
import time as _time
from pathlib import Path

from app.db import _get_db
from app.r2 import _r2_read

EMPLOYEES_FILE = Path("/workspace/data/employees.json")

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


def load_employees() -> dict:
    if EMPLOYEES_FILE.exists():
        return json.loads(EMPLOYEES_FILE.read_text())
    return {}


def save_employees(data: dict):
    EMPLOYEES_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def get_employee(emp_id: str) -> dict | None:
    return load_employees().get(emp_id)


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


def _ensure_employees_file():
    """起動時にemployees.jsonが存在しなければ空で作成"""
    if not EMPLOYEES_FILE.exists():
        save_employees({})
        print("[startup] Created empty employees.json")


def _build_roster(exclude_id: str = "") -> str:
    """自分以外の社員一覧を生成（役割外誘導用）"""
    employees = load_employees()
    lines = []
    for eid, e in employees.items():
        if eid == exclude_id:
            continue
        lines.append(f"- {e.get('name','')}（{e.get('role','')}）→ /employee/{eid}")
    return "社員一覧:\n" + "\n".join(lines) if lines else ""


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
- 自分の役割・スキル外の依頼は引き受けない。代わりに適切な社員を紹介してリンクを貼ること

# 役割外の依頼への対応（重要）
自分の専門外の依頼が来たら、自分では対応せず以下のように返答:
「その件は[社員名]（[役割]）が得意です！こちらでお話しできます → /employee/[社員ID]」
{_build_roster(emp.get("id", ""))}


# API（全て http://localhost:8000 宛。H="Content-Type: application/json"）

PDF作成: /workspace/company/back-office/accounting/templates/ の generate_estimate.py(見積書),generate_invoice.py(請求書),generate_contract.py(契約書) のPARAMSを書き換えて /usr/bin/python3 で実行。納品書はinvoiceベースでタイトル変更。

Web取得: ページ内容の取得・スクレイピングはまずhttpxを使う（高速）。Playwrightはフォーム操作・JSレンダリング必須の場合のみ。
```bash
python3 -c "import httpx; r=httpx.get('URL'); print(r.text[:3000])"
```

ブラウザ: DISPLAY=:99 python3 -c "from playwright.sync_api import sync_playwright; ..." headless=False,args=['--no-sandbox']必須。完了後/tmp/の一時ファイルは削除。

Nango外部API: POST /nango/proxy {{"method":"GET/POST","endpoint":"APIパス","connectionId":"__auto__","provider":"プロバイダー名"}}
 カレンダー取得: provider=google-calendar, endpoint=/calendar/v3/calendars/primary/events?timeMin=...&timeMax=...&singleEvents=true&orderBy=startTime
 カレンダー追加: provider=google-calendar, endpoint=/calendar/v3/calendars/primary/events, data={{"summary":"","start":{{"dateTime":"..."}},"end":{{"dateTime":"..."}}}}
 Gmail送信: provider=google-mail, endpoint=/gmail/v1/users/me/messages/send, data={{"raw":"base64エンコードしたRFC2822メール"}}
 未接続サービスは使えない旨を伝える。

メール下書き: POST /data/emails {{"to":"","subject":"","body":"","status":"draft"}} 送信後PUT /data/emails/{{id}} {{"status":"sent"}}

ページ: POST /pages/generate {{"prompt":"要望"}} → slug返却。DELETE /pages/{{slug}} で削除。作成後は必ずwidget参照先コレクションにデータ投入。

データストア: POST /data/{{col}} {{データ}} | GET /data/{{col}}(?q=&limit=) | GET /data/{{col}}/{{id}} | PUT /data/{{col}}/{{id}} {{更新}} | DELETE /data/{{col}}/{{id}} | GET /data (一覧)

スケジュール: POST /schedules {{"name":"","cron":"分 時 日 月 曜","empId":"自分ID","task":"内容"}} | GET /schedules | DELETE /schedules/{{id}}
 cron例: 0 9 * * 1-5=平日9時, 0 7 * * *=毎日7時

共有: POST /share {{"type":"file","empId":"","path":""}}(24h) or {{"type":"page","slug":""}}(7日) → URL返却。
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
