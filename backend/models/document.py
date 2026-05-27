import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column
from core.database import Base


class Document(Base):
    __tablename__ = "documents"

    id:         Mapped[int]           = mapped_column(Integer, primary_key=True)
    name:       Mapped[str]           = mapped_column(String(255), nullable=False)
    short_name: Mapped[str | None]    = mapped_column(String(100), nullable=True)
    doc_type:   Mapped[str]           = mapped_column(String(20), nullable=False)
    object_id:  Mapped[int | None]    = mapped_column(Integer, ForeignKey("construction_objects.id"), nullable=True)
    file_key:   Mapped[str | None]    = mapped_column(String(500), nullable=True)
    is_active:  Mapped[bool]          = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())