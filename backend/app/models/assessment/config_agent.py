"""
测评-智能体关联模型 - 对应数据库表 znt_assessment_config_agents
"""

from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.database import Base


class AssessmentConfigAgent(Base):
    """测评-智能体关联表"""
    __tablename__ = "znt_assessment_config_agents"
    __table_args__ = (
        UniqueConstraint("config_id", "agent_id", name="uq_znt_assessment_config_agent"),
        {"comment": "测评-智能体关联表"},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    config_id = Column(Integer, ForeignKey("znt_assessment_configs.id", ondelete="CASCADE"), nullable=False, index=True, comment="测评配置")
    agent_id = Column(Integer, ForeignKey("znt_agents.id", ondelete="CASCADE"), nullable=False, index=True, comment="课堂智能体")

    config = relationship("AssessmentConfig", back_populates="config_agents", lazy="select")
    agent = relationship("AIAgent", lazy="select")

    def __repr__(self):
        return f"<AssessmentConfigAgent(config_id={self.config_id}, agent_id={self.agent_id})>"
