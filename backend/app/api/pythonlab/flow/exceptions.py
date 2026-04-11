"""
Flow 模块异常定义

包含自定义异常类和错误处理工具。
"""

from typing import Any, Dict, Optional
from fastapi import HTTPException, status


class FlowException(HTTPException):
    """Flow 模块基础异常"""

    def __init__(
        self,
        status_code: int,
        detail: str,
        error_code: Optional[str] = None,
        extra: Optional[Dict[str, Any]] = None
    ):
        super().__init__(status_code=status_code, detail=detail)
        self.error_code = error_code
        self.extra = extra or {}


class ValidationError(FlowException):
    """输入验证错误"""

    def __init__(self, detail: str, field: Optional[str] = None):
        extra = {"field": field} if field else {}
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
            error_code="VALIDATION_ERROR",
            extra=extra
        )


class SizeLimitError(FlowException):
    """大小限制错误"""

    def __init__(self, detail: str, limit: Optional[int] = None):
        extra = {"limit": limit} if limit else {}
        super().__init__(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=detail,
            error_code="SIZE_LIMIT_ERROR",
            extra=extra
        )


class AIAgentError(FlowException):
    """AI 智能体错误"""

    def __init__(self, detail: str, error_type: Optional[str] = None):
        extra = {"error_type": error_type} if error_type else {}
        super().__init__(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
            error_code="AI_AGENT_ERROR",
            extra=extra
        )


class AIAgentTimeoutError(AIAgentError):
    """AI 智能体超时错误"""

    def __init__(self, detail: str = "AI request timed out"):
        super().__init__(
            detail=detail,
            error_type="TIMEOUT"
        )


class AIAgentNotConfiguredError(AIAgentError):
    """AI 智能体未配置错误"""

    def __init__(self, detail: str = "AI Agent not configured"):
        super().__init__(
            detail=detail,
            error_type="NOT_CONFIGURED"
        )


class NotFoundError(FlowException):
    """资源未找到错误"""

    def __init__(self, detail: str, resource_type: Optional[str] = None):
        extra = {"resource_type": resource_type} if resource_type else {}
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
            error_code="NOT_FOUND_ERROR",
            extra=extra
        )


class RateLimitError(FlowException):
    """速率限制错误"""

    def __init__(self, detail: str = "请求过于频繁"):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            error_code="RATE_LIMIT_ERROR"
        )


class InternalError(FlowException):
    """内部服务器错误"""

    def __init__(self, detail: str, original_error: Optional[Exception] = None):
        extra = {"original_error": str(original_error)} if original_error else {}
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
            error_code="INTERNAL_ERROR",
            extra=extra
        )


# 错误处理装饰器
def handle_flow_exceptions(func):
    """处理 Flow 异常的装饰器"""
    from functools import wraps

    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except FlowException:
            # 重新抛出 FlowException，让 FastAPI 处理
            raise
        except Exception as e:
            # 将其他异常转换为 InternalError
            raise InternalError(
                detail="Internal server error",
                original_error=e
            )

    return wrapper