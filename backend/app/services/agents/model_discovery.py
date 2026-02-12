"""
模型发现服务
从AI服务商API获取可用模型列表
支持自动检测服务商类型和获取实时模型列表
"""

import asyncio
import time
import re
from typing import Optional, List, Dict, Any, Tuple
from urllib.parse import urlparse, urlunparse

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.agents import (
    AIServiceProvider,
    AIModelInfo,
    ServiceProviderConfig,
    ModelDiscoveryRequest,
    ModelDiscoveryResponse,
    ProviderDetectionResult,
    COMMON_MODEL_PRESETS,
)


class ModelDiscoveryService:
    """模型发现服务类"""
    
    def __init__(self):
        # 服务商检测规则：URL模式 -> 服务商类型
        self.provider_detection_rules = [
            # OpenAI
            {
                "patterns": [
                    r"api\.openai\.com",
                    r"openai\.com/v1",
                    r"openai\.azure\.com",
                ],
                "provider": AIServiceProvider.OPENAI,
                "confidence": 0.95,
                "method": "url_pattern"
            },
            # DeepSeek
            {
                "patterns": [
                    r"api\.deepseek\.com",
                    r"deepseek\.com",
                ],
                "provider": AIServiceProvider.DEEPSEEK,
                "confidence": 0.95,
                "method": "url_pattern"
            },
            # Azure OpenAI
            {
                "patterns": [
                    r"\.openai\.azure\.com",
                    r"cognitiveservices\.azure\.com",
                ],
                "provider": AIServiceProvider.AZURE,
                "confidence": 0.90,
                "method": "url_pattern"
            },
            # Anthropic
            {
                "patterns": [
                    r"api\.anthropic\.com",
                    r"anthropic\.com",
                ],
                "provider": AIServiceProvider.ANTHROPIC,
                "confidence": 0.95,
                "method": "url_pattern"
            },
            # Google (Gemini)
            {
                "patterns": [
                    r"generativelanguage\.googleapis\.com",
                    r"googleapis\.com/v1beta/models",
                ],
                "provider": AIServiceProvider.GOOGLE,
                "confidence": 0.90,
                "method": "url_pattern"
            },
            # Ollama (本地)
            {
                "patterns": [
                    r"localhost:11434",
                    r"127\.0\.0\.1:11434",
                    r"ollama\.local",
                ],
                "provider": AIServiceProvider.OLLAMA,
                "confidence": 0.85,
                "method": "url_pattern"
            },
            # Dify (自定义智能体)
            {
                "patterns": [
                    r"dify\.ai",
                    r"dify\.com",
                    r"/v1/chat/completions",
                ],
                "provider": AIServiceProvider.DIFY,
                "confidence": 0.80,
                "method": "url_pattern"
            },
            # OpenRouter
            {
                "patterns": [
                    r"openrouter\.ai",
                    r"openrouter\.ai/api/v1",
                ],
                "provider": AIServiceProvider.OPENROUTER,
                "confidence": 0.90,
                "method": "url_pattern"
            },
            # SiliconFlow（硅基流动）
            {
                "patterns": [
                    r"siliconflow\.cn",
                    r"api\.siliconflow\.cn",
                ],
                "provider": AIServiceProvider.SILICONFLOW,
                "confidence": 0.90,
                "method": "url_pattern"
            },
            # Volcengine Ark（火山方舟）
            {
                "patterns": [
                    r"volcengine\.com",
                    r"volces\.com",
                    r"ark\.cn-beijing\.volces\.com",
                ],
                "provider": AIServiceProvider.VOLCENGINE,
                "confidence": 0.85,
                "method": "url_pattern"
            },
            # Aliyun Bailian / DashScope（阿里百炼/通义千问）
            {
                "patterns": [
                    r"dashscope\.aliyuncs\.com",
                    r"bailian\.aliyun\.com",
                    r"aliyun\.com",
                ],
                "provider": AIServiceProvider.ALIYUN,
                "confidence": 0.85,
                "method": "url_pattern"
            },
        ]
        
        # 各服务商的模型列表API端点
        self.model_list_endpoints = {
            AIServiceProvider.OPENAI: "/v1/models",
            AIServiceProvider.DEEPSEEK: "/v1/models",
            AIServiceProvider.ANTHROPIC: "/v1/models",
            AIServiceProvider.GOOGLE: "/v1beta/models",
            AIServiceProvider.OLLAMA: "/api/tags",
            AIServiceProvider.DIFY: "/v1/models",
            AIServiceProvider.OPENROUTER: "/api/v1/models",
            AIServiceProvider.SILICONFLOW: "/v1/models",
            AIServiceProvider.VOLCENGINE: "/api/v3/models",
            AIServiceProvider.ALIYUN: "/v1/models",
        }
    
    def detect_provider_from_url(self, api_endpoint: str) -> ProviderDetectionResult:
        """
        根据API端点URL检测服务商类型
        """
        # 标准化URL
        parsed = urlparse(api_endpoint)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        
        # 检查URL模式匹配
        for rule in self.provider_detection_rules:
            for pattern in rule["patterns"]:
                if re.search(pattern, api_endpoint, re.IGNORECASE):
                    return ProviderDetectionResult(
                        provider=rule["provider"],
                        confidence=rule["confidence"],
                        detection_method=rule["method"],
                        base_url=base_url
                    )
        
        # 检查常见服务商子路径
        path = parsed.path.lower()
        if "/openai/" in path or "openai" in api_endpoint.lower():
            return ProviderDetectionResult(
                provider=AIServiceProvider.OPENAI,
                confidence=0.70,
                detection_method="path_pattern",
                base_url=base_url
            )
        elif "/deepseek/" in path or "deepseek" in api_endpoint.lower():
            return ProviderDetectionResult(
                provider=AIServiceProvider.DEEPSEEK,
                confidence=0.70,
                detection_method="path_pattern",
                base_url=base_url
            )
        elif "/anthropic/" in path or "anthropic" in api_endpoint.lower():
            return ProviderDetectionResult(
                provider=AIServiceProvider.ANTHROPIC,
                confidence=0.70,
                detection_method="path_pattern",
                base_url=base_url
            )
        
        # 默认返回自定义类型
        return ProviderDetectionResult(
            provider=AIServiceProvider.CUSTOM,
            confidence=0.50,
            detection_method="default",
            base_url=base_url
        )
    
    def normalize_api_endpoint(self, api_endpoint: str, provider: AIServiceProvider) -> str:
        """
        规范化API端点URL
        """
        parsed = urlparse(api_endpoint)
        
        # 确保有正确的路径
        if provider in [AIServiceProvider.OPENAI, AIServiceProvider.DEEPSEEK, AIServiceProvider.SILICONFLOW, AIServiceProvider.ALIYUN]:
            # 如果路径为空或为根路径，添加/v1
            if not parsed.path or parsed.path == "/":
                parsed = parsed._replace(path="/v1")
            # 如果路径已经是/v1开头，不再重复添加
            elif parsed.path == "/v1" or parsed.path.startswith("/v1/"):
                # 路径已经是/v1或/v1/xxx，保持不变
                pass
        elif provider == AIServiceProvider.OPENROUTER:
            # OpenRouter 使用 /api/v1
            if not parsed.path or parsed.path == "/":
                parsed = parsed._replace(path="/api/v1")
            elif parsed.path == "/api/v1" or parsed.path.startswith("/api/v1/"):
                pass
        elif provider == AIServiceProvider.VOLCENGINE:
            # Volcengine Ark 使用 /api/v3
            if not parsed.path or parsed.path == "/":
                parsed = parsed._replace(path="/api/v3")
            elif parsed.path == "/api/v3" or parsed.path.startswith("/api/v3/"):
                pass
        
        # 重新构建URL
        return urlunparse(parsed)
    
    async def discover_models_openai(self, config: ServiceProviderConfig) -> List[AIModelInfo]:
        """发现OpenAI模型"""
        models = []
        
        try:
            headers = {
                "Authorization": f"Bearer {config.api_key}",
                "Content-Type": "application/json",
            }
            
            if config.organization:
                headers["OpenAI-Organization"] = config.organization
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{config.base_url}/models",
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    for model_data in data.get("data", []):
                        model_id = model_data.get("id", "")
                        
                        # 跳过某些模型
                        if model_id.startswith("babbage") or model_id.startswith("davinci"):
                            continue
                        
                        # 提取模型信息
                        model_info = AIModelInfo(
                            id=model_id,
                            name=self._format_model_name(model_id),
                            provider=AIServiceProvider.OPENAI,
                            description=f"OpenAI {model_id}",
                            is_chat="chat" in model_id.lower() or "gpt" in model_id.lower(),
                            is_vision="vision" in model_id.lower() or "4o" in model_id.lower(),
                        )
                        models.append(model_info)
        
        except Exception as e:
            # 如果API调用失败，返回预设模型
            models = COMMON_MODEL_PRESETS.get(AIServiceProvider.OPENAI, [])
        
        return models
    
    async def discover_models_deepseek(self, config: ServiceProviderConfig) -> List[AIModelInfo]:
        """发现DeepSeek模型"""
        models = []
        
        try:
            headers = {
                "Authorization": f"Bearer {config.api_key}",
                "Content-Type": "application/json",
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{config.base_url}/models",
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    for model_data in data.get("data", []):
                        model_id = model_data.get("id", "")
                        
                        model_info = AIModelInfo(
                            id=model_id,
                            name=self._format_model_name(model_id),
                            provider=AIServiceProvider.DEEPSEEK,
                            description=f"DeepSeek {model_id}",
                            is_chat="chat" in model_id.lower(),
                            is_reasoning="reasoner" in model_id.lower(),
                        )
                        models.append(model_info)
        
        except Exception as e:
            # 如果API调用失败，返回预设模型
            models = COMMON_MODEL_PRESETS.get(AIServiceProvider.DEEPSEEK, [])
        
        return models
    
    async def discover_models_anthropic(self, config: ServiceProviderConfig) -> List[AIModelInfo]:
        """发现Anthropic模型"""
        models = []
        
        try:
            headers = {
                "x-api-key": config.api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{config.base_url}/models",
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    for model_data in data.get("data", []):
                        model_id = model_data.get("id", "")
                        
                        model_info = AIModelInfo(
                            id=model_id,
                            name=self._format_model_name(model_id),
                            provider=AIServiceProvider.ANTHROPIC,
                            description=f"Anthropic {model_id}",
                            is_chat=True,  # Claude都是聊天模型
                            is_vision="opus" in model_id.lower() or "sonnet" in model_id.lower(),
                        )
                        models.append(model_info)
        
        except Exception as e:
            # 如果API调用失败，返回预设模型
            models = COMMON_MODEL_PRESETS.get(AIServiceProvider.ANTHROPIC, [])
        
        return models
    
    async def discover_models_openrouter(self, config: ServiceProviderConfig) -> List[AIModelInfo]:
        """发现 OpenRouter 模型"""
        models = []
        try:
            headers = {
                "Authorization": f"Bearer {config.api_key}",
                "Content-Type": "application/json",
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(f"{config.base_url}/models", headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    items = data.get("data") or data.get("models") or []
                    for model in items:
                        model_id = model.get("id") or model.get("name") or ""
                        if not model_id:
                            continue
                        models.append(AIModelInfo(
                            id=model_id,
                            name=self._format_model_name(model_id),
                            provider=AIServiceProvider.OPENROUTER,
                            description=f"OpenRouter {model_id}",
                            is_chat=True,
                            is_vision="vision" in model_id.lower() or "4o" in model_id.lower(),
                            is_audio=False,
                            is_reasoning="reason" in model_id.lower(),
                        ))
        except Exception:
            models = COMMON_MODEL_PRESETS.get(AIServiceProvider.OPENROUTER, [])
        return models
    
    async def discover_models_siliconflow(self, config: ServiceProviderConfig) -> List[AIModelInfo]:
        """发现 SiliconFlow（硅基流动）模型"""
        models = []
        try:
            headers = {
                "Authorization": f"Bearer {config.api_key}",
                "Content-Type": "application/json",
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(f"{config.base_url}/models", headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    items = data.get("data") or data.get("models") or []
                    for model in items:
                        model_id = model.get("id") or model.get("name") or ""
                        if not model_id:
                            continue
                        models.append(AIModelInfo(
                            id=model_id,
                            name=self._format_model_name(model_id),
                            provider=AIServiceProvider.SILICONFLOW,
                            description=f"SiliconFlow {model_id}",
                            is_chat=True,
                            is_vision=False,
                            is_audio=False,
                            is_reasoning="reason" in model_id.lower(),
                        ))
        except Exception:
            models = COMMON_MODEL_PRESETS.get(AIServiceProvider.SILICONFLOW, [])
        return models
    
    async def discover_models_volcengine(self, config: ServiceProviderConfig) -> List[AIModelInfo]:
        """发现 Volcengine Ark（火山方舟）模型"""
        models = []
        try:
            headers = {
                "Authorization": f"Bearer {config.api_key}",
                "Content-Type": "application/json",
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(f"{config.base_url}/models", headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    items = data.get("data") or data.get("models") or []
                    for model in items:
                        model_id = model.get("id") or model.get("name") or ""
                        if not model_id:
                            continue
                        models.append(AIModelInfo(
                            id=model_id,
                            name=self._format_model_name(model_id),
                            provider=AIServiceProvider.VOLCENGINE,
                            description=f"Volcengine {model_id}",
                            is_chat=True,
                            is_vision=False,
                            is_audio=False,
                            is_reasoning="reason" in model_id.lower(),
                        ))
        except Exception:
            models = COMMON_MODEL_PRESETS.get(AIServiceProvider.VOLCENGINE, [])
        return models
    
    async def discover_models_aliyun(self, config: ServiceProviderConfig) -> List[AIModelInfo]:
        """发现 Aliyun Bailian / DashScope（阿里百炼/通义千问）模型"""
        models = []
        try:
            headers = {
                "Authorization": f"Bearer {config.api_key}",
                "Content-Type": "application/json",
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                # DashScope 典型模型列表端点
                response = await client.get(f"{config.base_url}/models", headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    items = data.get("data") or data.get("models") or []
                    for model in items:
                        model_id = model.get("id") or model.get("model") or model.get("name") or ""
                        if not model_id:
                            continue
                        models.append(AIModelInfo(
                            id=model_id,
                            name=self._format_model_name(model_id),
                            provider=AIServiceProvider.ALIYUN,
                            description=f"Aliyun {model_id}",
                            is_chat=True,
                            is_vision="qwen" in model_id.lower(),
                            is_audio=False,
                            is_reasoning="reason" in model_id.lower(),
                        ))
        except Exception:
            models = COMMON_MODEL_PRESETS.get(AIServiceProvider.ALIYUN, [])
        return models
    
    async def discover_models_ollama(self, config: ServiceProviderConfig) -> List[AIModelInfo]:
        """发现Ollama模型"""
        models = []
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(f"{config.base_url}/api/tags")
                
                if response.status_code == 200:
                    data = response.json()
                    for model_data in data.get("models", []):
                        model_name = model_data.get("name", "")
                        
                        model_info = AIModelInfo(
                            id=model_name,
                            name=self._format_model_name(model_name),
                            provider=AIServiceProvider.OLLAMA,
                            description=f"Ollama {model_name}",
                            is_chat=True,  # 大多数Ollama模型都支持聊天
                        )
                        models.append(model_info)
        
        except Exception as e:
            # Ollama默认没有预设模型
            models = []
        
        return models
    
    def _format_model_name(self, model_id: str) -> str:
        """格式化模型显示名称"""
        # 移除版本号和后缀
        name = model_id.replace("-", " ").replace("_", " ").title()
        
        # 特殊处理
        if "gpt" in model_id.lower():
            name = name.replace("Gpt", "GPT")
        if "claude" in model_id.lower():
            name = name.replace("Claude", "Claude")
        
        return name
    
    async def discover_models(
        self,
        request: ModelDiscoveryRequest
    ) -> ModelDiscoveryResponse:
        """
        发现可用模型列表
        根据API端点和密钥自动检测服务商并获取模型列表
        """
        start_time = time.time()
        
        try:
            # 1. 检测服务商类型
            if request.provider:
                # 如果用户指定了服务商，使用指定的
                detection_result = ProviderDetectionResult(
                    provider=request.provider,
                    confidence=1.0,
                    detection_method="user_specified",
                    base_url=request.api_endpoint
                )
            else:
                # 自动检测服务商
                detection_result = self.detect_provider_from_url(request.api_endpoint)
            
            # 2. 规范化配置
            config = ServiceProviderConfig(
                provider=detection_result.provider,
                base_url=self.normalize_api_endpoint(request.api_endpoint, detection_result.provider),
                api_key=request.api_key,
            )
            
            # 3. 根据服务商类型调用相应的发现方法
            models = []
            if detection_result.provider == AIServiceProvider.OPENAI:
                models = await self.discover_models_openai(config)
            elif detection_result.provider == AIServiceProvider.DEEPSEEK:
                models = await self.discover_models_deepseek(config)
            elif detection_result.provider == AIServiceProvider.ANTHROPIC:
                models = await self.discover_models_anthropic(config)
            elif detection_result.provider == AIServiceProvider.OLLAMA:
                models = await self.discover_models_ollama(config)
            elif detection_result.provider == AIServiceProvider.OPENROUTER:
                models = await self.discover_models_openrouter(config)
            elif detection_result.provider == AIServiceProvider.SILICONFLOW:
                models = await self.discover_models_siliconflow(config)
            elif detection_result.provider == AIServiceProvider.VOLCENGINE:
                models = await self.discover_models_volcengine(config)
            elif detection_result.provider == AIServiceProvider.ALIYUN:
                models = await self.discover_models_aliyun(config)
            elif detection_result.provider == AIServiceProvider.AZURE:
                # Azure OpenAI使用类似OpenAI的接口
                config.provider = AIServiceProvider.OPENAI
                models = await self.discover_models_openai(config)
            elif detection_result.provider == AIServiceProvider.DIFY:
                # Dify智能体：返回预设模型或尝试使用OpenAI兼容接口
                try:
                    models = await self.discover_models_openai(config)
                except Exception:
                    # 如果OpenAI兼容接口失败，返回预设模型
                    models = COMMON_MODEL_PRESETS.get(AIServiceProvider.DIFY, [])
            else:
                # 其他服务商或自定义，返回预设模型或空列表
                models = COMMON_MODEL_PRESETS.get(detection_result.provider, [])
            
            # 4. 计算响应时间
            response_time_ms = (time.time() - start_time) * 1000
            
            return ModelDiscoveryResponse(
                success=True,
                provider=detection_result.provider,
                models=models,
                total_count=len(models),
                detection_method=detection_result.detection_method,
                request_url=f"{config.base_url}/models",
                response_time_ms=response_time_ms
            )
        
        except Exception as e:
            response_time_ms = (time.time() - start_time) * 1000
            
            return ModelDiscoveryResponse(
                success=False,
                provider=getattr(detection_result, 'provider', AIServiceProvider.CUSTOM),
                models=[],
                total_count=0,
                error_message=f"模型发现失败: {str(e)}",
                detection_method=getattr(detection_result, 'detection_method', 'error'),
                response_time_ms=response_time_ms
            )
    
    async def get_preset_models(self, provider: Optional[AIServiceProvider] = None) -> List[AIModelInfo]:
        """
        获取预设模型列表
        用于在没有API密钥或API不可用时提供常见模型选择
        """
        if provider:
            return COMMON_MODEL_PRESETS.get(provider, [])
        else:
            # 返回所有预设模型
            all_models = []
            for provider_models in COMMON_MODEL_PRESETS.values():
                all_models.extend(provider_models)
            return all_models


# 创建服务实例
model_discovery_service = ModelDiscoveryService()


# 服务函数（用于API端点调用）
async def discover_models_service(
    request: ModelDiscoveryRequest
) -> ModelDiscoveryResponse:
    """
    模型发现服务函数
    """
    return await model_discovery_service.discover_models(request)


async def get_preset_models_service(
    provider: Optional[AIServiceProvider] = None
) -> List[AIModelInfo]:
    """
    获取预设模型服务函数
    """
    return await model_discovery_service.get_preset_models(provider)
