import datetime
from models.organization import Organization
from models.work_type import WorkType
from models.document import Document

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.issue import Issue, IssueStatusHistory
from models.user import User
from routers.auth import get_current_user
from schemas.issue import (
    IssueCreate, IssueResponse, IssueUpdate,
    IssueStatusHistoryResponse, StatusTransitionRequest,
)

router = APIRouter(prefix="/issues", tags=["issues"])

# Машина состояний: (текущий статус, роль, тип замечания) → допустимые переходы
# issue_type=None означает "любой тип"
TRANSITIONS: dict[tuple[str, str, str | None], list[str]] = {
    # Тип 1: supervisor → foreman
    ("issued",               "foreman",    "type1"): ["in_progress"],
    ("in_progress",          "foreman",    "type1"): ["on_review_supervisor"],
    ("on_review_supervisor", "supervisor", "type1"): ["closed", "rework"],
    ("rework",               "foreman",    "type1"): ["in_progress"],

    # Тип 2: client_rep → supervisor → foreman
    ("issued",               "supervisor",  "type2"): ["in_progress"],        # supervisor переадресует
    ("in_progress",          "foreman",     "type2"): ["on_review_supervisor"],
    ("on_review_supervisor", "supervisor",  "type2"): ["on_review_client", "rework"],
    ("on_review_client",     "client_rep",  "type2"): ["closed", "rework"],
    ("rework",               "foreman",     "type2"): ["in_progress"],
    ("rework",               "supervisor",  "type2"): ["in_progress"],        # после возврата от заказчика

    # Админ может всё
    ("issued",               "admin", None): ["in_progress", "closed", "rework"],
    ("in_progress",          "admin", None): ["on_review_supervisor", "closed", "rework"],
    ("on_review_supervisor", "admin", None): ["on_review_client", "closed", "rework"],
    ("on_review_client",     "admin", None): ["closed", "rework"],
    ("rework",               "admin", None): ["in_progress", "issued"],
}


def _allowed_transitions(current_status: str, role: str, issue_type: str) -> list[str]:
    # Сначала ищем точное совпадение по типу
    result = TRANSITIONS.get((current_status, role, issue_type), [])
    if not result:
        # Потом проверяем для admin (issue_type=None)
        result = TRANSITIONS.get((current_status, role, None), [])
    return result


async def _next_number(db: AsyncSession, object_id: int) -> str:
    result = await db.execute(
        select(func.count()).where(Issue.object_id == object_id)
    )
    count = result.scalar() or 0
    return f"ФАС-{count + 1:04d}"

async def _enrich_issue(issue: Issue, db: AsyncSession) -> IssueResponse:
    """Подгружает имена связанных сущностей."""
    data = IssueResponse.model_validate(issue)

    if issue.author_id:
        u = await db.get(User, issue.author_id)
        data.author_name = u.full_name if u else None

    if issue.supervisor_id:
        u = await db.get(User, issue.supervisor_id)
        data.supervisor_name = u.full_name if u else None

    if issue.assignee_id:
        u = await db.get(User, issue.assignee_id)
        data.assignee_name = u.full_name if u else None

    if issue.subcontractor_org_id:
        o = await db.get(Organization, issue.subcontractor_org_id)
        data.subcontractor_name = o.name if o else None

    if issue.work_type_id:
        w = await db.get(WorkType, issue.work_type_id)
        data.work_type_name = w.name if w else None

    if issue.document_id:
        d = await db.get(Document, issue.document_id)
        data.document_name = d.short_name or d.name if d else None

    return data

@router.get("", response_model=list[IssueResponse])
async def list_issues(
    object_id:    int | None = None,
    status:       str | None = None,
    issue_type:   str | None = None,
    assignee_id:  int | None = None,
    is_overdue:   bool | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Issue)

    if current_user.role == "foreman":
        q = q.where(Issue.assignee_id == current_user.id)
    if current_user.role == "client_rep":
        q = q.where(Issue.issue_type == "type2")

    if object_id:
        q = q.where(Issue.object_id == object_id)
    if status:
        q = q.where(Issue.status == status)
    if issue_type:
        q = q.where(Issue.issue_type == issue_type)
    if assignee_id:
        q = q.where(Issue.assignee_id == assignee_id)
    if is_overdue is not None:
        q = q.where(Issue.is_overdue == is_overdue)

    result = await db.execute(q.order_by(Issue.created_at.desc()))
    issues = result.scalars().all()

    today = datetime.date.today()
    for issue in issues:
        if issue.planned_finish_at and issue.status != 'closed':
            issue.is_overdue = issue.planned_finish_at < today
        else:
            issue.is_overdue = False

    return [await _enrich_issue(issue, db) for issue in issues]


