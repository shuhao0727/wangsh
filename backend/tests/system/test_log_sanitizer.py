import subprocess
import sys
from pathlib import Path

import pytest

from app.core.log_sanitizer import redact_log_exception, redact_log_message


BACKEND_ROOT = Path(__file__).resolve().parents[2]


def _run_backend_python(code: str, *, timeout: float = 10.0) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-c", code],
        cwd=BACKEND_ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def test_installer_uses_public_loguru_configuration_only():
    source = (BACKEND_ROOT / "app/core/log_sanitizer.py").read_text()
    celery_source = (BACKEND_ROOT / "app/core/celery_app.py").read_text()

    assert "logger.configure(patcher=sanitize_loguru_record)" in source
    assert "logger._core" not in source
    assert "setup_logging" not in celery_source
    assert "after_setup_logger" in celery_source
    assert "after_setup_task_logger" in celery_source


def test_redact_log_message_removes_sensitive_query_parameters():
    message = (
        "GET /api/v1/admin/stream?token=header.payload.signature&mode=live "
        "GET /api/v1/auth?access_token=access-secret&refresh_token=refresh-secret"
    )

    redacted = redact_log_message(message)

    assert "header.payload.signature" not in redacted
    assert "access-secret" not in redacted
    assert "refresh-secret" not in redacted
    assert "?token=<redacted>&mode=live" in redacted
    assert "?access_token=<redacted>&refresh_token=<redacted>" in redacted


def test_redact_log_message_removes_headers_and_assignments():
    message = (
        "Authorization: Bearer header.payload.signature\n"
        "api_key='provider-secret' password=plain-secret"
    )

    redacted = redact_log_message(message)

    assert "header.payload.signature" not in redacted
    assert "provider-secret" not in redacted
    assert "plain-secret" not in redacted
    assert "Bearer <redacted>" in redacted
    assert "api_key='<redacted>'" in redacted
    assert "password=<redacted>" in redacted


def test_redact_log_message_removes_url_userinfo_passwords():
    message = (
        "database=postgresql://user:database-secret@db:5432/app "
        "async=postgresql+asyncpg://user:async-secret@db/app "
        "redis=redis://:redis-secret@redis:6379/0 "
        "broker=amqp://worker:celery-secret@rabbitmq:5672/vhost "
        "public=https://reader@example.com/docs"
    )

    redacted = redact_log_message(message)

    for secret in (
        "database-secret",
        "async-secret",
        "redis-secret",
        "celery-secret",
    ):
        assert secret not in redacted
    assert "postgresql://user:<redacted>@db:5432/app" in redacted
    assert "postgresql+asyncpg://user:<redacted>@db/app" in redacted
    assert "redis://:<redacted>@redis:6379/0" in redacted
    assert "amqp://worker:<redacted>@rabbitmq:5672/vhost" in redacted
    assert "https://reader@example.com/docs" in redacted


def test_redact_log_message_handles_escaped_structured_logs():
    message = (
        r'{\"password\":\"escaped-password\",'
        r'\"x-api-key\":\"escaped-api-key\",'
        r'\"Authorization\":\"Token escaped-auth\",'
        r'\"Proxy-Authorization\":\"Digest realm=\\\"escaped-realm\\\"\",'
        r'\"Cookie\":\"session=escaped-cookie\"}'
    )

    redacted = redact_log_message(message)

    for secret in (
        "escaped-password",
        "escaped-api-key",
        "escaped-auth",
        "escaped-realm",
        "escaped-cookie",
    ):
        assert secret not in redacted
    assert r'\"password\":\"<redacted>\"' in redacted
    assert r'\"x-api-key\":\"<redacted>\"' in redacted
    assert r'\"Authorization\":\"Token <redacted>\"' in redacted
    assert r'\"Proxy-Authorization\":\"Digest <redacted>\"' in redacted
    assert r'\"Cookie\":\"<redacted>\"' in redacted


def test_redact_log_message_handles_double_escaped_structured_logs():
    message = (
        r'{\\"password\\":\\"double-password\\",'
        r'\\"Authorization\\":\\"Bearer double-bearer\\"}'
    )

    redacted = redact_log_message(message)

    assert "double-password" not in redacted
    assert "double-bearer" not in redacted
    assert r'\\"password\\":\\"<redacted>\\"' in redacted
    assert r'\\"Authorization\\":\\"Bearer <redacted>\\"' in redacted


