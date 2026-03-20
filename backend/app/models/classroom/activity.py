"""课堂互动活动模型 - znt_classroom_activities"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON, Text, func
from sqlalchemy.orm import relationship
from app.db.database import Base


class ClassroomActivity(Base):
    __tablename__ = "znt_classroom_activities"
    __table_args__ = {"comment": "课堂互动活动表"}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    activity_type = Column(String(20), nullable=False, comment="活动类型: vote/fill_blank")
    title = Column(String(200), nullable=False, comment="活动标题")
    options = Column(JSON, nullable=True, comment='投票选项 [{"key":"A","text":"..."},...]')
    correct_answer = Column(String(500), nullable=True, comment="正确答案")
    allow_multiple = Column(Boolean, nullable=False, default=False, comment="是否多选投票")
    time_limit = Column(Integer, nullable=False, default=60, comment="时间限制(秒), 0=无限制")
    status = Column(String(20), nullable=False, default="draft", comment="状态: draft/active/ended")
    started_at = Column(DateTime(timezone=True), nullable=True, comment="开始时间")
    ended_at = Column(DateTime(timezone=True), nullable=True, comment="结束时间")
    analysis_agent_id = Column(Integer, ForeignKey("znt_agents.id", ondelete="SET NULL"), nullable=True, comment="分析智能体快照ID")
    analysis_prompt = Column(Text, nullable=True, comment="分析提示词快照")
    analysis_status = Column(String(20), nullable=True, comment="分析状态: pending/running/success/failed/skipped/not_applicable")
    analysis_result = Column(Text, nullable=True, comment="分析文本结果")
    analysis_context = Column(JSON, nullable=True, comment="结构化分析上下文")
    analysis_error = Column(Text, nullable=True, comment="分析失败错误信息")
    analysis_updated_at = Column(DateTime(timezone=True), nullable=True, comment="分析更新时间")
    created_by = Column(Integer, ForeignKey("sys_users.id", ondelete="CASCADE"), nullable=False, index=True, comment="创建者")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False, comment="更新时间")

    creator = relationship("User", lazy="select")
    responses = relationship("ClassroomResponse", back_populates="activity", cascade="all, delete-orphan", lazy="select")
