"""
测评配置相关 Pydantic 模型
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator


class AssessmentConfigBase(BaseModel):
    """测评配置基础模型"""
    title: str = Field(..., min_length=1, max_length=200, description="测评标题")
    grade: Optional[str] = Field(None, max_length=20, description="年级")
    teaching_objectives: Optional[str] = Field(None, description="教学目标（Markdown）")
    knowledge_points: Optional[str] = Field(None, description="知识点列表 JSON 数组")
    total_score: int = Field(100, ge=1, le=1000, description="总分")
    question_config: Optional[str] = Field(None, description="题型配置 JSON")
    ai_prompt: Optional[str] = Field(None, description="教师自定义出题提示词")
    agent_id: Optional[int] = Field(None, description="出题/评分用智能体 ID")
    time_limit_minutes: int = Field(0, ge=0, description="答题时限（分钟），0=不限时")
    available_start: Optional[datetime] = Field(None, description="开放开始时间")
    available_end: Optional[datetime] = Field(None, description="开放结束时间")

    @validator("title")
    def validate_title(cls, v):
        if not v.strip():
            raise ValueError("测评标题不能为空")
        return v.strip()


class AssessmentConfigCreate(AssessmentConfigBase):
    """创建测评配置"""
    agent_ids: Optional[List[int]] = Field(None, description="关联的课堂智能体 ID 列表")


class AssessmentConfigUpdate(BaseModel):
    """更新测评配置"""
    title: Optional[str] = Field(None, min_length=1, max_length=200, description="测评标题")
    grade: Optional[str] = Field(None, max_length=20, description="年级")
    teaching_objectives: Optional[str] = Field(None, description="教学目标")
    knowledge_points: Optional[str] = Field(None, description="知识点列表 JSON")
    total_score: Optional[int] = Field(None, ge=1, le=1000, description="总分")
    question_config: Optional[str] = Field(None, description="题型配置 JSON")
    ai_prompt: Optional[str] = Field(None, description="出题提示词")
    agent_id: Optional[int] = Field(None, description="出题/评分用智能体 ID")
    time_limit_minutes: Optional[int] = Field(None, ge=0, description="答题时限")
    available_start: Optional[datetime] = Field(None, description="开放开始时间")
    available_end: Optional[datetime] = Field(None, description="开放结束时间")
    agent_ids: Optional[List[int]] = Field(None, description="关联的课堂智能体 ID 列表")

    @validator("title")
    def validate_title(cls, v):
        if v is not None and not v.strip():
            raise ValueError("测评标题不能为空")
        return v.strip() if v else v


class AssessmentConfigAgentResponse(BaseModel):
    """关联智能体响应"""
    id: int
    name: str
    agent_type: str

    class Config:
        from_attributes = True


class AssessmentConfigResponse(BaseModel):
    """测评配置响应"""
    id: int
    title: str
    grade: Optional[str] = None
    teaching_objectives: Optional[str] = None
    knowledge_points: Optional[str] = None
    total_score: int
    question_config: Optional[str] = None
    ai_prompt: Optional[str] = None
    agent_id: Optional[int] = None
    agent_name: Optional[str] = None
    time_limit_minutes: int
    available_start: Optional[datetime] = None
    available_end: Optional[datetime] = None
    enabled: bool
    created_by_user_id: Optional[int] = None
    creator_name: Optional[str] = None
    question_count: int = 0
    session_count: int = 0
    config_agents: List[AssessmentConfigAgentResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AssessmentConfigListResponse(BaseModel):
    """测评配置列表响应"""
    items: List[AssessmentConfigResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
