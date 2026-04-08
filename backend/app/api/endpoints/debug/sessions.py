"""Deprecated compatibility wrapper for legacy /api/v1/debug imports."""

from app.api.pythonlab.sessions import *  # noqa: F401,F403
from app.api.pythonlab.sessions import (
    _cleanup_and_count_active_sessions,
    _public_host,
    _rewrite_dap_host_for_client,
    _session_ws_path,
)
