"""R2 Object Storage — Cloudflare R2 (S3-compatible) helpers."""

import os
from pathlib import Path


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
