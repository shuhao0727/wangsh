"""
模型发现 API 端点
提供从AI服务商API获取可用模型列表的功能
支持自动检测服务商类型和获取实时模型列表
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.schemas.agents import (
    AIServiceProvider,
    ModelDiscoveryRequest,
    ModelDiscoveryResponse,
    AIModelInfo,
)
from app.services.agents import (
    discover_models_service,
    get_preset_models_service,
)

router = APIRouter()


@router.post("/discover", response_model=ModelDiscoveryResponse)
async def discover_models(
    request: ModelDiscoveryRequest,
):
    """
    发现可用模型列表
    
    根据提供的API端点和密钥，自动检测服务商类型并获取可用模型列表。
    
    请求参数:
    - `api_endpoint`: API端点URL（如 https://api.openai.com/v1）
    - `api_key`: API密钥
    - `provider`: 可选，指定服务商类型（如 openai、deepseek 等），如不指定则自动检测
    
    返回:
    - `success`: 是否成功
    - `provider`: 检测到的服务商类型
    - `models`: 可用模型列表
    - `total_count`: 模型总数
    - `error_message`: 错误信息（如果失败）
    - `detection_method`: 服务商检测方法
    - `response_time_ms`: 响应时间（毫秒）
    
    支持的服务商:
    - OpenAI (api.openai.com)
    - DeepSeek (api.deepseek.com)
    - Anthropic (api.anthropic.com)
    - Ollama (localhost:11434)
    - Azure OpenAI (*.openai.azure.com)
    - 自定义服务商
    """
    try:
        return await discover_models_service(request)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"模型发现失败: {str(e)}",
        )


@router.get("/preset-models", response_model=List[AIModelInfo])
async def get_preset_models(
    provider: Optional[AIServiceProvider] = Query(None, description="服务商类型过滤（可选）"),
):
    """
    获取预设模型列表
    
    返回常见AI服务商的预设模型列表，用于在没有API密钥或API不可用时提供模型选择。
    
    参数:
    - `provider`: 可选，指定服务商类型（如 openai、deepseek 等），如不指定则返回所有预设模型
    
    返回:
    - 预设模型列表，每个模型包含：
        - `id`: 模型ID
        - `name`: 模型显示名称
        - `provider`: 服务商
        - `description`: 模型描述
        - `is_chat`: 是否支持聊天
        - `is_vision`: 是否支持视觉
        - `is_reasoning`: 是否支持深度推理
    """
    try:
        return await get_preset_models_service(provider)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取预设模型失败: {str(e)}",
        )


@router.get("/detect-provider")
async def detect_provider_from_endpoint(
    api_endpoint: str = Query(..., description="API端点URL"),
):
    """
    根据API端点URL检测服务商类型
    
    通过分析URL模式自动识别AI服务商类型。
    
    参数:
    - `api_endpoint`: API端点URL
    
    返回:
    - `provider`: 检测到的服务商类型
    - `confidence`: 检测置信度（0-1）
    - `detection_method`: 检测方法
    - `base_url`: 规范化后的基础URL
    - `suggested_endpoint`: 建议的API端点（规范化后）
    
    支持检测的服务商:
    - OpenAI: api.openai.com, openai.com/v1
    - DeepSeek: api.deepseek.com
    - Anthropic: api.anthropic.com
    - Azure OpenAI: *.openai.azure.com
    - Ollama: localhost:11434
    - 其他自定义服务商
    """
    try:
        from app.services.agents.model_discovery import model_discovery_service
        
        detection_result = model_discovery_service.detect_provider_from_url(api_endpoint)
        
        # 规范化API端点
        normalized_endpoint = model_discovery_service.normalize_api_endpoint(
            api_endpoint, detection_result.provider
        )
        
        return {
            "provider": detection_result.provider,
            "confidence": detection_result.confidence,
            "detection_method": detection_result.detection_method,
            "base_url": detection_result.base_url,
            "suggested_endpoint": normalized_endpoint,
            "original_endpoint": api_endpoint,
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"服务商检测失败: {str(e)}",
        )


@router.get("/supported-providers")
async def get_supported_providers():
    """
    获取支持的服务商列表
    
    返回系统支持的AI服务商类型及其相关信息。
    
    返回:
    - `providers`: 支持的服务商列表，每个服务商包含：
        - `id`: 服务商标识符
        - `name`: 服务商显示名称
        - `description`: 服务商描述
        - `default_endpoint`: 默认API端点
        - `model_list_endpoint`: 模型列表API端点
        - `has_preset_models`: 是否有预设模型
        - `preset_model_count`: 预设模型数量
    """
    from app.schemas.agents import COMMON_MODEL_PRESETS
    
    providers = [
        {
            "id": "openai",
            "name": "OpenAI",
            "description": "OpenAI API（GPT系列模型）",
            "default_endpoint": "https://api.openai.com/v1",
            "model_list_endpoint": "/v1/models",
            "has_preset_models": True,
            "preset_model_count": len(COMMON_MODEL_PRESETS.get(AIServiceProvider.OPENAI, [])),
        },
        {
            "id": "deepseek",
            "name": "DeepSeek",
            "description": "DeepSeek API（国产AI模型）",
            "default_endpoint": "https://api.deepseek.com/v1",
            "model_list_endpoint": "/v1/models",
            "has_preset_models": True,
            "preset_model_count": len(COMMON_MODEL_PRESETS.get(AIServiceProvider.DEEPSEEK, [])),
        },
        {
            "id": "anthropic",
            "name": "Anthropic",
            "description": "Anthropic Claude API",
            "default_endpoint": "https://api.anthropic.com/v1",
            "model_list_endpoint": "/v1/models",
            "has_preset_models": True,
            "preset_model_count": len(COMMON_MODEL_PRESETS.get(AIServiceProvider.ANTHROPIC, [])),
        },
        {
            "id": "azure",
            "name": "Azure OpenAI",
            "description": "Microsoft Azure OpenAI服务",
            "default_endpoint": "https://{resource}.openai.azure.com/openai/deployments",
            "model_list_endpoint": "/openai/deployments?api-version={version}",
            "has_preset_models": False,
            "preset_model_count": 0,
        },
        {
            "id": "openrouter",
            "name": "OpenRouter",
            "description": "OpenRouter 聚合模型服务",
            "default_endpoint": "https://openrouter.ai/api/v1",
            "model_list_endpoint": "/api/v1/models",
            "has_preset_models": True,
            "preset_model_count": len(COMMON_MODEL_PRESETS.get(AIServiceProvider.OPENROUTER, [])),
        },
        {
            "id": "siliconflow",
            "name": "硅基流动",
            "description": "SiliconFlow 模型服务",
            "default_endpoint": "https://api.siliconflow.cn/v1",
            "model_list_endpoint": "/v1/models",
            "has_preset_models": True,
            "preset_model_count": len(COMMON_MODEL_PRESETS.get(AIServiceProvider.SILICONFLOW, [])),
        },
        {
            "id": "volcengine",
            "name": "火山方舟",
            "description": "Volcengine Ark 模型服务",
            "default_endpoint": "https://ark.cn-beijing.volces.com/api/v3",
            "model_list_endpoint": "/api/v3/models",
            "has_preset_models": True,
            "preset_model_count": len(COMMON_MODEL_PRESETS.get(AIServiceProvider.VOLCENGINE, [])),
        },
        {
            "id": "aliyun",
            "name": "阿里百炼",
            "description": "Aliyun Bailian / DashScope 模型服务",
            "default_endpoint": "https://dashscope.aliyuncs.com/v1",
            "model_list_endpoint": "/v1/models",
            "has_preset_models": True,
            "preset_model_count": len(COMMON_MODEL_PRESETS.get(AIServiceProvider.ALIYUN, [])),
        },
        {
            "id": "ollama",
            "name": "Ollama",
            "description": "本地运行的Ollama模型",
            "default_endpoint": "http://localhost:11434",
            "model_list_endpoint": "/api/tags",
            "has_preset_models": False,
            "preset_model_count": 0,
        },
        {
            "id": "custom",
            "name": "自定义服务商",
            "description": "自定义API端点",
            "default_endpoint": "自定义",
            "model_list_endpoint": "自定义",
            "has_preset_models": False,
            "preset_model_count": 0,
        },
    ]
    
    return {
        "providers": providers,
        "total": len(providers),
        "has_model_discovery": True,
    }
