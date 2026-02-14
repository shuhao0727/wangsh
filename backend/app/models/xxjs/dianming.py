from sqlalchemy import Column, Integer, String, DateTime, func, UniqueConstraint
from app.db.database import Base

class XxjsDianming(Base):
    __tablename__ = "xxjs_dianming"
    __table_args__ = (
        UniqueConstraint("year", "class_name", "student_name", name="uq_xxjs_dianming_student"),
        {"comment": "信息技术-点名系统(学生名单)"}
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    year = Column(String(32), nullable=False, index=True, comment="年份/届别")
    class_name = Column(String(64), nullable=False, index=True, comment="班级名称")
    student_name = Column(String(64), nullable=False, comment="学生姓名")
    student_no = Column(String(64), nullable=True, index=True, comment="学号")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
