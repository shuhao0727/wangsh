from datetime import datetime, timedelta, timezone
from typing import Any, Final, List, Tuple

from fastapi import Request, Response
from loguru import logger

from app.utils.cache import cache

DEBUG_V1_PREFIX: Final[str] = "/api/v1/debug"
PYTHONLAB_V2_PREFIX: Final[str] = "/api/v2/pythonlab"
DEBUG_V1_SUNSET_HTTP_DATE: Final[str] = "Wed, 31 Dec 2026 23:59:59 GMT"
DEBUG_V1_WARNING: Final[str] = '299 WangSh "/api/v1/debug/* is deprecated; use /api/v2/pythonlab/*"'
DEBUG_V1_SUCCESSOR_LINK: Final[str] = f'<{PYTHONLAB_V2_PREFIX}>; rel="successor-version"'
DEBUG_V1_METRIC_TTL_SECONDS: Final[int] = 90 * 24 * 60 * 60
DEBUG_V1_USAGE_LOOKBACK_DAYS_MAX: Final[int] = 90


def is_debug_v1_alias_path(path: str) -> bool:
    return str(path or "").startswith(DEBUG_V1_PREFIX)


def _metric_date_bucket(now: datetime | None = None) -> str:
    return (now or datetime.now(timezone.utc)).strftime("%Y%m%d")


def _metric_key_for_bucket(transport: str, date_bucket: str) -> str:
    return f"pythonlab:deprecated_v1:{transport}:{date_bucket}"


def _metric_key(transport: str) -> str:
    return _metric_key_for_bucket(transport, _metric_date_bucket())


def _recent_date_buckets(days: int, now: datetime | None = None) -> list[tuple[str, str]]:
    base = now or datetime.now(timezone.utc)
    items: list[tuple[str, str]] = []
    for offset in range(max(1, int(days))):
        current = base - timedelta(days=(days - offset - 1))
        items.append((current.strftime("%Y%m%d"), current.strftime("%Y-%m-%d")))
    return items


def _parse_counter_value(raw: Any) -> int:
    if raw is None:
        return 0
    if isinstance(raw, int):
        return max(0, raw)
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", errors="ignore")
    try:
        return max(0, int(str(raw).strip() or "0"))
    except Exception:
        return 0


async def _record_debug_v1_alias_hit(method: str, path: str, transport: str) -> None:
    logger.warning(
        "pythonlab deprecated alias used transport={} method={} path={} successor={}",
        transport,
        method,
        path,
        PYTHONLAB_V2_PREFIX,
    )
    try:
        client = await cache.get_client()
        key = _metric_key(transport)
        await client.incr(key)  # type: ignore[misc]
        await client.expire(key, DEBUG_V1_METRIC_TTL_SECONDS)  # type: ignore[misc]
    except Exception:
        pass


def _apply_debug_v1_deprecation_headers(response: Response) -> None:
    response.headers["Deprecation"] = "true"
    response.headers["Sunset"] = DEBUG_V1_SUNSET_HTTP_DATE
    response.headers["Link"] = DEBUG_V1_SUCCESSOR_LINK
    response.headers["Warning"] = DEBUG_V1_WARNING
    response.headers["X-PythonLab-Deprecated-Alias"] = "true"


async def mark_http_debug_v1_alias(request: Request, response: Response) -> None:
    path = str(request.url.path or "")
    if not is_debug_v1_alias_path(path):
        return
    _apply_debug_v1_deprecation_headers(response)
    await _record_debug_v1_alias_hit(str(request.method or "GET").upper(), path, "http")


async def get_debug_v1_websocket_accept_headers(path: str) -> List[Tuple[bytes, bytes]]:
    if not is_debug_v1_alias_path(path):
        return []
    await _record_debug_v1_alias_hit("GET", path, "websocket")
    return [
        (b"deprecation", b"true"),
        (b"sunset", DEBUG_V1_SUNSET_HTTP_DATE.encode("ascii")),
        (b"link", DEBUG_V1_SUCCESSOR_LINK.encode("ascii")),
        (b"warning", DEBUG_V1_WARNING.encode("ascii")),
        (b"x-pythonlab-deprecated-alias", b"true"),
    ]


async def collect_debug_v1_alias_usage(days: int = 7, *, now: datetime | None = None) -> dict[str, Any]:
    lookback_days = max(1, min(int(days), DEBUG_V1_USAGE_LOOKBACK_DAYS_MAX))
    client = await cache.get_client()
    series: list[dict[str, Any]] = []
    total_http = 0
    total_websocket = 0

    for date_bucket, date_label in _recent_date_buckets(lookback_days, now=now):
        http_count = _parse_counter_value(await client.get(_metric_key_for_bucket("http", date_bucket)))  # type: ignore[misc]
        websocket_count = _parse_counter_value(await client.get(_metric_key_for_bucket("websocket", date_bucket)))  # type: ignore[misc]
        total_http += http_count
        total_websocket += websocket_count
        series.append(
            {
                "date": date_label,
                "http": http_count,
                "websocket": websocket_count,
                "total": http_count + websocket_count,
            }
        )

    return {
        "window_days": lookback_days,
        "prefix": DEBUG_V1_PREFIX,
        "successor_prefix": PYTHONLAB_V2_PREFIX,
        "summary": {
            "http": total_http,
            "websocket": total_websocket,
            "total": total_http + total_websocket,
        },
        "days": series,
    }
