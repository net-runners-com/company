"""Rules management — company-wide and per-department CLAUDE.md."""

from pathlib import Path

from fastapi import APIRouter, Request

router = APIRouter()

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


@router.get("/rules/company")
async def get_company_rules():
    if COMPANY_RULES_FILE.exists():
        return {"content": COMPANY_RULES_FILE.read_text(encoding="utf-8")}
    return {"content": ""}


@router.put("/rules/company")
async def put_company_rules(req: Request):
    body = await req.json()
    COMPANY_RULES_FILE.parent.mkdir(parents=True, exist_ok=True)
    COMPANY_RULES_FILE.write_text(body["content"], encoding="utf-8")
    return {"ok": True}


@router.get("/rules/departments")
async def list_departments():
    deps = []
    for dept_id, dept_path in DEPARTMENT_DIRS.items():
        claude_md = dept_path / "CLAUDE.md"
        deps.append({
            "id": dept_id,
            "hasRules": claude_md.exists(),
        })
    return {"departments": deps}


@router.get("/rules/department/{dept_id}")
async def get_department_rules(dept_id: str):
    dept_path = DEPARTMENT_DIRS.get(dept_id)
    if not dept_path:
        return {"error": "Unknown department"}, 404
    claude_md = dept_path / "CLAUDE.md"
    if claude_md.exists():
        return {"content": claude_md.read_text(encoding="utf-8")}
    return {"content": ""}


@router.put("/rules/department/{dept_id}")
async def put_department_rules(dept_id: str, req: Request):
    dept_path = DEPARTMENT_DIRS.get(dept_id)
    if not dept_path:
        return {"error": "Unknown department"}, 404
    body = await req.json()
    dept_path.mkdir(parents=True, exist_ok=True)
    (dept_path / "CLAUDE.md").write_text(body["content"], encoding="utf-8")
    return {"ok": True}
