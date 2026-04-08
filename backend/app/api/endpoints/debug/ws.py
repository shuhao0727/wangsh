"""Deprecated compatibility wrapper for legacy /api/v1/debug imports."""

from app.api.pythonlab.ws import *  # noqa: F401,F403
from app.api.pythonlab.ws import (
    DapSessionBridge,
    _build_dap_host_candidates,
    _extract_ws_token,
    _normalize_client_conn_id,
    _parse_last_seq,
    _read_dap_message,
    _validate_dap_request_payload,
    _write_dap_message,
)
