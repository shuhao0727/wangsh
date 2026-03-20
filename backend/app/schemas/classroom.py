"""课堂互动 Pydantic schemas"""

from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime


ActivityType = Literal["vote", "fill_blank"]


class OptionItem(BaseModel):
    key: str = Field(..., description="选项标识 A/B/C/D")
    text: str = Field(..., description="选项内容")


class ActivityCreate(BaseModel):
    activity_type: ActivityType
    title: str = Field(..., min_length=1, max_length=200)
    options: Optional[List[OptionItem]] = None
    correct_answer: Optional[str] = None
    allow_multiple: bool = False
    time_limit: int = Field(60, ge=0, description="秒, 0=无限制")


class ActivityUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    options: Optional[List[OptionItem]] = None
    correct_answer: Optional[str] = None
    allow_multiple: Optional[bool] = None
    time_limit: Optional[int] = Field(None, ge=0)


class ActivityResponse(BaseModel):
    id: int
    activity_type: str
    title: str
    options: Optional[list] = None
    correct_answer: Optional[str] = None
    allow_multiple: bool
    time_limit: int
    status: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_by: int
    created_at: datetime
    response_count: int = 0
    remaining_seconds: Optional[int] = None

    class Config:
        from_attributes = True


class ActivityStudentView(BaseModel):
    """学生视角 — 隐藏正确答案"""
    id: int
    activity_type: str
    title: str
    options: Optional[list] = None
    allow_multiple: bool
    time_limit: int
    status: str
    started_at: Optional[datetime] = None
    remaining_seconds: Optional[int] = None
    my_answer: Optional[str] = None


class ResponseSubmit(BaseModel):
    answer: str = Field(..., min_length=1, max_length=500)


class ResponseResult(BaseModel):
    id: int
    answer: str
    is_correct: Optional[bool] = None
    submitted_at: datetime


class ActivityStats(BaseModel):
    activity_id: int
    total_responses: int
    option_counts: Optional[dict] = None
    correct_count: int = 0
    correct_rate: Optional[float] = None


class ActivityListResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int


class ActivityResultView(BaseModel):
    """活动结束后的结果视图"""
    id: int
    activity_type: str
    title: str
    options: Optional[list] = None
    correct_answer: Optional[str] = None
    allow_multiple: bool
    my_answer: Optional[str] = None
    is_correct: Optional[bool] = None
    stats: Optional[ActivityStats] = None
