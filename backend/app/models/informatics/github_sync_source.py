from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.database import Base


class InformaticsGithubSyncSource(Base):
    __tablename__ = "inf_github_sync_sources"
    __table_args__ = (
        UniqueConstraint("repo_owner", "repo_name", "branch", "source_path", name="uq_inf_sync_source_repo_path"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    repo_owner: Mapped[str] = mapped_column(String(100))
    repo_name: Mapped[str] = mapped_column(String(200))
    branch: Mapped[str] = mapped_column(String(100), default="main")
    source_path: Mapped[str] = mapped_column(String(500))
    source_sha: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    note_id: Mapped[int] = mapped_column(ForeignKey("inf_typst_notes.id", ondelete="CASCADE"))
    is_active: Mapped[bool] = mapped_column(default=True)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
