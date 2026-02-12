from datetime import datetime

from pydantic import BaseModel, Field


class TypstAssetListItem(BaseModel):
    id: int
    path: str = Field(..., max_length=400)
    mime: str = Field(..., max_length=100)
    sha256: str | None = Field(default=None, max_length=64)
    size_bytes: int | None = None
    uploaded_by_id: int | None = None
    created_at: datetime
