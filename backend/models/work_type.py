from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class WorkType(Base):
    __tablename__ = "work_types"

    id:        Mapped[int]  = mapped_column(Integer, primary_key=True)
    name:      Mapped[str]  = mapped_column(String(255), nullable=False, unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)