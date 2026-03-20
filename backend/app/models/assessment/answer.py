"""
答题记录模型 - 对应数据库表 znt_assessment_answers
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class AssessmentAnswer(Base):
    """答题记录表 - 每道题的作答详情"""
    __tablename__ = "znt_assessment_answers"
    __table_args__ = {"comment": "答题记录表"}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("znt_assessment_sessions.id", ondelete="CASCADE"), nullable=False, index=True, comment="所属会话")
    question_id = Column(Integer, ForeignKey("znt_assessment_questions.id", ondelete="SET NULL"), nullable=True, comment="题目ID（预生成模式）")
    question_snapshot = Column(Text, nullable=True, comment="题目完整快照 JSON（实时生成模式）")
    question_type = Column(String(20), nullable=False, comment="题型（冗余存储）")
    student_answer = Column(Text, nullable=True, comment="学生提交的答案")
    is_correct = Column(Boolean, nullable=True, comment="是否正确")
    ai_score = Column(Integer, nullable=True, comment="AI 评分（填空/简答题）")
    ai_feedback = Column(Text, nullable=True, comment="AI 评语")
    max_score = Column(Integer, nullable=False, comment="该题满分")
    knowledge_point = Column(String(200), nullable=True, comment="知识点（冗余存储）")
    attempt_seq = Column(Integer, default=1, comment="同知识点第几次尝试")
    is_adaptive = Column(Boolean, default=False, comment="是否为AI追加的自适应题")
    answered_at = Column(DateTime(timezone=True), nullable=True, comment="作答时间")

    session = relationship("AssessmentSession", back_populates="answers", lazy="select")
    question = relationship("AssessmentQuestion", lazy="select")

    def __repr__(self):
        return f"<AssessmentAnswer(id={self.id}, session_id={self.session_id}, correct={self.is_correct})>"
