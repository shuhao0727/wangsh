from datetime import datetime
from pydantic import BaseModel, Field


class TypstCategoryListItem(BaseModel):
    id: int
    path: str = ""
    sort_order: int = 0
    updated_at: datetime


class TypstCategoryCreate(BaseModel):
    path: str = Field(..., min_length=1, max_length=200)
    sort_order: int = 0


class TypstCategoryUpdate(BaseModel):
    path: str | None = Field(None, min_length=1, max_length=200)
    sort_order: int | None = None

