from enum import Enum
from pydantic import BaseModel, ConfigDict


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    position: str | None
    organization_id: int | None
    is_active: bool

    model_config = {"from_attributes": True}


class UserRole(str, Enum):
    admin = "admin"
    client_rep = "client_rep"
    supervisor = "supervisor"
    foreman = "foreman"


class UserCreate(BaseModel):
    full_name: str
    email: str
    password: str
    role: UserRole
    position: str | None = None
    organization_id: int | None = None
    object_ids: list[int] = []  # объекты для привязки сразу при создании


class UserUpdate(BaseModel):
    password: str | None = None
    role: UserRole | None = None
    position: str | None = None
    organization_id: int | None = None
    is_active: bool | None = None


class UserListResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    position: str | None
    organization_id: int | None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)