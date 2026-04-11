"""
WebSocket 验证和工具函数
"""

import re
from typing import Any, Dict, Optional

from fastapi import WebSocket

from app.core.config import settings
from app.api.pythonlab.constants import WORKSPACE_MAIN_PY, WORKSPACE_DIR


def _extract_ws_token(websocket: WebSocket) -> Optional[str]:
    """从 WebSocket 连接中提取认证 token"""
    token = websocket.query_params.get("token")
    if token:
        return token
    for k in [settings.ACCESS_TOKEN_COOKIE_NAME, "access_token", "ws_access_token"]:
        v = websocket.cookies.get(k)
        if v:
            return v
    return None


def _normalize_client_conn_id(raw: Any) -> Optional[str]:
    """规范化客户端连接 ID"""
    s = str(raw or "").strip()
    if not s:
        return None
    s = s[:64]
    if re.fullmatch(r"[A-Za-z0-9._-]+", s):
        return s
    return None


def _validate_dap_request_payload(msg: Dict[str, Any]) -> Optional[str]:
    """验证 DAP 请求负载"""
    if msg.get("type") != "request":
        return None
    cmd = str(msg.get("command") or "")
    _raw_args = msg.get("arguments")
    args: Dict[str, Any] = _raw_args if isinstance(_raw_args, dict) else {}
    if cmd == "setBreakpoints":
        _raw_src = args.get("source")
        src: Dict[str, Any] = _raw_src if isinstance(_raw_src, dict) else {}
        if str(src.get("path") or "") != WORKSPACE_MAIN_PY:
            return f"source.path 仅允许 {WORKSPACE_MAIN_PY}"
    if cmd == "launch":
        if str(args.get("program") or "") != WORKSPACE_MAIN_PY:
            return f"program 仅允许 {WORKSPACE_MAIN_PY}"
        if str(args.get("cwd") or "") not in {"", WORKSPACE_DIR}:
            return f"cwd 仅允许 {WORKSPACE_DIR}"
    return None


def _build_dap_host_candidates(host: Any, *, in_docker: bool) -> list[str]:
    """构建 DAP 主机候选列表"""
    host_candidates: list[str] = []
    for raw_host in [host, "host.docker.internal", "172.17.0.1", "127.0.0.1"]:
        normalized = str(raw_host or "").strip()
        if normalized and normalized not in host_candidates:
            host_candidates.append(normalized)
    if in_docker:
        host_candidates = [item for item in host_candidates if item != "127.0.0.1"] + ["127.0.0.1"]
    return host_candidates


def _parse_last_seq(websocket: WebSocket) -> Optional[int]:
    """解析最后序列号"""
    raw = str(websocket.query_params.get("last_seq") or "").strip()
    if not raw:
        return None
    try:
        value = int(raw)
    except Exception:
        return None
    return value if value >= 0 else None