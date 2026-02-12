from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TypstNoteCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    summary: str = Field("", max_length=500)
    category_path: str = Field("", max_length=200)
    published: bool = False
    style_key: str = Field("my_style", max_length=100)
    entry_path: str = Field("main.typ", max_length=200)
    files: Optional[dict] = None
    toc: Optional[list] = None
    content_typst: str = Field("", max_length=200000)


class TypstNoteUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    summary: Optional[str] = Field(None, max_length=500)
    category_path: Optional[str] = Field(None, max_length=200)
    published: Optional[bool] = None
    style_key: Optional[str] = Field(None, max_length=100)
    entry_path: Optional[str] = Field(None, max_length=200)
    files: Optional[dict] = None
    toc: Optional[list] = None
    content_typst: Optional[str] = Field(None, max_length=200000)


class TypstNoteListItem(BaseModel):
    id: int
    title: str
    summary: str = ""
    category_path: str = ""
    published: bool = False
    updated_at: datetime
    compiled_at: Optional[datetime] = None


class TypstNoteResponse(BaseModel):
    id: int
    title: str
    summary: str = ""
    category_path: str = ""
    published: bool = False
    published_at: Optional[datetime] = None
    style_key: str = "my_style"
    entry_path: str = "main.typ"
    files: dict = {}
    toc: list = []
    content_typst: str
    created_by_id: Optional[int] = None
    compiled_hash: Optional[str] = None
    compiled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class TypstNotePublicListItem(BaseModel):
    id: int
    title: str
    summary: str = ""
    category_path: str = ""
    updated_at: datetime


class TypstNotePublicResponse(BaseModel):
    id: int
    title: str
    summary: str = ""
    toc: list = []
    updated_at: datetime
