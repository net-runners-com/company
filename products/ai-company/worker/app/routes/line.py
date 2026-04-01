"""LINE routing — route messages to the best employee."""

import json
import subprocess

from fastapi import APIRouter

from app.employee import load_employees

router = APIRouter()


@router.post("/line/route")
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

    routing_prompt = f"""メッセージを最適な社員に振り分け。社員一覧:
{roster}
予定/TODO/相談→秘書,経費/会計→経理,記事/SNS→マーケ,調査→リサーチ,営業/メール→営業,インフラ→DevOps,要件/進捗→PM,戦略→ストラテジスト,採用→人事,コード→エンジニア,新規事業→newbiz,財務→finance,不明→emp-1
メッセージ: {message}
JSON出力のみ: {{"empId":"emp-X","empName":"名前","reason":"10字以内"}}"""

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
