"""Pure text redaction rules used by application logging integrations."""

import re
from dataclasses import dataclass


_REDACTED = "<redacted>"
_SENSITIVE_KEY_SUFFIXES = (
    "password",
    "passwd",
    "passphrase",
    "token",
    "secret",
    "api_key",
    "private_key",
    "secret_key",
    "encryption_key",
    "access_key",
    "credential",
    "credentials",
)
_IDENTIFIER_RE = re.compile(
    r"(?<![A-Za-z0-9_-])(?P<key>[A-Za-z][A-Za-z0-9_-]*)(?![A-Za-z0-9_-])"
)
_QUERY_PARAMETER_RE = re.compile(
    r"(?P<prefix>[?&])(?P<key>[A-Za-z][A-Za-z0-9_-]*)=(?P<value>[^&\s#]*)"
)
_URL_SCHEME_RE = re.compile(
    r"(?<![A-Za-z0-9+.-])[A-Za-z][A-Za-z0-9+.-]*://"
)
_AUTH_HEADER_NAME_RE = re.compile(
    r"(?<![A-Za-z0-9_-])(?:proxy-authorization|authorization)"
    r"(?![A-Za-z0-9_-])",
    re.IGNORECASE,
)
_COOKIE_HEADER_NAME_RE = re.compile(
    r"(?<![A-Za-z0-9_-])(?:set-cookie|cookie)(?![A-Za-z0-9_-])",
    re.IGNORECASE,
)
_AUTH_SCHEME_RE = re.compile(r"[A-Za-z][A-Za-z0-9!#$%&'*+\-.^_`|~]*")
_ESCAPED_QUOTE_RE = re.compile(r"\\+([\"'])")
_UNQUOTED_VALUE_TERMINATORS = frozenset("&,;}]'\"")
_URL_AUTHORITY_TERMINATORS = frozenset("/?#")
_CAMEL_CASE_BOUNDARY_RE = re.compile(r"(?<=[a-z0-9])(?=[A-Z])")
_ACRONYM_BOUNDARY_RE = re.compile(r"(?<=[A-Z])(?=[A-Z][a-z])")


@dataclass(frozen=True)
class _Replacement:
    start: int
    end: int
    text: str


@dataclass(frozen=True)
class _HeaderKey:
    delimiter: int
    quote_token: str | None
    quoted: bool


@dataclass(frozen=True)
class _HeaderValueSpan:
    start: int
    end: int


def _is_sensitive_key(key: str) -> bool:
    normalized = _CAMEL_CASE_BOUNDARY_RE.sub("_", key)
    normalized = _ACRONYM_BOUNDARY_RE.sub("_", normalized)
    normalized = normalized.lower().replace("-", "_")
    return normalized in _SENSITIVE_KEY_SUFFIXES or any(
        normalized.endswith(f"_{suffix}")
        for suffix in _SENSITIVE_KEY_SUFFIXES
    )


def _redact_query_parameter(match: re.Match[str]) -> str:
    if not _is_sensitive_key(match.group("key")):
        return match.group(0)
    return f"{match.group('prefix')}{match.group('key')}={_REDACTED}"


def _find_url_authority_end(message: str, start: int) -> int:
    cursor = start
    while cursor < len(message):
        character = message[cursor]
        if character.isspace() or character in _URL_AUTHORITY_TERMINATORS:
            break
        cursor += 1
    return cursor


def _redact_url_userinfo_passwords(message: str) -> str:
    parts: list[str] = []
    output_cursor = 0
    search_cursor = 0

    while match := _URL_SCHEME_RE.search(message, search_cursor):
        authority_start = match.end()
        authority_end = _find_url_authority_end(message, authority_start)
        userinfo_end = message.rfind("@", authority_start, authority_end)
        if userinfo_end < 0:
            search_cursor = authority_end
            continue

        password_delimiter = message.find(
            ":", authority_start, userinfo_end
        )
        if password_delimiter < 0:
            search_cursor = userinfo_end + 1
            continue

        parts.append(message[output_cursor:password_delimiter + 1])
        parts.append(_REDACTED)
        output_cursor = userinfo_end
        search_cursor = userinfo_end + 1

    parts.append(message[output_cursor:])
    return "".join(parts)


