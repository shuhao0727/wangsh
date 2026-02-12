from datetime import datetime
from pydantic import BaseModel, Field


class TypstStyleListItem(BaseModel):
    key: str
    title: str = ""
    sort_order: int = 0
    updated_at: datetime


class TypstStyleResponse(BaseModel):
    key: str
    title: str = ""
    sort_order: int = 0
    content: str = ""
    updated_at: datetime


class TypstStyleUpsert(BaseModel):
    key: str = Field(..., min_length=1, max_length=100)
    title: str = Field("", max_length=200)
    sort_order: int = 0
    content: str = Field("", max_length=200000)


class TypstStyleUpdate(BaseModel):
    title: str | None = Field(None, max_length=200)
    sort_order: int | None = None
    content: str | None = Field(None, max_length=200000)