def test_redact_log_message_uses_controlled_sensitive_key_suffixes():
    message = (
        "x-api-key=hyphen-key x_api_key=underscore-key "
        "new_password=new-secret admin_password=admin-secret "
        "plain_password=plain-secret POSTGRES_PASSWORD=postgres-secret "
        "GITHUB_SYNC_TOKEN=github-secret CLIENT_SECRET=client-secret "
        "token_budget=20 password_policy=enabled secret_sauce=public "
        "GET /config?x-api-key=query-key&POSTGRES_PASSWORD=query-db-secret"
        "&token_budget=20"
    )

    redacted = redact_log_message(message)

    for secret in (
        "hyphen-key",
        "underscore-key",
        "new-secret",
        "admin-secret",
        "plain-secret",
        "postgres-secret",
        "github-secret",
        "client-secret",
        "query-key",
        "query-db-secret",
    ):
        assert secret not in redacted
    assert "token_budget=20" in redacted
    assert "password_policy=enabled" in redacted
    assert "secret_sauce=public" in redacted


def test_redact_log_message_handles_camel_case_sensitive_keys():
    message = (
        '{"accessToken":"access-secret","clientSecret":"client-secret",'
        '"apiKey":"api-secret","privateKey":"private-secret",'
        '"encryptionKey":"encryption-secret","accessKey":"access-key-secret",'
        '"credentials":"credential-secret","tokenBudget":20,'
        '"passwordPolicy":"enabled","secretSauce":"public",'
        '"publicKey":"public-value","queryKey":"query-value"} '
        "GET /config?accessToken=query-access&clientSecret=query-client"
        "&apiKey=query-api&privateKey=query-private"
        "&publicKey=query-public&queryKey=query-name&tokenBudget=20"
    )

    redacted = redact_log_message(message)

    for secret in (
        "access-secret",
        "client-secret",
        "api-secret",
        "query-access",
        "query-client",
        "query-api",
        "private-secret",
        "encryption-secret",
        "access-key-secret",
        "credential-secret",
        "query-private",
    ):
        assert secret not in redacted
    assert '"accessToken":"<redacted>"' in redacted
    assert '"clientSecret":"<redacted>"' in redacted
    assert '"apiKey":"<redacted>"' in redacted
    assert '"privateKey":"<redacted>"' in redacted
    assert '"encryptionKey":"<redacted>"' in redacted
    assert '"accessKey":"<redacted>"' in redacted
    assert '"credentials":"<redacted>"' in redacted
    assert "tokenBudget=20" in redacted
    assert '"passwordPolicy":"enabled"' in redacted
    assert '"secretSauce":"public"' in redacted
    assert '"publicKey":"public-value"' in redacted
    assert '"queryKey":"query-value"' in redacted
    assert "publicKey=query-public" in redacted
    assert "queryKey=query-name" in redacted


def test_redact_log_message_handles_structured_values_and_auth_headers():
    message = (
        '{"client_secret": "json-secret", "session_token": "session-secret"} '
        "{'client_secret': 'python-secret'}\n"
        "Cookie: session=cookie-secret; csrftoken=csrf-secret\n"
        "Authorization: Basic dXNlcjpwYXNzd29yZA==\n"
        "Proxy-Authorization: Bearer proxy.bearer.secret\n"
        'headers={"Authorization": "Bearer dict.bearer.secret", '
        '"Cookie": "dict-cookie-secret"}\n'
        '-H "Cookie: curl-cookie-secret"'
    )

    redacted = redact_log_message(message)

    for secret in (
        "json-secret",
        "session-secret",
        "python-secret",
        "cookie-secret",
        "csrf-secret",
        "dXNlcjpwYXNzd29yZA==",
        "proxy.bearer.secret",
        "dict.bearer.secret",
        "dict-cookie-secret",
        "curl-cookie-secret",
    ):
        assert secret not in redacted
    assert '"client_secret": "<redacted>"' in redacted
    assert '"session_token": "<redacted>"' in redacted
    assert "'client_secret': '<redacted>'" in redacted
    assert "Cookie: <redacted>" in redacted
    assert "Basic <redacted>" in redacted
    assert "Bearer <redacted>" in redacted


