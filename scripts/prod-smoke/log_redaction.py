"""Pure log redaction shared by smoke orchestration and publishing CLIs.

This module must not import the runner, load environment files, or execute commands.
"""
from __future__ import annotations

import json
import re
import urllib.parse
from typing import Any


REDACTED_VALUE = "<redacted>"
SENSITIVE_FIELD_PATTERN = (
    r"(?:access_token|refresh_token|session[_-]?token|token|password|passwd|"
    r"(?:x[_-]?)?api[_-]?key|client_secret|authorization|cookie|set[_-]?cookie|secret)"
)
SENSITIVE_COLON_FIELD_PATTERN = (
    r"(?:access_token|refresh_token|session[_-]?token|password|passwd|"
    r"(?:x[_-]?)?api[_-]?key|client_secret|secret)"
)
SENSITIVE_ENV_KEY_PATTERN = re.compile(
    r"(?:^|_)(?:PASSWORD|PASSWD|TOKEN|API_KEY|PRIVATE_KEY|SECRET|"
    r"AUTHORIZATION|CREDENTIAL|COOKIE)(?:$|_)",
    re.IGNORECASE,
)
SENSITIVE_ENV_EXACT_KEYS = {
    "CELERY_BROKER_URL",
    "CELERY_RESULT_BACKEND",
    "DATABASE_URL",
    "REDIS_URL",
}
SAFE_DIAGNOSTIC_VALUES = {
    "<empty>",
    "<redacted>",
    "false",
    "invalid",
    "missing",
    "no",
    "none",
    "null",
    "present",
    "required",
    "set",
    "true",
    "unset",
    "yes",
}


def collect_sensitive_values(
    config: dict[str, str],
    extra_values: list[str] | None = None,
) -> list[str]:
    values: set[str] = set()
    for key, value in config.items():
        if key not in SENSITIVE_ENV_EXACT_KEYS and not SENSITIVE_ENV_KEY_PATTERN.search(key):
            continue
        text = str(value).strip()
        if len(text) >= 4 and text != REDACTED_VALUE:
            values.add(text)
    for value in extra_values or []:
        text = str(value).strip()
        if len(text) >= 4 and text != REDACTED_VALUE:
            values.add(text)
    return sorted(values, key=len, reverse=True)


def redact_command(command: list[str], sensitive_values: list[str] | None = None) -> list[str]:
    return [
        _redact_known_values(str(part), sensitive_values)
        for part in command
    ]


def _sensitive_value_variants(value: str) -> list[str]:
    variants = {
        value,
        urllib.parse.quote(value, safe=""),
        urllib.parse.quote_plus(value, safe=""),
        json.dumps(value, ensure_ascii=False)[1:-1],
    }
    return sorted(
        (item for item in variants if len(item) >= 4),
        key=len,
        reverse=True,
    )


def _redact_known_values(
    text: str,
    sensitive_values: list[str] | None = None,
) -> str:
    redacted = text
    variants: set[str] = set()
    for sensitive_value in sensitive_values or []:
        if sensitive_value:
            variants.update(_sensitive_value_variants(sensitive_value))
    for variant in sorted(variants, key=len, reverse=True):
        if len(variant) >= 8 or not variant.isalnum():
            redacted = redacted.replace(variant, REDACTED_VALUE)
            continue
        redacted = re.sub(
            rf"(?<![A-Za-z0-9]){re.escape(variant)}(?![A-Za-z0-9])",
            REDACTED_VALUE,
            redacted,
        )
    return redacted


def _redact_unquoted_field(match: re.Match[str]) -> str:
    value = match.group("value")
    if value.lower() in SAFE_DIAGNOSTIC_VALUES:
        return match.group(0)
    return f"{match.group('prefix')}{REDACTED_VALUE}"


