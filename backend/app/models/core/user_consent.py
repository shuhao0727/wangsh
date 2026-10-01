"""
用户同意记录模型 - GDPR 合规
记录用户对数据处理的同意情况
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Index
from sqlalchemy.sql import func
from app.db.database import Base


class UserConsent(Base):
    """用户同意记录表模型 - sys_user_consents"""
    __tablename__ = "sys_user_consents"
    __table_args__ = (
        Index("ix_sys_user_consents_user_id", "user_id"),
        Index("ix_sys_user_consents_consent_type", "consent_type"),
        Index("ix_sys_user_consents_user_consent", "user_id", "consent_type"),
        {"comment": "用户同意记录表（GDPR 合规）"},
    )

    # 主键
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # 用户信息
    user_id = Column(Integer, nullable=False, comment="用户 ID")

    # 同意信息
    consent_type = Column(String(50), nullable=False, comment="同意类型: AI_USAGE, DATA_ANALYSIS, MARKETING, etc.")
    consented = Column(Boolean, nullable=False, comment="是否同意")

    # 同意时间和来源
    consented_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment="同意/拒绝时间")
    ip_address = Column(String(45), nullable=True, comment="IP 地址")

    # 更新时间（用于记录同意状态变更）
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False, comment="更新时间")

    def __repr__(self):
        return f"<UserConsent(id={self.id}, user_id={self.user_id}, type='{self.consent_type}', consented={self.consented})>"
