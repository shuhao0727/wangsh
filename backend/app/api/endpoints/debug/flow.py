"""Deprecated compatibility wrapper for legacy /api/v1/debug imports."""

from app.api.pythonlab.flow import *  # noqa: F401,F403
from app.api.pythonlab.flow import (
    _build_flow,
    _ensure_conservative_code_optimization,
    _normalize_optimized_python_code,
    _strip_markdown_fence,
)
