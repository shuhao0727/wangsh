import asyncio
import importlib
import sys
from datetime import datetime, timezone

from fastapi import Response
from starlette.requests import Request

import app.api.pythonlab.compat as compat_api
import app.api.pythonlab.compat_routes as compat_routes_api


class FakeRedisClient:
    def __init__(self):
        self.counters: dict[str, int] = {}
        self.expiries: dict[str, int] = {}
        self.values: dict[str, object] = {}

    async def incr(self, key: str):
        next_value = self.counters.get(key, 0) + 1
        self.counters[key] = next_value
        return next_value

    async def expire(self, key: str, seconds: int):
        self.expiries[key] = seconds

    async def get(self, key: str):
        return self.values.get(key)


class FakeCache:
    def __init__(self):
        self.client = FakeRedisClient()

    async def get_client(self):
        return self.client


def _make_request(path: str):
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": path,
            "headers": [],
            "client": ("127.0.0.1", 12345),
            "query_string": b"",
            "scheme": "http",
            "server": ("pythonlab.local", 8000),
        }
    )


def _load_app(monkeypatch):
    monkeypatch.setenv("DEBUG", "false")
    sys.modules.pop("main", None)
    module = importlib.import_module("main")
    return module.app


def _collect_route_paths(app, prefix: str) -> set[str]:
    return {
        path
        for path in (getattr(route, "path", None) for route in app.routes)
        if path and path.startswith(prefix)
    }


def test_mark_http_debug_v1_alias_sets_headers_and_usage_counter(monkeypatch):
    fake_cache = FakeCache()
    monkeypatch.setattr(compat_api, "cache", fake_cache)
    response = Response()

    asyncio.run(compat_api.mark_http_debug_v1_alias(_make_request("/api/v1/debug/flow/parse"), response))

    assert response.headers["Deprecation"] == "true"
    assert response.headers["Sunset"] == compat_api.DEBUG_V1_SUNSET_HTTP_DATE
    assert response.headers["Link"] == compat_api.DEBUG_V1_SUCCESSOR_LINK
    assert response.headers["Warning"] == compat_api.DEBUG_V1_WARNING
    assert response.headers["X-PythonLab-Deprecated-Alias"] == "true"

    key = compat_api._metric_key("http")
    assert fake_cache.client.counters[key] == 1
    assert fake_cache.client.expiries[key] == compat_api.DEBUG_V1_METRIC_TTL_SECONDS


def test_mark_http_debug_v1_alias_ignores_v2_path(monkeypatch):
    fake_cache = FakeCache()
    monkeypatch.setattr(compat_api, "cache", fake_cache)
    response = Response()

    asyncio.run(compat_api.mark_http_debug_v1_alias(_make_request("/api/v2/pythonlab/flow/parse"), response))

    assert "Deprecation" not in response.headers
    assert fake_cache.client.counters == {}


def test_get_debug_v1_websocket_accept_headers_marks_alias_usage(monkeypatch):
    fake_cache = FakeCache()
    monkeypatch.setattr(compat_api, "cache", fake_cache)

    headers = asyncio.run(compat_api.get_debug_v1_websocket_accept_headers("/api/v1/debug/sessions/dbg_1/ws"))
    decoded = {key.decode("ascii"): value.decode("ascii") for key, value in headers}

    assert decoded["deprecation"] == "true"
    assert decoded["sunset"] == compat_api.DEBUG_V1_SUNSET_HTTP_DATE
    assert decoded["link"] == compat_api.DEBUG_V1_SUCCESSOR_LINK
    assert decoded["warning"] == compat_api.DEBUG_V1_WARNING
    assert decoded["x-pythonlab-deprecated-alias"] == "true"

    key = compat_api._metric_key("websocket")
    assert fake_cache.client.counters[key] == 1


def test_collect_debug_v1_alias_usage_returns_recent_window(monkeypatch):
    fake_cache = FakeCache()
    fake_cache.client.values[compat_api._metric_key_for_bucket("http", "20260406")] = b"2"
    fake_cache.client.values[compat_api._metric_key_for_bucket("websocket", "20260407")] = "3"
    fake_cache.client.values[compat_api._metric_key_for_bucket("http", "20260408")] = 4
    monkeypatch.setattr(compat_api, "cache", fake_cache)

    result = asyncio.run(
        compat_api.collect_debug_v1_alias_usage(
            3,
            now=datetime(2026, 4, 8, 12, 0, tzinfo=timezone.utc),
        )
    )

    assert result["window_days"] == 3
    assert result["summary"] == {"http": 6, "websocket": 3, "total": 9}
    assert result["days"] == [
        {"date": "2026-04-06", "http": 2, "websocket": 0, "total": 2},
        {"date": "2026-04-07", "http": 0, "websocket": 3, "total": 3},
        {"date": "2026-04-08", "http": 4, "websocket": 0, "total": 4},
    ]


def test_get_deprecated_usage_route_returns_usage_snapshot(monkeypatch):
    async def fake_collect(days: int):
        return {
            "window_days": days,
            "prefix": "/api/v1/debug",
            "successor_prefix": "/api/v2/pythonlab",
            "summary": {"http": 1, "websocket": 2, "total": 3},
            "days": [{"date": "2026-04-08", "http": 1, "websocket": 2, "total": 3}],
        }

    monkeypatch.setattr(compat_routes_api, "collect_debug_v1_alias_usage", fake_collect)

    result = asyncio.run(compat_routes_api.get_deprecated_usage(days=5, current_user={"id": 1}))

    assert result["window_days"] == 5
    assert result["summary"]["total"] == 3


def test_pythonlab_v1_debug_routes_remain_registered_as_compat_alias(monkeypatch):
    app = _load_app(monkeypatch)
    paths = _collect_route_paths(app, "/api/v1/debug")

    expected = {
        "/api/v1/debug/sessions",
        "/api/v1/debug/sessions/{session_id}",
        "/api/v1/debug/sessions/{session_id}/stop",
        "/api/v1/debug/sessions/{session_id}/ws",
        "/api/v1/debug/sessions/{session_id}/terminal",
        "/api/v1/debug/flow/parse",
        "/api/v1/debug/syntax/check",
        "/api/v1/debug/cfg/parse",
    }

    missing = expected - paths
    assert not missing, f"missing v1 compat routes: {sorted(missing)}"
