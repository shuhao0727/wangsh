"""对话/使用记录相关的 Pydantic 模型"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class ConversationSummary(BaseModel):
    session_id: str
    agent_id: int
    display_agent_name: Optional[str] = None
    display_user_name: Optional[str] = None
    last_at: datetime
    turns: int = 0
    preview: Optional[str] = None


class ConversationMessage(BaseModel):
    id: int
    session_id: str
    user_id: Optional[int] = None
    agent_id: Optional[int] = None
    display_user_name: Optional[str] = None
    display_agent_name: Optional[str] = None
    message_type: str
    content: str
    response_time_ms: Optional[int] = None
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
    class_names: List[str] = []
    grades: List[str] = []
    agent_names: List[str] = []
