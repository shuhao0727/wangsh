"""
模型发现服务
从AI服务商API获取可用模型列表
支持自动检测服务商类型和获取实时模型列表
"""

import re
import time
from typing import Optional, List
from urllib.parse import urlparse, urlunparse

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
from app.services.agents.endpoint_security import (
    EndpointNotAllowedError,
    _assert_safe_endpoint,
    _assert_safe_endpoint_async,
)
from app.services.agents.provider_clients import (
    discover_models_openai as _discover_models_openai,
    discover_models_deepseek as _discover_models_deepseek,
    discover_models_anthropic as _discover_models_anthropic,
    discover_models_openrouter as _discover_models_openrouter,
    discover_models_siliconflow as _discover_models_siliconflow,
    discover_models_volcengine as _discover_models_volcengine,
    discover_models_aliyun as _discover_models_aliyun,
    discover_models_ollama as _discover_models_ollama,
)


# 各服务商 API 端点的默认路径前缀：仅当路径为空或 "/" 时补全，其余路径保持原样
_DEFAULT_PATH_PREFIXES = {
    AIServiceProvider.OPENAI: "/v1",
    AIServiceProvider.DEEPSEEK: "/v1",
    AIServiceProvider.SILICONFLOW: "/v1",
    AIServiceProvider.ALIYUN: "/v1",
    AIServiceProvider.OPENROUTER: "/api/v1",
    AIServiceProvider.VOLCENGINE: "/api/v3",
}


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

    def _match_provider(self, api_endpoint: str) -> ProviderDetectionResult:
        """纯本地 URL 模式匹配服务商（不发起任何网络请求）。"""
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

    def detect_provider_from_url(self, api_endpoint: str) -> ProviderDetectionResult:
        """
        根据API端点URL检测服务商类型（同步版，供同步调用方/测试使用）

        先做纯本地模式匹配拿到服务商，再执行 SSRF 防护：仅 OLLAMA 服务商
        显式放行本机 11434 端点，其余 provider 一律拦截内网/环回/元数据地址。
        """
        result = self._match_provider(api_endpoint)
        _assert_safe_endpoint(
            api_endpoint,
            allow_local_ollama=result.provider == AIServiceProvider.OLLAMA,
        )
        return result

    async def detect_provider_from_url_async(self, api_endpoint: str) -> ProviderDetectionResult:
        """
        根据API端点URL检测服务商类型（异步版）

        语义与同步版一致；SSRF 防护用 loop.getaddrinfo 解析，不阻塞事件循环。
        """
        result = self._match_provider(api_endpoint)
        await _assert_safe_endpoint_async(
            api_endpoint,
            allow_local_ollama=result.provider == AIServiceProvider.OLLAMA,
        )
        return result

    def _normalize_api_endpoint_body(self, api_endpoint: str, provider: AIServiceProvider) -> str:
        """URL 规范化（不含 SSRF 防护，供同步/异步入口复用）。"""
        parsed = urlparse(api_endpoint)
        default_path = _DEFAULT_PATH_PREFIXES.get(provider)
        if default_path and (not parsed.path or parsed.path == "/"):
            parsed = parsed._replace(path=default_path)
        # 重新构建URL
        return urlunparse(parsed)

    def normalize_api_endpoint(self, api_endpoint: str, provider: AIServiceProvider) -> str:
        """
        规范化API端点URL（同步版）

        SSRF 防护：拒绝内网/环回/元数据端点；OLLAMA 服务商显式放行本机 11434。
        """
        _assert_safe_endpoint(
            api_endpoint,
            allow_local_ollama=provider == AIServiceProvider.OLLAMA,
        )
        return self._normalize_api_endpoint_body(api_endpoint, provider)

    async def normalize_api_endpoint_async(self, api_endpoint: str, provider: AIServiceProvider) -> str:
        """规范化API端点URL（异步版，SSRF 防护不阻塞事件循环）。"""
        await _assert_safe_endpoint_async(
            api_endpoint,
            allow_local_ollama=provider == AIServiceProvider.OLLAMA,
        )
        return self._normalize_api_endpoint_body(api_endpoint, provider)

    async def discover_models_openai(self, config: ServiceProviderConfig) -> List[AIModelInfo]:
        """发现 OpenAI 模型（委托 provider_clients 模块级实现）。"""
        return await _discover_models_openai(config)

    async def discover_models_deepseek(self, config: ServiceProviderConfig) -> List[AIModelInfo]:
        """发现 DeepSeek 模型（委托 provider_clients 模块级实现）。"""
        return await _discover_models_deepseek(config)

    async def discover_models_anthropic(self, config: ServiceProviderConfig) -> List[AIModelInfo]:
        """发现 Anthropic 模型（委托 provider_clients 模块级实现）。"""
        return await _discover_models_anthropic(config)

    async def discover_models_openrouter(self, config: ServiceProviderConfig) -> List[AIModelInfo]:
        """发现 OpenRouter 模型（委托 provider_clients 模块级实现）。"""
        return await _discover_models_openrouter(config)

    async def discover_models_siliconflow(self, config: ServiceProviderConfig) -> List[AIModelInfo]:
        """发现 SiliconFlow 模型（委托 provider_clients 模块级实现）。"""
        return await _discover_models_siliconflow(config)

    async def discover_models_volcengine(self, config: ServiceProviderConfig) -> List[AIModelInfo]:
        """发现 Volcengine 模型（委托 provider_clients 模块级实现）。"""
        return await _discover_models_volcengine(config)

    async def discover_models_aliyun(self, config: ServiceProviderConfig) -> List[AIModelInfo]:
        """发现 Aliyun 模型（委托 provider_clients 模块级实现）。"""
        return await _discover_models_aliyun(config)

    async def discover_models_ollama(self, config: ServiceProviderConfig) -> List[AIModelInfo]:
        """发现 Ollama 模型（委托 provider_clients 模块级实现）。"""
        return await _discover_models_ollama(config)


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
                detection_result = await self.detect_provider_from_url_async(request.api_endpoint)

            # 2. 规范化配置
            config = ServiceProviderConfig(
                provider=detection_result.provider,
                # 说明：detect 与 normalize 各自会跑一次 SSRF 防护，同一请求对同一
                # host 会重复解析一次 DNS。刻意不缓存解析结果——DNS 记录可能随时
                # 变化，缓存会引入陈旧风险，而重复解析的开销可忽略（本地缓存解析器）。
                base_url=await self.normalize_api_endpoint_async(request.api_endpoint, detection_result.provider),
                api_key=request.api_key,
            )

            # 3. 根据服务商类型调用相应的发现方法
            models = []
            if detection_result.provider in (AIServiceProvider.OPENAI, AIServiceProvider.AZURE):
                # Azure OpenAI 使用类似 OpenAI 的接口（OPENAI 路径 provider 本就一致）
                config.provider = AIServiceProvider.OPENAI
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
            elif detection_result.provider == AIServiceProvider.DIFY:
                # Dify智能体：返回预设模型或尝试使用OpenAI兼容接口
                try:
                    models = await self.discover_models_openai(config)
                except Exception:
                    # 如果OpenAI兼容接口失败，返回预设模型
                    models = COMMON_MODEL_PRESETS.get(AIServiceProvider.DIFY, [])
            else:
                # 未知服务商：优先尝试 OpenAI 兼容的 /v1/models 查询
                try:
                    models = await self.discover_models_openai(config)
                except Exception as e:
                    response_time_ms = (time.time() - start_time) * 1000
                    return ModelDiscoveryResponse(
                        success=False,
                        provider=detection_result.provider,
                        models=[],
                        total_count=0,
                        error_message=f"模型发现失败：端点返回格式不兼容 ({str(e)[:200]})",
                        detection_method=detection_result.detection_method,
                        request_url=f"{config.base_url}/models",
                        response_time_ms=response_time_ms,
                    )

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

        except EndpointNotAllowedError:
            # SSRF 防护拒绝的端点：单独 re-raise（不吞成 success=False），
            # 让 API 层的 except ValueError -> 400 生效，与 /detect-provider 一致
            raise
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
