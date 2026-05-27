import datetime
from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from core.database import Base


class ConstructionObject(Base):
    __tablename__ = "construction_objects"

    id:          Mapped[int]               = mapped_column(Integer, primary_key=True)
    name:        Mapped[str]               = mapped_column(String(255), nullable=False)
    description: Mapped[str | None]        = mapped_column(Text, nullable=True)
    photo_key:   Mapped[str | None]        = mapped_column(String(500), nullable=True)
    date_start:  Mapped[str | None]        = mapped_column(String(20), nullable=True)
    date_end:    Mapped[str | None]        = mapped_column(String(20), nullable=True)
    is_active:   Mapped[bool]              = mapped_column(Boolean, nullable=False, default=True)
    created_at:  Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())