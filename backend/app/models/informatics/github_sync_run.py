from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.database import Base


class InformaticsGithubSyncRun(Base):
    __tablename__ = "inf_github_sync_runs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    trigger_type: Mapped[str] = mapped_column(String(20), default="manual")
    status: Mapped[str] = mapped_column(String(20), default="running")
    repo_owner: Mapped[str] = mapped_column(String(100), default="")
    repo_name: Mapped[str] = mapped_column(String(200), default="")
    branch: Mapped[str] = mapped_column(String(100), default="main")
    created_count: Mapped[int] = mapped_column(default=0)
    updated_count: Mapped[int] = mapped_column(default=0)
    deleted_count: Mapped[int] = mapped_column(default=0)
    skipped_count: Mapped[int] = mapped_column(default=0)
    error_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(server_default=func.now())
    finished_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
