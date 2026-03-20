"""
测评题目模型 - 对应数据库表 znt_assessment_questions
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class AssessmentQuestion(Base):
    """题库表 - 预生成或实时生成的题目"""
    __tablename__ = "znt_assessment_questions"
    __table_args__ = {"comment": "测评题库表"}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    config_id = Column(Integer, ForeignKey("znt_assessment_configs.id", ondelete="CASCADE"), nullable=False, index=True, comment="所属测评配置")
    question_type = Column(String(20), nullable=False, comment="题型: choice/fill/short_answer")
    content = Column(Text, nullable=False, comment="题目内容（Markdown）")
    options = Column(Text, nullable=True, comment="选项 JSON（仅选择题）")
    correct_answer = Column(Text, nullable=False, comment="正确答案")
    score = Column(Integer, nullable=False, comment="分值")
    difficulty = Column(String(10), nullable=False, default="medium", comment="难度: easy/medium/hard")
    knowledge_point = Column(String(200), nullable=True, comment="对应知识点")
    explanation = Column(Text, nullable=True, comment="答案解析")
    source = Column(String(20), nullable=False, default="ai_generated", comment="来源: ai_generated/manual/ai_realtime")
    mode = Column(String(20), nullable=False, default="fixed", comment="模式: fixed(固定题)/adaptive(知识点自适应)")
    adaptive_config = Column(Text, nullable=True, comment="自适应配置 JSON: {mastery_streak, max_attempts, prompt_hint}")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment="创建时间")

    config = relationship("AssessmentConfig", back_populates="questions", lazy="select")

    def __repr__(self):
        return f"<AssessmentQuestion(id={self.id}, type='{self.question_type}', score={self.score})>"