def test_redact_log_message_handles_arbitrary_auth_schemes_and_folding():
    message = (
        "Authorization: Token token-scheme-secret\n"
        'Proxy-Authorization: Digest username="admin", nonce="digest-secret"\n'
        "Authorization: AWS4-HMAC-SHA256 "
        "Credential=access-key/20260722/region/service/aws4_request, "
        "SignedHeaders=host;x-amz-date, Signature=aws-signature-secret\n"
        'Authorization: Digest username="folded",\r\n'
        ' nonce="folded-secret"\r\n'
        'Authorization: Digest username="truncated", nonce="truncated-secret\n'
        "next: visible\n"
        '{"Authorization": "Custom custom-scheme-secret"}\n'
        '-H "Proxy-Authorization: Negotiate negotiate-secret"'
    )

    redacted = redact_log_message(message)

    for secret in (
        "token-scheme-secret",
        "digest-secret",
        "aws-signature-secret",
        "folded-secret",
        "truncated-secret",
        "custom-scheme-secret",
        "negotiate-secret",
    ):
        assert secret not in redacted
    assert "Authorization: Token <redacted>" in redacted
    assert "Proxy-Authorization: Digest <redacted>" in redacted
    assert "Authorization: AWS4-HMAC-SHA256 <redacted>" in redacted
    assert "Authorization: Digest <redacted>" in redacted
    assert '"Authorization": "Custom <redacted>"' in redacted
    assert '-H "Proxy-Authorization: Negotiate <redacted>"' in redacted
    assert "next: visible" in redacted


def test_redact_log_message_handles_multiline_escaped_and_truncated_values():
    message = (
        '{"password": "first line\nsecond line", '
        '"client_secret": "escaped \\"quote\\" and \\\\ slash", '
        "'session_token': 'escaped \\'single\\' quote'}\n"
        'api_key="truncated-secret\\'
    )

    redacted = redact_log_message(message)

    for secret in (
        "first line",
        "second line",
        "escaped",
        "quote",
        "single",
        "truncated-secret",
    ):
        assert secret not in redacted
    assert '"password": "<redacted>"' in redacted
    assert '"client_secret": "<redacted>"' in redacted
    assert "'session_token': '<redacted>'" in redacted
    assert redacted.endswith('api_key="<redacted>')


@pytest.mark.parametrize(
    "message",
    [
        "The bearer token format is documented",
        "Browser supports Cookie: enabled",
        'The literal "Cookie: enabled" is documentation',
        "Authorization: Bearer examples are documented prose",
        "The token budget is 20, the cookie policy is enabled, "
        "and Basic authentication documentation is public.",
    ],
)
def test_redact_log_message_preserves_ordinary_text(message):
    assert redact_log_message(message) == message


def test_redact_log_message_handles_one_megabyte_inputs_within_time_limit():
    code = """
from time import perf_counter

from app.core.log_sanitizer import redact_log_message

size = 1024 * 1024
plain_unterminated = 'client_secret="' + ('x' * size)
escaped_structured = (
    r'{\\"client_secret\\":\\"' + ('x' * size) + r'\\"}'
)
prose_unit = 'Documentation Authorization: Bearer examples are documented prose. '
ordinary_prose = (prose_unit * ((size // len(prose_unit)) + 1))[:size]

for message in (plain_unterminated, escaped_structured):
    started = perf_counter()
    redacted = redact_log_message(message)
    assert perf_counter() - started < 1.0
    assert 'x' not in redacted
    assert '<redacted>' in redacted

started = perf_counter()
redacted_prose = redact_log_message(ordinary_prose)
assert perf_counter() - started < 1.0
assert redacted_prose == ordinary_prose
"""

    try:
        result = _run_backend_python(code, timeout=4.0)
    except subprocess.TimeoutExpired:
        pytest.fail("one-megabyte sanitization exceeded the runtime boundary")

    assert result.returncode == 0, result.stderr


def test_redact_log_exception_sanitizes_exception_message_and_traceback():
    try:
        raise RuntimeError(
            "upstream failed: token=exception-secret\n"
            "Authorization: Bearer exception.bearer.secret"
        )
    except RuntimeError:
        redacted = redact_log_exception(sys.exc_info())

    assert "exception-secret" not in redacted
    assert "exception.bearer.secret" not in redacted
    assert "token=<redacted>" in redacted
    assert "Bearer <redacted>" in redacted
    assert "RuntimeError" in redacted


