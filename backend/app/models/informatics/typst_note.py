from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, LargeBinary, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB

from app.db.database import Base


class TypstNote(Base):
    __tablename__ = "inf_typst_notes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    summary = Column(String(500), nullable=False, default="")
    category_path = Column(String(200), nullable=False, default="")
    published = Column(Boolean, default=False, nullable=False, index=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    style_key = Column(String(100), nullable=False, default="my_style")
    entry_path = Column(String(200), nullable=False, default="main.typ")
    files = Column(JSONB, nullable=False, default=dict)
    toc = Column(JSONB, nullable=False, default=list)
    content_typst = Column(Text, nullable=False, default="")

    created_by_id = Column(Integer, ForeignKey("sys_users.id"), nullable=True, index=True)

    compiled_hash = Column(String(64), nullable=True)
    compiled_pdf = Column(LargeBinary, nullable=True)
    compiled_pdf_path = Column(String(500), nullable=True)
    compiled_pdf_size = Column(Integer, nullable=True)
    compiled_at = Column(DateTime(timezone=True), nullable=True)

    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
