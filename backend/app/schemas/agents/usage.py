"""智能体使用记录相关的 Pydantic 模型"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class AgentUsageUser(BaseModel):
    id: int
    full_name: Optional[str] = None
    name: Optional[str] = None
    student_id: Optional[str] = None
    class_name: Optional[str] = None
    grade: Optional[str] = None
    is_active: Optional[bool] = None
    question_count: int = 0


class AgentUsageAgent(BaseModel):
    id: int
    name: Optional[str] = None
    agent_name: Optional[str] = None
    agent_type: Optional[str] = None
    model_name: Optional[str] = None
    user_id: Optional[int] = None
    status: Optional[bool] = None
    description: Optional[str] = None
    usage_count: int = 0


class AgentUsageCreate(BaseModel):
    agent_id: int = Field(..., ge=1)
    user_id: int = Field(..., ge=1)
    question: Optional[str] = None
    answer: Optional[str] = None
    session_id: Optional[str] = None
    response_time_ms: Optional[int] = None
    used_at: Optional[datetime] = None


class AgentUsageResponse(BaseModel):
    id: int
    user_id: int
    moxing_id: int
    question: str = ""
    answer: str = ""
    session_id: Optional[str] = None
    response_time_ms: Optional[int] = None
    used_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    user: Optional[AgentUsageUser] = None
    moxing: Optional[AgentUsageAgent] = None
    additional_data: Optional[Dict[str, Any]] = None


class AgentUsageListResponse(BaseModel):
    items: List[AgentUsageResponse]
    total: int


class AgentUsageStatistics(BaseModel):
    total_usage: int = 0
    active_students: int = 0
    active_agents: int = 0
    avg_response_time: int = 0
    today_usage: int = 0
    week_usage: int = 0
    month_usage: int = 0
