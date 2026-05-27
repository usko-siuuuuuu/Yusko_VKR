import datetime
from pydantic import BaseModel

DOC_TYPES = {"normative", "project"}


class DocumentCreate(BaseModel):
    name: str
    short_name: str | None = None
    doc_type: str
    object_id: int | None = None  # None для нормативных (общих)

    def model_post_init(self, __context):
        if self.doc_type not in DOC_TYPES:
            raise ValueError(f"Тип документа должен быть одним из: {DOC_TYPES}")
        if self.doc_type == "project" and self.object_id is None:
            raise ValueError("Проектный документ должен быть привязан к объекту")


class DocumentUpdate(BaseModel):
    name: str | None = None
    short_name: str | None = None
    is_active: bool | None = None


class DocumentResponse(BaseModel):
    id: int
    name: str
    short_name: str | None
    doc_type: str
    object_id: int | None
    file_key: str | None
    is_active: bool
    created_at: datetime.datetime

    model_config = {"from_attributes": True}