def test_standard_logging_bridge_is_idempotent_and_emits_each_record_once():
    code = """
import logging

from loguru import logger

from app.core.log_sanitizer import install_log_sanitization

install_log_sanitization()
root_handler = logging.getLogger().handlers[0]
logger.configure(patcher=lambda record: None)
install_log_sanitization()
assert logging.getLogger().handlers == [root_handler]

messages = []
sink_id = logger.add(messages.append, format='{level}|{message}')
try:
    logger.warning('client_secret=restored-patcher-secret')
    logging.getLogger('celery.worker').warning(
        'worker rejected password=bridge-secret'
    )
finally:
    logger.remove(sink_id)

output = ''.join(messages)
assert 'restored-patcher-secret' not in output
assert output.count('WARNING|client_secret=<redacted>') == 1
assert 'bridge-secret' not in output
assert output.count('WARNING|worker rejected password=<redacted>') == 1
"""

    result = _run_backend_python(code)

    assert result.returncode == 0, result.stderr


def test_standard_logging_bridge_preserves_application_caller():
    code = """
import logging

from loguru import logger

from app.core.log_sanitizer import install_log_sanitization

install_log_sanitization()
records = []
sink_id = logger.add(lambda message: records.append(message.record))
try:
    def emit_from_application():
        logging.getLogger('third_party.client').warning(
            'password=caller-source-secret'
        )

    emit_from_application()
finally:
    logger.remove(sink_id)

record = records[-1]
assert record['function'] == 'emit_from_application', record
assert record['message'] == 'password=<redacted>'
"""

    result = _run_backend_python(code)

    assert result.returncode == 0, result.stderr


def test_standard_logging_bridge_preserves_stacklevel_caller():
    code = """
import inspect
import logging

from loguru import logger

from app.core.log_sanitizer import install_log_sanitization

install_log_sanitization()
records = []
sink_id = logger.add(lambda message: records.append(message.record))
try:
    def logging_wrapper():
        logging.getLogger('third_party.client').warning(
            'password=stacklevel-secret',
            stacklevel=2,
        )

    def emit_from_application():
        frame = inspect.currentframe()
        expected_path = frame.f_code.co_filename
        expected_line = inspect.currentframe().f_lineno + 1
        logging_wrapper()
        return expected_line, expected_path

    expected_line, expected_path = emit_from_application()
finally:
    logger.remove(sink_id)

record = records[-1]
assert record['function'] == 'emit_from_application', record
assert record['line'] == expected_line, record
assert record['file'].path == expected_path, record
assert record['message'] == 'password=<redacted>'
"""

    result = _run_backend_python(code)

    assert result.returncode == 0, result.stderr


def test_direct_loguru_exception_chain_is_sanitized_once():
    code = """
from loguru import logger

from app.core.log_sanitizer import install_log_sanitization

install_log_sanitization()
messages = []
sink_id = logger.add(
    messages.append,
    format='{level}|{message}',
    backtrace=False,
    diagnose=False,
)
try:
    try:
        try:
            raise ValueError('password=inner-loguru-secret')
        except ValueError as exc:
            raise RuntimeError('client_secret=outer-loguru-secret') from exc
    except RuntimeError:
        logger.exception("request failed session_token='message-loguru-secret'")
finally:
    logger.remove(sink_id)

output = ''.join(messages)
for secret in (
    'inner-loguru-secret',
    'outer-loguru-secret',
    'message-loguru-secret',
):
    assert secret not in output
assert output.count('ValueError: password=<redacted>') == 1
assert output.count('RuntimeError: client_secret=<redacted>') == 1
assert output.count('The above exception was the direct cause') == 1
assert output.count("ERROR|request failed session_token='<redacted>'") == 1
"""

    result = _run_backend_python(code)

    assert result.returncode == 0, result.stderr


