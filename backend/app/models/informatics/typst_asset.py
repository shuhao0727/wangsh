from sqlalchemy import Column, DateTime, ForeignKey, Integer, LargeBinary, String, func

from app.db.database import Base


class TypstAsset(Base):
    __tablename__ = "inf_typst_assets"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, ForeignKey("inf_typst_notes.id"), nullable=False, index=True)
    path = Column(String(400), nullable=False)
    mime = Column(String(100), nullable=False, default="application/octet-stream")
    sha256 = Column(String(64), nullable=True)
    size_bytes = Column(Integer, nullable=True)
    content = Column(LargeBinary, nullable=False)
    uploaded_by_id = Column(Integer, ForeignKey("sys_users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
