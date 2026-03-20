"""课堂互动学生响应模型 - znt_classroom_responses"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship
from app.db.database import Base


class ClassroomResponse(Base):
    __tablename__ = "znt_classroom_responses"
    __table_args__ = (
        UniqueConstraint("activity_id", "user_id", name="uq_classroom_response_activity_user"),
        {"comment": "课堂互动学生响应表"},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    activity_id = Column(Integer, ForeignKey("znt_classroom_activities.id", ondelete="CASCADE"), nullable=False, index=True, comment="活动ID")
    user_id = Column(Integer, ForeignKey("sys_users.id", ondelete="CASCADE"), nullable=False, index=True, comment="学生ID")
    answer = Column(String(500), nullable=False, comment="学生答案")
    is_correct = Column(Boolean, nullable=True, comment="是否正确")
    submitted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment="提交时间")

    activity = relationship("ClassroomActivity", back_populates="responses", lazy="select")
    user = relationship("User", lazy="select")
