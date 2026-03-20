"""
初级画像模型 - 对应数据库表 znt_assessment_basic_profiles
学生提交测评后自动生成，仅基于本次测评数据
"""

from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, func, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.database import Base


class AssessmentBasicProfile(Base):
    """初级画像表 - 自动生成的测评画像"""
    __tablename__ = "znt_assessment_basic_profiles"
    __table_args__ = (
        UniqueConstraint("session_id", name="uq_znt_assessment_basic_profiles_session"),
        {"comment": "初级画像表（测评后自动生成）"},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("znt_assessment_sessions.id", ondelete="CASCADE"), nullable=False, unique=True, comment="关联的测评会话")
    user_id = Column(Integer, ForeignKey("sys_users.id", ondelete="CASCADE"), nullable=False, index=True, comment="学生")
    config_id = Column(Integer, ForeignKey("znt_assessment_configs.id", ondelete="CASCADE"), nullable=False, index=True, comment="关联的测评配置")
    earned_score = Column(Integer, nullable=False, comment="实际得分")
    total_score = Column(Integer, nullable=False, comment="满分")
    knowledge_scores = Column(Text, nullable=True, comment="各知识点得分 JSON")
    wrong_points = Column(Text, nullable=True, comment="错题知识点 JSON 数组")
    ai_summary = Column(Text, nullable=True, comment="AI 简短评语（Markdown）")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment="创建时间")

    session = relationship("AssessmentSession", back_populates="basic_profile", lazy="select")
    user = relationship("User", lazy="select")

    def __repr__(self):
        return f"<AssessmentBasicProfile(id={self.id}, session_id={self.session_id}, score={self.earned_score}/{self.total_score})>"