def _skip_inline_whitespace(message: str, cursor: int) -> int:
    while cursor < len(message) and message[cursor] in " \t":
        cursor += 1
    return cursor


def _quote_token_at(message: str, index: int) -> str | None:
    if index >= len(message):
        return None
    if message[index] in "\"'":
        return message[index]
    if message[index] == "\\":
        cursor = index
        while cursor < len(message) and message[cursor] == "\\":
            cursor += 1
        if cursor < len(message) and message[cursor] in "\"'":
            return message[index:cursor + 1]
    return None


def _quote_token_before(message: str, index: int) -> str | None:
    if index < 1 or message[index - 1] not in "\"'":
        return None

    cursor = index - 1
    while cursor > 0 and message[cursor - 1] == "\\":
        cursor -= 1
    if cursor == index - 1:
        return message[index - 1]
    return message[cursor:index]


def _is_escaped_quote_boundary(message: str, index: int) -> bool:
    if index >= len(message):
        return True
    return message[index] in ",}]&;\r\n"


def _find_plain_closing_quote(
    message: str, start: int, quote_token: str
) -> int | None:
    index = start
    while index < len(message):
        character = message[index]
        if character == "\\":
            index += 2
            continue
        if character == quote_token:
            return index
        index += 1
    return None


def _find_escaped_closing_quote(
    message: str, start: int, quote_token: str
) -> int | None:
    quote = quote_token[-1]
    expected_slashes = len(quote_token) - 1
    index = start
    while index < len(message):
        if message[index] != quote:
            index += 1
            continue

        slash_start = index - 1
        while slash_start >= start and message[slash_start] == "\\":
            slash_start -= 1
        slash_count = index - slash_start - 1
        if (
            slash_count == expected_slashes
            and _is_escaped_quote_boundary(message, index + 1)
        ):
            return index - expected_slashes
        index += 1
    return None


def _find_closing_quote(
    message: str, start: int, quote_token: str
) -> int | None:
    if len(quote_token) == 1:
        return _find_plain_closing_quote(message, start, quote_token)
    return _find_escaped_closing_quote(message, start, quote_token)


def _find_unquoted_end(message: str, start: int) -> int:
    index = start
    while index < len(message):
        character = message[index]
        if character.isspace() or character in _UNQUOTED_VALUE_TERMINATORS:
            break
        index += 1
    return index


def _assignment_value_start(
    message: str, match: re.Match[str]
) -> int | None:
    delimiter = match.end()
    key_quote = _quote_token_before(message, match.start())
    if key_quote and message.startswith(key_quote, delimiter):
        delimiter += len(key_quote)

    delimiter = _skip_inline_whitespace(message, delimiter)
    if delimiter >= len(message) or message[delimiter] not in ":=":
        return None

    value_start = delimiter + 1
    while value_start < len(message) and message[value_start].isspace():
        value_start += 1
    if value_start >= len(message):
        return None
    return value_start


def _quoted_replacement(
    message: str, value_start: int, quote_token: str
) -> _Replacement:
    content_start = value_start + len(quote_token)
    closing_quote = _find_closing_quote(message, content_start, quote_token)
    if closing_quote is None:
        return _Replacement(
            start=value_start,
            end=len(message),
            text=f"{quote_token}{_REDACTED}",
        )
    return _Replacement(
        start=value_start,
        end=closing_quote + len(quote_token),
        text=f"{quote_token}{_REDACTED}{quote_token}",
    )


def _assignment_replacement(
    message: str, value_start: int
) -> _Replacement | None:
    quote_token = _quote_token_at(message, value_start)
    if quote_token is not None:
        return _quoted_replacement(message, value_start, quote_token)

    value_end = _find_unquoted_end(message, value_start)
    if value_end == value_start:
        return None
    return _Replacement(value_start, value_end, _REDACTED)


