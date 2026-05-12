import datetime

from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey,
    Integer, String, Text, func,
)
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class Issue(Base):
    __tablename__ = "issues"

    id:                  Mapped[int]             = mapped_column(Integer, primary_key=True)
    number:              Mapped[str]             = mapped_column(String(50), nullable=False, unique=True)
    object_id:           Mapped[int]             = mapped_column(Integer, ForeignKey("construction_objects.id"), nullable=False)
    location_id:         Mapped[int | None]      = mapped_column(Integer, ForeignKey("locations.id"), nullable=True)
    work_type_id:        Mapped[int | None]      = mapped_column(Integer, ForeignKey("work_types.id"), nullable=True)
    contractor_id:       Mapped[int | None]      = mapped_column(Integer, ForeignKey("contractors.id"), nullable=True)
    author_id:           Mapped[int]             = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    assignee_id:         Mapped[int | None]      = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    status:              Mapped[str]             = mapped_column(String(50), nullable=False, default="created")
    priority:            Mapped[str]             = mapped_column(String(20), nullable=False, default="normal")
    description:         Mapped[str]             = mapped_column(Text, nullable=False)
    requirements:        Mapped[str | None]      = mapped_column(Text, nullable=True)
    normative_reference: Mapped[str | None]      = mapped_column(String(500), nullable=True)
    defect_cause_id:     Mapped[int | None]      = mapped_column(Integer, ForeignKey("defect_causes.id"), nullable=True)
    planned_finish_at:   Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    is_overdue:          Mapped[bool]            = mapped_column(Boolean, nullable=False, default=False)
    created_at:          Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at:          Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class IssueStatusHistory(Base):
    __tablename__ = "issue_status_history"

    id:         Mapped[int]        = mapped_column(Integer, primary_key=True)
    issue_id:   Mapped[int]        = mapped_column(Integer, ForeignKey("issues.id"), nullable=False)
    old_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    new_status: Mapped[str]        = mapped_column(String(50), nullable=False)
    changed_by: Mapped[int]        = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    comment:    Mapped[str | None] = mapped_column(Text, nullable=True)
    changed_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())