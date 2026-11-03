"""课堂互动 Pydantic schemas"""

from pydantic import BaseModel, Field
from typing import Optional, List, Literal

ActivityType = Literal["vote", "fill_blank"]
# 说明：产品文档曾提及 5 种活动类型，但当前仅 vote(投票)/fill_blank(填空) 两种已实现，
# 前端也仅消费这两种。其余类型未实现，强行扩展会引入空壳端点，故保持现状。

class OptionItem(BaseModel):
    key: str = Field(..., description="选项标识 A/B/C/D")
    text: str = Field(..., description="选项内容")

class ActivityCreate(BaseModel):
    activity_type: ActivityType
    title: str = Field(..., min_length=1, max_length=200)
    # 班级名称：留空的旧活动不会向学生端开放。
    class_name: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    options: Optional[List[OptionItem]] = None
    correct_answer: Optional[str] = None
    allow_multiple: bool = False
    time_limit: int = Field(60, ge=0, description="秒, 0=无限制")
    analysis_agent_id: Optional[int] = None
    analysis_prompt: Optional[str] = None

class ActivityUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    class_name: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    options: Optional[List[OptionItem]] = None
    correct_answer: Optional[str] = None
    allow_multiple: Optional[bool] = None
    time_limit: Optional[int] = Field(None, ge=0)
    analysis_agent_id: Optional[int] = None
    analysis_prompt: Optional[str] = None

class ActivityEndRequest(BaseModel):
    analysis_agent_id: Optional[int] = None
    analysis_prompt: Optional[str] = None

class ResponseSubmit(BaseModel):
    answer: str = Field(..., min_length=1, max_length=500)

class ActivityStats(BaseModel):
    activity_id: int
    total_responses: int
    option_counts: Optional[dict] = None
    correct_count: int = 0
    correct_rate: Optional[float] = None
    blank_slot_stats: Optional[list] = None
    top_wrong_answers: Optional[list] = None
