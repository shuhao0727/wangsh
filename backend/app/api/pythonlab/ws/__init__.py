"""
PythonLab WebSocket 模块 - 兼容导出文件

此文件用于保持向后兼容，将所有函数从新模块重新导出。
实际实现已拆分到各个子模块中。
"""

import asyncio
import os

# 导入 settings 以保持向后兼容
from app.core.config import settings

# 导入 cache 以保持向后兼容
from app.utils.cache import cache

# 导入 celery_app 以保持向后兼容
from app.core.celery_app import celery_app

# 导入所有函数和类，保持向后兼容
from .validation import (
    _extract_ws_token,
    _normalize_client_conn_id,
    _validate_dap_request_payload,
    _build_dap_host_candidates,
    _parse_last_seq,
)

from .connection import (
    _read_dap_message,
    _write_dap_message,
)

from .bridge import (
    _DAP_BRIDGES,
    _DAP_BRIDGES_LOCK,
    DapSessionBridge,
    _get_or_create_dap_bridge,
)

from .handlers import (
    terminal_ws,
    dap_ws,
    router,
    auth_get_current_user,
    WebSocketDisconnect,
)

# 从 constants 导入常量
from app.api.pythonlab.constants import (
    CACHE_KEY_SESSION_PREFIX,
    DAP_HOST_DEFAULT,
    WORKSPACE_MAIN_PY,
    WORKSPACE_DIR,
    WS_HEARTBEAT_INTERVAL,
    WS_MAX_DAP_MSG_BYTES,
    WS_MAX_STDOUT_KB,
    WS_RATE_LIMIT_PER_SEC,
    SESSION_STATUS_READY,
    SESSION_STATUS_ATTACHED,
    SESSION_STATUS_RUNNING,
    SESSION_STATUS_STOPPED,
    SESSION_STATUS_TERMINATED,
    SESSION_STATUS_FAILED,
    SESSION_STATUS_TERMINATING,
)

# 从 utils 导入工具函数
from app.api.pythonlab.utils import now_iso

# 导出所有函数和类
__all__ = [
    # asyncio
    "asyncio",

    # os
    "os",

    # settings
    "settings",

    # cache
    "cache",

    # celery_app
    "celery_app",

    # 验证函数
    "_extract_ws_token",
    "_normalize_client_conn_id",
    "_validate_dap_request_payload",
    "_build_dap_host_candidates",
    "_parse_last_seq",

    # 连接函数
    "_read_dap_message",
    "_write_dap_message",

    # 桥接器相关
    "_DAP_BRIDGES",
    "_DAP_BRIDGES_LOCK",
    "DapSessionBridge",
    "_get_or_create_dap_bridge",

    # WebSocket 端点
    "terminal_ws",
    "dap_ws",
    "router",
    "auth_get_current_user",
    "WebSocketDisconnect",

    # 常量
    "CACHE_KEY_SESSION_PREFIX",
    "DAP_HOST_DEFAULT",
    "WORKSPACE_MAIN_PY",
    "WORKSPACE_DIR",
    "WS_HEARTBEAT_INTERVAL",
    "WS_MAX_DAP_MSG_BYTES",
    "WS_MAX_STDOUT_KB",
    "WS_RATE_LIMIT_PER_SEC",
    "SESSION_STATUS_READY",
    "SESSION_STATUS_ATTACHED",
    "SESSION_STATUS_RUNNING",
    "SESSION_STATUS_STOPPED",
    "SESSION_STATUS_TERMINATED",
    "SESSION_STATUS_FAILED",
    "SESSION_STATUS_TERMINATING",

    # 工具函数
    "now_iso",
]