import datetime
from pydantic import BaseModel


class ObjectCreate(BaseModel):
    name: str
    description: str | None = None
    date_start: str | None = None
    date_end: str | None = None


class ObjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    photo_key: str | None = None
    date_start: str | None = None
    date_end: str | None = None
    is_active: bool | None = None


class ObjectResponse(BaseModel):
    id: int
    name: str
    description: str | None
    photo_key: str | None
    date_start: str | None
    date_end: str | None
    is_active: bool
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


class ObjectOrganizationAdd(BaseModel):
    organization_id: int
    role: str


class ObjectOrganizationResponse(BaseModel):
    id: int
    object_id: int
    organization_id: int
    organization_name: str
    role: str


class ObjectMemberAdd(BaseModel):
    user_id: int


class ObjectMemberResponse(BaseModel):
    id: int
    object_id: int
    user_id: int
    full_name: str
    role: str
    position: str | None
    added_at: datetime.datetime