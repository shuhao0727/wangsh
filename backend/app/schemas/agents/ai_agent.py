"""
AI智能体相关的 Pydantic 模型
用于请求/响应的数据验证
与前端类型定义保持一致
"""

from datetime import datetime
from typing import Optional, List, Literal, Dict, Any
from pydantic import BaseModel, Field, ConfigDict, field_validator, HttpUrl, AnyHttpUrl
from uuid import UUID


# 智能体类型定义
# 历史数据中可能存在 openai，这里保留兼容
AgentType = Literal["general", "dify", "openai"]


class AIAgentBase(BaseModel):
    """AI智能体基础模型"""
    name: str = Field(..., min_length=1, max_length=200, description="智能体名称")
    agent_type: AgentType = Field(..., description="智能体类型: general(通用)/openai(OpenAI兼容)/dify(Dify自定义)")
    description: Optional[str] = Field(None, max_length=2000, description="智能体描述（可选）")
    model_name: Optional[str] = Field(None, max_length=100, description="模型名称（如：deepseek-chat, gpt-4, 深度思考等）")
    api_endpoint: Optional[AnyHttpUrl] = Field(None, description="API端点URL")
    api_key: Optional[str] = Field(None, max_length=200, description="API密钥")
    system_prompt: Optional[str] = Field(None, max_length=8000, description="系统提示词（智能体人设/角色设定）")
    is_active: bool = Field(True, description="是否启用")
    
    @field_validator("name")
    @classmethod
    def validate_name_not_empty(cls, v: str):
        """验证名称非空"""
        if not v.strip():
            raise ValueError("智能体名称不能为空")
        return v.strip()


class AIAgentCreate(AIAgentBase):
    """AI智能体创建模型"""
    pass


class AIAgentUpdate(BaseModel):
    """AI智能体更新模型"""
    name: Optional[str] = Field(None, min_length=1, max_length=200, description="智能体名称")
    agent_type: Optional[AgentType] = Field(None, description="智能体类型")
    description: Optional[str] = Field(None, max_length=2000, description="智能体描述（可选）")
    model_name: Optional[str] = Field(None, max_length=100, description="模型名称")
    api_endpoint: Optional[AnyHttpUrl] = Field(None, description="API端点URL")
    api_key: Optional[str] = Field(None, max_length=200, description="API密钥")
    system_prompt: Optional[str] = Field(None, max_length=8000, description="系统提示词（智能体人设/角色设定）")
    clear_api_key: Optional[bool] = Field(False, description="是否清除已保存的API密钥")
    is_active: Optional[bool] = Field(None, description="是否启用")

    @field_validator("name")
    @classmethod
    def validate_name_not_empty(cls, v: Optional[str]):
        """验证名称非空（如果提供）"""
        if v is not None:
            if not v.strip():
                raise ValueError("智能体名称不能为空")
            return v.strip()
        return v

    @field_validator("model_name", mode="before")
    @classmethod
    def coerce_model_name(cls, v):
        """兼容前端 tags 模式可能传入数组"""
        if isinstance(v, list):
            return v[0] if v else None
        return v


class AIAgentInDB(AIAgentBase):
    """数据库中的AI智能体模型"""
    id: int = Field(..., description="智能体ID")
    has_api_key: Optional[bool] = Field(None, description="是否已配置API密钥")
    api_key_last4: Optional[str] = Field(None, max_length=8, description="API密钥末尾4位")
    is_deleted: bool = Field(False, description="是否已删除")
    created_at: datetime = Field(..., description="创建时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间")
    
    model_config = ConfigDict(from_attributes=True)


class AIAgentResponse(AIAgentInDB):
    """API响应中的AI智能体模型"""
    api_key: Optional[str] = Field(None, exclude=True, description="API密钥（永远不返回）")
    status: Optional[bool] = Field(None, description="状态显示（前端兼容字段）")
    agent_name: Optional[str] = Field(None, description="智能体名称别名（前端兼容字段）")
    description: Optional[str] = Field(None, description="描述")
    model_name: Optional[str] = Field(None, description="模型名称（前端兼容字段）")
    system_prompt: Optional[str] = Field(None, description="系统提示词")
    
    model_config = ConfigDict(from_attributes=True)


