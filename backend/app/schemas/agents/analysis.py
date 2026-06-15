"""任务分析相关的 Pydantic 模型 — 热点问题 + 学生问题链"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


# ── 基础数据结构 ──

class HotQuestionExample(BaseModel):
    question: str
    count: int


class HotQuestionBucket(BaseModel):
    bucket_start: datetime
    question_count: int
    unique_students: int
    top_questions: List[HotQuestionExample]


class TimelineBucket(BaseModel):
    """时序分析时间桶"""
    bucket_start: datetime
    bucket_end: datetime
    question_count: int = 0
    unique_students: int = 0
    top_questions: List[HotQuestionExample] = []
    is_burst: bool = Field(False, description="是否为爆发点")
    near_teacher_mark: Optional[str] = Field(None, description="关联的教师提问内容")
    bloom_distribution: Dict[str, int] = Field(default_factory=dict, description="该桶内 Bloom 认知层级分布")


class TeacherQuestionMark(BaseModel):
    """教师提问时间标记"""
    time: datetime = Field(..., description="教师提问时间")
    question: str = Field("", description="教师提问内容")


class TaskComparisonItem(BaseModel):
    topic: str
    questions: List[str]
    count: int


class KeywordItem(BaseModel):
    word: str
    count: int


class MainQuestionChainItem(BaseModel):
    stage: str
    question: str
    reason: Optional[str] = None
    evidence: List[str] = []


# ── 请求 / 响应 ──

class TaskAnalysisRequest(BaseModel):
    task_sheet: str = Field(..., description="任务单原文内容")
    agent_id: int = Field(..., ge=1, description="智能体ID")
    start_at: Optional[datetime] = Field(None, description="开始时间(ISO)")
    end_at: Optional[datetime] = Field(None, description="结束时间(ISO)")
    class_name: Optional[str] = Field(None, description="班级名称筛选")
    bucket_seconds: int = Field(180, ge=60, le=600, description="时间桶秒数，默认3分钟")
    teacher_marks: List[TeacherQuestionMark] = Field(default_factory=list, description="教师提问时间点")


class TaskAnalysisResponse(BaseModel):
    word_cloud: List[KeywordItem] = []
    covered: List[TaskComparisonItem] = []
    uncovered: List[TaskComparisonItem] = []
    main_question_chain: List[MainQuestionChainItem] = []
    bloom: Dict[str, int] = {}
    # 时序分析
    timeline_buckets: List[TimelineBucket] = []
    teacher_marks: List[TeacherQuestionMark] = []
    burst_points: List[TimelineBucket] = []


# ── 保存 / 记录 — 提取基类避免三套重复 ──

class BaseAnalysisSaveRequest(BaseModel):
    """分析保存请求基类"""
    title: str = Field("未命名分析", max_length=200)
    agent_id: int = Field(..., ge=1, description="数据来源智能体ID")
    analysis_agent_id: Optional[int] = Field(None, ge=1, description="分析用智能体ID")
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    class_name: Optional[str] = None
    custom_prompt: Optional[str] = Field(None, max_length=8000, description="自定义AI分析提示词")


class TaskAnalysisSaveRequest(BaseAnalysisSaveRequest):
    task_sheet: str
    bucket_seconds: int = Field(180, ge=60, le=600, description="时间桶秒数")
    teacher_marks: List[TeacherQuestionMark] = Field(default_factory=list, description="教师提问时间点")


class HotQuestionAnalysisSaveRequest(BaseAnalysisSaveRequest):
    task_sheet: str
    bucket_seconds: int = Field(180, ge=60, le=600)
    teacher_marks: List[TeacherQuestionMark] = Field(default_factory=list)
    prompt_template_id: Optional[int] = Field(None, ge=1, description="提示词模板ID")


class StudentChainAnalysisSaveRequest(BaseAnalysisSaveRequest):
    task_sheet: Optional[str] = Field(None, description="任务单（可选）")
    teacher_marks: List[TeacherQuestionMark] = Field(default_factory=list)
    prompt_template_id: Optional[int] = Field(None, ge=1, description="提示词模板ID")
    merge_threshold: Optional[float] = Field(None, ge=0.15, le=0.60, description="问题合并相似度阈值(0.15-0.60)，默认0.30，越低越宽松")


class BaseAnalysisRecord(BaseModel):
    """分析记录基类"""
    id: int
    title: str
    agent_id: Optional[int] = None
    class_name: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    result: Dict[str, Any] = {}
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TaskAnalysisRecord(BaseAnalysisRecord):
    task_sheet: str = ""


class HotQuestionAnalysisRecord(BaseAnalysisRecord):
    task_sheet: str = ""
    analysis_agent_id: Optional[int] = None
    bucket_seconds: int = 180
    teacher_marks: List[TeacherQuestionMark] = []
    custom_prompt: Optional[str] = None


class StudentChainAnalysisRecord(BaseAnalysisRecord):
    analysis_agent_id: Optional[int] = None
    task_sheet: Optional[str] = None


class AnalysisListItem(BaseModel):
    """统一的分析列表项（热点/问题链/旧表共用）"""
    id: int
    title: str
    agent_id: Optional[int] = None
    class_name: Optional[str] = None
    created_at: datetime
    theme_count: int = 0
    question_count: int = 0
    teacher_anchor_count: int = 0
    burst_count: int = 0
    chain_count: int = 0
    ai_chain_node_count: int = 0
    uncovered_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class AgentAnalysisPromptTemplateCreate(BaseModel):
    analysis_type: str = Field(..., pattern="^(hot_questions|student_chains)$")
    name: str = Field(..., min_length=1, max_length=120)
    content: str = Field(..., min_length=1, max_length=8000)
    is_default: bool = False
    is_active: bool = True
    sort_order: int = Field(100, ge=0, le=10000)


class AgentAnalysisPromptTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    content: Optional[str] = Field(None, min_length=1, max_length=8000)
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = Field(None, ge=0, le=10000)


class AgentAnalysisPromptTemplateRecord(BaseModel):
    id: int
    analysis_type: str
    name: str
    content: str
    is_default: bool = False
    is_active: bool = True
    sort_order: int = 100
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
