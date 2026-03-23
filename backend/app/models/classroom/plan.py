"""课堂计划模型"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.database import Base


class ClassroomPlan(Base):
    __tablename__ = "znt_classroom_plans"
    __table_args__ = {"comment": "课堂计划表"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False, comment="计划标题")
    status = Column(String(20), nullable=False, default="draft", comment="状态: draft/active/ended")
    current_item_id = Column(Integer, nullable=True, comment="当前进行中的 plan_item id")
    created_by = Column(Integer, ForeignKey("sys_users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    items = relationship("ClassroomPlanItem", back_populates="plan", order_by="ClassroomPlanItem.order_index", cascade="all, delete-orphan", lazy="select")
    creator = relationship("User", lazy="select")


class ClassroomPlanItem(Base):
    __tablename__ = "znt_classroom_plan_items"
    __table_args__ = {"comment": "课堂计划题目列表"}

    id = Column(Integer, primary_key=True, autoincrement=True)
    plan_id = Column(Integer, ForeignKey("znt_classroom_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_id = Column(Integer, ForeignKey("znt_classroom_activities.id", ondelete="CASCADE"), nullable=False)
    order_index = Column(Integer, nullable=False, default=0, comment="排列顺序")
    status = Column(String(20), nullable=False, default="pending", comment="状态: pending/active/ended")

    plan = relationship("ClassroomPlan", back_populates="items")
    activity = relationship("ClassroomActivity", lazy="select")
