"""对话/使用记录相关的 Pydantic 模型"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class ConversationSummary(BaseModel):
    id: int
    status: str
    user_name: Optional[str] = None
    student_id: Optional[str] = None
    class_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    question_count: int = 0
    answer_count: int = 0
    last_question: Optional[str] = None


class ConversationMessage(BaseModel):
    id: int
    message_type: str
    content: str
    created_at: datetime


class StudentChainMessage(BaseModel):
    id: int
    message_type: str
    content: str
    created_at: datetime


class StudentChainSession(BaseModel):
    session_id: str
    last_at: datetime
    turns: int
    student_id: Optional[str] = None
    user_name: Optional[str] = None
    class_name: Optional[str] = None
    messages: List[StudentChainMessage]


class ConversationExportRequest(BaseModel):
    session_ids: List[str]


class UsageFilterOptions(BaseModel):
    agent_id: Optional[int] = Field(None, ge=1)
    time_range: Optional[str] = Field(None, description="today/7d/30d")