def redact_sensitive_output(output: str, sensitive_values: list[str] | None = None) -> str:
    redacted = _redact_known_values(output, sensitive_values)
    redacted = re.sub(
        r"(\b[a-z][a-z0-9+.-]*://[^:/@\s]+:)[^@\s]+(@)",
        rf"\1{REDACTED_VALUE}\2",
        redacted,
        flags=re.IGNORECASE,
    )
    redacted = re.sub(
        r"(\b(?:Set-Cookie|Cookie)\s*:\s*)[^\r\n]+",
        rf"\1{REDACTED_VALUE}",
        redacted,
        flags=re.IGNORECASE,
    )
    redacted = re.sub(
        r"(\bAuthorization\s*:\s*(?:Bearer|Basic)\s+)[^\s,;\"']+",
        rf"\1{REDACTED_VALUE}",
        redacted,
        flags=re.IGNORECASE,
    )
    redacted = re.sub(
        rf"([?&]{SENSITIVE_FIELD_PATTERN}=)[^&\s\"']+",
        rf"\1{REDACTED_VALUE}",
        redacted,
        flags=re.IGNORECASE,
    )
    redacted = re.sub(
        r"(\b(?:Bearer|Basic)\s+)[A-Za-z0-9._~+/=-]{12,}",
        rf"\1{REDACTED_VALUE}",
        redacted,
        flags=re.IGNORECASE,
    )
    redacted = re.sub(
        r"\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b",
        REDACTED_VALUE,
        redacted,
    )
    redacted = re.sub(
        rf'(\\\"{SENSITIVE_FIELD_PATTERN}\\\"\s*:\s*\\\").*?(\\\")',
        rf"\1{REDACTED_VALUE}\2",
        redacted,
        flags=re.IGNORECASE,
    )
    redacted = re.sub(
        rf'("{SENSITIVE_FIELD_PATTERN}"\s*:\s*")[^"]*(")',
        rf"\1{REDACTED_VALUE}\2",
        redacted,
        flags=re.IGNORECASE,
    )
    redacted = re.sub(
        rf"('{SENSITIVE_FIELD_PATTERN}'\s*:\s*')[^']*(')",
        rf"\1{REDACTED_VALUE}\2",
        redacted,
        flags=re.IGNORECASE,
    )
    redacted = re.sub(
        rf'(?P<prefix>\b{SENSITIVE_FIELD_PATTERN}\s*[=:]\s*)'
        rf'"(?:\\.|[^"\\])*"',
        lambda match: f'{match.group("prefix")}"{REDACTED_VALUE}"',
        redacted,
        flags=re.IGNORECASE,
    )
    redacted = re.sub(
        rf"(?P<prefix>\b{SENSITIVE_FIELD_PATTERN}\s*[=:]\s*)"
        rf"'(?:\\.|[^'\\])*'",
        lambda match: f"{match.group('prefix')}'{REDACTED_VALUE}'",
        redacted,
        flags=re.IGNORECASE,
    )
    redacted = re.sub(
        rf"(?P<prefix>\b{SENSITIVE_FIELD_PATTERN}\s*=\s*)"
        rf"(?P<value>(?![\"'])[^&;\s,}}\]]+)",
        _redact_unquoted_field,
        redacted,
        flags=re.IGNORECASE,
    )
    redacted = re.sub(
        rf"(?P<prefix>\b{SENSITIVE_COLON_FIELD_PATTERN}\s*:\s*)"
        rf"(?P<value>(?![\"'])[^,\s}}\]]+)",
        _redact_unquoted_field,
        redacted,
        flags=re.IGNORECASE,
    )
    return redacted


def redact_sensitive_payload(
    payload: Any,
    sensitive_values: list[str] | None = None,
) -> Any:
    if isinstance(payload, str):
        return redact_sensitive_output(payload, sensitive_values)
    if isinstance(payload, list):
        return [
            redact_sensitive_payload(item, sensitive_values)
            for item in payload
        ]
    if isinstance(payload, tuple):
        return tuple(
            redact_sensitive_payload(item, sensitive_values)
            for item in payload
        )
    if isinstance(payload, dict):
        return {
            key: redact_sensitive_payload(value, sensitive_values)
            for key, value in payload.items()
        }
    return payload
