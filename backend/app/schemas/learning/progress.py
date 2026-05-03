"""
学习进度相关 Pydantic 模型
"""

import json
from datetime import datetime
from typing import Any, Dict, Optional, List
from pydantic import BaseModel, Field, ConfigDict, field_validator


class LearningProgressCreate(BaseModel):
    """创建学习进度"""
    module_key: str = Field(..., pattern=r"^(ml|ai|agents)$", description="模块标识: ml, ai, agents")
    current_stage: Optional[str] = Field(None, max_length=100, description="当前学习阶段")
    completed_stages: Optional[List[str]] = Field(None, description="已完成阶段列表")
    notes: Optional[str] = Field(None, description="学习笔记")


class LearningProgressUpdate(BaseModel):
    """更新学习进度"""
    current_stage: Optional[str] = Field(None, max_length=100, description="当前学习阶段")
    completed_stages: Optional[List[str]] = Field(None, description="已完成阶段列表")
    data: Optional[Dict[str, Any]] = Field(None, description="前端自定义学习进度数据")
    notes: Optional[str] = Field(None, description="学习笔记")


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
