import datetime
from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column
from core.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id:         Mapped[int]               = mapped_column(Integer, primary_key=True)
    name:       Mapped[str]               = mapped_column(String(255), nullable=False)
    type:       Mapped[str]               = mapped_column(String(50), nullable=False)
    is_active:  Mapped[bool]              = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())