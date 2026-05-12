import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.storage import delete_file, ensure_bucket_exists, generate_presigned_url, upload_file
from models.attachment import Attachment
from models.issue import Issue
from models.user import User
from routers.auth import get_current_user
from schemas.attachment import AttachmentDownloadResponse, AttachmentResponse

router = APIRouter(tags=["attachments"])

ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/heic",
    "application/pdf",
    "video/mp4", "video/quicktime",
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


@router.post(
    "/issues/{issue_id}/attachments",
    response_model=AttachmentResponse,
    status_code=201,
)
async def upload_attachment(
    issue_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    issue = await db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Замечание не найдено")

    # Прораб может загружать только к своим замечаниям
    if current_user.role == "foreman" and issue.contractor_id != current_user.contractor_id:
        raise HTTPException(status_code=403, detail="Нет доступа к этому замечанию")

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Тип файла не поддерживается: {file.content_type}. "
                   f"Разрешены: JPEG, PNG, WebP, HEIC, PDF, MP4, MOV",
        )

    file_bytes = await file.read()

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=422, detail="Файл превышает максимальный размер 50 МБ")

    # Путь в MinIO: issues/{issue_id}/{uuid}.{ext}
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    storage_path = f"issues/{issue_id}/{uuid.uuid4().hex}.{ext}"

    ensure_bucket_exists()
    upload_file(file_bytes, storage_path, file.content_type)

    attachment = Attachment(
        issue_id=issue_id,
        uploaded_by=current_user.id,
        status_at_upload=issue.status,
        file_name=file.filename,
        file_size=len(file_bytes),
        mime_type=file.content_type,
        storage_path=storage_path,
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)
    return attachment


@router.get("/issues/{issue_id}/attachments", response_model=list[AttachmentResponse])
async def list_attachments(
    issue_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    issue = await db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Замечание не найдено")

    if current_user.role == "foreman" and issue.contractor_id != current_user.contractor_id:
        raise HTTPException(status_code=403, detail="Нет доступа к этому замечанию")

    result = await db.execute(
        select(Attachment)
        .where(Attachment.issue_id == issue_id)
        .order_by(Attachment.uploaded_at)
    )
    return result.scalars().all()


@router.get("/attachments/{attachment_id}/download", response_model=AttachmentDownloadResponse)
async def download_attachment(
    attachment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    attachment = await db.get(Attachment, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Вложение не найдено")

    url = generate_presigned_url(attachment.storage_path)
    return AttachmentDownloadResponse(url=url, file_name=attachment.file_name)


@router.delete("/attachments/{attachment_id}", status_code=204)
async def delete_attachment(
    attachment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    attachment = await db.get(Attachment, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Вложение не найдено")

    # Удалить может только автор загрузки или admin
    if current_user.id != attachment.uploaded_by and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Недостаточно прав для удаления")

    delete_file(attachment.storage_path)

    await db.delete(attachment)
    await db.commit()