import datetime
from pydantic import BaseModel

ORG_TYPES = {"customer", "general_contractor", "subcontractor"}


class OrganizationCreate(BaseModel):
    name: str
    type: str

    def model_post_init(self, __context):
        if self.type not in ORG_TYPES:
            raise ValueError(f"Тип организации должен быть одним из: {ORG_TYPES}")


class OrganizationUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    is_active: bool | None = None


class OrganizationResponse(BaseModel):
    id: int
    name: str
    type: str
    is_active: bool
    created_at: datetime.datetime

    model_config = {"from_attributes": True}