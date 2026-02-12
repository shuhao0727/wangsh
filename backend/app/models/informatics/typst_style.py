from sqlalchemy import Column, DateTime, Integer, String, Text, func

from app.db.database import Base


class TypstStyle(Base):
    __tablename__ = "inf_typst_styles"

    key = Column(String(100), primary_key=True)
    title = Column(String(200), nullable=False, default="")
    content = Column(Text, nullable=False, default="")
    sort_order = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

