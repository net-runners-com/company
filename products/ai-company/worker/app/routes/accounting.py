"""Accounting — journal, expenses, invoices, process."""

import asyncio
import json
import re
import time as _time
from pathlib import Path

from fastapi import APIRouter, Request

router = APIRouter()

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


@router.get("/accounting/journal")
async def get_journal(month: str = ""):
    """仕訳帳データを返す"""
    if not month:
        month = _time.strftime("%Y-%m")
    filepath = ACCOUNTING_DIR / "journal" / f"{month}.md"
    entries = _parse_md_table(filepath)
    # 金額をパース
    for e in entries:
        for key in ("借方金額", "貸方金額"):
            raw = e.get(key, "0")
            nums = re.sub(r'[^\d]', '', str(raw))
            e[key] = int(nums) if nums else 0
    return {"month": month, "entries": entries}


@router.get("/accounting/expenses")
async def get_expenses(month: str = ""):
    """経費帳データを返す"""
    if not month:
        month = _time.strftime("%Y-%m")
    filepath = ACCOUNTING_DIR / "expenses" / f"{month}.md"
    entries = _parse_md_table(filepath)
    for e in entries:
        raw = e.get("金額", "0")
        nums = re.sub(r'[^\d]', '', str(raw))
        e["金額_num"] = int(nums) if nums else 0
    return {"month": month, "entries": entries}


@router.get("/accounting/invoices")
async def get_invoices(month: str = ""):
    """受領請求書データを返す"""
    if not month:
        month = _time.strftime("%Y-%m")
    filepath = ACCOUNTING_DIR / "invoices" / f"received-{month}.md"
    entries = _parse_md_table(filepath)
    return {"month": month, "entries": entries}


@router.post("/accounting/process")
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