def test_standard_logging_exception_chain_is_sanitized_once():
    code = """
import logging

from loguru import logger

from app.core.log_sanitizer import install_log_sanitization

install_log_sanitization()
messages = []
sink_id = logger.add(
    messages.append,
    format='{level}|{message}',
    backtrace=False,
    diagnose=False,
)
try:
    try:
        try:
            raise ValueError('password=inner-stdlib-secret')
        except ValueError as exc:
            raise RuntimeError('api_key=outer-stdlib-secret') from exc
    except RuntimeError:
        logging.getLogger('third_party.client').exception(
            'request failed session_token=message-stdlib-secret'
        )
finally:
    logger.remove(sink_id)

output = ''.join(messages)
for secret in (
    'inner-stdlib-secret',
    'outer-stdlib-secret',
    'message-stdlib-secret',
):
    assert secret not in output
assert output.count('ValueError: password=<redacted>') == 1
assert output.count('RuntimeError: api_key=<redacted>') == 1
assert output.count('The above exception was the direct cause') == 1
assert output.count('ERROR|request failed session_token=<redacted>') == 1
"""

    result = _run_backend_python(code)

    assert result.returncode == 0, result.stderr


def test_fastapi_main_installs_sanitization_in_isolated_process():
    code = """
from loguru import logger
import main

messages = []
sink_id = logger.add(messages.append, format='{message}')
try:
    logger.warning('client_secret="fastapi-entry-secret"')
finally:
    logger.remove(sink_id)

output = ''.join(messages)
assert 'fastapi-entry-secret' not in output
assert 'client_secret="<redacted>"' in output
"""

    result = _run_backend_python(code)

    assert result.returncode == 0, result.stderr


def test_celery_worker_entry_installs_sanitization_in_isolated_process():
    code = """
import io
import logging

from celery.signals import after_setup_logger, after_setup_task_logger
from loguru import logger

from app.celery_app import celery

root = logging.getLogger()
original_stream = io.StringIO()
original_handler = logging.StreamHandler(original_stream)
original_handler.setLevel(logging.ERROR)
original_formatter = logging.Formatter('ROOT|%(levelname)s|%(message)s')
original_handler.setFormatter(original_formatter)
root.handlers = [original_handler]
root.setLevel(logging.WARNING)

loguru_messages = []
sink_id = logger.add(loguru_messages.append, format='{message}')
try:
    logger.warning('api_key=celery-import-secret')
finally:
    logger.remove(sink_id)

assert 'celery-import-secret' not in ''.join(loguru_messages)
assert root.handlers == [original_handler]
assert root.level == logging.WARNING

after_setup_logger.send(
    sender=celery,
    logger=root,
    loglevel=logging.INFO,
    logfile='/tmp/celery.log',
    format='ROOT|%(levelname)s|%(message)s',
    colorize=False,
)

assert root.handlers == [original_handler]
assert root.level == logging.WARNING
assert original_handler.level == logging.ERROR
assert original_handler.formatter is original_formatter

root.error('POSTGRES_PASSWORD=%s', 'celery-root-secret')
root_output = original_stream.getvalue()
assert 'celery-root-secret' not in root_output
assert 'POSTGRES_PASSWORD=<redacted>' in root_output

task_stream = io.StringIO()
task_handler = logging.StreamHandler(task_stream)
task_handler.setLevel(logging.WARNING)
task_formatter = logging.Formatter('TASK|%(levelname)s|%(message)s')
task_handler.setFormatter(task_formatter)
task_logger = logging.getLogger('celery.task.contract')
task_logger.handlers = [task_handler]
task_logger.setLevel(logging.INFO)
task_logger.propagate = False

after_setup_task_logger.send(
    sender=celery,
    logger=task_logger,
    loglevel=logging.INFO,
    logfile='/tmp/celery-task.log',
    format='TASK|%(levelname)s|%(message)s',
    colorize=False,
)

assert task_logger.handlers == [task_handler]
assert task_logger.level == logging.INFO
assert task_handler.level == logging.WARNING
assert task_handler.formatter is task_formatter

try:
    raise RuntimeError('admin_password=celery-task-exception')
except RuntimeError:
    task_logger.exception(
        'x-api-key=%s',
        'celery-task-message',
    )

task_output = task_stream.getvalue()
assert 'celery-task-message' not in task_output
assert 'celery-task-exception' not in task_output
assert task_output.count('RuntimeError: admin_password=<redacted>') == 1
assert task_output.count('x-api-key=<redacted>') == 1
"""

    result = _run_backend_python(code)

    assert result.returncode == 0, result.stderr