class AIAgentListResponse(BaseModel):
    """AI智能体列表响应"""
    items: List[AIAgentResponse] = Field(..., description="智能体列表")
    total: int = Field(..., description="总数")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页大小")
    total_pages: int = Field(..., description="总页数")


# 智能体测试相关模型
class AgentTestRequest(BaseModel):
    """智能体测试请求模型"""
    agent_id: int = Field(..., description="智能体ID")
    test_message: str = Field(..., min_length=1, max_length=1000, description="测试消息")

class ChatMessage(BaseModel):
    """对话历史中的单条消息"""
    role: Literal["user", "assistant", "system"] = Field(..., description="消息角色")
    content: str = Field(..., min_length=1, max_length=16000, description="消息内容")


class AgentChatRequest(BaseModel):
    agent_id: int = Field(..., description="智能体ID")
    message: str = Field(..., min_length=1, max_length=4000, description="当前对话消息")
    messages: Optional[List[ChatMessage]] = Field(None, description="对话历史（多轮上下文）")
    user: Optional[str] = Field(None, description="用户标识")
    inputs: Optional[Dict[str, Any]] = Field(default_factory=dict, description="附加输入")


class AgentTestResponse(BaseModel):
    """智能体测试响应模型"""
    success: bool = Field(..., description="测试是否成功")
    message: str = Field(..., description="响应消息或错误信息")
    response_time: Optional[float] = Field(None, description="响应时间（毫秒）")
    timestamp: datetime = Field(..., description="时间戳")


class AgentRevealKeyRequest(BaseModel):
    admin_password: str = Field(..., min_length=1, max_length=200, description="管理员密码（二次确认）")


class AgentRevealKeyResponse(BaseModel):
    api_key: str = Field(..., description="API密钥明文")


# 智能体统计数据模型
class AgentStatisticsData(BaseModel):
    """智能体统计数据模型"""
    total: int = Field(..., description="智能体总数")
    generalCount: int = Field(..., description="通用智能体数量")
    difyCount: int = Field(..., description="Dify智能体数量")
    activeCount: int = Field(..., description="启用智能体数量")
    total_agents: int = Field(..., description="智能体总数（兼容字段）")
    active_agents: int = Field(..., description="启用智能体数量（兼容字段）")
    deleted_agents: int = Field(..., description="已删除智能体数量（兼容字段）")
    api_errors: int = Field(..., description="API错误数")


class AgentUsageUser(BaseModel):
    id: int
    student_id: Optional[str] = None
    name: Optional[str] = None
    grade: Optional[str] = None
    class_name: Optional[str] = None
    is_active: Optional[bool] = None


class AgentUsageAgent(BaseModel):
    id: int
    agent_name: str
    agent_type: str
    model_name: Optional[str] = None
    user_id: Optional[int] = None
    status: Optional[bool] = None
    description: Optional[str] = None


class AgentUsageCreate(BaseModel):
    agent_id: int
    user_id: Optional[int] = None
    question: Optional[str] = None
    answer: Optional[str] = None
    session_id: Optional[str] = None
    response_time_ms: Optional[int] = None
    used_at: Optional[datetime] = None


class AgentUsageResponse(BaseModel):
    id: int
    user_id: int
    moxing_id: int
    question: Optional[str] = None
    answer: Optional[str] = None
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
    page: int
    page_size: int
    total_pages: int


class AgentUsageStatistics(BaseModel):
    total_usage: int
    active_students: int
    active_agents: int
    avg_response_time: int
    today_usage: int
    week_usage: int
    month_usage: int


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


class UsageFilterOptions(BaseModel):
    class_names: List[str] = []
    grades: List[str] = []
    agent_names: List[str] = []


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


class TeacherQuestionMark(BaseModel):
    """教师提问时间标记"""
    time: datetime = Field(..., description="教师提问时间")
    question: str = Field("", description="教师提问内容")


