"""ML 学习书与章节模型。"""

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
)
from sqlalchemy.orm import relationship
from app.db.database import Base


class MLBook(Base):
    __tablename__ = "ml_books"
    __table_args__ = (
        UniqueConstraint("module_key", name="uq_ml_books_module_key"),
        {"comment": "ML 学习书元数据表"},
    )

    id = Column(Integer, primary_key=True, autoincrement=True, comment="主键")
    module_key = Column(String(50), nullable=False, comment="模块标识: ml / ai / agents")
    title = Column(String(255), nullable=False, comment="书名")
    subtitle = Column(String(255), nullable=True, comment="副标题")
    description = Column(Text, nullable=True, comment="书籍描述")
    audience = Column(String(255), nullable=True, comment="目标读者")
    outcomes = Column(Text, nullable=True, comment="学习成果 (JSON 数组)")
    enabled = Column(Boolean, default=True, nullable=False, comment="是否启用")
    created_at = Column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")

    chapters = relationship("MLBookChapter", back_populates="book", cascade="all, delete-orphan", order_by="MLBookChapter.sort_order")


class MLBookChapter(Base):
    __tablename__ = "ml_book_chapters"
    __table_args__ = (
        UniqueConstraint("book_id", "slug", name="uq_ml_book_chapters_book_slug"),
        UniqueConstraint("book_id", "chapter_number", name="uq_ml_book_chapters_book_number"),
        {"comment": "ML 学习书章节内容表"},
    )

    id = Column(Integer, primary_key=True, autoincrement=True, comment="主键")
    book_id = Column(Integer, ForeignKey("ml_books.id", ondelete="CASCADE"), nullable=False, comment="关联书籍")
    slug = Column(String(120), nullable=False, comment="URL 友好唯一标识")
    chapter_number = Column(Integer, nullable=False, comment="章节序号")
    title = Column(String(255), nullable=False, comment="章节标题")
    summary = Column(Text, nullable=True, comment="章节摘要")
    difficulty = Column(String(50), nullable=True, comment="难度: beginner/intermediate/advanced/expert")
    estimated_minutes = Column(Integer, nullable=True, comment="预计学习时长(分钟)")
    markdown = Column(Text, nullable=True, comment="章节正文 (Markdown)")
    goals = Column(Text, nullable=True, comment="学习目标 (JSON 数组)")
    checklist = Column(Text, nullable=True, comment="检查清单 (JSON 数组)")
    experiments = Column(Text, nullable=True, comment="实验任务 (JSON)")
    glossary = Column(Text, nullable=True, comment="术语表 (JSON)")
    references = Column(Text, nullable=True, comment="参考来源 (JSON)")
    prerequisites = Column(Text, nullable=True, comment="前置章节 (JSON 数组)")
    keywords = Column(Text, nullable=True, comment="搜索关键词 (JSON 数组)")
    quiz = Column(Text, nullable=True, comment="自测题 (JSON)")
    sort_order = Column(Integer, default=0, nullable=False, comment="排序值")
    enabled = Column(Boolean, default=True, nullable=False, comment="是否启用")
    created_at = Column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")

    book = relationship("MLBook", back_populates="chapters")
