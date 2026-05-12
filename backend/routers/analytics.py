import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, cast, Date, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.contractor import Contractor
from models.issue import Issue
from models.user import User
from models.work_type import WorkType
from routers.auth import get_current_user
from schemas.analytics import (
    ContractorRatingItem,
    OverdueIssueItem,
    StatusDistributionItem,
    SummaryResponse,
    TimelineItem,
    WorkTypeDistributionItem,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])

BLOCKED_ROLES = {"foreman"}


def _check_access(current_user: User) -> None:
    if current_user.role in BLOCKED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аналитика недоступна для роли foreman",
        )


# ── Сводные показатели ────────────────────────────────────────────────────────

@router.get("/summary", response_model=SummaryResponse)
async def get_summary(
    object_id: int = Query(..., description="ID объекта строительства"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_access(current_user)

    # Считаем количество по каждому статусу одним запросом
    result = await db.execute(
        select(
            func.count().label("total"),
            func.sum(case((Issue.status == "created",     1), else_=0)).label("created"),
            func.sum(case((Issue.status == "issued",      1), else_=0)).label("issued"),
            func.sum(case((Issue.status == "in_progress", 1), else_=0)).label("in_progress"),
            func.sum(case((Issue.status == "on_review",   1), else_=0)).label("on_review"),
            func.sum(case((Issue.status == "rework",      1), else_=0)).label("rework"),
            func.sum(case((Issue.status == "closed",      1), else_=0)).label("closed"),
            func.sum(case((Issue.status == "rejected",    1), else_=0)).label("rejected"),
            func.sum(case((Issue.is_overdue == True,      1), else_=0)).label("overdue"),
        ).where(Issue.object_id == object_id)
    )
    row = result.mappings().one()

    # Среднее время закрытия в днях — только для closed замечаний
    avg_result = await db.execute(
        select(
            func.avg(
                func.extract("epoch", Issue.updated_at - Issue.created_at) / 86400
            ).label("avg_days")
        ).where(
            Issue.object_id == object_id,
            Issue.status == "closed",
        )
    )
    avg_days = avg_result.scalar()

    return SummaryResponse(
        total=row["total"] or 0,
        created=row["created"] or 0,
        issued=row["issued"] or 0,
        in_progress=row["in_progress"] or 0,
        on_review=row["on_review"] or 0,
        rework=row["rework"] or 0,
        closed=row["closed"] or 0,
        rejected=row["rejected"] or 0,
        overdue=row["overdue"] or 0,
        avg_close_days=round(float(avg_days), 1) if avg_days else None,
    )


# ── Распределение по статусам ─────────────────────────────────────────────────

@router.get("/by-status", response_model=list[StatusDistributionItem])
async def get_by_status(
    object_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_access(current_user)

    result = await db.execute(
        select(Issue.status, func.count().label("count"))
        .where(Issue.object_id == object_id)
        .group_by(Issue.status)
        .order_by(func.count().desc())
    )
    return [
        StatusDistributionItem(status=row.status, count=row.count)
        for row in result
    ]


# ── Распределение по видам работ ──────────────────────────────────────────────

@router.get("/by-work-type", response_model=list[WorkTypeDistributionItem])
async def get_by_work_type(
    object_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_access(current_user)

    result = await db.execute(
        select(
            Issue.work_type_id,
            WorkType.name.label("work_type_name"),
            func.count().label("count"),
            func.sum(case((Issue.is_overdue == True, 1), else_=0)).label("overdue_count"),
        )
        .outerjoin(WorkType, Issue.work_type_id == WorkType.id)
        .where(Issue.object_id == object_id)
        .group_by(Issue.work_type_id, WorkType.name)
        .order_by(func.count().desc())
    )
    return [
        WorkTypeDistributionItem(
            work_type_id=row.work_type_id,
            work_type_name=row.work_type_name,
            count=row.count,
            overdue_count=row.overdue_count or 0,
        )
        for row in result
    ]


# ── Рейтинг подрядчиков ───────────────────────────────────────────────────────

@router.get("/by-contractor", response_model=list[ContractorRatingItem])
async def get_by_contractor(
    object_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_access(current_user)

    result = await db.execute(
        select(
            Issue.contractor_id,
            Contractor.name.label("contractor_name"),
            func.count().label("total"),
            func.sum(case((Issue.status == "closed", 1), else_=0)).label("closed"),
            func.sum(case((Issue.is_overdue == True,  1), else_=0)).label("overdue"),
            func.avg(
                case(
                    (
                        Issue.status == "closed",
                        func.extract("epoch", Issue.updated_at - Issue.created_at) / 86400,
                    ),
                    else_=None,
                )
            ).label("avg_close_days"),
        )
        .outerjoin(Contractor, Issue.contractor_id == Contractor.id)
        .where(Issue.object_id == object_id)
        .group_by(Issue.contractor_id, Contractor.name)
        .order_by(func.count().desc())
    )
    return [
        ContractorRatingItem(
            contractor_id=row.contractor_id,
            contractor_name=row.contractor_name,
            total=row.total,
            closed=row.closed or 0,
            overdue=row.overdue or 0,
            avg_close_days=round(float(row.avg_close_days), 1) if row.avg_close_days else None,
        )
        for row in result
    ]


# ── Просроченные замечания ────────────────────────────────────────────────────

@router.get("/overdue", response_model=list[OverdueIssueItem])
async def get_overdue(
    object_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_access(current_user)

    today = datetime.date.today()

    result = await db.execute(
        select(
            Issue.id,
            Issue.number,
            Issue.description,
            Issue.status,
            Issue.planned_finish_at,
            Contractor.name.label("contractor_name"),
        )
        .outerjoin(Contractor, Issue.contractor_id == Contractor.id)
        .where(
            Issue.object_id == object_id,
            Issue.planned_finish_at < today,
            Issue.status.notin_(["closed", "rejected"]),
        )
        .order_by(Issue.planned_finish_at)
    )

    items = []
    for row in result:
        days_overdue = None
        if row.planned_finish_at:
            days_overdue = (today - row.planned_finish_at).days

        items.append(OverdueIssueItem(
            id=row.id,
            number=row.number,
            description=row.description,
            status=row.status,
            contractor_name=row.contractor_name,
            planned_finish_at=str(row.planned_finish_at) if row.planned_finish_at else None,
            days_overdue=days_overdue,
        ))
    return items


# ── Динамика по неделям ───────────────────────────────────────────────────────

@router.get("/timeline", response_model=list[TimelineItem])
async def get_timeline(
    object_id: int = Query(...),
    weeks: int = Query(default=12, ge=1, le=52),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _check_access(current_user)

    since = datetime.date.today() - datetime.timedelta(weeks=weeks)

    # Замечания созданные за период
    created_result = await db.execute(
        select(
            func.to_char(cast(Issue.created_at, Date), "IYYY-IW").label("week"),
            func.count().label("cnt"),
        )
        .where(Issue.object_id == object_id, Issue.created_at >= since)
        .group_by(text("1"))
        .order_by(text("1"))
    )
    created_map = {row.week: row.cnt for row in created_result}

    # Замечания закрытые за период
    closed_result = await db.execute(
        select(
            func.to_char(cast(Issue.updated_at, Date), "IYYY-IW").label("week"),
            func.count().label("cnt"),
        )
        .where(
            Issue.object_id == object_id,
            Issue.status == "closed",
            Issue.updated_at >= since,
        )
        .group_by(text("1"))
        .order_by(text("1"))
    )
    closed_map = {row.week: row.cnt for row in closed_result}

    # Объединяем все недели
    all_weeks = sorted(set(created_map) | set(closed_map))
    return [
        TimelineItem(
            week=w,
            created=created_map.get(w, 0),
            closed=closed_map.get(w, 0),
        )
        for w in all_weeks
    ]