"""Share URLs — file and page sharing via R2 presigned URLs."""

import json
import uuid
import time as _time

from fastapi import APIRouter, Request

from app.db import _get_db
from app.r2 import _get_r2, _r2_prefix, R2_BUCKET

router = APIRouter()


@router.post("/share")
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
