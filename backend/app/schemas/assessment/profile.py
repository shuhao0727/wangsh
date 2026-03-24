"""
画像相关 Pydantic 模型
"""

from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, ConfigDict


ProfileType = Literal["individual", "group", "class"]


class BasicProfileResponse(BaseModel):
    """初级画像响应"""
    id: int
    session_id: int
    user_id: int
    config_id: int
    earned_score: int
    total_score: int
    knowledge_scores: Optional[str] = None
    wrong_points: Optional[str] = None
    ai_summary: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProfileGenerateRequest(BaseModel):
    """生成高级画像请求"""
    profile_type: ProfileType = Field(..., description="画像类型")
    target_id: str = Field(..., description="目标标识")
    config_id: Optional[int] = Field(None, description="关联的测评配置")
    discussion_session_id: Optional[int] = Field(None, description="关联的小组讨论会话")
    agent_ids: Optional[List[int]] = Field(None, description="关联的智能体 ID 列表")
    agent_id: int = Field(..., description="生成画像用的智能体 ID")


class ProfileBatchGenerateRequest(BaseModel):
    """批量生成画像请求"""
    profile_type: ProfileType = Field("individual", description="画像类型")
    user_ids: List[int] = Field(..., min_length=1, description="学生 ID 列表")
    config_id: Optional[int] = Field(None, description="关联的测评配置")
    discussion_session_id: Optional[int] = Field(None, description="关联的小组讨论会话")
    agent_ids: Optional[List[int]] = Field(None, description="关联的智能体 ID 列表")
    agent_id: int = Field(..., description="生成画像用的智能体 ID")


class ProfileResponse(BaseModel):
    """高级画像响应"""
    id: int
    profile_type: str
    target_id: str
    config_id: Optional[int] = None
    config_title: Optional[str] = None
    discussion_session_id: Optional[int] = None
    agent_ids: Optional[str] = None
    data_sources: Optional[str] = None
    result_text: Optional[str] = None
    scores: Optional[str] = None
    created_by_user_id: Optional[int] = None
    creator_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProfileListResponse(BaseModel):
    """画像列表响应"""
    items: List[ProfileResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
