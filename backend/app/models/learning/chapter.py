"""学习章节模型 - 对应数据库表 sys_learning_chapters"""

from sqlalchemy import Column, DateTime, Integer, String, Text, func

from app.db.database import Base


class LearningChapter(Base):
    """学习章节表。"""

    __tablename__ = "sys_learning_chapters"
    __table_args__ = {"comment": "学习章节内容表"}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    module_key = Column(String(50), nullable=False, index=True, comment="模块标识: ml, ai, agents")
    slug = Column(String(120), nullable=False, comment="章节唯一标识")
    title = Column(String(255), nullable=False, comment="标题")
    summary = Column(Text, nullable=True, comment="摘要")
    estimated_minutes = Column(Integer, nullable=False, default=30, comment="预计学习时长(分钟)")
    difficulty = Column(String(20), nullable=False, default="beginner", comment="难度: beginner/intermediate/advanced/expert")
    group_name = Column(String(100), nullable=True, comment="所属分组名称")
    markdown = Column(Text, nullable=True, comment="Markdown 正文内容")
    sort_order = Column(Integer, nullable=False, default=0, comment="排序")
    created_at = Column(DateTime, server_default=func.now(), nullable=False, comment="创建时间")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False, comment="更新时间")

    def __repr__(self):
        return f"<LearningChapter(id={self.id}, module_key='{self.module_key}', slug='{self.slug}')>"
