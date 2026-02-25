"""
文章相关的 Pydantic 模型
用于请求/响应的数据验证
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, validator
from uuid import UUID

from app.schemas.articles.markdown_style import MarkdownStyleResponse


def _sanitize_custom_css(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = str(v)
    s = s.replace("</style", "<\\/style").replace("</STYLE", "<\\/STYLE")
    return s


class ArticleBase(BaseModel):
    """文章基础模型"""
    title: str = Field(..., min_length=1, max_length=255, description="文章标题")
    slug: str = Field(..., min_length=1, max_length=255, description="URL友好的别名")
    content: str = Field(..., description="文章正文内容 (Markdown格式)")
    summary: Optional[str] = Field(None, description="文章摘要 (可选)")
    custom_css: Optional[str] = Field(None, max_length=50000, description="文章自定义CSS (可选)")
    style_key: Optional[str] = Field(None, min_length=1, max_length=100, description="Markdown样式方案key (可选)")
    published: bool = Field(False, description="是否发布")
    
    @validator("slug")
    def validate_slug(cls, v):
        """验证slug格式"""
        if not v.replace("-", "").replace("_", "").isalnum():
            raise ValueError("slug只能包含字母、数字、破折号和下划线")
        return v.lower()

    @validator("custom_css")
    def validate_custom_css(cls, v):
        return _sanitize_custom_css(v)

    @validator("style_key")
    def validate_style_key(cls, v):
        if v is None:
            return None
        if not v.replace("-", "").replace("_", "").isalnum():
            raise ValueError("style_key只能包含字母、数字、破折号和下划线")
        return v


class ArticleCreate(ArticleBase):
    """文章创建模型"""
    author_id: int = Field(..., description="作者ID")
    category_id: Optional[int] = Field(None, description="分类ID (可选)")
    # 标签功能已移除，删除了tag_ids字段
    
    @validator("title")
    def validate_title_not_empty(cls, v):
        """验证标题非空"""
        if not v.strip():
            raise ValueError("标题不能为空")
        return v.strip()


class ArticleUpdate(BaseModel):
    """文章更新模型"""
    title: Optional[str] = Field(None, min_length=1, max_length=255, description="文章标题")
    slug: Optional[str] = Field(None, min_length=1, max_length=255, description="URL友好的别名")
    content: Optional[str] = Field(None, description="文章正文内容 (Markdown格式)")
    summary: Optional[str] = Field(None, description="文章摘要 (可选)")
    custom_css: Optional[str] = Field(None, max_length=50000, description="文章自定义CSS (可选)")
    style_key: Optional[str] = Field(None, min_length=1, max_length=100, description="Markdown样式方案key (可选)")
    published: Optional[bool] = Field(None, description="是否发布")
    category_id: Optional[int] = Field(None, description="分类ID (可选)")
    # 标签功能已移除，删除了tag_ids字段
    
    @validator("slug")
    def validate_slug(cls, v):
        """验证slug格式"""
        if v is not None and not v.replace("-", "").replace("_", "").isalnum():
            raise ValueError("slug只能包含字母、数字、破折号和下划线")
        return v.lower() if v else v

    @validator("custom_css")
    def validate_custom_css(cls, v):
        return _sanitize_custom_css(v)

    @validator("style_key")
    def validate_style_key(cls, v):
        if v is None:
            return None
        if not v.replace("-", "").replace("_", "").isalnum():
            raise ValueError("style_key只能包含字母、数字、破折号和下划线")
        return v


class ArticleInDBBase(ArticleBase):
    """数据库文章基础模型"""
    id: int
    author_id: int
    category_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ArticleInDB(ArticleInDBBase):
    """数据库文章模型"""
    pass


# 响应模型
class AuthorInfo(BaseModel):
    """作者信息模型（用于嵌套响应）"""
    id: int
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class CategoryInfo(BaseModel):
    """分类信息模型（用于嵌套响应）"""
    id: int
    name: str
    slug: str
    
    class Config:
        from_attributes = True


# 标签功能已移除，删除了TagInfo类


class ArticleResponse(ArticleInDBBase):
    """文章响应模型"""
    class Config:
        from_attributes = True


class ArticleWithRelations(ArticleResponse):
    """包含关系的文章响应模型"""
    author: Optional[AuthorInfo] = None
    category: Optional[CategoryInfo] = None
    style: Optional[MarkdownStyleResponse] = None
    
    class Config:
        from_attributes = True


class ArticleList(BaseModel):
    """文章列表响应模型"""
    total: int
    articles: List[ArticleWithRelations]
    page: int
    size: int
    total_pages: int
