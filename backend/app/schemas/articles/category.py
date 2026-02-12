"""
分类相关的 Pydantic 模型
用于请求/响应的数据验证
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, validator


class CategoryBase(BaseModel):
    """分类基础模型"""
    name: str = Field(..., min_length=1, max_length=100, description="分类名")
    slug: str = Field(..., min_length=1, max_length=100, description="URL友好的别名")
    description: Optional[str] = Field(None, description="分类描述 (可选)")
    
    @validator("slug")
    def validate_slug(cls, v):
        """验证slug格式"""
        if not v.replace("-", "").replace("_", "").isalnum():
            raise ValueError("slug只能包含字母、数字、破折号和下划线")
        return v.lower()


class CategoryCreate(CategoryBase):
    """分类创建模型"""
    
    @validator("name")
    def validate_name_not_empty(cls, v):
        """验证分类名非空"""
        if not v.strip():
            raise ValueError("分类名不能为空")
        return v.strip()


class CategoryUpdate(BaseModel):
    """分类更新模型"""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="分类名")
    slug: Optional[str] = Field(None, min_length=1, max_length=100, description="URL友好的别名")
    description: Optional[str] = Field(None, description="分类描述 (可选)")
    
    @validator("slug")
    def validate_slug(cls, v):
        """验证slug格式"""
        if v is not None and not v.replace("-", "").replace("_", "").isalnum():
            raise ValueError("slug只能包含字母、数字、破折号和下划线")
        return v.lower() if v else v
    
    @validator("name")
    def validate_name_not_empty(cls, v):
        """验证分类名非空"""
        if v is not None and not v.strip():
            raise ValueError("分类名不能为空")
        return v.strip() if v else v


class CategoryInDBBase(CategoryBase):
    """数据库分类基础模型"""
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class CategoryInDB(CategoryInDBBase):
    """数据库分类模型"""
    pass


class CategoryResponse(CategoryInDBBase):
    """分类响应模型"""
    
    class Config:
        from_attributes = True


class CategoryWithUsage(CategoryResponse):
    """包含使用次数的分类响应模型"""
    article_count: int = Field(0, description="该分类下的文章数量")
    
    class Config:
        from_attributes = True


class CategoryList(BaseModel):
    """分类列表响应模型"""
    total: int
    categories: List[CategoryResponse]
    page: int
    size: int
    total_pages: int