import datetime
from pydantic import BaseModel


# ── WorkType ──────────────────────────────────────────────────────────────────

class WorkTypeCreate(BaseModel):
    name: str


class WorkTypeUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class WorkTypeResponse(BaseModel):
    id: int
    name: str
    is_active: bool

    model_config = {"from_attributes": True}


# ── DefectCause ───────────────────────────────────────────────────────────────

class DefectCauseCreate(BaseModel):
    name: str


class DefectCauseUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class DefectCauseResponse(BaseModel):
    id: int
    name: str
    is_active: bool

    model_config = {"from_attributes": True}


# ── Contractor ────────────────────────────────────────────────────────────────

class ContractorCreate(BaseModel):
    name: str
    inn: str | None = None


class ContractorUpdate(BaseModel):
    name: str | None = None
    inn: str | None = None
    is_active: bool | None = None


class ContractorResponse(BaseModel):
    id: int
    name: str
    inn: str | None
    is_active: bool

    model_config = {"from_attributes": True}


# ── ConstructionObject ────────────────────────────────────────────────────────

class ConstructionObjectCreate(BaseModel):
    name: str
    description: str | None = None
    started_at: datetime.date | None = None
    finished_at: datetime.date | None = None


class ConstructionObjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    started_at: datetime.date | None = None
    finished_at: datetime.date | None = None
    is_active: bool | None = None


class ConstructionObjectResponse(BaseModel):
    id: int
    name: str
    description: str | None
    started_at: datetime.date | None
    finished_at: datetime.date | None
    is_active: bool
    created_at: datetime.datetime

    model_config = {"from_attributes": True}

# ── Location ──────────────────────────────────────────────────────────────────

class LocationResponse(BaseModel):
    id: int
    object_id: int
    parent_id: int | None
    level: str
    name: str

    model_config = {"from_attributes": True}