class TaskAnalysisRequest(BaseModel):
    task_sheet: str = Field(..., description="任务单原文内容")
    agent_id: int = Field(..., ge=1, description="智能体ID")
    start_at: Optional[datetime] = Field(None, description="开始时间(ISO)")
    end_at: Optional[datetime] = Field(None, description="结束时间(ISO)")
    class_name: Optional[str] = Field(None, description="班级名称筛选")
    bucket_seconds: int = Field(180, ge=60, le=600, description="时间桶秒数，默认3分钟")
    teacher_marks: List[TeacherQuestionMark] = Field(default_factory=list, description="教师提问时间点")


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


class TaskAnalysisSaveRequest(BaseModel):
    title: str = Field("未命名分析", max_length=200)
    task_sheet: str
    agent_id: int = Field(..., ge=1, description="数据来源智能体ID（学生对话的智能体）")
    analysis_agent_id: Optional[int] = Field(None, ge=1, description="分析用智能体ID（执行AI分析的智能体，不填则用agent_id）")
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    class_name: Optional[str] = None
    bucket_seconds: int = Field(180, ge=60, le=600, description="时间桶秒数")
    custom_prompt: Optional[str] = Field(None, max_length=2000, description="自定义AI分析提示词")
    teacher_marks: List[TeacherQuestionMark] = Field(default_factory=list, description="教师提问时间点")


class TaskAnalysisRecord(BaseModel):
    id: int
    title: str
    task_sheet: str = ""
    agent_id: Optional[int] = None
    class_name: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    result: Dict[str, Any] = {}
    created_at: datetime

    class Config:
        from_attributes = True


class TaskAnalysisListItem(BaseModel):
    id: int
    title: str
    agent_id: Optional[int] = None
    class_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── 热点问题分析专用 Schema ──

class HotQuestionAnalysisSaveRequest(BaseModel):
    title: str = Field("未命名分析", max_length=200)
    task_sheet: str
    agent_id: int = Field(..., ge=1, description="数据来源智能体ID")
    analysis_agent_id: Optional[int] = Field(None, ge=1, description="分析用智能体ID")
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    class_name: Optional[str] = None
    bucket_seconds: int = Field(180, ge=60, le=600)
    custom_prompt: Optional[str] = Field(None, max_length=2000)
    teacher_marks: List[TeacherQuestionMark] = Field(default_factory=list)


class HotQuestionAnalysisRecord(BaseModel):
    id: int
    title: str
    task_sheet: str = ""
    agent_id: Optional[int] = None
    analysis_agent_id: Optional[int] = None
    class_name: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    bucket_seconds: int = 180
    teacher_marks: List[TeacherQuestionMark] = []
    custom_prompt: Optional[str] = None
    result: Dict[str, Any] = {}
    created_at: datetime

    class Config:
        from_attributes = True


class HotQuestionAnalysisListItem(BaseModel):
    id: int
    title: str
    agent_id: Optional[int] = None
    class_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── 学生问题链分析专用 Schema ──

class StudentChainAnalysisSaveRequest(BaseModel):
    title: str = Field("未命名分析", max_length=200)
    agent_id: int = Field(..., ge=1, description="数据来源智能体ID")
    analysis_agent_id: Optional[int] = Field(None, ge=1, description="分析用智能体ID")
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    class_name: Optional[str] = None
    task_sheet: Optional[str] = Field(None, description="任务单（可选）")
    custom_prompt: Optional[str] = Field(None, max_length=2000)


class StudentChainAnalysisRecord(BaseModel):
    id: int
    title: str
    agent_id: Optional[int] = None
    analysis_agent_id: Optional[int] = None
    class_name: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    task_sheet: Optional[str] = None
    result: Dict[str, Any] = {}
    created_at: datetime

    class Config:
        from_attributes = True


class StudentChainAnalysisListItem(BaseModel):
    id: int
    title: str
    agent_id: Optional[int] = None
    class_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
