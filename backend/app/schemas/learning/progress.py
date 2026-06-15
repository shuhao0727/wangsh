"""
学习进度相关 Pydantic 模型
"""

import json
from datetime import datetime
from typing import Any, Dict, Optional, List
from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator


class LearningProgressCreate(BaseModel):
    """创建学习进度"""
    module_key: str = Field(..., pattern=r"^(ml|ai|agents)$", description="模块标识: ml, ai, agents")
    current_stage: Optional[str] = Field(None, max_length=100, description="当前学习阶段")
    completed_stages: Optional[List[str]] = Field(None, description="已完成阶段列表")
    notes: Optional[str] = Field(None, description="学习笔记")


class LearningProgressUpdate(BaseModel):
    """
    更新学习进度 - 用于 PUT/POST upsert 端点的输入验证。

    已知字段做类型与长度校验，额外字段保留存储（前端发送的 completedItems 等自定义数据）。
    """
    current_stage: Optional[str] = Field(
        None, max_length=100, description="当前学习阶段"
    )
    completed_stages: Optional[List[str]] = Field(
        None, description="已完成阶段列表，最多 50 个阶段"
    )
    notes: Optional[str] = Field(
        None, max_length=5000, description="学习笔记，最大 5000 字符"
    )

    # 允许额外字段通过（前端发送的 completedItems, favoriteItems 等）
    model_config = ConfigDict(extra="allow")

    @model_validator(mode="after")
    def check_payload_size(self) -> "LearningProgressUpdate":
        """限制总负载大小为 50KB，防止滥用"""
        raw = json.dumps(self.model_dump(), ensure_ascii=False, default=str)
        if len(raw.encode("utf-8")) > 50 * 1024:
            raise ValueError("请求体过大，学习进度数据不得超过 50KB")
        return self

    @field_validator("completed_stages", mode="before")
    @classmethod
    def validate_completed_stages(cls, v: object) -> object:
        """确保 completed_stages 各元素为字符串且长度合理"""
        if v is None:
            return v
        if not isinstance(v, list):
            raise ValueError("completed_stages 必须为列表")
        if len(v) > 50:
            raise ValueError("completed_stages 最多包含 50 个阶段")
        for item in v:
            if not isinstance(item, str):
                raise ValueError("completed_stages 各元素必须为字符串")
            if len(item) > 100:
                raise ValueError("completed_stages 各元素长度不得超过 100 字符")
        return v

    def to_progress_dict(self) -> Dict[str, Any]:
        """将所有字段（含额外字段）转为可存储的 dict，排除 None 值"""
        # model_dump 包含已知字段 + 额外字段
        return {k: v for k, v in self.model_dump().items() if v is not None}


class LearningProgressOut(BaseModel):
    """学习进度响应"""
    id: int
    user_id: int
    module_key: str
    current_stage: Optional[str] = None
    completed_stages: Optional[str] = None
    progress_data: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_validator("completed_stages", mode="before")
    @classmethod
    def parse_completed_stages(cls, v: object) -> object:
        """保持数据库原始字符串，前端自行解析 JSON"""
        if isinstance(v, list):
            return json.dumps(v, ensure_ascii=False)
        return v
