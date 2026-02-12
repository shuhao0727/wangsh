"""
AI智能体模型定义 - 对应数据库表 znt_agents
与数据库设计文档v3.0保持一致
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, func, ForeignKey
from sqlalchemy.sql import expression
from sqlalchemy.orm import relationship

from app.db.database import Base


class AIAgent(Base):
    """AI智能体表模型 - znt_agents（v3.0增强版）"""
    __tablename__ = "znt_agents"
    __table_args__ = {'comment': 'AI智能体配置表'}
    __mapper_args__ = {"exclude_properties": ["updated_at"]}
    
    # 覆盖Base中的updated_at字段，防止SQLAlchemy自动更新
    updated_at = None
    
    # 主键
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # 基本信息
    name = Column(String(200), nullable=False, comment="智能体名称")# 智能体类型
    description = Column(Text, nullable=True, comment="智能体描述")
    agent_type = Column(String(20), nullable=False, index=True, comment="智能体类型: general/dify/custom/openai/azure/anthropic")
    
    # 模型名称
    model_name = Column(String(100), comment="模型名称，如：deepseek-chat, gpt-4, 深度思考等")
    
    # API配置
    api_endpoint = Column(String(500), comment="API端点URL")
    api_key = Column(String(200), nullable=True, comment="API密钥")
    
    # 状态
    is_active = Column(Boolean, default=True, server_default=expression.true(), comment="是否启用")
    is_deleted = Column(Boolean, default=False, server_default=expression.false(), comment="是否已删除（软删除）")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment="创建时间")
    deleted_at = Column(DateTime(timezone=True), nullable=True, comment="删除时间（软删除）")
    
    def __repr__(self):
        return f"<AIAgent(id={self.id}, name='{self.name}', type='{self.agent_type}', active={self.is_active})>"


class ZntConversation(Base):
    __tablename__ = "znt_conversations"
    __table_args__ = {"comment": "对话记录表"}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("sys_users.id"), nullable=True, index=True)
    user_name = Column(String(100), nullable=True)
    agent_id = Column(Integer, ForeignKey("znt_agents.id"), nullable=True, index=True)
    agent_name = Column(String(200), nullable=True)
    session_id = Column(String(100), nullable=True, index=True)
    message_type = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    response_time_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    agent = relationship("AIAgent")
