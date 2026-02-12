"""
项目所有Pydantic Schema定义
按功能模块组织在子目录中

导入结构示例：
    from app.schemas.core import UserCreate, UserResponse
    from app.schemas.articles import ArticleCreate, ArticleResponse
"""

from .core import *
from .articles import *

# 导出所有Schema类型
__all__ = [
    # 从core模块导出
    "Token",
    "TokenData",
    "UserBase",
    "UserCreate",
    "UserLogin",
    "UserUpdate",
    "UserInDB",
    "UserResponse",
    "PasswordResetRequest",
    "PasswordReset",
    
    # 从articles模块导出
    "ArticleBase",
    "ArticleCreate",
    "ArticleUpdate",
    "ArticleInDB",
    "ArticleResponse",
    "ArticleWithRelations",
    "ArticleList",
    "TagBase",
    "TagCreate",
    "TagUpdate",
    "TagInDB",
    "TagResponse",
    "TagWithUsage",
    "TagList",
    "CategoryBase",
    "CategoryCreate",
    "CategoryUpdate",
    "CategoryInDB",
    "CategoryResponse",
    "CategoryWithUsage",
    "CategoryList",
    "AuthorInfo",
    "CategoryInfo",
    "TagInfo"
]