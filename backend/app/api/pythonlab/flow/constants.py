"""
Flow 模块常量定义

包含所有常量、配置和路径定义。
"""

from pathlib import Path
from typing import Final

# 文件路径常量
PROMPT_TEMPLATE_PATH: Final[Path] = Path(__file__).resolve().parents[4] / "prompts" / "flowchart_to_python.txt"
OPTIMIZE_CODE_TEMPLATE_PATH: Final[Path] = Path(__file__).resolve().parents[4] / "prompts" / "optimize_code.txt"

# 模板大小限制 (1MB)
MAX_TEMPLATE_SIZE: Final[int] = 1024 * 1024

# 默认提示词模板
DEFAULT_OPTIMIZE_CODE_PROMPT: Final[str] = """你是一位资深 Python 代码优化专家。
请在不改变原始业务语义的前提下优化代码，可提升可读性、健壮性和性能。
输出必须满足以下要求：
1. 仅输出可直接运行的 Python 代码。
2. 不要输出解释、标题、前后缀、注释说明或 Markdown 代码块标记。
3. 严格保持与输入代码语义一致。"""

# 复杂度阈值
COMPLEX_SPLIT_THRESHOLD: Final[int] = 2

# 错误代码
ERROR_CODES = {
    "AST_TOO_LARGE": "E_AST_TOO_LARGE",
    "PARSE_TIMEOUT": "E_PARSE_TIMEOUT",
    "SYNTAX_ERROR": "E_SYNTAX",
    "TRUNCATED_WARNING": "W_TRUNCATED",
}

# 状态常量
OPTIMIZATION_STATUS = {
    "PENDING": "pending",
    "APPLIED": "applied",
    "FAILED": "failed",
}

# 日志类型
LOG_TYPES = {
    "CODE": "code",
    "FLOW": "flow",
}

# 边类型
EDGE_KINDS = {
    "NEXT": "Next",
    "TRUE": "True",
    "FALSE": "False",
    "RETURN": "Return",
    "BREAK": "Break",
    "CONTINUE": "Continue",
    "EXCEPT": "Except",
    "FINALLY": "Finally",
}