"""R2 Object Storage — Cloudflare R2 (S3-compatible) helpers for back service."""

import os


def _get_r2():
    import boto3
    return boto3.client(
        "s3",
        endpoint_url=os.environ.get("R2_ENDPOINT", ""),
        aws_access_key_id=os.environ.get("R2_ACCESS_KEY_ID", ""),
        aws_secret_access_key=os.environ.get("R2_SECRET_ACCESS_KEY", ""),
        region_name="auto",
    )


R2_BUCKET = os.environ.get("R2_BUCKET", "ai-company-dev")


def r2_prefix(emp_id: str) -> str:
    return f"employees/{emp_id}/"


def r2_list(emp_id: str, path: str = "") -> list[dict]:
    s3 = _get_r2()
    prefix = r2_prefix(emp_id) + path
    if prefix and not prefix.endswith("/"):
        prefix += "/"
    try:
        resp = s3.list_objects_v2(Bucket=R2_BUCKET, Prefix=prefix, Delimiter="/")
    except Exception as e:
        print(f"[R2] list error: {e}")
        return []

    items = []
    for cp in resp.get("CommonPrefixes", []):
        name = cp["Prefix"][len(prefix):].rstrip("/")
        if name:
            items.append({"name": name, "path": cp["Prefix"][len(r2_prefix(emp_id)):].rstrip("/"), "isDir": True, "size": None})
    for obj in resp.get("Contents", []):
        name = obj["Key"][len(prefix):]
        if name and "/" not in name:
            items.append({"name": name, "path": obj["Key"][len(r2_prefix(emp_id)):], "isDir": False, "size": obj["Size"]})
    return items


def r2_read(emp_id: str, path: str) -> bytes | None:
    s3 = _get_r2()
    key = r2_prefix(emp_id) + path
    try:
        resp = s3.get_object(Bucket=R2_BUCKET, Key=key)
        return resp["Body"].read()
    except Exception:
        return None


def r2_write(emp_id: str, path: str, data: bytes, content_type: str = "application/octet-stream"):
    s3 = _get_r2()
    key = r2_prefix(emp_id) + path
    s3.put_object(Bucket=R2_BUCKET, Key=key, Body=data, ContentType=content_type)


def r2_presign(emp_id: str, path: str, expires: int = 3600) -> str | None:
    s3 = _get_r2()
    key = r2_prefix(emp_id) + path
    try:
        return s3.generate_presigned_url("get_object", Params={"Bucket": R2_BUCKET, "Key": key}, ExpiresIn=expires)
    except Exception:
        return None
