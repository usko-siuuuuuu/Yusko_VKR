import datetime
from pydantic import BaseModel


class IssueCreate(BaseModel):
    object_id:           int
    location_id:         int | None = None
    work_type_id:        int | None = None
    contractor_id:       int | None = None
    assignee_id:         int | None = None
    priority:            str = "normal"
    description:         str
    requirements:        str | None = None
    normative_reference: str | None = None
    defect_cause_id:     int | None = None
    planned_finish_at:   datetime.date | None = None


class IssueUpdate(BaseModel):
    location_id:         int | None = None
    work_type_id:        int | None = None
    contractor_id:       int | None = None
    assignee_id:         int | None = None
    priority:            str | None = None
    description:         str | None = None
    requirements:        str | None = None
    normative_reference: str | None = None
    defect_cause_id:     int | None = None
    planned_finish_at:   datetime.date | None = None


class StatusTransitionRequest(BaseModel):
    new_status: str
    comment:    str | None = None


class IssueStatusHistoryResponse(BaseModel):
    id:         int
    issue_id:   int
    old_status: str | None
    new_status: str
    changed_by: int
    comment:    str | None
    changed_at: datetime.datetime

    model_config = {"from_attributes": True}


class IssueResponse(BaseModel):
    id:                  int
    number:              str
    object_id:           int
    location_id:         int | None
    work_type_id:        int | None
    contractor_id:       int | None
    author_id:           int
    assignee_id:         int | None
    status:              str
    priority:            str
    description:         str
    requirements:        str | None
    normative_reference: str | None
    defect_cause_id:     int | None
    planned_finish_at:   datetime.date | None
    is_overdue:          bool
    created_at:          datetime.datetime
    updated_at:          datetime.datetime

    model_config = {"from_attributes": True}