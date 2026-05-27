import datetime
from pydantic import BaseModel


class IssueCreate(BaseModel):
    object_id:            int
    issue_type:           str = "type1"
    location_id:          int | None = None
    work_type_id:         int | None = None
    work_type_custom:     str | None = None
    supervisor_id:        int | None = None
    assignee_id:          int | None = None
    subcontractor_org_id: int | None = None
    axes:                 str | None = None
    location_x:           float | None = None
    location_y:           float | None = None
    description:          str
    requirements:         str | None = None
    document_id:          int | None = None
    planned_finish_at:    datetime.date | None = None


class IssueUpdate(BaseModel):
    location_id:          int | None = None
    work_type_id:         int | None = None
    work_type_custom:     str | None = None
    supervisor_id:        int | None = None
    assignee_id:          int | None = None
    subcontractor_org_id: int | None = None
    axes:                 str | None = None
    location_x:           float | None = None
    location_y:           float | None = None
    description:          str | None = None
    requirements:         str | None = None
    document_id:          int | None = None
    planned_finish_at:    datetime.date | None = None


class StatusTransitionRequest(BaseModel):
    new_status: str
    comment:    str | None = None


class IssueStatusHistoryResponse(BaseModel):
    id:                int
    issue_id:          int
    old_status:        str | None
    new_status:        str
    changed_by:        int
    changed_by_name:   str | None = None
    comment:           str | None
    visible_to_client: bool
    changed_at:        datetime.datetime

    model_config = {"from_attributes": True}


class IssueResponse(BaseModel):
    id:                   int
    number:               str
    object_id:            int
    issue_type:           str
    location_id:          int | None
    work_type_id:         int | None
    work_type_name:       str | None = None
    work_type_custom:     str | None
    author_id:            int
    author_name:          str | None = None
    supervisor_id:        int | None
    supervisor_name:      str | None = None
    assignee_id:          int | None
    assignee_name:        str | None = None
    subcontractor_org_id: int | None
    subcontractor_name:   str | None = None
    axes:                 str | None
    location_x:           float | None
    location_y:           float | None
    description:          str
    requirements:         str | None
    document_id:          int | None
    document_name:        str | None = None
    status:               str
    planned_finish_at:    datetime.date | None
    is_overdue:           bool
    created_at:           datetime.datetime
    updated_at:           datetime.datetime

    model_config = {"from_attributes": True}