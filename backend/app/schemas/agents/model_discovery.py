"""
模型发现相关的 Pydantic 模型
用于从AI服务商API获取可用模型列表
"""

from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, validator, HttpUrl
from enum import Enum


# 支持的AI服务商类型
class AIServiceProvider(str, Enum):
    """AI服务商类型枚举"""
    OPENAI = "openai"
    DEEPSEEK = "deepseek"
    AZURE = "azure"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    COHERE = "cohere"
    TOGETHER = "together"
    GROK = "grok"
    OLLAMA = "ollama"
    OPENROUTER = "openrouter"
    SILICONFLOW = "siliconflow"
    VOLCENGINE = "volcengine"
    ALIYUN = "aliyun"
    DIFY = "dify"
    CUSTOM = "custom"


# 模型信息
class AIModelInfo(BaseModel):
    """AI模型信息"""
    id: str = Field(..., description="模型ID（API中使用的标识符）")
    name: str = Field(..., description="模型显示名称")
    provider: AIServiceProvider = Field(..., description="服务商")
    context_length: Optional[int] = Field(None, description="上下文长度（tokens）")
    max_tokens: Optional[int] = Field(None, description="最大生成tokens数")
    is_chat: bool = Field(True, description="是否支持聊天功能")
    is_vision: bool = Field(False, description="是否支持视觉功能")
    is_audio: bool = Field(False, description="是否支持音频功能")
    is_reasoning: bool = Field(False, description="是否支持深度推理")
    description: Optional[str] = Field(None, description="模型描述")
    available: bool = Field(True, description="模型是否可用")
    
    class Config:
        from_attributes = True


# 服务商配置
class ServiceProviderConfig(BaseModel):
    """服务商配置"""
    provider: AIServiceProvider = Field(..., description="服务商类型")
    base_url: str = Field(..., description="API基础URL")
    api_key: str = Field(..., description="API密钥")
    api_version: Optional[str] = Field(None, description="API版本（如Azure需要）")
    organization: Optional[str] = Field(None, description="组织ID（OpenAI需要）")
    project: Optional[str] = Field(None, description="项目ID（某些服务商需要）")
    
    @validator("base_url")
    def validate_base_url(cls, v):
        """验证base_url格式"""
        if not v:
            return v
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("base_url必须以http://或https://开头")
        return v


# 模型发现请求
class ModelDiscoveryRequest(BaseModel):
    """模型发现请求"""
    api_endpoint: str = Field(..., description="API端点URL")
    api_key: str = Field(..., description="API密钥")
    provider: Optional[AIServiceProvider] = Field(None, description="服务商类型（可选，自动检测）")
    
    @validator("api_endpoint")
    def validate_api_endpoint(cls, v):
        """验证API端点格式"""
        if not v:
            raise ValueError("API端点不能为空")
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("API端点必须以http://或https://开头")
        return v


# 模型发现响应
class ModelDiscoveryResponse(BaseModel):
    """模型发现响应"""
    success: bool = Field(..., description="是否成功")
    provider: AIServiceProvider = Field(..., description="检测到的服务商类型")
    models: List[AIModelInfo] = Field([], description="可用模型列表")
    total_count: int = Field(0, description="模型总数")
    error_message: Optional[str] = Field(None, description="错误信息（如果失败）")
    detection_method: Optional[str] = Field(None, description="服务商检测方法")
    request_url: Optional[str] = Field(None, description="实际请求的URL")
    response_time_ms: Optional[float] = Field(None, description="响应时间（毫秒）")


# 服务商检测结果
class ProviderDetectionResult(BaseModel):
    """服务商检测结果"""
    provider: AIServiceProvider = Field(..., description="检测到的服务商")
    confidence: float = Field(..., ge=0.0, le=1.0, description="检测置信度（0-1）")
    detection_method: str = Field(..., description="检测方法")
    base_url: Optional[str] = Field(None, description="规范化后的基础URL")
    api_version: Optional[str] = Field(None, description="API版本（如果检测到）")


