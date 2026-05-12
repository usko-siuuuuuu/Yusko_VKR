from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import require_admin
from models.construction_object import ConstructionObject
from models.contractor import Contractor
from models.defect_cause import DefectCause
from models.work_type import WorkType
from routers.auth import get_current_user
from schemas.catalogs import (
    ConstructionObjectCreate, ConstructionObjectResponse, ConstructionObjectUpdate,
    ContractorCreate, ContractorResponse, ContractorUpdate,
    DefectCauseCreate, DefectCauseResponse, DefectCauseUpdate,
    WorkTypeCreate, WorkTypeResponse, WorkTypeUpdate,
)

router = APIRouter()


# ══════════════════════════════════════════════════════════════════════════════
# ВИДЫ РАБОТ
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/work-types", response_model=list[WorkTypeResponse])
async def list_work_types(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(WorkType)
    if active_only:
        q = q.where(WorkType.is_active == True)
    result = await db.execute(q.order_by(WorkType.name))
    return result.scalars().all()


@router.post("/work-types", response_model=WorkTypeResponse, status_code=201)
async def create_work_type(
    body: WorkTypeCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    obj = WorkType(name=body.name)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/work-types/{id}", response_model=WorkTypeResponse)
async def update_work_type(
    id: int,
    body: WorkTypeUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    obj = await db.get(WorkType, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Вид работ не найден")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/work-types/{id}", status_code=204)
async def deactivate_work_type(
    id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    obj = await db.get(WorkType, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Вид работ не найден")
    obj.is_active = False
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# ПРИЧИНЫ ДЕФЕКТОВ
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/defect-causes", response_model=list[DefectCauseResponse])
async def list_defect_causes(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(DefectCause)
    if active_only:
        q = q.where(DefectCause.is_active == True)
    result = await db.execute(q.order_by(DefectCause.name))
    return result.scalars().all()


@router.post("/defect-causes", response_model=DefectCauseResponse, status_code=201)
async def create_defect_cause(
    body: DefectCauseCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    obj = DefectCause(name=body.name)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/defect-causes/{id}", response_model=DefectCauseResponse)
async def update_defect_cause(
    id: int,
    body: DefectCauseUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    obj = await db.get(DefectCause, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Причина дефекта не найдена")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/defect-causes/{id}", status_code=204)
async def deactivate_defect_cause(
    id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    obj = await db.get(DefectCause, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Причина дефекта не найдена")
    obj.is_active = False
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# ПОДРЯДЧИКИ
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/contractors", response_model=list[ContractorResponse])
async def list_contractors(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(Contractor)
    if active_only:
        q = q.where(Contractor.is_active == True)
    result = await db.execute(q.order_by(Contractor.name))
    return result.scalars().all()


@router.post("/contractors", response_model=ContractorResponse, status_code=201)
async def create_contractor(
    body: ContractorCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    obj = Contractor(name=body.name, inn=body.inn)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/contractors/{id}", response_model=ContractorResponse)
async def update_contractor(
    id: int,
    body: ContractorUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    obj = await db.get(Contractor, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Подрядчик не найден")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/contractors/{id}", status_code=204)
async def deactivate_contractor(
    id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    obj = await db.get(Contractor, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Подрядчик не найден")
    obj.is_active = False
    await db.commit()


# ══════════════════════════════════════════════════════════════════════════════
# ОБЪЕКТЫ СТРОИТЕЛЬСТВА
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/construction-objects", response_model=list[ConstructionObjectResponse])
async def list_construction_objects(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(ConstructionObject)
    if active_only:
        q = q.where(ConstructionObject.is_active == True)
    result = await db.execute(q.order_by(ConstructionObject.name))
    return result.scalars().all()


@router.post("/construction-objects", response_model=ConstructionObjectResponse, status_code=201)
async def create_construction_object(
    body: ConstructionObjectCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    obj = ConstructionObject(**body.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.patch("/construction-objects/{id}", response_model=ConstructionObjectResponse)
async def update_construction_object(
    id: int,
    body: ConstructionObjectUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    obj = await db.get(ConstructionObject, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Объект строительства не найден")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    await db.commit()
    await db.refresh(obj)
    return obj


@router.delete("/construction-objects/{id}", status_code=204)
async def deactivate_construction_object(
    id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    obj = await db.get(ConstructionObject, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Объект строительства не найден")
    obj.is_active = False
    await db.commit()