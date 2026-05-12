import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class Attachment(Base):
    __tablename__ = "attachments"

    id:               Mapped[int]        = mapped_column(Integer, primary_key=True)
    issue_id:         Mapped[int]        = mapped_column(Integer, ForeignKey("issues.id"), nullable=False)
    uploaded_by:      Mapped[int]        = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    status_at_upload: Mapped[str | None] = mapped_column(String(50), nullable=True)
    file_name:        Mapped[str]        = mapped_column(String(255), nullable=False)
    file_size:        Mapped[int]        = mapped_column(Integer, nullable=False)
    mime_type:        Mapped[str]        = mapped_column(String(100), nullable=False)
    storage_path:     Mapped[str]        = mapped_column(String(500), nullable=False)
    uploaded_at:      Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )