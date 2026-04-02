"""File browser + skills API — R2-backed, runs in back service."""

import time as _time
import mimetypes

from fastapi import APIRouter, Request
from fastapi.responses import Response

from app.r2 import r2_list, r2_read, r2_write, r2_presign
from app.routes.employees import get_employee

router = APIRouter()


@router.get("/employee/{emp_id}/files")
async def list_files(emp_id: str, path: str = ""):
    emp = get_employee(emp_id)
    if not emp:
        return {"error": "Not found"}
    return {"path": path, "items": r2_list(emp_id, path)}


@router.get("/employee/{emp_id}/files/read")
async def read_file(emp_id: str, path: str = ""):
    emp = get_employee(emp_id)
    if not emp:
        return {"error": "Not found"}
    data = r2_read(emp_id, path)
    if data is None:
        return {"error": "File not found"}
    try:
        return {"path": path, "name": path.split("/")[-1], "content": data.decode("utf-8")}
    except UnicodeDecodeError:
        return {"error": "Binary file", "path": path}


@router.post("/employee/{emp_id}/files/write")
async def write_file(emp_id: str, payload: dict):
    file_path = payload.get("path", "")
    content = payload.get("content", "")
    if not file_path:
        return {"error": "path is required"}
    emp = get_employee(emp_id)
    if not emp:
        return {"error": "Not found"}
    r2_write(emp_id, file_path, content.encode("utf-8"), "text/plain; charset=utf-8")
    return {"status": "saved", "path": file_path}


@router.post("/employee/{emp_id}/files/upload")
async def upload_file(emp_id: str, request: Request):
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
    mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    r2_write(emp_id, safe_name, content, mime)

    return {"status": "uploaded", "path": safe_name, "filename": filename, "size": len(content)}


@router.get("/employee/{emp_id}/files/serve")
async def serve_file(emp_id: str, path: str = ""):
    emp = get_employee(emp_id)
    if not emp:
        return Response(content="Not found", status_code=404)
    data = r2_read(emp_id, path)
    if data is None:
        return Response(content="Not found", status_code=404)
    mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
    return Response(content=data, media_type=mime)


@router.get("/employee/{emp_id}/files/presign")
async def presign_file(emp_id: str, path: str = ""):
    emp = get_employee(emp_id)
    if not emp:
        return {"error": "Not found"}
    url = r2_presign(emp_id, path)
    if not url:
        return {"error": "Failed to generate URL"}
    return {"url": url}


# ─── Skills (stored in R2) ───

@router.get("/employee/{emp_id}/skills")
async def list_skills(emp_id: str):
    items = r2_list(emp_id, "skills")
    skills = []
    for item in items:
        if item["isDir"] or not item["name"].endswith(".md"):
            continue
        data = r2_read(emp_id, f"skills/{item['name']}")
        content = data.decode("utf-8") if data else ""
        title = content.split("\n")[0].lstrip("# ").strip() if content else item["name"].replace(".md", "")
        skills.append({
            "name": item["name"].replace(".md", ""),
            "title": title,
            "filename": item["name"],
            "size": item.get("size", 0),
        })
    return skills


@router.post("/employee/{emp_id}/skills")
async def upsert_skill(emp_id: str, payload: dict):
    name = payload.get("name", "")
    content = payload.get("content", "")
    if not name:
        return {"error": "name is required"}
    safe_name = "".join(c for c in name if c.isalnum() or c in "-_").strip()
    if not safe_name:
        return {"error": "Invalid skill name"}
    r2_write(emp_id, f"skills/{safe_name}.md", content.encode("utf-8"), "text/markdown; charset=utf-8")
    return {"status": "saved", "name": safe_name, "filename": f"{safe_name}.md"}


@router.delete("/employee/{emp_id}/skills/{skill_name}")
async def delete_skill(emp_id: str, skill_name: str):
    # R2 doesn't have a native delete in our helper, but we can overwrite with empty
    # For now, return success (full delete requires s3.delete_object)
    from app.r2 import _get_r2, R2_BUCKET, r2_prefix
    s3 = _get_r2()
    key = r2_prefix(emp_id) + f"skills/{skill_name}.md"
    try:
        s3.delete_object(Bucket=R2_BUCKET, Key=key)
    except Exception:
        pass
    return {"status": "deleted"}


@router.get("/employee/{emp_id}/skills/{skill_name}")
async def get_skill(emp_id: str, skill_name: str):
    data = r2_read(emp_id, f"skills/{skill_name}.md")
    if data is None:
        return {"error": "Not found"}
    content = data.decode("utf-8")
    title = content.split("\n")[0].lstrip("# ").strip() if content else skill_name
    return {"name": skill_name, "title": title, "content": content}
