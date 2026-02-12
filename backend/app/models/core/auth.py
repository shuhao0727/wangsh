"""
认证相关模型定义 - 使用 sys_ 前缀
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from sqlalchemy.sql import expression
from app.db.database import Base


class RefreshToken(Base):
    """刷新令牌表 - sys_refresh_tokens"""
    __tablename__ = "sys_refresh_tokens"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, index=True, nullable=False, comment="用户ID")
    token = Column(String(500), unique=True, nullable=False, comment="刷新令牌")
    expires_at = Column(DateTime(timezone=True), nullable=False, comment="过期时间")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment="创建时间")
    is_revoked = Column(Boolean, default=False, server_default=expression.false(), comment="是否已撤销")
    
    def __repr__(self):
        return f"<RefreshToken(id={self.id}, user_id={self.user_id})>"