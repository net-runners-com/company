"""File browser, presign, and employee skills API."""

import time as _time
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import Response

from app.employee import get_employee
from app.r2 import _get_r2, _r2_list, _r2_read, _r2_write, _r2_prefix, R2_BUCKET

router = APIRouter()


# ============================================
# Employee File Browser API (R2-backed)
# ============================================

@router.get("/employee/{emp_id}/files")
async def list_files(emp_id: str, path: str = ""):
    """社員のファイル一覧（R2から取得）"""
    emp = get_employee(emp_id)
    if not emp:
        return {"error": "Not found"}
    items = _r2_list(emp_id, path)
    return {"path": path, "items": items}


@router.get("/employee/{emp_id}/files/read")
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


@router.post("/employee/{emp_id}/files/write")
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


@router.post("/employee/{emp_id}/files/upload")
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
        "path": safe_name,
        "filename": filename,
        "size": len(content),
    }


@router.get("/employee/{emp_id}/files/serve")
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


@router.get("/employee/{emp_id}/files/presign")
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
# Employee Skills API
# ============================================

@router.get("/employee/{emp_id}/skills")
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


@router.post("/employee/{emp_id}/skills")
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


@router.delete("/employee/{emp_id}/skills/{skill_name}")
async def delete_skill(emp_id: str, skill_name: str):
    """スキルを削除"""
    filepath = Path(f"/workspace/data/employees/{emp_id}/skills/{skill_name}.md")
    if not filepath.exists():
        return {"error": "Not found"}
    filepath.unlink()
    return {"status": "deleted"}


@router.get("/employee/{emp_id}/skills/{skill_name}")
async def get_skill(emp_id: str, skill_name: str):
    """スキルの内容を取得"""
    filepath = Path(f"/workspace/data/employees/{emp_id}/skills/{skill_name}.md")
    if not filepath.exists():
        return {"error": "Not found"}
    content = filepath.read_text()
    title = content.split("\n")[0].lstrip("# ").strip() if content else skill_name
    return {"name": skill_name, "title": title, "content": content}
