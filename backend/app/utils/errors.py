"""错误处理工具"""
from loguru import logger
from app.core.config import settings


def safe_error_detail(prefix: str, e: Exception) -> str:
    """
    生成安全的错误详情：
    - DEBUG 模式：返回完整错误信息，方便调试
    - 生产模式：只返回前缀，不暴露内部细节
    """
    logger.error(f"{prefix}: {e}")
    if settings.DEBUG:
        return f"{prefix}: {e}"
    return prefix
