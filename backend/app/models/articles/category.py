"""
分类模型定义 - 使用 wz_ 前缀
"""

from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


class Category(Base):
    """分类表模型 - wz_categories"""
    __tablename__ = "wz_categories"

    # 主键
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # 分类信息
    name = Column(String(100), unique=True, nullable=False, comment="分类名")
    description = Column(Text, nullable=True, comment="分类描述 (可选)")
    slug = Column(String(100), unique=True, index=True, nullable=False, comment="URL友好的别名")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False, comment="更新时间")
    
    # 关系定义
    articles = relationship("Article", back_populates="category", lazy="select")
    
    def __repr__(self):
        return f"<Category(id={self.id}, name='{self.name}', slug='{self.slug}')>"