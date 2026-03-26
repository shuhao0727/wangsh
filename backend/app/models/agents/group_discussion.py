from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class GroupDiscussionSession(Base):
    __tablename__ = "znt_group_discussion_sessions"
    __table_args__ = (
        UniqueConstraint(
            "session_date",
            "class_name",
            "group_no",
            name="uq_znt_group_discussion_sessions_date_class_group",
        ),
        {"comment": "小组讨论会话（按日期+班级+组号分组）"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    session_date: Mapped[date] = mapped_column(Date, nullable=False, index=True, comment="会话日期（用于每日分组）")
    class_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True, comment="班级（用于分组隔离）")
    group_no: Mapped[str] = mapped_column(String(16), nullable=False, index=True, comment="组号（学生输入）")
    group_name: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True, comment="组名（由创建者设置）")

    created_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("sys_users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    last_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    message_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    created_by_user = relationship("User", lazy="select")


class GroupDiscussionMember(Base):
    __tablename__ = "znt_group_discussion_members"
    __table_args__ = (
        UniqueConstraint("session_id", "user_id", name="uq_group_session_user"),
        {"comment": "小组讨论成员表"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("znt_group_discussion_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("sys_users.id", ondelete="CASCADE"), nullable=False, index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    muted_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, comment="禁言截止时间")

    session = relationship("GroupDiscussionSession", backref="members")
    user = relationship("User", backref="joined_groups")


class GroupDiscussionMessage(Base):
    __tablename__ = "znt_group_discussion_messages"
    __table_args__ = {"comment": "小组讨论消息表"}

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("znt_group_discussion_sessions.id", ondelete="CASCADE"), nullable=False, index=True)

    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("sys_users.id", ondelete="CASCADE"), nullable=False, index=True)
    user_display_name: Mapped[str] = mapped_column(String(100), nullable=False, comment="展示名快照（便于历史回放）")

    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    session = relationship("GroupDiscussionSession", lazy="select")
    user = relationship("User", lazy="select")


class GroupDiscussionAnalysis(Base):
    __tablename__ = "znt_group_discussion_analyses"
    __table_args__ = {"comment": "小组讨论分析结果（管理员发起，可使用智能体API）"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("znt_group_discussion_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_id: Mapped[int] = mapped_column(Integer, ForeignKey("znt_agents.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by_admin_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("sys_users.id", ondelete="CASCADE"), nullable=False, index=True)

    analysis_type: Mapped[str] = mapped_column(String(32), nullable=False, comment="分析类型，如 summary/topics/risk")
    prompt: Mapped[str] = mapped_column(Text, nullable=False)

    result_text: Mapped[str] = mapped_column(Text, nullable=False)
    compare_session_ids: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="可选：横向对比的会话ID列表（JSON）")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    session = relationship("GroupDiscussionSession", lazy="select")
    agent = relationship("AIAgent", lazy="select")
    created_by_admin_user = relationship("User", lazy="select")
