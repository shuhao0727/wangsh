"""用户输入净化工具

防止 XSS 注入和 Prompt Injection 攻击
"""
from html import escape
import re
from typing import Optional


def sanitize_html(text: Optional[str]) -> Optional[str]:
    """转义 HTML 特殊字符，防止 XSS

    Args:
        text: 待转义的文本

    Returns:
        转义后的文本，None 输入返回 None

    Example:
        >>> sanitize_html('<script>alert("XSS")</script>')
        '&lt;script&gt;alert("XSS")&lt;/script&gt;'
    """
    if text is None:
        return None
    return escape(text)


def sanitize_multiline(text: Optional[str]) -> Optional[str]:
    """转义多行文本中的 HTML

    Args:
        text: 待转义的多行文本

    Returns:
        转义后的文本，保留换行符
    """
    if text is None:
        return None
    return escape(text)


# 危险 Prompt 注入模式
PROMPT_INJECTION_PATTERNS = [
    # 忽略指令类
    r"ignore\s+(?:all\s+)?(?:previous|above|prior)\s+(?:instructions?|prompts?|rules?)",
    r"disregard\s+(?:all\s+)?(?:previous|above|prior)\s+(?:instructions?|prompts?|rules?)",
    r"forget\s+(?:all\s+)?(?:previous|above|prior)\s+(?:instructions?|prompts?|rules?)",

    # 角色劫持类
    r"system\s*:\s*(?:you\s+are|now\s+you|act\s+as)",
    r"new\s+instructions?\s*:",
    r"(?:you|your)\s+(?:new|real)\s+role\s+is",

    # XSS 脚本注入
    r"<\s*/?s*(?:script|style|iframe|object|embed)",
    r"javascript\s*:",
    r"onerror\s*=",
    r"onclick\s*=",
    r"onload\s*=",

    # 数据泄露类
    r"reveal\s+(?:the|your|all)\s+(?:api|key|secret|password|token)",
    r"show\s+me\s+(?:the|your|all)\s+(?:api|key|secret|password|token)",
]


def check_prompt_injection(text: str) -> bool:
    """检测 Prompt Injection 攻击

    Args:
        text: 待检测的文本

    Returns:
        True 表示检测到潜在攻击，False 表示安全

    Example:
        >>> check_prompt_injection("Ignore all previous instructions")
        True
        >>> check_prompt_injection("请帮我写一个函数")
        False
    """
    if not text:
        return False

    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    return False


def validate_user_message(message: str, max_length: int = 4000) -> str:
    """验证并清理用户消息

    Args:
        message: 用户消息
        max_length: 最大长度

    Returns:
        清理后的消息

    Raises:
        ValueError: 消息为空、过长或包含恶意内容
    """
    if not message or not message.strip():
        raise ValueError("消息不能为空")

    if len(message) > max_length:
        raise ValueError(f"消息长度不能超过 {max_length} 字符")

    if check_prompt_injection(message):
        raise ValueError("检测到潜在的恶意指令，请修改后重试")

    return message.strip()
