from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from app.db.database import Base


class InformaticsGithubSyncSource(Base):
    __tablename__ = "inf_github_sync_sources"
    __table_args__ = (
        UniqueConstraint("repo_owner", "repo_name", "branch", "source_path", name="uq_inf_sync_source_repo_path"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    repo_owner = Column(String(100), nullable=False)
    repo_name = Column(String(200), nullable=False)
    branch = Column(String(100), nullable=False, default="main")
    source_path = Column(String(500), nullable=False)
    source_sha = Column(String(80), nullable=True)
    note_id = Column(Integer, ForeignKey("inf_typst_notes.id", ondelete="CASCADE"), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
