"""
审计日志模型 - GDPR 合规
记录关键用户操作（数据导出、删除等）
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, Index
from sqlalchemy.sql import func
from app.db.database import Base


class AuditLog(Base):
    """审计日志表模型 - sys_audit_logs"""
    __tablename__ = "sys_audit_logs"
    __table_args__ = (
        Index("ix_sys_audit_logs_user_id", "user_id"),
        Index("ix_sys_audit_logs_action", "action"),
        Index("ix_sys_audit_logs_created_at", "created_at"),
        {"comment": "审计日志表（GDPR 合规）"},
    )

    # 主键
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # 用户信息
    user_id = Column(Integer, nullable=False, comment="用户 ID")

    # 操作信息
    action = Column(String(50), nullable=False, comment="操作类型: EXPORT_DATA, DELETE_DATA, VIEW_CONVERSATION, etc.")
    resource_type = Column(String(50), nullable=True, comment="资源类型: conversation, analysis, user, etc.")
    resource_id = Column(String(100), nullable=True, comment="资源 ID")

    # 请求信息
    ip_address = Column(String(45), nullable=True, comment="IP 地址（支持 IPv4 和 IPv6）")
    user_agent = Column(Text, nullable=True, comment="用户代理字符串")

    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment="创建时间")

    def __repr__(self):
        return f"<AuditLog(id={self.id}, user_id={self.user_id}, action='{self.action}', created_at={self.created_at})>"