def _redact_assignments(message: str) -> str:
    parts: list[str] = []
    output_cursor = 0
    search_cursor = 0

    while match := _IDENTIFIER_RE.search(message, search_cursor):
        search_cursor = match.end()
        if not _is_sensitive_key(match.group("key")):
            continue

        value_start = _assignment_value_start(message, match)
        if value_start is None:
            continue

        replacement = _assignment_replacement(message, value_start)
        if replacement is None:
            continue

        parts.append(message[output_cursor:replacement.start])
        parts.append(replacement.text)
        output_cursor = replacement.end
        search_cursor = replacement.end

    parts.append(message[output_cursor:])
    return "".join(parts)


def _line_header_context(message: str, name_start: int) -> bool:
    cursor = name_start - 1
    while cursor >= 0 and message[cursor] in " \t<>":
        cursor -= 1
    return cursor < 0 or message[cursor] in "\r\n"


def _previous_non_whitespace(message: str, index: int) -> str | None:
    cursor = index - 1
    while cursor >= 0 and message[cursor] in " \t":
        cursor -= 1
    return message[cursor] if cursor >= 0 else None


def _curl_header_context(
    message: str,
    name_start: int,
    quote_token: str | None,
) -> bool:
    if quote_token is None:
        return False

    quote_start = name_start - len(quote_token)
    option_end = quote_start
    while option_end > 0 and message[option_end - 1] in " \t":
        option_end -= 1

    for option in ("-H", "--header"):
        option_start = option_end - len(option)
        if option_start < 0:
            continue
        if message[option_start:option_end] != option:
            continue
        if option_start == 0 or message[option_start - 1].isspace():
            return True
    return False


def _find_folded_header_end(message: str, start: int) -> int:
    cursor = start
    while True:
        carriage_return = message.find("\r", cursor)
        line_feed = message.find("\n", cursor)
        candidates = [
            position for position in (carriage_return, line_feed) if position >= 0
        ]
        if not candidates:
            return len(message)

        line_end = min(candidates)
        next_line = line_end + 1
        if (
            message[line_end] == "\r"
            and next_line < len(message)
            and message[next_line] == "\n"
        ):
            next_line += 1

        if next_line < len(message) and message[next_line] in " \t":
            cursor = next_line
            continue
        return line_end


def _find_structured_header_end(message: str, start: int) -> int:
    cursor = start
    while cursor < len(message):
        if message[cursor] in ",}]\r\n":
            break
        cursor += 1
    return cursor


def _parse_header_key(
    message: str, name_start: int, name_end: int
) -> _HeaderKey | None:
    quote_token = _quote_token_before(message, name_start)
    cursor = name_end
    quoted = bool(quote_token and message.startswith(quote_token, cursor))
    if quoted:
        cursor += len(quote_token or "")

    cursor = _skip_inline_whitespace(message, cursor)
    if cursor >= len(message) or message[cursor] != ":":
        return None
    return _HeaderKey(cursor, quote_token, quoted)


def _header_context(
    message: str,
    name_start: int,
    key: _HeaderKey,
) -> str | None:
    if _line_header_context(message, name_start):
        return "line"
    if not key.quoted and _curl_header_context(
        message, name_start, key.quote_token
    ):
        return "curl"
    if key.quoted:
        return "structured"

    key_start = name_start - len(key.quote_token or "")
    previous_character = _previous_non_whitespace(message, key_start)
    if previous_character in "{[,":
        return "structured"
    return None


def _quoted_header_span(
    message: str, content_start: int, quote_token: str
) -> _HeaderValueSpan:
    closing_quote = _find_closing_quote(message, content_start, quote_token)
    value_end = closing_quote if closing_quote is not None else len(message)
    return _HeaderValueSpan(content_start, value_end)


