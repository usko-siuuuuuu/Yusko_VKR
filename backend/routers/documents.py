from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import require_admin
from models.document import Document
from routers.auth import get_current_user
from schemas.documents import DocumentCreate, DocumentUpdate, DocumentResponse

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    doc_type: str | None = None,
    object_id: int | None = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(Document)
    if active_only:
        q = q.where(Document.is_active == True)
    if doc_type:
        q = q.where(Document.doc_type == doc_type)
    if object_id is not None:
        # Нормативные (общие) + проектные этого объекта
        q = q.where(
            (Document.doc_type == "normative") |
            (Document.object_id == object_id)
        )
    result = await db.execute(q.order_by(Document.name))
    return result.scalars().all()


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_document(
    body: DocumentCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    doc = Document(
        name=body.name,
        short_name=body.short_name,
        doc_type=body.doc_type,
        object_id=body.object_id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


@router.patch("/{doc_id}", response_model=DocumentResponse)
async def update_document(
    doc_id: int,
    body: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(doc, field, value)
    await db.commit()
    await db.refresh(doc)
    return doc


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    doc.is_active = False
    await db.commit()