# 常见模型预设
COMMON_MODEL_PRESETS: Dict[AIServiceProvider, List[AIModelInfo]] = {
    AIServiceProvider.OPENAI: [
        AIModelInfo(
            id="gpt-4o",
            name="GPT-4o",
            provider=AIServiceProvider.OPENAI,
            context_length=128000,
            max_tokens=4096,
            is_chat=True,
            is_vision=True,
            description="OpenAI最新多模态模型"
        ),
        AIModelInfo(
            id="gpt-4-turbo",
            name="GPT-4 Turbo",
            provider=AIServiceProvider.OPENAI,
            context_length=128000,
            max_tokens=4096,
            is_chat=True,
            is_vision=True,
            description="OpenAI GPT-4 Turbo"
        ),
        AIModelInfo(
            id="gpt-3.5-turbo",
            name="GPT-3.5 Turbo",
            provider=AIServiceProvider.OPENAI,
            context_length=16385,
            max_tokens=4096,
            is_chat=True,
            description="OpenAI GPT-3.5 Turbo"
        ),
    ],
    AIServiceProvider.DEEPSEEK: [
        AIModelInfo(
            id="deepseek-chat",
            name="DeepSeek Chat",
            provider=AIServiceProvider.DEEPSEEK,
            context_length=32768,
            max_tokens=4096,
            is_chat=True,
            description="DeepSeek通用聊天模型"
        ),
        AIModelInfo(
            id="deepseek-reasoner",
            name="DeepSeek 深度思考",
            provider=AIServiceProvider.DEEPSEEK,
            context_length=32768,
            max_tokens=4096,
            is_chat=True,
            is_reasoning=True,
            description="DeepSeek深度推理模型"
        ),
        AIModelInfo(
            id="deepseek-coder",
            name="DeepSeek Coder",
            provider=AIServiceProvider.DEEPSEEK,
            context_length=16384,
            max_tokens=4096,
            is_chat=True,
            description="DeepSeek代码生成模型"
        ),
    ],
    AIServiceProvider.ANTHROPIC: [
        AIModelInfo(
            id="claude-3-opus-20240229",
            name="Claude 3 Opus",
            provider=AIServiceProvider.ANTHROPIC,
            context_length=200000,
            max_tokens=4096,
            is_chat=True,
            is_vision=True,
            description="Anthropic Claude 3 Opus（最强）"
        ),
        AIModelInfo(
            id="claude-3-sonnet-20240229",
            name="Claude 3 Sonnet",
            provider=AIServiceProvider.ANTHROPIC,
            context_length=200000,
            max_tokens=4096,
            is_chat=True,
            is_vision=True,
            description="Anthropic Claude 3 Sonnet（平衡）"
        ),
    ],
    AIServiceProvider.GOOGLE: [
        AIModelInfo(
            id="gemini-pro",
            name="Gemini Pro",
            provider=AIServiceProvider.GOOGLE,
            context_length=32768,
            max_tokens=8192,
            is_chat=True,
            is_vision=True,
            description="Google Gemini Pro"
        ),
        AIModelInfo(
            id="gemini-1.5-pro",
            name="Gemini 1.5 Pro",
            provider=AIServiceProvider.GOOGLE,
            context_length=1000000,
            max_tokens=8192,
            is_chat=True,
            is_vision=True,
            description="Google Gemini 1.5 Pro（长上下文）"
        ),
    ],
    AIServiceProvider.DIFY: [
        AIModelInfo(
            id="dify-chat",
            name="Dify Chat",
            provider=AIServiceProvider.DIFY,
            context_length=16384,
            max_tokens=4096,
            is_chat=True,
            description="Dify智能体聊天模型"
        ),
        AIModelInfo(
            id="dify-completion",
            name="Dify Completion",
            provider=AIServiceProvider.DIFY,
            context_length=16384,
            max_tokens=4096,
            is_chat=True,
            description="Dify智能体补全模型"
        ),
    ],
    AIServiceProvider.OPENROUTER: [
        AIModelInfo(
            id="openrouter/gpt-4o",
            name="OpenRouter GPT-4o",
            provider=AIServiceProvider.OPENROUTER,
            is_chat=True,
            is_vision=True,
            is_audio=False,
            is_reasoning=False,
            description="OpenRouter 代理的 GPT-4o",
            available=True,
        ),
        AIModelInfo(
            id="openrouter/claude-3-sonnet",
            name="OpenRouter Claude 3 Sonnet",
            provider=AIServiceProvider.OPENROUTER,
            is_chat=True,
            is_vision=True,
            is_audio=False,
            is_reasoning=False,
            description="OpenRouter 代理的 Claude 3 Sonnet",
            available=True,
        ),
    ],
    AIServiceProvider.SILICONFLOW: [
        AIModelInfo(
            id="siliconflow/llama-3.1-8b-instruct",
            name="SiliconFlow Llama 3.1 8B Instruct",
            provider=AIServiceProvider.SILICONFLOW,
            is_chat=True,
            is_vision=False,
            is_audio=False,
            is_reasoning=False,
            description="硅基流动 Llama 指令模型",
            available=True,
        ),
        AIModelInfo(
            id="siliconflow/qwen2.5",
            name="SiliconFlow Qwen 2.5",
            provider=AIServiceProvider.SILICONFLOW,
            is_chat=True,
            is_vision=False,
            is_audio=False,
            is_reasoning=False,
            description="硅基流动的通义千问系列",
            available=True,
        ),
    ],
    AIServiceProvider.VOLCENGINE: [
        AIModelInfo(
            id="doubao-pro-128k",
            name="Volcengine Doubao Pro 128k",
            provider=AIServiceProvider.VOLCENGINE,
            is_chat=True,
            is_vision=False,
            is_audio=False,
            is_reasoning=False,
            description="火山方舟豆包 Pro（长上下文）",
            available=True,
        ),
        AIModelInfo(
            id="doubao-lite-32k",
            name="Volcengine Doubao Lite 32k",
            provider=AIServiceProvider.VOLCENGINE,
            is_chat=True,
            is_vision=False,
            is_audio=False,
            is_reasoning=False,
            description="火山方舟豆包 Lite",
            available=True,
        ),
    ],
    AIServiceProvider.ALIYUN: [
        AIModelInfo(
            id="qwen-plus",
            name="Aliyun Qwen Plus",
            provider=AIServiceProvider.ALIYUN,
            is_chat=True,
            is_vision=True,
            is_audio=False,
            is_reasoning=False,
            description="阿里百炼 通义千问 Plus",
            available=True,
        ),
        AIModelInfo(
            id="qwen-turbo",
            name="Aliyun Qwen Turbo",
            provider=AIServiceProvider.ALIYUN,
            is_chat=True,
            is_vision=False,
            is_audio=False,
            is_reasoning=False,
            description="阿里百炼 通义千问 Turbo",
            available=True,
        ),
    ],
}
