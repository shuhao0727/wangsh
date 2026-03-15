from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.database import Base


class InformaticsGithubSyncSetting(Base):
    __tablename__ = "inf_github_sync_settings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    repo_url: Mapped[str] = mapped_column(String(500), default="")
    repo_owner: Mapped[str] = mapped_column(String(100), default="")
    repo_name: Mapped[str] = mapped_column(String(200), default="")
    branch: Mapped[str] = mapped_column(String(100), default="main")
    token_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    enabled: Mapped[bool] = mapped_column(default=False)
    interval_hours: Mapped[int] = mapped_column(default=48)
    delete_mode: Mapped[str] = mapped_column(String(20), default="unpublish")
    last_test_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    last_test_message: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    last_test_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    updated_by_id: Mapped[Optional[int]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
