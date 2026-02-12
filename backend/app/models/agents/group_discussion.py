from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

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

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_date = Column(Date, nullable=False, index=True, comment="会话日期（用于每日分组）")
    class_name = Column(String(64), nullable=False, index=True, comment="班级（用于分组隔离）")
    group_no = Column(String(16), nullable=False, index=True, comment="组号（学生输入）")
    group_name = Column(String(64), nullable=True, index=True, comment="组名（由创建者设置）")

    created_by_user_id = Column(Integer, ForeignKey("sys_users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    last_message_at = Column(DateTime(timezone=True), nullable=True, index=True)
    message_count = Column(Integer, nullable=False, server_default="0")

    created_by_user = relationship("User", lazy="select")


class GroupDiscussionMessage(Base):
    __tablename__ = "znt_group_discussion_messages"
    __table_args__ = {"comment": "小组讨论消息表"}

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("znt_group_discussion_sessions.id"), nullable=False, index=True)

    user_id = Column(Integer, ForeignKey("sys_users.id"), nullable=False, index=True)
    user_display_name = Column(String(100), nullable=False, comment="展示名快照（便于历史回放）")

    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    session = relationship("GroupDiscussionSession", lazy="select")
    user = relationship("User", lazy="select")


class GroupDiscussionAnalysis(Base):
    __tablename__ = "znt_group_discussion_analyses"
    __table_args__ = {"comment": "小组讨论分析结果（管理员发起，可使用智能体API）"}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("znt_group_discussion_sessions.id"), nullable=False, index=True)
    agent_id = Column(Integer, ForeignKey("znt_agents.id"), nullable=False, index=True)
    created_by_admin_user_id = Column(Integer, ForeignKey("sys_users.id"), nullable=False, index=True)

    analysis_type = Column(String(32), nullable=False, comment="分析类型，如 summary/topics/risk")
    prompt = Column(Text, nullable=False)

    result_text = Column(Text, nullable=False)
    compare_session_ids = Column(Text, nullable=True, comment="可选：横向对比的会话ID列表（JSON）")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    session = relationship("GroupDiscussionSession", lazy="select")
    agent = relationship("AIAgent", lazy="select")
    created_by_admin_user = relationship("User", lazy="select")
