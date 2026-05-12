from sqlalchemy import Boolean, Date, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
import datetime

from core.database import Base


class ConstructionObject(Base):
    __tablename__ = "construction_objects"

    id:          Mapped[int]             = mapped_column(Integer, primary_key=True)
    name:        Mapped[str]             = mapped_column(String(255), nullable=False)
    description: Mapped[str | None]      = mapped_column(Text, nullable=True)
    started_at:  Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    finished_at: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    is_active:   Mapped[bool]            = mapped_column(Boolean, nullable=False, default=True)
    created_at:  Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )