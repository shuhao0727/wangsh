"""课堂互动学生响应模型 - znt_classroom_responses"""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class ClassroomResponse(Base):
    __tablename__ = "znt_classroom_responses"
    __table_args__ = (
        UniqueConstraint("activity_id", "user_id", name="uq_classroom_response_activity_user"),
        {"comment": "课堂互动学生响应表"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    activity_id: Mapped[int] = mapped_column(Integer, ForeignKey("znt_classroom_activities.id", ondelete="CASCADE"), nullable=False, index=True, comment="活动ID")
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("sys_users.id", ondelete="CASCADE"), nullable=False, index=True, comment="学生ID")
    answer: Mapped[str] = mapped_column(String(500), nullable=False, comment="学生答案")
    is_correct: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, comment="是否正确")
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment="提交时间")

    activity = relationship("ClassroomActivity", back_populates="responses", lazy="select")
    user = relationship("User", lazy="select")
