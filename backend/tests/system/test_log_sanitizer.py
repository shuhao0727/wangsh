import sys

from app.core.log_sanitizer import redact_log_exception, redact_log_message


def test_redact_log_message_removes_sensitive_query_parameters():
    message = (
        'GET /api/v1/admin/stream?token=header.payload.signature&mode=live '
        'GET /api/v1/auth?access_token=access-secret&refresh_token=refresh-secret'
    )

    redacted = redact_log_message(message)

    assert "header.payload.signature" not in redacted
    assert "access-secret" not in redacted
    assert "refresh-secret" not in redacted
    assert "?token=<redacted>&mode=live" in redacted
    assert "?access_token=<redacted>&refresh_token=<redacted>" in redacted


def test_redact_log_message_removes_headers_and_assignments():
    message = (
        "Authorization: Bearer header.payload.signature "
        "api_key='provider-secret' password=plain-secret"
    )

    redacted = redact_log_message(message)

    assert "header.payload.signature" not in redacted
    assert "provider-secret" not in redacted
    assert "plain-secret" not in redacted
    assert "Bearer <redacted>" in redacted
    assert "api_key=<redacted>" in redacted  # 引号已被脱敏正则完整移除
    assert "password=<redacted>" in redacted


def test_redact_log_exception_sanitizes_exception_message_and_traceback():
    try:
        raise RuntimeError(
            "upstream failed: token=exception-secret "
            "Authorization: Bearer exception.bearer.secret"
        )
    except RuntimeError:
        redacted = redact_log_exception(sys.exc_info())

    assert "exception-secret" not in redacted
    assert "exception.bearer.secret" not in redacted
    assert "token=<redacted>" in redacted
    assert "Bearer <redacted>" in redacted
    assert "RuntimeError" in redacted
