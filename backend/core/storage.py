import boto3
from botocore.config import Config

from core.config import settings

_s3_client = None


def get_s3_client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            endpoint_url=f"http://{settings.minio_host}:{settings.minio_port}",
            aws_access_key_id=settings.minio_root_user,
            aws_secret_access_key=settings.minio_root_password,
            config=Config(signature_version="s3v4"),
            region_name="us-east-1",
        )
    return _s3_client


def ensure_bucket_exists():
    client = get_s3_client()
    try:
        client.head_bucket(Bucket=settings.minio_bucket)
    except Exception:
        client.create_bucket(Bucket=settings.minio_bucket)


def upload_file(file_bytes: bytes, storage_path: str, mime_type: str) -> None:
    client = get_s3_client()
    client.put_object(
        Bucket=settings.minio_bucket,
        Key=storage_path,
        Body=file_bytes,
        ContentType=mime_type,
    )


def generate_presigned_url(storage_path: str, expires_in: int = 3600) -> str:
    # Для presigned URL используем localhost — адрес доступный из браузера
    presign_client = boto3.client(
        "s3",
        endpoint_url=f"http://localhost:{settings.minio_port}",
        aws_access_key_id=settings.minio_root_user,
        aws_secret_access_key=settings.minio_root_password,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )
    return presign_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.minio_bucket, "Key": storage_path},
        ExpiresIn=expires_in,
    )


def delete_file(storage_path: str) -> None:
    client = get_s3_client()
    client.delete_object(Bucket=settings.minio_bucket, Key=storage_path)