"""游戏资源库 — Pydantic Schema"""

from datetime import datetime
from typing import Annotated, Optional

from pydantic import BaseModel, Field, StringConstraints


NonBlankCategory = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=100),
]


class GameResourceBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="游戏名称")
    description: Optional[str] = Field(None, description="游戏简介")
    category: str = Field(..., min_length=1, max_length=100, description="分类")


class GameResourceCreate(GameResourceBase):
    """管理员上传/创建游戏资源"""
    pass


class GameResourceUpdate(BaseModel):
    """管理员编辑游戏信息（不重新上传文件）"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    category: Optional[NonBlankCategory] = None
    icon_url: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None


class GameResourceResponse(GameResourceBase):
    """返回给前端的游戏资源信息"""
    id: int
    filename: str
    file_size: int
    file_mime: str = "application/octet-stream"
    file_sha256: Optional[str] = None
    icon_url: Optional[str] = None
    download_count: int = 0
    is_active: bool = True
    uploaded_by: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GameDownloadLogResponse(BaseModel):
    """下载记录"""
    id: int
    game_id: int
    user_id: Optional[int] = None
    ip_address: str
    user_agent: Optional[str] = None
    downloaded_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GameResourceListResponse(BaseModel):
    """分页列表"""
    items: list[GameResourceResponse]
    total: int
