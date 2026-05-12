import datetime
from pydantic import BaseModel


class AttachmentResponse(BaseModel):
    id:               int
    issue_id:         int
    uploaded_by:      int
    status_at_upload: str | None
    file_name:        str
    file_size:        int
    mime_type:        str
    storage_path:     str
    uploaded_at:      datetime.datetime

    model_config = {"from_attributes": True}


class AttachmentDownloadResponse(BaseModel):
    url: str
    file_name: str
    expires_in_seconds: int = 3600