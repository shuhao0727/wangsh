from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.db.database import Base


class InformaticsGithubSyncRun(Base):
    __tablename__ = "inf_github_sync_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trigger_type = Column(String(20), nullable=False, default="manual")
    status = Column(String(20), nullable=False, default="running")
    repo_owner = Column(String(100), nullable=False, default="")
    repo_name = Column(String(200), nullable=False, default="")
    branch = Column(String(100), nullable=False, default="main")
    created_count = Column(Integer, nullable=False, default=0)
    updated_count = Column(Integer, nullable=False, default=0)
    deleted_count = Column(Integer, nullable=False, default=0)
    skipped_count = Column(Integer, nullable=False, default=0)
    error_summary = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    finished_at = Column(DateTime(timezone=True), nullable=True)
