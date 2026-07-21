"""Helpers for removing credentials from application log messages."""

import re
import traceback
from types import TracebackType
from typing import TypeAlias


_SENSITIVE_QUERY_RE = re.compile(
    r"([?&](?:token|access_token|refresh_token)=)[^&\s]+",
    re.IGNORECASE,
)
_SENSITIVE_ASSIGNMENT_RE = re.compile(
    r"(\b(?:token|access_token|refresh_token|api_key|password)\b"
    r"\s*(?:=|:)\s*)[\"']?[^&\s,]+[\"']?",
    re.IGNORECASE,
)
_BEARER_RE = re.compile(
    r"(\bBearer\s+)[A-Za-z0-9._~+/=-]+",
    re.IGNORECASE,
)

ExceptionInfo: TypeAlias = tuple[
    type[BaseException] | None,
    BaseException | None,
    TracebackType | None,
]


def redact_log_message(message: str) -> str:
    """Redact common credentials before a message reaches log sinks."""
    redacted = _SENSITIVE_QUERY_RE.sub(r"\1<redacted>", message)
    redacted = _SENSITIVE_ASSIGNMENT_RE.sub(r"\1<redacted>", redacted)
    return _BEARER_RE.sub(r"\1<redacted>", redacted)


def redact_log_exception(exc_info: ExceptionInfo) -> str:
    """Format and redact an exception without exposing its original message."""
    if not exc_info[0]:
        return ""
    rendered = "".join(traceback.format_exception(*exc_info))
    return redact_log_message(rendered)
