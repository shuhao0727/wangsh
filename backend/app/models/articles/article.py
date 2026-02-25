"""
文章模型定义 - 使用 wz_ 前缀
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func, expression
from app.db.database import Base


class Article(Base):
    """文章表模型 - wz_articles"""
    __tablename__ = "wz_articles"

    # 主键
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # 文章基本信息
    title = Column(String(255), nullable=False, comment="文章标题")
    slug = Column(String(255), unique=True, index=True, nullable=False, comment="URL友好的别名")
    content = Column(Text, nullable=False, comment="文章正文内容 (Markdown格式)")
    summary = Column(Text, nullable=True, comment="文章摘要 (可选)")
    custom_css = Column(Text, nullable=True, comment="文章自定义CSS (可选)")
    style_key = Column(String(100), ForeignKey("wz_markdown_styles.key"), nullable=True, comment="Markdown样式方案Key (可选)")
    
    # 外键关联 - 注意：用户表已改为 sys_users
    author_id = Column(Integer, ForeignKey("sys_users.id"), nullable=False, comment="作者ID")
    category_id = Column(Integer, ForeignKey("wz_categories.id"), nullable=True, comment="分类ID (可选)")
    
    # 状态字段
    published = Column(Boolean, default=False, server_default=expression.false(), comment="是否发布")
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, comment="创建时间")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False, comment="更新时间")
    
    # 关系定义
    author = relationship("User", back_populates="articles", lazy="select")
    category = relationship("Category", back_populates="articles", lazy="select")
    style = relationship("MarkdownStyle", back_populates="articles", lazy="select")
    # 标签功能已移除，删除了tags关系
    
    def __repr__(self):
        return f"<Article(id={self.id}, title='{self.title}', slug='{self.slug}')>"


# 标签功能已移除，删除ArticleTag类
