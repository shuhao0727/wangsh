"""ASGI request budgets applied before Starlette/FastAPI form parsing.

This middleware deliberately operates at the ASGI ``receive`` boundary.  It
limits request headers already accepted by the HTTP server and counts body
bytes before ``Request.form()`` / ``UploadFile`` parsing sees them.  The receive
idle timeout only bounds time spent waiting for the next network body event; it
is not, and must not be described as, a way to pre-empt synchronous parser CPU.
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Iterable, Sequence

from starlette.types import ASGIApp, Message, Receive, Scope, Send

_MIB = 1024 * 1024
_FORM_CONTENT_TYPES = {
    "application/x-www-form-urlencoded",
    "multipart/form-data",
}
_UNSAFE_METHODS = {"POST", "PUT", "PATCH"}


@dataclass(frozen=True)
class RequestBudget:
    """Budget for one class of form request."""

    name: str
    max_body_bytes: int
    receive_idle_seconds: float = 30.0


@dataclass(frozen=True)
class RouteBudget:
    """Match a request path before choosing its form body budget."""

    budget: RequestBudget
    methods: frozenset[str]
    exact_path: str | None = None
    path_prefix: str | None = None
    path_suffix: str | None = None

    def matches(self, method: str, path: str) -> bool:
        if method not in self.methods:
            return False
        if self.exact_path is not None and path != self.exact_path:
            return False
        if self.path_prefix is not None and not path.startswith(self.path_prefix):
            return False
        if self.path_suffix is not None and not path.endswith(self.path_suffix):
            return False
        return True


LOGIN_FORM_BUDGET = RequestBudget("auth-login-form", 16 * 1024, 10.0)
STANDARD_IMPORT_BUDGET = RequestBudget("standard-import", 12 * _MIB, 30.0)
TYPST_ASSET_BUDGET = RequestBudget("typst-asset", 6 * _MIB, 30.0)
# The business file limit is 500 MiB.  Multipart fields and framing need a
# small request-level allowance; the service still enforces the exact file cap.
GAME_UPLOAD_BUDGET = RequestBudget("game-upload", 502 * _MIB, 60.0)
FALLBACK_FORM_BUDGET = RequestBudget("fallback-form", 2 * _MIB, 30.0)

DEFAULT_ROUTE_BUDGETS: tuple[RouteBudget, ...] = (
    RouteBudget(LOGIN_FORM_BUDGET, frozenset({"POST"}), exact_path="/api/v1/auth/login"),
    RouteBudget(
        STANDARD_IMPORT_BUDGET,
        frozenset({"POST"}),
        exact_path="/api/v1/users/import",
    ),
    RouteBudget(
        STANDARD_IMPORT_BUDGET,
        frozenset({"POST"}),
        exact_path="/api/v1/xbk/import/preview",
    ),
    RouteBudget(
        STANDARD_IMPORT_BUDGET,
        frozenset({"POST"}),
        exact_path="/api/v1/xbk/import",
    ),
    RouteBudget(
        TYPST_ASSET_BUDGET,
        frozenset({"POST"}),
        path_prefix="/api/v1/informatics/typst-notes/",
        path_suffix="/assets",
    ),
    RouteBudget(
        GAME_UPLOAD_BUDGET,
        frozenset({"POST"}),
        exact_path="/api/v1/admin/it/games",
    ),
)


class InvalidContentLength(Exception):
    pass


def _content_type(headers: Sequence[tuple[bytes, bytes]]) -> str:
    for name, value in headers:
        if name.lower() == b"content-type":
            return value.decode("latin-1").split(";", 1)[0].strip().lower()
    return ""


def _content_length(headers: Sequence[tuple[bytes, bytes]]) -> int | None:
    values = [value.strip() for name, value in headers if name.lower() == b"content-length"]
    if not values:
        return None
    if len(set(values)) != 1:
        raise InvalidContentLength("conflicting content-length headers")
    try:
        value = int(values[0].decode("ascii"), 10)
    except (UnicodeDecodeError, ValueError) as exc:
        raise InvalidContentLength("invalid content-length header") from exc
    if value < 0:
        raise InvalidContentLength("negative content-length header")
    return value


def select_request_budget(
    scope: Scope,
    route_budgets: Iterable[RouteBudget] = DEFAULT_ROUTE_BUDGETS,
) -> RequestBudget | None:
    """Return a body budget only for unsafe form parsing requests."""

    method = str(scope.get("method") or "").upper()
    if method not in _UNSAFE_METHODS:
        return None
    headers = scope.get("headers") or []
    if _content_type(headers) not in _FORM_CONTENT_TYPES:
        return None
    path = str(scope.get("path") or "")
    for route in route_budgets:
        if route.matches(method, path):
            return route.budget
    return FALLBACK_FORM_BUDGET


class RequestBudgetMiddleware:
    """Pure ASGI middleware for header and pre-parser body budgets."""

    def __init__(
        self,
        app: ASGIApp,
        *,
        route_budgets: Iterable[RouteBudget] = DEFAULT_ROUTE_BUDGETS,
        max_header_count: int = 100,
        max_header_bytes: int = 32 * 1024,
        max_header_line_bytes: int = 8 * 1024,
    ) -> None:
        self.app = app
        self.route_budgets = tuple(route_budgets)
        self.max_header_count = max_header_count
        self.max_header_bytes = max_header_bytes
        self.max_header_line_bytes = max_header_line_bytes

    def _headers_within_budget(self, headers: Sequence[tuple[bytes, bytes]]) -> bool:
        if len(headers) > self.max_header_count:
            return False
        total = 0
        for name, value in headers:
            line_size = len(name) + len(value) + 4
            if line_size > self.max_header_line_bytes:
                return False
            total += line_size
            if total > self.max_header_bytes:
                return False
        return True

    @staticmethod
    async def _json_error(send: Send, status: int, detail: str) -> None:
        body = json.dumps({"detail": detail}, ensure_ascii=False).encode("utf-8")
        await send(
            {
                "type": "http.response.start",
                "status": status,
                "headers": [
                    (b"content-type", b"application/json; charset=utf-8"),
                    (b"content-length", str(len(body)).encode("ascii")),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = scope.get("headers") or []
        if not self._headers_within_budget(headers):
            await self._json_error(send, 431, "请求头超过允许预算")
            return

        budget = select_request_budget(scope, self.route_budgets)
        if budget is None:
            await self.app(scope, receive, send)
            return

        try:
            declared_length = _content_length(headers)
        except InvalidContentLength:
            await self._json_error(send, 400, "Content-Length 无效")
            return
        if declared_length is not None and declared_length > budget.max_body_bytes:
            await self._json_error(send, 413, "请求体超过该接口允许预算")
            return

        total = 0
        rejected_status: int | None = None
        rejected_detail = ""
        downstream_started = False

        async def budgeted_receive() -> Message:
            nonlocal total, rejected_status, rejected_detail
            if rejected_status is not None:
                return {"type": "http.disconnect"}
            try:
                message = await asyncio.wait_for(
                    receive(), timeout=budget.receive_idle_seconds
                )
            except TimeoutError:
                # This timeout surrounds only the network receive await.  It does
                # not wrap or claim to interrupt multipart parser CPU work.
                rejected_status = 408
                rejected_detail = "等待请求体数据超时"
                return {"type": "http.disconnect"}
            if message["type"] == "http.request":
                total += len(message.get("body", b""))
                if total > budget.max_body_bytes:
                    rejected_status = 413
                    rejected_detail = "请求体超过该接口允许预算"
                    return {"type": "http.disconnect"}
            return message

        async def tracked_send(message: Message) -> None:
            nonlocal downstream_started
            # Starlette translates a receive disconnect during form parsing into
            # its own 400 response.  Once our receive guard has rejected the
            # request, suppress that downstream response so the budget status is
            # deterministic (413/408) and emitted by this outer middleware.
            if rejected_status is not None:
                return
            if message["type"] == "http.response.start":
                downstream_started = True
            await send(message)

        try:
            await self.app(scope, budgeted_receive, tracked_send)
        except Exception:
            if rejected_status is None:
                raise
        if rejected_status is not None and not downstream_started:
            await self._json_error(send, rejected_status, rejected_detail)
