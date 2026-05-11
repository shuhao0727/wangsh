"""学习内容配置模型。"""

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, UniqueConstraint, func

from app.db.database import Base


class LearningContentItem(Base):
    """学习模块内容项。"""

    __tablename__ = "sys_learning_content_items"
    __table_args__ = (
        UniqueConstraint(
            "module_key",
            "section_key",
            "item_key",
            name="uq_sys_learning_content_module_section_item",
        ),
        {"comment": "学习内容配置表"},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    module_key = Column(String(50), nullable=False, index=True, comment="模块标识: ml, ai, agents")
    section_key = Column(String(80), nullable=False, index=True, comment="内容分区")
    item_key = Column(String(120), nullable=False, comment="内容项唯一标识")
    title = Column(String(255), nullable=False, comment="标题")
    summary = Column(Text, nullable=True, comment="摘要")
    content = Column(Text, nullable=False, comment="结构化内容 JSON")
    tags = Column(Text, nullable=True, comment="标签 JSON 数组")
    difficulty = Column(String(50), nullable=True, comment="难度")
    sort_order = Column(Integer, nullable=False, default=0, server_default="0", comment="排序")
    enabled = Column(Boolean, nullable=False, default=True, server_default="true", comment="是否启用")
    source_type = Column(String(50), nullable=False, default="admin", server_default="admin", comment="来源")
    owner_id = Column(Integer, nullable=True, index=True, comment="所有者用户ID，NULL表示公共")
    created_at = Column(DateTime, server_default=func.now(), nullable=False, comment="创建时间")
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="更新时间",
    )

    def __repr__(self):
        return (
            f"<LearningContentItem(id={self.id}, module_key='{self.module_key}', "
            f"section_key='{self.section_key}', item_key='{self.item_key}')>"
        )
