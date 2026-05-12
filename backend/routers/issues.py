import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.location import Location  # noqa: F401 — нужен чтобы SQLAlchemy видел таблицу
from models.issue import Issue, IssueStatusHistory
from models.user import User
from routers.auth import get_current_user
from schemas.issue import (
    IssueCreate, IssueResponse, IssueUpdate,
    IssueStatusHistoryResponse, StatusTransitionRequest,
)

router = APIRouter(prefix="/issues", tags=["issues"])


# Разрешённые переходы: (текущий статус, роль) → список допустимых новых статусов
TRANSITIONS: dict[tuple[str, str], list[str]] = {
    ("created",     "inspector"):       ["issued", "rejected"],
    ("created",     "pto_engineer"):    ["issued", "rejected"],
    ("created",     "admin"):           ["issued", "rejected"],
    ("issued",      "foreman"):         ["in_progress"],
    ("issued",      "admin"):           ["in_progress", "rejected"],
    ("in_progress", "foreman"):         ["on_review"],
    ("in_progress", "admin"):           ["on_review", "rejected"],
    ("on_review",   "inspector"):       ["closed", "rework"],
    ("on_review",   "pto_engineer"):    ["closed", "rework"],
    ("on_review",   "admin"):           ["closed", "rework", "rejected"],
    ("rework",      "foreman"):         ["in_progress"],
    ("rework",      "admin"):           ["in_progress", "rejected"],
}


def _allowed_transitions(current_status: str, role: str) -> list[str]:
    return TRANSITIONS.get((current_status, role), [])


async def _next_number(db: AsyncSession, object_id: int) -> str:
    """Генерирует номер вида ФАС-0001 на основе количества замечаний по объекту."""
    result = await db.execute(
        select(func.count()).where(Issue.object_id == object_id)
    )
    count = result.scalar() or 0
    return f"ФАС-{count + 1:04d}"


# ── Список замечаний ──────────────────────────────────────────────────────────

@router.get("", response_model=list[IssueResponse])
async def list_issues(
    object_id:    int | None = None,
    status:       str | None = None,
    contractor_id: int | None = None,
    assignee_id:  int | None = None,
    is_overdue:   bool | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Issue)

    # Прораб видит только замечания своего подрядчика
    if current_user.role == "foreman":
        q = q.where(Issue.contractor_id == current_user.contractor_id)

    if object_id:
        q = q.where(Issue.object_id == object_id)
    if status:
        q = q.where(Issue.status == status)
    if contractor_id:
        q = q.where(Issue.contractor_id == contractor_id)
    if assignee_id:
        q = q.where(Issue.assignee_id == assignee_id)
    if is_overdue is not None:
        q = q.where(Issue.is_overdue == is_overdue)

    result = await db.execute(q.order_by(Issue.created_at.desc()))
    return result.scalars().all()


# ── Одно замечание ────────────────────────────────────────────────────────────

@router.get("/{issue_id}", response_model=IssueResponse)
async def get_issue(
    issue_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    issue = await db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Замечание не найдено")

    if current_user.role == "foreman" and issue.contractor_id != current_user.contractor_id:
        raise HTTPException(status_code=403, detail="Нет доступа к этому замечанию")

    return issue


# ── Создать замечание ─────────────────────────────────────────────────────────

@router.post("", response_model=IssueResponse, status_code=201)
async def create_issue(
    body: IssueCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "foreman":
        raise HTTPException(status_code=403, detail="Прораб не может создавать замечания")

    number = await _next_number(db, body.object_id)

    issue = Issue(
        **body.model_dump(),
        number=number,
        author_id=current_user.id,
        status="created",
    )
    db.add(issue)
    await db.flush()

    history = IssueStatusHistory(
        issue_id=issue.id,
        old_status=None,
        new_status="created",
        changed_by=current_user.id,
        comment="Замечание создано",
    )
    db.add(history)
    await db.commit()
    await db.refresh(issue)
    return issue


# ── Редактировать замечание ───────────────────────────────────────────────────

@router.patch("/{issue_id}", response_model=IssueResponse)
async def update_issue(
    issue_id: int,
    body: IssueUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    issue = await db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Замечание не найдено")

    # Редактирование закрыто после перехода из created
    if issue.status != "created" and current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Редактирование доступно только в статусе 'created'",
        )

    if current_user.role == "foreman":
        raise HTTPException(status_code=403, detail="Прораб не может редактировать карточку")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(issue, field, value)

    issue.updated_at = datetime.datetime.now(datetime.timezone.utc)
    await db.commit()
    await db.refresh(issue)
    return issue


# ── Сменить статус ────────────────────────────────────────────────────────────

@router.post("/{issue_id}/status", response_model=IssueResponse)
async def change_status(
    issue_id: int,
    body: StatusTransitionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    issue = await db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Замечание не найдено")

    allowed = _allowed_transitions(issue.status, current_user.role)
    if body.new_status not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"Переход '{issue.status}' → '{body.new_status}' недопустим для роли '{current_user.role}'",
        )

    # При возврате на доработку комментарий обязателен
    if body.new_status == "rework" and not body.comment:
        raise HTTPException(
            status_code=422,
            detail="При возврате на доработку необходимо указать причину в комментарии",
        )

    history = IssueStatusHistory(
        issue_id=issue.id,
        old_status=issue.status,
        new_status=body.new_status,
        changed_by=current_user.id,
        comment=body.comment,
    )
    db.add(history)

    issue.status = body.new_status
    issue.updated_at = datetime.datetime.now(datetime.timezone.utc)

    await db.commit()
    await db.refresh(issue)
    return issue


# ── История статусов ──────────────────────────────────────────────────────────

@router.get("/{issue_id}/history", response_model=list[IssueStatusHistoryResponse])
async def get_issue_history(
    issue_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    issue = await db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Замечание не найдено")

    result = await db.execute(
        select(IssueStatusHistory)
        .where(IssueStatusHistory.issue_id == issue_id)
        .order_by(IssueStatusHistory.changed_at)
    )
    return result.scalars().all()