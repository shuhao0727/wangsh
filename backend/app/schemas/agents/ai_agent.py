"""
AI智能体相关的 Pydantic 模型
用于请求/响应的数据验证
与前端类型定义保持一致
"""

from datetime import datetime
from typing import Optional, List, Literal, Dict, Any
from pydantic import BaseModel, Field, validator, HttpUrl, AnyHttpUrl
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
    is_active: bool = Field(True, description="是否启用")
    
    @validator("name")
    def validate_name_not_empty(cls, v):
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
    clear_api_key: Optional[bool] = Field(False, description="是否清除已保存的API密钥")
    is_active: Optional[bool] = Field(None, description="是否启用")

    @validator("name")
    def validate_name_not_empty(cls, v):
        """验证名称非空（如果提供）"""
        if v is not None:
            if not v.strip():
                raise ValueError("智能体名称不能为空")
            return v.strip()
        return v


class AIAgentInDB(AIAgentBase):
    """数据库中的AI智能体模型"""
    id: int = Field(..., description="智能体ID")
    has_api_key: Optional[bool] = Field(None, description="是否已配置API密钥")
    api_key_last4: Optional[str] = Field(None, max_length=8, description="API密钥末尾4位")
    is_deleted: bool = Field(False, description="是否已删除")
    created_at: datetime = Field(..., description="创建时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间")
    
    class Config:
        from_attributes = True


class AIAgentResponse(AIAgentInDB):
    """API响应中的AI智能体模型"""
    status: Optional[bool] = Field(None, description="状态显示（前端兼容字段）")
    agent_name: Optional[str] = Field(None, description="智能体名称别名（前端兼容字段）")
    description: Optional[str] = Field(None, description="描述")
    model_name: Optional[str] = Field(None, description="模型名称（前端兼容字段）")
    
    class Config:
        from_attributes = True


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

class AgentChatRequest(BaseModel):
    agent_id: int = Field(..., description="智能体ID")
    message: str = Field(..., min_length=1, max_length=4000, description="对话消息")
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
    created_at: datetime


class HotQuestionExample(BaseModel):
    question: str
    count: int


class HotQuestionBucket(BaseModel):
    bucket_start: datetime
    question_count: int
    unique_students: int
    top_questions: List[HotQuestionExample]


class StudentChainMessage(BaseModel):
    id: int
    message_type: str
    content: str
    created_at: datetime


class StudentChainSession(BaseModel):
    session_id: str
    last_at: datetime
    turns: int
    messages: List[StudentChainMessage]


class ConversationExportRequest(BaseModel):
    session_ids: List[str]
