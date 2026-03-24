"""
测评会话相关 Pydantic 模型
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class SessionStartRequest(BaseModel):
    """开始检测请求"""
    config_id: int = Field(..., description="测评配置 ID")


class SessionStartResponse(BaseModel):
    """开始检测响应"""
    session_id: int
    config_title: str
    total_questions: int
    total_score: int
    time_limit_minutes: int
    started_at: datetime


class AnswerSubmitRequest(BaseModel):
    """提交单题答案"""
    answer_id: int = Field(..., description="答题记录 ID")
    student_answer: str = Field(..., description="学生答案")


class AnswerResult(BaseModel):
    """单题判分结果"""
    answer_id: int
    question_type: str
    is_correct: Optional[bool] = None
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    earned_score: Optional[int] = None
    max_score: int
    ai_feedback: Optional[str] = None


class SessionSubmitResponse(BaseModel):
    """提交整卷响应"""
    session_id: int
    status: str
    earned_score: int
    total_score: int
    basic_profile_id: Optional[int] = None
    summary: Optional[str] = None


class AnswerDetailResponse(BaseModel):
    """答题详情"""
    id: int
    question_type: str
    content: str
    options: Optional[str] = None
    student_answer: Optional[str] = None
    correct_answer: str
    is_correct: Optional[bool] = None
    earned_score: Optional[int] = None
    max_score: int
    ai_feedback: Optional[str] = None
    explanation: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SessionResultResponse(BaseModel):
    """检测结果响应"""
    session_id: int
    config_id: int
    config_title: str
    status: str
    earned_score: Optional[int] = None
    total_score: int
    started_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    answers: List[AnswerDetailResponse] = []
    basic_profile_id: Optional[int] = None


class SessionListItem(BaseModel):
    """学生答题情况列表项"""
    id: int
    user_id: int
    user_name: Optional[str] = None
    class_name: Optional[str] = None
    status: str
    earned_score: Optional[int] = None
    total_score: int
    started_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SessionListResponse(BaseModel):
    """学生答题情况列表"""
    items: List[SessionListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class QuestionForStudent(BaseModel):
    """学生端题目（不含答案）"""
    answer_id: int
    question_type: str
    content: str
    options: Optional[str] = None
    score: int
    student_answer: Optional[str] = None
    is_answered: bool = False


class StatisticsResponse(BaseModel):
    """答题统计"""
    config_id: int
    config_title: str
    total_students: int
    submitted_count: int
    avg_score: Optional[float] = None
    max_score: Optional[int] = None
    min_score: Optional[int] = None
    pass_rate: Optional[float] = None
    knowledge_rates: Optional[dict] = None
