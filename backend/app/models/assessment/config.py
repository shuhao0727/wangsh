"""
测评配置模型 - 对应数据库表 znt_assessment_configs
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, func
from sqlalchemy.sql import expression
from sqlalchemy.orm import relationship

from app.db.database import Base


class AssessmentConfig(Base):
    """测评配置表 - 教师创建的测评方案"""
    __tablename__ = "znt_assessment_configs"
    __table_args__ = {"comment": "测评配置表"}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(200), nullable=False, comment="测评标题")
    grade = Column(String(20), nullable=True, comment="年级")
    teaching_objectives = Column(Text, nullable=True, comment="教学目标（Markdown）")
    knowledge_points = Column(Text, nullable=True, comment="知识点列表 JSON 数组")
    total_score = Column(Integer, default=100, nullable=False, comment="总分")
    question_config = Column(Text, nullable=True, comment="题型配置 JSON")
    ai_prompt = Column(Text, nullable=True, comment="教师自定义出题提示词")
    agent_id = Column(Integer, ForeignKey("znt_agents.id", ondelete="SET NULL"), nullable=True, comment="出题/评分用智能体")
    time_limit_minutes = Column(Integer, default=0, nullable=False, comment="答题时限（分钟），0=不限时")
    available_start = Column(DateTime(timezone=True), nullable=True, comment="开放开始时间")
    available_end = Column(DateTime(timezone=True), nullable=True, comment="开放结束时间")
    enabled = Column(Boolean, default=False, server_default=expression.false(), nullable=False, comment="是否对学生开放")
    created_by_user_id = Column(Integer, ForeignKey("sys_users.id", ondelete="SET NULL"), nullable=True, comment="创建者")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False, comment="更新时间")

    agent = relationship("AIAgent", foreign_keys=[agent_id], lazy="select")
    creator = relationship("User", foreign_keys=[created_by_user_id], lazy="select")
    questions = relationship("AssessmentQuestion", back_populates="config", cascade="all, delete-orphan", lazy="select")
    config_agents = relationship("AssessmentConfigAgent", back_populates="config", cascade="all, delete-orphan", lazy="select")

    def __repr__(self):
        return f"<AssessmentConfig(id={self.id}, title='{self.title}', enabled={self.enabled})>"
