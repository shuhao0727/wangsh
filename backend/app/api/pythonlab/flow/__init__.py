"""
Flow 模块包

包含流程图解析、代码优化和 AI 对话功能。
"""

from .api import router
from .builder import parse_flow_internal, _build_flow
from .constants import (
    PROMPT_TEMPLATE_PATH,
    OPTIMIZE_CODE_TEMPLATE_PATH,
    MAX_TEMPLATE_SIZE,
    DEFAULT_OPTIMIZE_CODE_PROMPT,
    COMPLEX_SPLIT_THRESHOLD,
    ERROR_CODES,
    OPTIMIZATION_STATUS,
    LOG_TYPES,
    EDGE_KINDS,
)

from .exceptions import (
    FlowException,
    ValidationError,
    SizeLimitError,
    AIAgentError,
    AIAgentTimeoutError,
    AIAgentNotConfiguredError,
    NotFoundError,
    RateLimitError,
    InternalError,
    handle_flow_exceptions,
)

from .ai_service import (
    ai_chat_internal,
    generate_code_from_flow_internal,
    optimize_code_internal,
    test_agent_connection_internal,
    _ensure_conservative_code_optimization,
    _get_agent_config,
    _normalize_optimized_python_code,
    _strip_markdown_fence,
)

from .optimization_service import (
    apply_optimization_internal,
    rollback_optimization_internal,
)
from .utils import _now_ms

# 导入 code_generator_client
from app.services.agents.code_generator import code_generator_client

# 导入 cache
from app.utils.cache import cache

# 导入常量
from app.api.pythonlab.constants import API_VERSION_FLOW, PARSER_VERSION_FLOW, CACHE_KEY_FLOW_PREFIX
from app.api.pythonlab.utils import sha256_text, options_hash

# 导入 API 端点函数
from .api import (
    optimize_code,
    apply_optimization,
    rollback_optimization,
    get_prompt_template,
    save_prompt_template,
    ai_chat,
    generate_code_from_flow,
    test_agent_connection,
    parse_flow,
)

__all__ = [
    "router",
    "parse_flow_internal",
    "optimize_code_internal",
    "apply_optimization_internal",
    "rollback_optimization_internal",
    "ai_chat_internal",
    "generate_code_from_flow_internal",
    "test_agent_connection_internal",
    "_build_flow",
    "_ensure_conservative_code_optimization",
    "_get_agent_config",
    "_normalize_optimized_python_code",
    "_strip_markdown_fence",
    "_now_ms",
    "API_VERSION_FLOW",
    "PARSER_VERSION_FLOW",
    "CACHE_KEY_FLOW_PREFIX",
    "sha256_text",
    "options_hash",
    "PROMPT_TEMPLATE_PATH",
    "OPTIMIZE_CODE_TEMPLATE_PATH",
    "MAX_TEMPLATE_SIZE",
    "DEFAULT_OPTIMIZE_CODE_PROMPT",
    "COMPLEX_SPLIT_THRESHOLD",
    "ERROR_CODES",
    "OPTIMIZATION_STATUS",
    "LOG_TYPES",
    "EDGE_KINDS",
    "FlowException",
    "ValidationError",
    "SizeLimitError",
    "AIAgentError",
    "AIAgentTimeoutError",
    "AIAgentNotConfiguredError",
    "NotFoundError",
    "RateLimitError",
    "InternalError",
    "handle_flow_exceptions",
    "code_generator_client",
    "cache",
    # API 端点函数
    "optimize_code",
    "apply_optimization",
    "rollback_optimization",
    "get_prompt_template",
    "save_prompt_template",
    "ai_chat",
    "generate_code_from_flow",
    "test_agent_connection",
    "parse_flow",
]