"""LLM Provider 策略模式"""

from .base import LLMProvider
from .registry import get_provider
from .common import (
    provider_error_message,
    extract_provider_detail,
    resolve_credentials,
    build_messages,
    openrouter_fallback_model,
    openrouter_free_model,
    openrouter_model_candidates,
    should_retry_openrouter_fallback,
)
from .compat import detect_flags, chat_completions_endpoint, models_endpoint

__all__ = [
    "LLMProvider",
    "get_provider",
    "provider_error_message",
    "extract_provider_detail",
    "resolve_credentials",
    "build_messages",
    "openrouter_fallback_model",
    "openrouter_free_model",
    "openrouter_model_candidates",
    "should_retry_openrouter_fallback",
    # 兼容旧 import
    "detect_flags",
    "chat_completions_endpoint",
    "models_endpoint",
]
