import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column
from core.database import Base


class User(Base):
    __tablename__ = "users"

    id:              Mapped[int]            = mapped_column(Integer, primary_key=True)
    full_name:       Mapped[str]            = mapped_column(String(255), nullable=False)
    email:           Mapped[str]            = mapped_column(String(255), nullable=False, unique=True)
    password_hash:   Mapped[str]            = mapped_column(String(255), nullable=False)
    role:            Mapped[str]            = mapped_column(String(50), nullable=False)
    position:        Mapped[str | None]     = mapped_column(String(255), nullable=True)
    organization_id: Mapped[int | None]     = mapped_column(Integer, ForeignKey("organizations.id"), nullable=True)
    is_active:       Mapped[bool]           = mapped_column(Boolean, nullable=False, default=True)
    created_at:      Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())