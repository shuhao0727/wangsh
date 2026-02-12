from sqlalchemy import Column, DateTime, Integer, String, func

from app.db.database import Base


class TypstCategory(Base):
    __tablename__ = "inf_typst_categories"

    id = Column(Integer, primary_key=True, index=True)
    path = Column(String(200), nullable=False, unique=True, index=True, default="")
    sort_order = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

