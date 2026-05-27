from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import require_admin
from models.construction_object import ConstructionObject
from models.object_member import ObjectMember, ObjectOrganization
from models.organization import Organization
from models.user import User
from routers.auth import get_current_user
from schemas.objects import (
    ObjectCreate, ObjectResponse, ObjectUpdate,
    ObjectOrganizationAdd, ObjectMemberAdd,
    ObjectMemberResponse, ObjectOrganizationResponse,
)

router = APIRouter(prefix="/objects", tags=["objects"])

CAN_INVITE = {"admin", "client_rep", "supervisor"}


@router.get("", response_model=list[ObjectResponse])
async def list_objects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "admin":
        result = await db.execute(
            select(ConstructionObject)
            .where(ConstructionObject.is_active == True)
            .order_by(ConstructionObject.name)
        )
        return result.scalars().all()

    # Остальные видят только объекты где они участники
    result = await db.execute(
        select(ConstructionObject)
        .join(ObjectMember, ObjectMember.object_id == ConstructionObject.id)
        .where(
            ObjectMember.user_id == current_user.id,
            ConstructionObject.is_active == True,
        )
        .order_by(ConstructionObject.name)
    )
    return result.scalars().all()


@router.get("/{object_id}", response_model=ObjectResponse)
async def get_object(
    object_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = await db.get(ConstructionObject, object_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Объект не найден")

    if current_user.role != "admin":
        member = await db.execute(
            select(ObjectMember).where(
                ObjectMember.object_id == object_id,
                ObjectMember.user_id == current_user.id,
            )
        )
        if not member.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Нет доступа к этому объекту")

    return obj


@router.post("", response_model=ObjectResponse, status_code=status.HTTP_201_CREATED)
async def create_object(
    body: ObjectCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    obj = ConstructionObject(
        name=body.name,
        description=body.description,
        date_start=body.date_start,
        date_end=body.date_end,
    )
    db.add(obj)
    await db.flush()

    # Автоматически добавляем админа как участника
    db.add(ObjectMember(object_id=obj.id, user_id=_.id, added_by=_.id))

    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/{object_id}", response_model=ObjectResponse)
async def update_object(
    object_id: int,
    body: ObjectUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    obj = await db.get(ConstructionObject, object_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Объект не найден")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    await db.commit()
    await db.refresh(obj)
    return obj


# ── Организации объекта ───────────────────────────────────────────────────────

@router.get("/{object_id}/organizations", response_model=list[ObjectOrganizationResponse])
async def list_object_organizations(
    object_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ObjectOrganization, Organization)
        .join(Organization, ObjectOrganization.organization_id == Organization.id)
        .where(ObjectOrganization.object_id == object_id)
    )
    rows = result.all()
    return [
        ObjectOrganizationResponse(
            id=row.ObjectOrganization.id,
            object_id=object_id,
            organization_id=row.Organization.id,
            organization_name=row.Organization.name,
            role=row.ObjectOrganization.role,
        )
        for row in rows
    ]


@router.post("/{object_id}/organizations", status_code=status.HTTP_201_CREATED)
async def add_object_organization(
    object_id: int,
    body: ObjectOrganizationAdd,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    existing = await db.execute(
        select(ObjectOrganization).where(
            ObjectOrganization.object_id == object_id,
            ObjectOrganization.organization_id == body.organization_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Организация уже привязана к объекту")

    link = ObjectOrganization(
        object_id=object_id,
        organization_id=body.organization_id,
        role=body.role,
    )
    db.add(link)
    await db.commit()
    return {"ok": True}


@router.delete("/{object_id}/organizations/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_object_organization(
    object_id: int,
    org_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    result = await db.execute(
        select(ObjectOrganization).where(
            ObjectOrganization.object_id == object_id,
            ObjectOrganization.organization_id == org_id,
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Связь не найдена")
    await db.delete(link)
    await db.commit()


# ── Участники объекта ─────────────────────────────────────────────────────────

@router.get("/{object_id}/members", response_model=list[ObjectMemberResponse])
async def list_object_members(
    object_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ObjectMember, User)
        .join(User, ObjectMember.user_id == User.id)
        .where(ObjectMember.object_id == object_id)
        .order_by(User.full_name)
    )
    rows = result.all()
    return [
        ObjectMemberResponse(
            id=row.ObjectMember.id,
            object_id=object_id,
            user_id=row.User.id,
            full_name=row.User.full_name,
            role=row.User.role,
            position=row.User.position,
            added_at=row.ObjectMember.added_at,
        )
        for row in rows
    ]


@router.post("/{object_id}/members", status_code=status.HTTP_201_CREATED)
async def add_object_member(
    object_id: int,
    body: ObjectMemberAdd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in CAN_INVITE:
        raise HTTPException(status_code=403, detail="Недостаточно прав для приглашения")

    # Проверяем права: supervisor может добавлять только foreman'ов
    if current_user.role == "supervisor":
        user = await db.get(User, body.user_id)
        if not user or user.role != "foreman":
            raise HTTPException(
                status_code=403,
                detail="Технадзор может добавлять только прорабов",
            )

    # Проверяем что пользователь ещё не участник
    existing = await db.execute(
        select(ObjectMember).where(
            ObjectMember.object_id == object_id,
            ObjectMember.user_id == body.user_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Пользователь уже участник объекта")

    member = ObjectMember(
        object_id=object_id,
        user_id=body.user_id,
        added_by=current_user.id,
    )
    db.add(member)
    await db.commit()
    return {"ok": True}


@router.delete("/{object_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_object_member(
    object_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    result = await db.execute(
        select(ObjectMember).where(
            ObjectMember.object_id == object_id,
            ObjectMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Участник не найден")
    await db.delete(member)
    await db.commit()