def _header_value_span(
    message: str,
    value_start: int,
    key: _HeaderKey,
    context: str,
) -> _HeaderValueSpan | None:
    if context == "curl":
        if key.quote_token is None:
            return None
        return _quoted_header_span(message, value_start, key.quote_token)

    value_quote = _quote_token_at(message, value_start)
    if value_quote is not None:
        content_start = value_start + len(value_quote)
        return _quoted_header_span(message, content_start, value_quote)

    if context == "line":
        return _HeaderValueSpan(
            value_start,
            _find_folded_header_end(message, value_start),
        )
    return _HeaderValueSpan(
        value_start,
        _find_structured_header_end(message, value_start),
    )


def _locate_header_value(
    message: str, name_start: int, name_end: int
) -> _HeaderValueSpan | None:
    key = _parse_header_key(message, name_start, name_end)
    if key is None:
        return None

    context = _header_context(message, name_start, key)
    if context is None:
        return None

    value_start = _skip_inline_whitespace(message, key.delimiter + 1)
    return _header_value_span(message, value_start, key, context)


def _skip_http_whitespace(message: str, cursor: int, end: int) -> int:
    while cursor < end:
        if message[cursor] in " \t":
            cursor += 1
            continue
        if message[cursor] in "\r\n":
            next_line = cursor + 1
            if (
                message[cursor] == "\r"
                and next_line < end
                and message[next_line] == "\n"
            ):
                next_line += 1
            if next_line < end and message[next_line] in " \t":
                cursor = next_line + 1
                continue
        break
    return cursor


def _normalize_auth_credentials(value: str) -> str:
    unfolded = re.sub(r"\r?\n[ \t]+", " ", value)
    return _ESCAPED_QUOTE_RE.sub(r"\1", unfolded).strip()


def _auth_credentials_start(
    message: str, span: _HeaderValueSpan
) -> int | None:
    scheme_match = _AUTH_SCHEME_RE.match(message, span.start, span.end)
    if not scheme_match:
        return None

    credential_start = _skip_http_whitespace(message, scheme_match.end(), span.end)
    if credential_start == scheme_match.end() or credential_start >= span.end:
        return None

    raw_credentials = message[credential_start:span.end]
    credentials = _normalize_auth_credentials(raw_credentials)
    if not credentials:
        return None
    if not any(character.isspace() for character in credentials):
        return credential_start
    if "=" in credentials or "\r" in raw_credentials or "\n" in raw_credentials:
        return credential_start
    return None


def _redact_auth_headers(message: str) -> str:
    parts: list[str] = []
    output_cursor = 0
    search_cursor = 0

    while match := _AUTH_HEADER_NAME_RE.search(message, search_cursor):
        span = _locate_header_value(message, match.start(), match.end())
        if span is None or span.start < output_cursor:
            search_cursor = match.end()
            continue

        credential_start = _auth_credentials_start(message, span)
        if credential_start is None:
            search_cursor = match.end()
            continue

        parts.append(message[output_cursor:credential_start])
        parts.append(_REDACTED)
        output_cursor = span.end
        search_cursor = span.end

    parts.append(message[output_cursor:])
    return "".join(parts)


def _redact_cookie_headers(message: str) -> str:
    parts: list[str] = []
    output_cursor = 0
    search_cursor = 0

    while match := _COOKIE_HEADER_NAME_RE.search(message, search_cursor):
        span = _locate_header_value(message, match.start(), match.end())
        if (
            span is None
            or span.start >= span.end
            or span.start < output_cursor
        ):
            search_cursor = match.end()
            continue

        parts.append(message[output_cursor:span.start])
        parts.append(_REDACTED)
        output_cursor = span.end
        search_cursor = span.end

    parts.append(message[output_cursor:])
    return "".join(parts)


def redact_log_message(message: str) -> str:
    """Redact credentials with bounded regexes and single-pass value scans."""
    redacted = _redact_url_userinfo_passwords(message)
    redacted = _QUERY_PARAMETER_RE.sub(_redact_query_parameter, redacted)
    redacted = _redact_auth_headers(redacted)
    redacted = _redact_cookie_headers(redacted)
    return _redact_assignments(redacted)
