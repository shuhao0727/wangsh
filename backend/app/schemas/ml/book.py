"""ML 学习书 Schema。"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ── Book ─────────────────────────────────────────

class MLBookIn(BaseModel):
    """书籍元数据输入。"""
    title: str = Field(..., min_length=1, max_length=255, description="书名")
    subtitle: Optional[str] = Field(None, max_length=255, description="副标题")
    description: Optional[str] = Field(None, description="书籍描述")
    audience: Optional[str] = Field(None, max_length=255, description="目标读者")
    outcomes: List[str] = Field(default_factory=list, description="学习成果")
    enabled: bool = Field(True, description="是否启用")


class MLBookOut(BaseModel):
    """书籍元数据响应。"""
    id: int
    module_key: str
    title: str
    subtitle: Optional[str] = None
    description: Optional[str] = None
    audience: Optional[str] = None
    outcomes: List[str] = Field(default_factory=list)
    enabled: bool = True
    created_at: datetime
    updated_at: datetime
    chapters: List["MLBookChapterOut"] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


# ── Chapter ──────────────────────────────────────

class MLBookChapterIn(BaseModel):
    """章节内容输入。"""
    slug: str = Field(..., min_length=1, max_length=120, description="URL 标识")
    chapter_number: int = Field(..., ge=1, description="章节序号")
    title: str = Field(..., min_length=1, max_length=255, description="章节标题")
    summary: Optional[str] = Field(None, description="章节摘要")
    difficulty: Optional[str] = Field(None, max_length=50, description="难度等级")
    estimated_minutes: Optional[int] = Field(None, ge=1, description="预计学习时长(分钟)")
    markdown: Optional[str] = Field(None, description="章节正文 (Markdown)")
    goals: List[str] = Field(default_factory=list, description="学习目标")
    checklist: List[str] = Field(default_factory=list, description="检查清单")
    experiments: List[Dict[str, Any]] = Field(default_factory=list, description="实验任务")
    glossary: List[Dict[str, str]] = Field(default_factory=list, description="术语表")
    references: List[Dict[str, str]] = Field(default_factory=list, description="参考来源")
    prerequisites: List[str] = Field(default_factory=list, description="前置章节 slug")
    keywords: List[str] = Field(default_factory=list, description="搜索关键词")
    quiz: List[Dict[str, Any]] = Field(default_factory=list, description="自测题")
    sort_order: int = Field(0, description="排序值")
    enabled: bool = Field(True, description="是否启用")


class MLBookChapterOut(BaseModel):
    """章节内容响应。"""
    id: int
    book_id: int
    slug: str
    chapter_number: int
    title: str
    summary: Optional[str] = None
    difficulty: Optional[str] = None
    estimated_minutes: Optional[int] = None
    markdown: Optional[str] = None
    goals: List[str] = Field(default_factory=list)
    checklist: List[str] = Field(default_factory=list)
    experiments: List[Dict[str, Any]] = Field(default_factory=list)
    glossary: List[Dict[str, str]] = Field(default_factory=list)
    references: List[Dict[str, str]] = Field(default_factory=list)
    prerequisites: List[str] = Field(default_factory=list)
    keywords: List[str] = Field(default_factory=list)
    quiz: List[Dict[str, Any]] = Field(default_factory=list)
    sort_order: int = 0
    enabled: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Reorder ──────────────────────────────────────

class MLBookChapterReorderItem(BaseModel):
    """排序项。"""
    slug: str = Field(..., min_length=1, max_length=120)
    chapter_number: int = Field(..., ge=1)


class MLBookChapterReorderIn(BaseModel):
    """批量排序输入。"""
    items: List[MLBookChapterReorderItem] = Field(..., min_length=1, description="排序列表")


class MLBookToggleIn(BaseModel):
    """启用/停用输入。"""
    enabled: bool = Field(..., description="是否启用")
