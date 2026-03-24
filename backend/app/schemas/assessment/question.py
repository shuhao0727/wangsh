"""
测评题目相关 Pydantic 模型
"""

from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator


QuestionType = Literal["choice", "fill", "short_answer"]
Difficulty = Literal["easy", "medium", "hard"]
QuestionSource = Literal["ai_generated", "manual", "ai_realtime"]
QuestionMode = Literal["fixed", "adaptive"]


class QuestionBase(BaseModel):
    """题目基础模型"""
    question_type: QuestionType = Field(..., description="题型")
    content: str = Field(..., min_length=1, description="题目内容")
    options: Optional[str] = Field(None, description="选项 JSON（仅选择题）")
    correct_answer: str = Field(..., min_length=1, description="正确答案")
    score: int = Field(..., ge=1, le=100, description="分值")
    difficulty: Difficulty = Field("medium", description="难度")
    knowledge_point: Optional[str] = Field(None, max_length=200, description="知识点")
    explanation: Optional[str] = Field(None, description="答案解析")
    mode: QuestionMode = Field("fixed", description="模式: fixed/adaptive")
    adaptive_config: Optional[str] = Field(None, description="自适应配置 JSON")

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str):
        if not v.strip():
            raise ValueError("题目内容不能为空")
        return v.strip()


class QuestionCreate(QuestionBase):
    """手动创建题目"""
    config_id: int = Field(..., description="所属测评配置 ID")
    source: QuestionSource = Field("manual", description="来源")


class QuestionUpdate(BaseModel):
    """更新题目"""
    question_type: Optional[QuestionType] = Field(None, description="题型")
    content: Optional[str] = Field(None, min_length=1, description="题目内容")
    options: Optional[str] = Field(None, description="选项 JSON")
    correct_answer: Optional[str] = Field(None, min_length=1, description="正确答案")
    score: Optional[int] = Field(None, ge=1, le=100, description="分值")
    difficulty: Optional[Difficulty] = Field(None, description="难度")
    knowledge_point: Optional[str] = Field(None, max_length=200, description="知识点")
    explanation: Optional[str] = Field(None, description="答案解析")
    mode: Optional[QuestionMode] = Field(None, description="模式: fixed/adaptive")
    adaptive_config: Optional[str] = Field(None, description="自适应配置 JSON")


class QuestionResponse(BaseModel):
    """题目响应"""
    id: int
    config_id: int
    question_type: str
    content: str
    options: Optional[str] = None
    correct_answer: str
    score: int
    difficulty: str
    knowledge_point: Optional[str] = None
    explanation: Optional[str] = None
    source: str
    mode: str = "fixed"
    adaptive_config: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class QuestionListResponse(BaseModel):
    """题目列表响应"""
    items: List[QuestionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class GenerateQuestionsRequest(BaseModel):
    """AI 生成题目请求"""
    count: Optional[int] = Field(None, ge=1, le=50, description="生成数量（不传则按 question_config）")
