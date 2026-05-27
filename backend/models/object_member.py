import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from core.database import Base


class ObjectMember(Base):
    __tablename__ = "object_members"
    __table_args__ = (UniqueConstraint("object_id", "user_id"),)

    id:        Mapped[int]               = mapped_column(Integer, primary_key=True)
    object_id: Mapped[int]               = mapped_column(Integer, ForeignKey("construction_objects.id"), nullable=False)
    user_id:   Mapped[int]               = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    added_by:  Mapped[int | None]        = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    added_at:  Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ObjectOrganization(Base):
    __tablename__ = "object_organizations"
    __table_args__ = (UniqueConstraint("object_id", "organization_id"),)

    id:              Mapped[int] = mapped_column(Integer, primary_key=True)
    object_id:       Mapped[int] = mapped_column(Integer, ForeignKey("construction_objects.id"), nullable=False)
    organization_id: Mapped[int] = mapped_column(Integer, ForeignKey("organizations.id"), nullable=False)
    role:            Mapped[str] = mapped_column(String(50), nullable=False)