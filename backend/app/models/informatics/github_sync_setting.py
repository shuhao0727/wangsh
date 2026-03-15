from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.db.database import Base


class InformaticsGithubSyncSetting(Base):
    __tablename__ = "inf_github_sync_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    repo_url = Column(String(500), nullable=False, default="")
    repo_owner = Column(String(100), nullable=False, default="")
    repo_name = Column(String(200), nullable=False, default="")
    branch = Column(String(100), nullable=False, default="main")
    token_encrypted = Column(Text, nullable=True)
    enabled = Column(Boolean, nullable=False, default=False)
    interval_hours = Column(Integer, nullable=False, default=48)
    delete_mode = Column(String(20), nullable=False, default="unpublish")
    last_test_status = Column(String(20), nullable=True)
    last_test_message = Column(String(500), nullable=True)
    last_test_at = Column(DateTime(timezone=True), nullable=True)
    updated_by_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
