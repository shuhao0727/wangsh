"""
学习进度模型 - 对应数据库表 sys_learning_progress

为 ML / AI / 智能体三个学习板块提供进度追踪。
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint, func

from app.db.database import Base


class LearningProgress(Base):
    """学习进度表 - 每个用户每模块一条记录"""
    __tablename__ = "sys_learning_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "module_key", name="uq_sys_learning_progress_user_module"),
        {"comment": "学习进度表"},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(
        Integer,
        ForeignKey("sys_users.id", ondelete="CASCADE"),
        nullable=False,
        comment="用户 ID",
    )
    module_key = Column(String(50), nullable=False, comment="模块标识: ml, ai, agents")
    current_stage = Column(String(100), nullable=True, comment="当前学习阶段")
    completed_stages = Column(Text, nullable=True, comment="已完成阶段列表 (JSON 数组)")
    progress_data = Column(Text, nullable=True, comment="前端学习进度数据 (JSON 对象)")
    notes = Column(Text, nullable=True, comment="学习笔记")
    created_at = Column(DateTime, server_default=func.now(), nullable=False, comment="创建时间")
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False, comment="更新时间"
    )

    def __repr__(self):
        return (
            f"<LearningProgress(id={self.id}, user_id={self.user_id}, "
            f"module_key='{self.module_key}', stage='{self.current_stage}')>"
        )
