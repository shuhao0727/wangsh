"""
AI智能体模型定义 - 对应数据库表 znt_agents
与数据库设计文档v3.0保持一致
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, func, ForeignKey, JSON
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

    # System Prompt（智能体人设/角色设定）
    system_prompt = Column(Text, nullable=True, comment="系统提示词（智能体人设/角色设定）")
    
    # API配置
    api_endpoint = Column(String(500), comment="API端点URL")
    api_key = Column(String(200), nullable=True, comment="API密钥")
    api_key_encrypted = Column(Text, nullable=True, comment="API密钥（加密存储）")
    api_key_last4 = Column(String(8), nullable=True, comment="API密钥末尾4位")
    has_api_key = Column(Boolean, default=False, server_default=expression.false(), comment="是否已配置API密钥")
    
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
    user_id = Column(Integer, ForeignKey("sys_users.id", ondelete="SET NULL"), nullable=True, index=True)
    user_name = Column(String(100), nullable=True)
    agent_id = Column(Integer, ForeignKey("znt_agents.id", ondelete="SET NULL"), nullable=True, index=True)
    agent_name = Column(String(200), nullable=True)
    session_id = Column(String(100), nullable=True, index=True)
    message_type = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    response_time_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    agent = relationship("AIAgent")


class TaskAnalysis(Base):
    """任务分析记录表 — 保存教师的任务分析结果"""
    __tablename__ = "task_analyses"
    __table_args__ = {"comment": "任务分析记录表"}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(200), nullable=False, default="未命名分析")
    task_sheet = Column(Text, nullable=False)
    agent_id = Column(Integer, ForeignKey("znt_agents.id", ondelete="SET NULL"), nullable=True)
    class_name = Column(String(100), nullable=True)
    start_at = Column(DateTime(timezone=True), nullable=True)
    end_at = Column(DateTime(timezone=True), nullable=True)
    result = Column(JSON, nullable=False, default=dict)
    created_by = Column(Integer, ForeignKey("sys_users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class HotQuestionAnalysis(Base):
    """热点问题分析记录表 — 全班生发性问题发现"""
    __tablename__ = "hot_question_analyses"
    __table_args__ = {"comment": "热点问题分析记录表"}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(200), nullable=False, default="未命名分析")
    task_sheet = Column(Text, nullable=False)
    agent_id = Column(Integer, ForeignKey("znt_agents.id", ondelete="SET NULL"), nullable=True)
    analysis_agent_id = Column(Integer, ForeignKey("znt_agents.id", ondelete="SET NULL"), nullable=True)
    class_name = Column(String(100), nullable=True)
    start_at = Column(DateTime(timezone=True), nullable=True)
    end_at = Column(DateTime(timezone=True), nullable=True)
    bucket_seconds = Column(Integer, nullable=False, default=180)
    teacher_marks = Column(JSON, nullable=False, default=list)
    custom_prompt = Column(Text, nullable=True)
    result = Column(JSON, nullable=False, default=dict)
    created_by = Column(Integer, ForeignKey("sys_users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class StudentChainAnalysis(Base):
    """学生问题链分析记录表 — 个体思维链条追踪"""
    __tablename__ = "student_chain_analyses"
    __table_args__ = {"comment": "学生问题链分析记录表"}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(200), nullable=False, default="未命名分析")
    agent_id = Column(Integer, ForeignKey("znt_agents.id", ondelete="SET NULL"), nullable=True)
    analysis_agent_id = Column(Integer, ForeignKey("znt_agents.id", ondelete="SET NULL"), nullable=True)
    class_name = Column(String(100), nullable=True)
    start_at = Column(DateTime(timezone=True), nullable=True)
    end_at = Column(DateTime(timezone=True), nullable=True)
    task_sheet = Column(Text, nullable=True)
    result = Column(JSON, nullable=False, default=dict)
    created_by = Column(Integer, ForeignKey("sys_users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AgentAnalysisPromptTemplate(Base):
    """AgentData 分析提示词模板 — 按分析类型管理"""
    __tablename__ = "agent_analysis_prompt_templates"
    __table_args__ = {"comment": "AgentData 分析提示词模板表"}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    analysis_type = Column(String(40), nullable=False, index=True, comment="hot_questions/student_chains")
    name = Column(String(120), nullable=False, comment="模板名称")
    content = Column(Text, nullable=False, comment="提示词内容")
    is_default = Column(Boolean, nullable=False, default=False, server_default=expression.false())
    is_active = Column(Boolean, nullable=False, default=True, server_default=expression.true())
    sort_order = Column(Integer, nullable=False, default=100, server_default="100")
    created_by = Column(Integer, ForeignKey("sys_users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
