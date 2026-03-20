"""
高级画像模型 - 对应数据库表 znt_student_profiles
教师触发生成，融合测评+讨论+智能体三方数据
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class StudentProfile(Base):
    """高级画像表 - 三维融合画像"""
    __tablename__ = "znt_student_profiles"
    __table_args__ = {"comment": "高级画像表（三维融合分析）"}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    profile_type = Column(String(20), nullable=False, index=True, comment="画像类型: individual/group/class")
    target_id = Column(String(100), nullable=False, index=True, comment="目标标识: user_id/session_id/class_name")
    config_id = Column(Integer, ForeignKey("znt_assessment_configs.id", ondelete="SET NULL"), nullable=True, comment="关联的测评配置")
    discussion_session_id = Column(Integer, ForeignKey("znt_group_discussion_sessions.id", ondelete="SET NULL"), nullable=True, comment="关联的小组讨论会话")
    agent_ids = Column(Text, nullable=True, comment="关联的智能体 ID 列表 JSON")
    agent_id = Column(Integer, ForeignKey("znt_agents.id", ondelete="SET NULL"), nullable=True, comment="生成画像使用的智能体")
    data_sources = Column(Text, nullable=True, comment="使用的数据源 JSON")
    result_text = Column(Text, nullable=True, comment="画像内容（Markdown）")
    scores = Column(Text, nullable=True, comment="结构化评分 JSON")
    created_by_user_id = Column(Integer, ForeignKey("sys_users.id", ondelete="SET NULL"), nullable=True, comment="创建者（教师）")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment="创建时间")

    config = relationship("AssessmentConfig", lazy="select")
    agent = relationship("AIAgent", lazy="select")
    creator = relationship("User", lazy="select")

    def __repr__(self):
        return f"<StudentProfile(id={self.id}, type='{self.profile_type}', target='{self.target_id}')>"
