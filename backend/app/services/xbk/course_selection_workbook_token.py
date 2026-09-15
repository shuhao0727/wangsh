"""Server-signed, short-lived authorization tokens for R3 workbook plans."""

from __future__ import annotations

import base64
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import hmac
import json
import time
from typing import Any

from app.core.config import settings


TOKEN_TYPE = "XBK_WORKBOOK_PREVIEW"
TOKEN_VERSION = 1
TOKEN_TTL_SECONDS = 10 * 60
_KEY_CONTEXT = b"wangsh:xbk:course-selection-workbook-preview:v1"


class CourseSelectionWorkbookTokenError(ValueError):
    def __init__(self, code: str, message: str, *, status_code: int) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)

    def to_dict(self) -> dict[str, Any]:
        return {"code": self.code, "message": self.message, "issues": []}


@dataclass(frozen=True)
class CourseSelectionWorkbookTokenClaims:
    admin_id: int
    year: str
    term: str
    plan_id: str
    issued_at: int
    expires_at: int

    @property
    def expires_at_datetime(self) -> datetime:
        return datetime.fromtimestamp(self.expires_at, tz=timezone.utc)


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    try:
        decoded = base64.b64decode(value + padding, altchars=b"-_", validate=True)
        if _b64encode(decoded) != value:
            raise ValueError("non-canonical base64url")
        return decoded
    except (ValueError, TypeError) as exc:
        raise CourseSelectionWorkbookTokenError(
            "XBK_WORKBOOK_PREVIEW_TOKEN_INVALID",
            "预览确认令牌格式无效，请重新预览",
            status_code=401,
        ) from exc


def _canonical_json(payload: dict[str, Any]) -> bytes:
    return json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def _signing_key() -> bytes:
    # Derive a purpose-specific key so the application JWT key is not used
    # directly for a second token protocol.
    return hmac.new(
        str(settings.SECRET_KEY).encode("utf-8"),
        _KEY_CONTEXT,
        hashlib.sha256,
    ).digest()


def _now_epoch(now: int | float | datetime | None = None) -> int:
    if isinstance(now, datetime):
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
        return int(now.timestamp())
    if now is None:
        return int(time.time())
    return int(now)


def issue_course_selection_workbook_token(
    *,
    admin_id: int,
    year: str,
    term: str,
    plan_id: str,
    now: int | float | datetime | None = None,
    ttl_seconds: int = TOKEN_TTL_SECONDS,
) -> tuple[str, CourseSelectionWorkbookTokenClaims]:
    issued_at = _now_epoch(now)
    ttl = int(ttl_seconds)
    if ttl <= 0 or ttl > TOKEN_TTL_SECONDS:
        raise ValueError(f"ttl_seconds must be between 1 and {TOKEN_TTL_SECONDS}")
    claims = CourseSelectionWorkbookTokenClaims(
        admin_id=int(admin_id),
        year=str(year),
        term=str(term),
        plan_id=str(plan_id),
        issued_at=issued_at,
        expires_at=issued_at + ttl,
    )
    header = {"alg": "HS256", "typ": TOKEN_TYPE, "ver": TOKEN_VERSION}
    payload = {
        "typ": TOKEN_TYPE,
        "ver": TOKEN_VERSION,
        "admin_id": claims.admin_id,
        "year": claims.year,
        "term": claims.term,
        "plan_id": claims.plan_id,
        "iat": claims.issued_at,
        "exp": claims.expires_at,
    }
    signing_input = b".".join((_b64encode(_canonical_json(header)).encode(), _b64encode(_canonical_json(payload)).encode()))
    signature = hmac.new(_signing_key(), signing_input, hashlib.sha256).digest()
    return f"{signing_input.decode()}.{_b64encode(signature)}", claims


def _invalid_token(message: str) -> CourseSelectionWorkbookTokenError:
    return CourseSelectionWorkbookTokenError(
        "XBK_WORKBOOK_PREVIEW_TOKEN_INVALID",
        message,
        status_code=401,
    )


def _split_token(token: str) -> tuple[str, str, str]:
    try:
        encoded_header, encoded_payload, encoded_signature = str(token).split(".")
    except ValueError as exc:
        raise _invalid_token("预览确认令牌格式无效，请重新预览") from exc
    return encoded_header, encoded_payload, encoded_signature


