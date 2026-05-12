from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class Location(Base):
    __tablename__ = "locations"

    id:        Mapped[int]       = mapped_column(Integer, primary_key=True)
    object_id: Mapped[int]       = mapped_column(Integer, ForeignKey("construction_objects.id"), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("locations.id"), nullable=True)
    level:     Mapped[str]       = mapped_column(String(50), nullable=False)
    name:      Mapped[str]       = mapped_column(String(255), nullable=False)