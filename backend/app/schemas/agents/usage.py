"""智能体使用记录相关的 Pydantic 模型"""

from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


class AgentUsageUser(BaseModel):
    id: int
    full_name: str
    student_id: Optional[str] = None
    class_name: Optional[str] = None
    question_count: int = 0


class AgentUsageAgent(BaseModel):
    id: int
    name: str
    usage_count: int = 0


class AgentUsageCreate(BaseModel):
    agent_id: int = Field(..., ge=1)
    user_id: int = Field(..., ge=1)
    message_type: str = Field("question", description="question/answer")
    content: str = Field(..., min_length=1)
    session_id: Optional[str] = None


class AgentUsageResponse(BaseModel):
    id: int
    agent_id: int
    user_id: int
    message_type: str


class AgentUsageListResponse(BaseModel):
    items: List[AgentUsageResponse]
    total: int


class AgentUsageStatistics(BaseModel):
    total_questions: int = 0
    total_sessions: int = 0
    total_users: int = 0
    top_agents: List[AgentUsageAgent] = []
    top_users: List[AgentUsageUser] = []
    daily_stats: List[dict] = []
