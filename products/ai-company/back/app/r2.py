"""R2 Object Storage — write-only for back service (profile generation etc.)."""

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


def r2_write(emp_id: str, filename: str, content: bytes, content_type: str = "text/plain"):
    """R2にファイルを書き込む"""
    s3 = _get_r2()
    key = f"employees/{emp_id}/{filename}"
    s3.put_object(Bucket=R2_BUCKET, Key=key, Body=content, ContentType=content_type)
