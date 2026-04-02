"""R2 sync — local filesystem ↔ R2 (worker-only operations)."""

import os
from pathlib import Path


def _get_r2():
    import boto3
    return boto3.client(
        "s3",
        endpoint_url=os.environ.get("R2_ENDPOINT", ""),
        aws_access_key_id=os.environ.get("R2_ACCESS_KEY_ID", ""),
        aws_secret_access_key=os.environ.get("R2_SECRET_ACCESS_KEY", ""),
        region_name="auto",
    )


R2_BUCKET = os.environ.get("R2_BUCKET", "eureka")
R2_ENV = os.environ.get("R2_ENV", "development")


def _env_prefix() -> str:
    return f"{R2_ENV}/"


def _r2_prefix(emp_id: str) -> str:
    return f"{_env_prefix()}employees/{emp_id}/"


def _r2_read(emp_id: str, path: str) -> bytes | None:
    s3 = _get_r2()
    key = _r2_prefix(emp_id) + path
    try:
        resp = s3.get_object(Bucket=R2_BUCKET, Key=key)
        return resp["Body"].read()
    except Exception:
        return None


def _r2_sync_to_local(emp_id: str, local_dir: str):
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
