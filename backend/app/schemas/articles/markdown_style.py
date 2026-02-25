from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class MarkdownStyleListItem(BaseModel):
    key: str
    title: str = ""
    sort_order: int = 0
    updated_at: datetime


class MarkdownStyleResponse(BaseModel):
    key: str
    title: str = ""
    sort_order: int = 0
    content: str = ""
    created_at: datetime
    updated_at: datetime


class MarkdownStyleUpsert(BaseModel):
    key: str = Field(..., min_length=1, max_length=100)
    title: Optional[str] = Field(None, max_length=200)
    content: Optional[str] = None
    sort_order: Optional[int] = None


class MarkdownStyleUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    content: Optional[str] = None
    sort_order: Optional[int] = None
