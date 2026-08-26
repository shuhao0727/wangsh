"""
各 AI 服务商模型列表发现客户端（模块级函数）。

从 ModelDiscoveryService 抽出：8 个服务商的 HTTP 获取逻辑只依赖 config 参数与
共享的 _format_model_name，与类实例状态无关，故抽为纯模块级函数。
模型发现服务类保留同名薄包装方法（供上层调用与测试 monkeypatch）。
"""

from typing import List

import httpx

from app.schemas.agents import (
    AIServiceProvider,
    AIModelInfo,
    ServiceProviderConfig,
    COMMON_MODEL_PRESETS,
)


def _format_model_name(model_id: str) -> str:
    """格式化模型显示名称"""
    # 移除版本号和后缀
    name = model_id.replace("-", " ").replace("_", " ").title()

    # 特殊处理
    if "gpt" in model_id.lower():
        name = name.replace("Gpt", "GPT")
    if "claude" in model_id.lower():
        name = name.replace("Claude", "Claude")

    return name


async def discover_models_openai(config: ServiceProviderConfig) -> List[AIModelInfo]:
    """发现OpenAI模型"""
    models = []

    try:
        headers = {
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/wangsh",
            "X-Title": "WangSh AI",
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
                raw_models = data.get("data", [])
                if not isinstance(raw_models, list):
                    raise ValueError(f"模型列表格式异常: {type(raw_models).__name__}")
                for model_data in raw_models:
                    model_id = model_data.get("id", "")
                    if not model_id:
                        continue
                    # 跳过旧模型
                    if model_id.startswith("babbage") or model_id.startswith("davinci"):
                        continue
                    model_info = AIModelInfo(
                        id=model_id,
                        name=_format_model_name(model_id),
                        provider=AIServiceProvider.OPENAI,
                        description=f"OpenAI-compatible {model_id}",
                        is_chat="chat" in model_id.lower() or "gpt" in model_id.lower(),
                        is_vision="vision" in model_id.lower() or "4o" in model_id.lower(),
                    )
                    models.append(model_info)
            elif response.status_code == 401 or response.status_code == 403:
                raise PermissionError(f"API 密钥无效 (HTTP {response.status_code})")
            else:
                raise ConnectionError(
                    f"模型接口返回 HTTP {response.status_code}: {response.text[:300]}"
                )

    except (PermissionError, ConnectionError, ValueError):
        raise
    except Exception:
        # 不静默回退预设模型，由上层决定
        raise

    return models


async def discover_models_deepseek(config: ServiceProviderConfig) -> List[AIModelInfo]:
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
                        name=_format_model_name(model_id),
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


async def discover_models_anthropic(config: ServiceProviderConfig) -> List[AIModelInfo]:
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
                        name=_format_model_name(model_id),
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


async def discover_models_openrouter(config: ServiceProviderConfig) -> List[AIModelInfo]:
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
                        name=_format_model_name(model_id),
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


async def discover_models_siliconflow(config: ServiceProviderConfig) -> List[AIModelInfo]:
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
                        name=_format_model_name(model_id),
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


async def discover_models_volcengine(config: ServiceProviderConfig) -> List[AIModelInfo]:
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
                        name=_format_model_name(model_id),
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


async def discover_models_aliyun(config: ServiceProviderConfig) -> List[AIModelInfo]:
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
                        name=_format_model_name(model_id),
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


async def discover_models_ollama(config: ServiceProviderConfig) -> List[AIModelInfo]:
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
                        name=_format_model_name(model_name),
                        provider=AIServiceProvider.OLLAMA,
                        description=f"Ollama {model_name}",
                        is_chat=True,  # 大多数Ollama模型都支持聊天
                    )
                    models.append(model_info)

    except Exception as e:
        # Ollama默认没有预设模型
        models = []

    return models
