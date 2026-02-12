"""
系统功能开关模型
用于控制前台功能的可见性/可用性
"""

from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from app.db.database import Base


class FeatureFlag(Base):
    """系统功能开关表 - sys_feature_flags"""

    __tablename__ = "sys_feature_flags"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    key = Column(String(100), unique=True, index=True, nullable=False, comment="开关键")
    value = Column(JSONB, nullable=False, comment="开关值（JSON）")
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="更新时间",
    )
