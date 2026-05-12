from pydantic import BaseModel


class SummaryResponse(BaseModel):
    total: int
    created: int
    issued: int
    in_progress: int
    on_review: int
    rework: int
    closed: int
    rejected: int
    overdue: int
    avg_close_days: float | None


class StatusDistributionItem(BaseModel):
    status: str
    count: int


class WorkTypeDistributionItem(BaseModel):
    work_type_id: int | None
    work_type_name: str | None
    count: int
    overdue_count: int


class ContractorRatingItem(BaseModel):
    contractor_id: int | None
    contractor_name: str | None
    total: int
    closed: int
    overdue: int
    avg_close_days: float | None


class OverdueIssueItem(BaseModel):
    id: int
    number: str
    description: str
    status: str
    contractor_name: str | None
    planned_finish_at: str | None
    days_overdue: int | None

    model_config = {"from_attributes": True}


class TimelineItem(BaseModel):
    week: str
    created: int
    closed: int