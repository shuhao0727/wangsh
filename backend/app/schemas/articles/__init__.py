"""
文章系统Schema模块
包含文章、分类等文章系统相关的Pydantic模型
"""

# 文章相关的Schema
from .article import (
    ArticleBase,
    ArticleCreate,
    ArticleUpdate,
    ArticleInDB,
    ArticleResponse,
    ArticleWithRelations,
    ArticleList
)

# 分类相关的Schema
from .category import (
    CategoryBase,
    CategoryCreate,
    CategoryUpdate,
    CategoryInDB,
    CategoryResponse
)

from .markdown_style import (
    MarkdownStyleListItem,
    MarkdownStyleResponse,
    MarkdownStyleUpsert,
    MarkdownStyleUpdate,
)

__all__ = [
    # 文章Schema
    "ArticleBase",
    "ArticleCreate",
    "ArticleUpdate",
    "ArticleInDB",
    "ArticleResponse",
    "ArticleWithRelations",
    "ArticleList",
    
    # 分类Schema
    "CategoryBase",
    "CategoryCreate",
    "CategoryUpdate",
    "CategoryInDB",
    "CategoryResponse",

    # Markdown样式Schema
    "MarkdownStyleListItem",
    "MarkdownStyleResponse",
    "MarkdownStyleUpsert",
    "MarkdownStyleUpdate",
]
