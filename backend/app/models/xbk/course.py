"""
XBK 选课目录表
"""

from sqlalchemy import Column, Integer, String, DateTime, func, UniqueConstraint, Boolean
from sqlalchemy.sql import expression
from app.db.database import Base


class XbkCourse(Base):
    __tablename__ = "xbk_courses"
    __table_args__ = (
        UniqueConstraint("year", "term", "course_code", name="uq_xbk_courses_year_term_course_code"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    year = Column(Integer, nullable=False, index=True, comment="年份（如 2026）")
    term = Column(String(20), nullable=False, index=True, comment="学期（上学期/下学期）")
    course_code = Column(String(50), nullable=False, index=True, comment="课程代码（如 12）")
    course_name = Column(String(200), nullable=False, comment="课程名称")
    teacher = Column(String(100), nullable=True, comment="课程负责人")
    quota = Column(Integer, nullable=False, server_default=expression.text("0"), comment="限报人数")
    location = Column(String(200), nullable=True, comment="上课地点")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False, comment="更新时间")
    is_deleted = Column(Boolean, default=False, server_default=expression.false(), nullable=False, comment="是否已删除（软删除）")
