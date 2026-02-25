from sqlalchemy import Column, DateTime, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class MarkdownStyle(Base):
    __tablename__ = "wz_markdown_styles"

    key = Column(String(100), primary_key=True)
    title = Column(String(200), nullable=False, default="")
    content = Column(Text, nullable=False, default="")
    sort_order = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    articles = relationship("Article", back_populates="style", lazy="select")
