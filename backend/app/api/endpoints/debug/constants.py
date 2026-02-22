from typing import Final

# API Versions
PARSER_VERSION_PSEUDO: Final[str] = "v1_ast"
API_VERSION_PSEUDO: Final[str] = "pseudocode_v1"

PARSER_VERSION_FLOW: Final[str] = "v7_ir"
API_VERSION_FLOW: Final[str] = "flow_ast_v1"

VERSION_CFG: Final[str] = "v1"

# Paths
WORKSPACE_MAIN_PY: Final[str] = "/workspace/main.py"
WORKSPACE_DIR: Final[str] = "/workspace"

# Cache Keys
CACHE_KEY_PSEUDO_PREFIX: Final[str] = "debug:pseudocode"
CACHE_KEY_FLOW_PREFIX: Final[str] = "debug:flow"
CACHE_KEY_SESSION_PREFIX: Final[str] = "debug:session"
CACHE_KEY_USER_SESSIONS_PREFIX: Final[str] = "debug:user"

# Limits & Defaults
DEFAULT_MAX_PARSE_MS: Final[int] = 1200
DEFAULT_FLOW_MAX_PARSE_MS: Final[int] = 1500
MAX_CODE_SIZE_BYTES: Final[int] = 256 * 1024

# Flow Chart Limits
DEFAULT_MAX_NODES: Final[int] = 2000
DEFAULT_MAX_EDGES: Final[int] = 4000
DEFAULT_MAX_AST_NODES: Final[int] = 50000
DEFAULT_MAX_DEPTH: Final[int] = 8

# WebSocket Limits
WS_MAX_STDOUT_KB: Final[int] = 256
WS_MAX_DAP_MSG_BYTES: Final[int] = 1024 * 1024
WS_RATE_LIMIT_PER_SEC: Final[int] = 50
WS_HEARTBEAT_INTERVAL: Final[float] = 0.2

# DAP / Debugger
DAP_HOST_DEFAULT: Final[str] = "127.0.0.1"

# Error Codes
E_SYNTAX: Final[str] = "E_SYNTAX"
E_PARSE_TIMEOUT: Final[str] = "E_PARSE_TIMEOUT"
E_AST_TOO_LARGE: Final[str] = "E_AST_TOO_LARGE"
W_TRUNCATED: Final[str] = "W_TRUNCATED"

# Session Status
SESSION_STATUS_PENDING: Final[str] = "PENDING"
SESSION_STATUS_READY: Final[str] = "READY"
SESSION_STATUS_ATTACHED: Final[str] = "ATTACHED"
SESSION_STATUS_RUNNING: Final[str] = "RUNNING"
SESSION_STATUS_STOPPED: Final[str] = "STOPPED"
SESSION_STATUS_TERMINATING: Final[str] = "TERMINATING"
SESSION_STATUS_TERMINATED: Final[str] = "TERMINATED"
SESSION_STATUS_FAILED: Final[str] = "FAILED"
SESSION_STATUS_STARTING: Final[str] = "STARTING"

ACTIVE_STATUSES: Final[set] = {
    SESSION_STATUS_PENDING,
    SESSION_STATUS_READY,
    SESSION_STATUS_ATTACHED,
    SESSION_STATUS_RUNNING,
    SESSION_STATUS_STOPPED,
    SESSION_STATUS_STARTING,
}

INACTIVE_STATUSES: Final[set] = {
    SESSION_STATUS_TERMINATED,
    SESSION_STATUS_FAILED,
}

# Session Defaults
DEFAULT_SESSION_TTL: Final[int] = 1800
DEFAULT_UNATTACHED_TTL: Final[int] = 300
