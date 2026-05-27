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


# ── ConstructionObject ────────────────────────────────────────────────────────

class ConstructionObjectCreate(BaseModel):
    name: str
    description: str | None = None
    photo_key: str | None = None
    date_start: str | None = None
    date_end: str | None = None


class ConstructionObjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    photo_key: str | None = None
    date_start: str | None = None
    date_end: str | None = None
    is_active: bool | None = None


class ConstructionObjectResponse(BaseModel):
    id: int
    name: str
    description: str | None
    photo_key: str | None
    date_start: str | None
    date_end: str | None
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