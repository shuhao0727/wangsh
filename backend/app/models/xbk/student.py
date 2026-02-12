"""
XBK 学生名单表
"""

from sqlalchemy import Column, Integer, String, DateTime, func, UniqueConstraint, Boolean
from sqlalchemy.sql import expression
from app.db.database import Base


class XbkStudent(Base):
    __tablename__ = "xbk_students"
    __table_args__ = (
        UniqueConstraint("year", "term", "student_no", name="uq_xbk_students_year_term_student_no"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    year = Column(Integer, nullable=False, index=True, comment="年份（如 2026）")
    term = Column(String(20), nullable=False, index=True, comment="学期（上学期/下学期）")
    class_name = Column(String(50), nullable=False, index=True, comment="班级")
    student_no = Column(String(50), nullable=False, index=True, comment="学号")
    name = Column(String(50), nullable=False, comment="姓名")
    gender = Column(String(10), nullable=True, comment="性别")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False, comment="更新时间")
    is_deleted = Column(
        Boolean,
        default=False,
        server_default=expression.false(),
        nullable=False,
        comment="是否已删除（软删除）",
    )