@router.get("/{issue_id}", response_model=IssueResponse)
async def get_issue(
    issue_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    issue = await db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Замечание не найдено")

    if current_user.role == "foreman" and issue.assignee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к этому замечанию")

    if current_user.role == "client_rep" and issue.issue_type == "type1":
        raise HTTPException(status_code=403, detail="Нет доступа к замечаниям типа 1")

    today = datetime.date.today()
    if issue.planned_finish_at and issue.status != 'closed':
        issue.is_overdue = issue.planned_finish_at < today
    else:
        issue.is_overdue = False

    return await _enrich_issue(issue, db)


@router.post("", response_model=IssueResponse, status_code=201)
async def create_issue(
    body: IssueCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "foreman":
        raise HTTPException(status_code=403, detail="Прораб не может создавать замечания")

    if current_user.role == "client_rep" and body.issue_type == "type1":
        raise HTTPException(status_code=403, detail="Заказчик не может создавать замечания типа 1")

    if current_user.role == "supervisor" and body.issue_type == "type2":
        raise HTTPException(status_code=403, detail="Технадзор не может создавать замечания типа 2")

    number = await _next_number(db, body.object_id)

    issue = Issue(
        **body.model_dump(),
        number=number,
        author_id=current_user.id,
        status="issued",
    )
    db.add(issue)
    await db.flush()

    history = IssueStatusHistory(
        issue_id=issue.id,
        old_status=None,
        new_status="issued",
        changed_by=current_user.id,
        comment="Замечание выдано",
        visible_to_client=True,
    )
    db.add(history)
    await db.commit()
    await db.refresh(issue)
    return await _enrich_issue(issue, db)


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

    if current_user.role == "foreman":
        raise HTTPException(status_code=403, detail="Прораб не может редактировать карточку")

    if current_user.role == "client_rep" and issue.issue_type == "type1":
        raise HTTPException(status_code=403, detail="Нет доступа")

    # Только supervisor и admin могут редактировать после выдачи
    if issue.status != "issued" and current_user.role not in ("admin", "supervisor"):
        raise HTTPException(
            status_code=403,
            detail="Редактирование доступно только в статусе 'issued'",
        )

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(issue, field, value)

    issue.updated_at = datetime.datetime.now(datetime.timezone.utc)
    await db.commit()
    await db.refresh(issue)
    return await _enrich_issue(issue, db)


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

    allowed = _allowed_transitions(issue.status, current_user.role, issue.issue_type)
    if body.new_status not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"Переход '{issue.status}' → '{body.new_status}' недопустим для роли '{current_user.role}'",
        )

    if body.new_status == "rework" and not body.comment:
        raise HTTPException(
            status_code=422,
            detail="При возврате на доработку необходимо указать причину в комментарии",
        )

    # Видимость записи в истории для заказчика
    # Внутренний контур (supervisor↔foreman) скрыт от client_rep
    visible_to_client = not (
        issue.issue_type == "type2" and
        body.new_status in ("in_progress", "on_review_supervisor", "rework") and
        current_user.role in ("supervisor", "foreman")
    )

    history = IssueStatusHistory(
        issue_id=issue.id,
        old_status=issue.status,
        new_status=body.new_status,
        changed_by=current_user.id,
        comment=body.comment,
        visible_to_client=visible_to_client,
    )
    db.add(history)

    issue.status = body.new_status
    issue.updated_at = datetime.datetime.now(datetime.timezone.utc)

    await db.commit()
    await db.refresh(issue)
    return issue


@router.get("/{issue_id}/history", response_model=list[IssueStatusHistoryResponse])
async def get_issue_history(
    issue_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    issue = await db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Замечание не найдено")

    q = select(IssueStatusHistory).where(IssueStatusHistory.issue_id == issue_id)

    if current_user.role == "client_rep":
        q = q.where(IssueStatusHistory.visible_to_client == True)

    result = await db.execute(q.order_by(IssueStatusHistory.changed_at))
    history = result.scalars().all()

    enriched = []
    for h in history:
        item = IssueStatusHistoryResponse.model_validate(h)
        user = await db.get(User, h.changed_by)
        item.changed_by_name = user.full_name if user else None
        enriched.append(item)

    return enriched