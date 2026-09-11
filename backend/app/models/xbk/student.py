"""
XBK 学生名单表
"""

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import validates
from sqlalchemy.sql import expression
from app.db.database import Base
from app.utils.academic_year import normalize_academic_year


class XbkStudent(Base):
    __tablename__ = "xbk_students"
    __table_args__ = (
        CheckConstraint(
            "length(year) = 9 AND substr(year, 5, 1) = '-' "
            "AND CAST(substr(year, 1, 4) AS INTEGER) BETWEEN 2000 AND 2099 "
            "AND CAST(substr(year, 6, 4) AS INTEGER) = CAST(substr(year, 1, 4) AS INTEGER) + 1",
            name="ck_xbk_students_academic_year",
        ),
        UniqueConstraint("year", "term", "student_no", name="uq_xbk_students_year_term_student_no"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    year = Column(String(9), nullable=False, index=True, comment="学年（如 2026-2027）")

    @validates("year")
    def _normalize_year(self, _key: str, value: object) -> str:
        return normalize_academic_year(value)
    term = Column(String(20), nullable=False, index=True, comment="学期（上学期/下学期）")
    grade = Column(String(20), nullable=True, index=True, comment="年级（高一/高二）")
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
