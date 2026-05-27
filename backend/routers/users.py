from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import require_admin
from core.security import hash_password
from models.object_member import ObjectMember
from models.user import User
from routers.auth import get_current_user
from schemas.user import UserCreate, UserUpdate, UserListResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserListResponse])
async def list_users(
    organization_id: int | None = None,
    role: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    q = select(User).order_by(User.full_name)
    if organization_id:
        q = q.where(User.organization_id == organization_id)
    if role:
        q = q.where(User.role == role)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/by-object/{object_id}", response_model=list[UserListResponse])
async def list_users_by_object(
    object_id: int,
    role: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Список пользователей привязанных к конкретному объекту."""
    q = (
        select(User)
        .join(ObjectMember, ObjectMember.user_id == User.id)
        .where(ObjectMember.object_id == object_id)
        .order_by(User.full_name)
    )
    if role:
        q = q.where(User.role == role)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=UserListResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")

    user = User(
        full_name=body.full_name,
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role.value,
        position=body.position,
        organization_id=body.organization_id,
    )
    db.add(user)
    await db.flush()

    # Привязываем к объектам сразу при создании
    for object_id in body.object_ids:
        db.add(ObjectMember(
            object_id=object_id,
            user_id=user.id,
            added_by=current_admin.id,
        ))

    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserListResponse)
async def update_user(
    user_id: int,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if body.password is not None:
        user.password_hash = hash_password(body.password)
    if body.role is not None:
        user.role = body.role.value
    if body.position is not None:
        user.position = body.position
    if body.organization_id is not None:
        user.organization_id = body.organization_id
    if body.is_active is not None:
        user.is_active = body.is_active

    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/{user_id}/password", response_model=UserListResponse)
async def change_own_password(
    user_id: int,
    old_password: str,
    new_password: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Смена пароля самим пользователем — требует старый пароль."""
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Можно менять только свой пароль")

    from core.security import verify_password
    if not verify_password(old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Неверный текущий пароль")

    current_user.password_hash = hash_password(new_password)
    await db.commit()
    await db.refresh(current_user)
    return current_user