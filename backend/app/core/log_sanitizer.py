"""Public log sanitization facade and logging framework integrations."""

import logging
import threading
import traceback
from types import TracebackType
from typing import Any, TypeAlias

from loguru import logger

from app.core.log_redaction import redact_log_message as _redact_log_message


_INTERCEPTED_LOGGERS = (
    "uvicorn",
    "uvicorn.error",
    "uvicorn.access",
    "sqlalchemy",
    "celery",
    "passlib",
)
_INTERCEPT_GUARD = threading.local()
_INSTALL_LOCK = threading.RLock()
_STANDARD_LOGGING_INSTALLED = False

ExceptionInfo: TypeAlias = tuple[
    type[BaseException] | None,
    BaseException | None,
    TracebackType | None,
]


def redact_log_message(message: str) -> str:
    """Redact credentials while preserving the historical public import path."""
    return _redact_log_message(message)


def redact_log_exception(exc_info: ExceptionInfo) -> str:
    """Format and redact an exception without exposing its original message."""
    if not exc_info[0]:
        return ""
    rendered = "".join(traceback.format_exception(*exc_info))
    return redact_log_message(rendered)


def sanitize_loguru_record(record: dict[str, Any]) -> None:
    """Sanitize a Loguru record before its configured sinks render it."""
    record["message"] = redact_log_message(str(record["message"]))
    exception = record.get("exception")
    if not exception:
        return

    exc_info: ExceptionInfo = (
        exception.type,
        exception.value,
        exception.traceback,
    )
    exception_text = redact_log_exception(exc_info).rstrip()
    if exception_text:
        separator = "\n" if record["message"] else ""
        record["message"] = f"{record['message']}{separator}{exception_text}"
    record["exception"] = None


class SanitizingFilter(logging.Filter):
    """Sanitize a standard logging record without changing handler routing."""

    def filter(self, record: logging.LogRecord) -> bool:
        message = redact_log_message(record.getMessage())

        exception_text = ""
        if record.exc_info:
            exception_text = redact_log_exception(record.exc_info).rstrip()
        elif record.exc_text:
            exception_text = redact_log_message(record.exc_text).rstrip()

        if exception_text:
            separator = "\n" if message else ""
            message = f"{message}{separator}{exception_text}"

        record.msg = message
        record.args = ()
        record.exc_info = None
        record.exc_text = None
        if record.stack_info:
            record.stack_info = redact_log_message(record.stack_info)
        return True


_SANITIZING_FILTER = SanitizingFilter()


def add_sanitizing_filter(target_logger: logging.Logger) -> None:
    """Attach the shared filter to existing handlers without replacing them."""
    for handler in target_logger.handlers:
        if not any(
            isinstance(existing_filter, SanitizingFilter)
            for existing_filter in handler.filters
        ):
            handler.addFilter(_SANITIZING_FILTER)


def _restore_standard_logging_source(
    target: dict[str, Any],
    source: logging.LogRecord,
) -> None:
    """Use the caller location already resolved by standard logging."""
    target["name"] = source.name
    target["function"] = source.funcName
    target["line"] = source.lineno
    target["module"] = source.module
    target["file"].name = source.filename
    target["file"].path = source.pathname


class _InterceptHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        if getattr(_INTERCEPT_GUARD, "active", False):
            return

        _INTERCEPT_GUARD.active = True
        try:
            try:
                level: str | int = logger.level(record.levelname).name
            except ValueError:
                level = record.levelno

            message = redact_log_message(record.getMessage())
            if record.exc_info:
                exception_text = redact_log_exception(record.exc_info).rstrip()
                if exception_text:
                    separator = "\n" if message else ""
                    message = f"{message}{separator}{exception_text}"

            logger.patch(
                lambda target: _restore_standard_logging_source(target, record)
            ).log(level, message)
        finally:
            _INTERCEPT_GUARD.active = False


def install_loguru_sanitization() -> None:
    """Install the public Loguru patcher."""
    with _INSTALL_LOCK:
        logger.configure(patcher=sanitize_loguru_record)


def install_log_sanitization() -> None:
    """Refresh Loguru sanitization and install the logging bridge once."""
    global _STANDARD_LOGGING_INSTALLED

    with _INSTALL_LOCK:
        logger.configure(patcher=sanitize_loguru_record)
        if _STANDARD_LOGGING_INSTALLED:
            return

        intercept_handler = _InterceptHandler()
        root_logger = logging.getLogger()
        root_logger.handlers = [intercept_handler]
        root_logger.setLevel(logging.NOTSET)

        for name in _INTERCEPTED_LOGGERS:
            target = logging.getLogger(name)
            target.handlers = [intercept_handler]
            target.propagate = False

        _STANDARD_LOGGING_INSTALLED = True
