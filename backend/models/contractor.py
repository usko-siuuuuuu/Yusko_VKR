from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class Contractor(Base):
    __tablename__ = "contractors"

    id:        Mapped[int]       = mapped_column(Integer, primary_key=True)
    name:      Mapped[str]       = mapped_column(String(255), nullable=False)
    inn:       Mapped[str | None] = mapped_column(String(12), nullable=True)
    is_active: Mapped[bool]      = mapped_column(Boolean, nullable=False, default=True)