def _token_signing_input(encoded_header: str, encoded_payload: str) -> bytes:
    try:
        return f"{encoded_header}.{encoded_payload}".encode("ascii", "strict")
    except UnicodeEncodeError as exc:
        raise _invalid_token("预览确认令牌格式无效，请重新预览") from exc


def _verify_token_signature(signing_input: bytes, encoded_signature: str) -> None:
    supplied_signature = _b64decode(encoded_signature)
    expected_signature = hmac.new(_signing_key(), signing_input, hashlib.sha256).digest()
    if not hmac.compare_digest(supplied_signature, expected_signature):
        raise _invalid_token("预览确认令牌签名无效，请重新预览")


def _decode_token_claims(
    encoded_header: str,
    encoded_payload: str,
) -> tuple[object, object, CourseSelectionWorkbookTokenClaims]:
    try:
        header = json.loads(_b64decode(encoded_header))
        payload = json.loads(_b64decode(encoded_payload))
        claims = CourseSelectionWorkbookTokenClaims(
            admin_id=int(payload["admin_id"]),
            year=str(payload["year"]),
            term=str(payload["term"]),
            plan_id=str(payload["plan_id"]),
            issued_at=int(payload["iat"]),
            expires_at=int(payload["exp"]),
        )
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise _invalid_token("预览确认令牌内容无效，请重新预览") from exc
    return header, payload, claims


def _validate_token_protocol(
    header: object,
    payload: object,
    claims: CourseSelectionWorkbookTokenClaims,
) -> None:
    expected_header = {"alg": "HS256", "typ": TOKEN_TYPE, "ver": TOKEN_VERSION}
    protocol_valid = (
        header == expected_header
        and isinstance(payload, dict)
        and payload.get("typ") == TOKEN_TYPE
        and payload.get("ver") == TOKEN_VERSION
        and bool(claims.plan_id)
        and claims.expires_at > claims.issued_at
        and claims.expires_at - claims.issued_at <= TOKEN_TTL_SECONDS
    )
    if not protocol_valid:
        raise _invalid_token("预览确认令牌版本或声明无效，请重新预览")


def _validate_token_time(
    claims: CourseSelectionWorkbookTokenClaims,
    now: int | float | datetime | None,
) -> None:
    current_time = _now_epoch(now)
    if claims.issued_at > current_time + 5 or claims.expires_at <= current_time:
        raise CourseSelectionWorkbookTokenError(
            "XBK_WORKBOOK_PREVIEW_TOKEN_EXPIRED",
            "预览确认令牌已过期，请重新预览",
            status_code=401,
        )


def _validate_token_binding(
    claims: CourseSelectionWorkbookTokenClaims,
    *,
    admin_id: int,
    year: str,
    term: str,
    expected_plan_id: str | None,
) -> None:
    if claims.admin_id != int(admin_id):
        raise CourseSelectionWorkbookTokenError(
            "XBK_WORKBOOK_PREVIEW_TOKEN_IDENTITY_MISMATCH",
            "该预览令牌不属于当前管理员，请重新预览",
            status_code=403,
        )
    if claims.year != str(year) or claims.term != str(term):
        raise CourseSelectionWorkbookTokenError(
            "XBK_WORKBOOK_PREVIEW_TOKEN_PERIOD_MISMATCH",
            "预览令牌与提交的学年学期不一致，请重新预览",
            status_code=409,
        )
    if expected_plan_id is not None and claims.plan_id != expected_plan_id:
        raise CourseSelectionWorkbookTokenError(
            "XBK_WORKBOOK_PREVIEW_TOKEN_PLAN_MISMATCH",
            "提交的工作簿与已预览计划不一致，请重新预览",
            status_code=409,
        )


def verify_course_selection_workbook_token(
    token: str,
    *,
    admin_id: int,
    year: str,
    term: str,
    expected_plan_id: str | None = None,
    now: int | float | datetime | None = None,
) -> CourseSelectionWorkbookTokenClaims:
    encoded_header, encoded_payload, encoded_signature = _split_token(token)
    signing_input = _token_signing_input(encoded_header, encoded_payload)
    _verify_token_signature(signing_input, encoded_signature)
    header, payload, claims = _decode_token_claims(encoded_header, encoded_payload)
    _validate_token_protocol(header, payload, claims)
    _validate_token_time(claims, now)
    _validate_token_binding(
        claims,
        admin_id=admin_id,
        year=year,
        term=term,
        expected_plan_id=expected_plan_id,
    )
    return claims
