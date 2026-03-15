"""
优化记录模型定义 - 对应数据库表 znt_optimize_logs
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, func, ForeignKey
from sqlalchemy.sql import expression
from sqlalchemy.orm import relationship
import uuid

from app.db.database import Base

class OptimizeLog(Base):
    """优化记录表"""
    __tablename__ = "znt_optimize_logs"
    __table_args__ = {'comment': '代码/流程图优化记录表'}
    __mapper_args__ = {"exclude_properties": ["updated_at"]}
    
    # 覆盖Base中的updated_at字段
    updated_at = None
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("sys_users.id"), nullable=True, index=True)
    project_id = Column(Integer, nullable=True, index=True) # 可以关联到实验ID
    
    # type: 'code' or 'flow'
    type = Column(String(20), nullable=False, index=True)
    
    # Content stored as text (JSON string for flow)
    original_content = Column(Text, nullable=True)
    optimized_content = Column(Text, nullable=True)
    
    # status: 'pending', 'applied', 'rejected'
    status = Column(String(20), default="pending", nullable=False)
    
    rollback_id = Column(String(36), default=lambda: str(uuid.uuid4()), index=True, unique=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    def __repr__(self):
        return f"<OptimizeLog(id={self.id}, type='{self.type}', status='{self.status}')>"
