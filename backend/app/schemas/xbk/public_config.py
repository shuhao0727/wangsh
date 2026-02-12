"""
XBK 前台可见性配置
"""

from pydantic import BaseModel, Field


class XbkPublicConfig(BaseModel):
    enabled: bool = Field(..., description="是否在前台公开显示 XBK 入口")

