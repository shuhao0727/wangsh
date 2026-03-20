"""
测评会话模型 - 对应数据库表 znt_assessment_sessions
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class AssessmentSession(Base):
    """测评会话表 - 学生每次参加测评的记录"""
    __tablename__ = "znt_assessment_sessions"
    __table_args__ = {"comment": "测评会话表"}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    config_id = Column(Integer, ForeignKey("znt_assessment_configs.id", ondelete="CASCADE"), nullable=False, index=True, comment="所属测评配置")
    user_id = Column(Integer, ForeignKey("sys_users.id", ondelete="CASCADE"), nullable=False, index=True, comment="学生")
    status = Column(String(20), nullable=False, default="pending", comment="状态: pending/in_progress/submitted/graded")
    started_at = Column(DateTime(timezone=True), nullable=True, comment="开始答题时间")
    submitted_at = Column(DateTime(timezone=True), nullable=True, comment="提交时间")
    total_score = Column(Integer, nullable=False, comment="满分")
    earned_score = Column(Integer, nullable=True, comment="实际得分")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment="创建时间")

    config = relationship("AssessmentConfig", lazy="select")
    user = relationship("User", lazy="select")
    answers = relationship("AssessmentAnswer", back_populates="session", cascade="all, delete-orphan", lazy="select")
    basic_profile = relationship("AssessmentBasicProfile", back_populates="session", uselist=False, cascade="all, delete-orphan", lazy="select")

    def __repr__(self):
        return f"<AssessmentSession(id={self.id}, user_id={self.user_id}, status='{self.status}')>"
