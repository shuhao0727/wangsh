import asyncio
from copy import deepcopy

from fastapi import HTTPException
from starlette.requests import Request

import app.api.pythonlab.sessions as sessions_api


class FakeRedisClient:
    def __init__(self):
        self.sets: dict[str, set[str]] = {}
        self.expiries: dict[str, int] = {}

    async def smembers(self, key: str):
        return set(self.sets.get(key, set()))

    async def sadd(self, key: str, *values: str):
        bucket = self.sets.setdefault(key, set())
        bucket.update(str(value) for value in values)

    async def srem(self, key: str, value: str):
        self.sets.setdefault(key, set()).discard(str(value))

    async def expire(self, key: str, seconds: int):
        self.expiries[key] = seconds


class FakeCache:
    def __init__(self):
        self.store: dict[str, object] = {}
        self.expiries: dict[str, int] = {}
        self.client = FakeRedisClient()

    async def set(self, key: str, value, expire_seconds: int | None = None):
        self.store[key] = deepcopy(value)
        if expire_seconds is not None:
            self.expiries[key] = expire_seconds
        return True

    async def get(self, key: str):
        value = self.store.get(key)
        return deepcopy(value)

    async def get_client(self):
        return self.client


class FakeCeleryApp:
    def __init__(self):
        self.calls: list[tuple[str, list[str]]] = []

    def send_task(self, task_name: str, args=None, **_kwargs):
        self.calls.append((task_name, list(args or [])))


def _make_request(path: str, method: str = "POST", headers: dict[str, str] | None = None):
    raw_headers = []
    merged = {"host": "pythonlab.local:8000"}
    if headers:
        merged.update(headers)
    for key, value in merged.items():
        raw_headers.append((key.lower().encode("utf-8"), value.encode("utf-8")))
    return Request(
        {
            "type": "http",
            "method": method,
            "path": path,
            "headers": raw_headers,
            "client": ("127.0.0.1", 12345),
            "query_string": b"",
            "scheme": "http",
            "server": ("pythonlab.local", 8000),
        }
    )


def _patch_session_env(monkeypatch):
    fake_cache = FakeCache()
    fake_celery = FakeCeleryApp()
    monkeypatch.setattr(sessions_api, "cache", fake_cache)
    monkeypatch.setattr(sessions_api, "celery_app", fake_celery)
    monkeypatch.setattr(sessions_api, "now_iso", lambda: "2026-04-07T00:00:00+00:00")
    monkeypatch.setattr(sessions_api.settings, "PYTHONLAB_MAX_SESSIONS_PER_USER", 2, raising=False)
    monkeypatch.setattr(sessions_api.settings, "PYTHONLAB_UNATTACHED_TTL_SECONDS", 300, raising=False)
    return fake_cache, fake_celery


def test_create_session_uses_v2_ws_path_and_persists_meta(monkeypatch):
    fake_cache, fake_celery = _patch_session_env(monkeypatch)
    monkeypatch.setattr(sessions_api, "_cleanup_and_count_active_sessions", lambda _user_id: asyncio.sleep(0, result=0))
    monkeypatch.setattr(sessions_api.settings, "PYTHONLAB_DEFAULT_MEMORY_MB", 256, raising=False)

    payload = sessions_api.DebugSessionCreateRequest(
        title="pythonlab",
        code="print('hi')\n",
        runtime_mode="debug",
        entry_path="main.py",
        requirements=[],
    )
    request = _make_request("/api/v2/pythonlab/sessions")

    result = asyncio.run(sessions_api.create_session(request, payload, current_user={"id": 7}))

    assert result.session_id.startswith("dbg_")
    assert result.status == sessions_api.SESSION_STATUS_PENDING
    assert result.ws_url == f"/api/v2/pythonlab/sessions/{result.session_id}/ws"

    session_key = f"{sessions_api.CACHE_KEY_SESSION_PREFIX}:{result.session_id}"
    code_key = f"{session_key}:code"
    session_meta = fake_cache.store[session_key]
    assert isinstance(session_meta, dict)
    assert session_meta["owner_user_id"] == 7
    assert session_meta["runtime_mode"] == "debug"
    assert session_meta["engine"] == "remote"
    assert session_meta["limits"]["memory_mb"] == 256
    assert session_meta["code_sha256"] == sessions_api.sha256_text(payload.code)
    assert fake_cache.store[code_key] == payload.code

    user_sessions_key = f"{sessions_api.CACHE_KEY_USER_SESSIONS_PREFIX}:7:sessions"
    assert result.session_id in fake_cache.client.sets[user_sessions_key]
    assert fake_celery.calls == [("app.tasks.pythonlab.start_session", [result.session_id])]


def test_create_session_keeps_explicit_memory_limit(monkeypatch):
    fake_cache, _ = _patch_session_env(monkeypatch)
    monkeypatch.setattr(sessions_api, "_cleanup_and_count_active_sessions", lambda _user_id: asyncio.sleep(0, result=0))
    monkeypatch.setattr(sessions_api.settings, "PYTHONLAB_DEFAULT_MEMORY_MB", 256, raising=False)

    payload = sessions_api.DebugSessionCreateRequest(
        title="pythonlab",
        code="print('hi')\n",
        runtime_mode="debug",
        entry_path="main.py",
        requirements=[],
        limits=sessions_api.DebugLimits(memory_mb=96),
    )
    request = _make_request("/api/v2/pythonlab/sessions")

    result = asyncio.run(sessions_api.create_session(request, payload, current_user={"id": 7}))

    session_key = f"{sessions_api.CACHE_KEY_SESSION_PREFIX}:{result.session_id}"
    session_meta = fake_cache.store[session_key]
    assert isinstance(session_meta, dict)
    assert session_meta["limits"]["memory_mb"] == 96


def test_create_session_rejects_when_user_quota_is_exceeded(monkeypatch):
    _patch_session_env(monkeypatch)
    monkeypatch.setattr(sessions_api, "_cleanup_and_count_active_sessions", lambda _user_id: asyncio.sleep(0, result=2))
    monkeypatch.setattr(sessions_api.settings, "PYTHONLAB_MAX_SESSIONS_PER_USER", 2, raising=False)

    payload = sessions_api.DebugSessionCreateRequest(
        title="pythonlab",
        code="print('hi')\n",
        runtime_mode="debug",
        entry_path="main.py",
        requirements=[],
    )
    request = _make_request("/api/v2/pythonlab/sessions")

    try:
        asyncio.run(sessions_api.create_session(request, payload, current_user={"id": 7}))
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 429
        assert exc.detail["error_code"] == "QUOTA_EXCEEDED"


def test_get_session_rewrites_host_docker_internal_for_client(monkeypatch):
    fake_cache, _ = _patch_session_env(monkeypatch)
    session_id = "dbg_host"
    session_key = f"{sessions_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"
    fake_cache.store[session_key] = {
        "session_id": session_id,
        "owner_user_id": 9,
        "status": "READY",
        "created_at": "2026-04-07T00:00:00+00:00",
        "last_heartbeat_at": "2026-04-07T00:00:00+00:00",
        "ttl_seconds": 300,
        "limits": {"cpu_ms": 30000},
        "entry_path": "main.py",
        "engine": "remote",
        "runtime_mode": "debug",
        "code_sha256": sessions_api.sha256_text("print('x')\n"),
        "dap_host": "host.docker.internal",
        "dap_port": 5678,
        "docker_container_id": "container-1",
        "error_code": None,
        "error_detail": None,
    }

    request = _make_request("/api/v2/pythonlab/sessions/dbg_host", method="GET", headers={"x-forwarded-host": "demo.example.com:8443"})
    result = asyncio.run(sessions_api.get_session(session_id, request, current_user={"id": 9}))

    assert result.session_id == session_id
    assert result.dap_host == "demo.example.com"
    assert result.dap_port == 5678


def test_session_ws_path_defaults_to_v2_when_prefix_missing():
    request = _make_request("/sessions", method="POST")
    assert sessions_api._session_ws_path(request, "dbg_fallback") == "/api/v2/pythonlab/sessions/dbg_fallback/ws"


def test_list_sessions_keeps_owned_active_items_sorted(monkeypatch):
    fake_cache, _ = _patch_session_env(monkeypatch)
    user_id = 13
    user_sessions_key = f"{sessions_api.CACHE_KEY_USER_SESSIONS_PREFIX}:{user_id}:sessions"
    fake_cache.client.sets[user_sessions_key] = {"dbg_old", "dbg_new", "dbg_inactive", "dbg_other_owner"}
    fake_cache.store[f"{sessions_api.CACHE_KEY_SESSION_PREFIX}:dbg_old"] = {
        "session_id": "dbg_old",
        "owner_user_id": user_id,
        "status": "READY",
        "created_at": "2026-04-06T10:00:00+00:00",
        "last_heartbeat_at": "2026-04-06T10:00:00+00:00",
        "ttl_seconds": 300,
        "limits": {"cpu_ms": 30000},
        "entry_path": "main.py",
        "engine": "remote",
        "runtime_mode": "debug",
        "code_sha256": sessions_api.sha256_text("print('old')\n"),
        "dap_host": "host.docker.internal",
        "dap_port": 5678,
        "docker_container_id": None,
        "error_code": None,
        "error_detail": None,
    }
    fake_cache.store[f"{sessions_api.CACHE_KEY_SESSION_PREFIX}:dbg_new"] = {
        **fake_cache.store[f"{sessions_api.CACHE_KEY_SESSION_PREFIX}:dbg_old"],
        "session_id": "dbg_new",
        "created_at": "2026-04-07T10:00:00+00:00",
        "code_sha256": sessions_api.sha256_text("print('new')\n"),
    }
    fake_cache.store[f"{sessions_api.CACHE_KEY_SESSION_PREFIX}:dbg_inactive"] = {
        **fake_cache.store[f"{sessions_api.CACHE_KEY_SESSION_PREFIX}:dbg_old"],
        "session_id": "dbg_inactive",
        "status": sessions_api.SESSION_STATUS_TERMINATED,
    }
    fake_cache.store[f"{sessions_api.CACHE_KEY_SESSION_PREFIX}:dbg_other_owner"] = {
        **fake_cache.store[f"{sessions_api.CACHE_KEY_SESSION_PREFIX}:dbg_old"],
        "session_id": "dbg_other_owner",
        "owner_user_id": 99,
    }

    request = _make_request("/api/v2/pythonlab/sessions", method="GET", headers={"x-forwarded-host": "list.example.com:8443"})
    result = asyncio.run(sessions_api.list_sessions(request, current_user={"id": user_id}))

    assert result["total"] == 2
    assert [item["session_id"] for item in result["items"]] == ["dbg_new", "dbg_old"]
    assert result["items"][0]["dap_host"] == "list.example.com"
    assert "dbg_inactive" not in fake_cache.client.sets[user_sessions_key]


def test_stop_session_marks_terminated_and_dispatches_task(monkeypatch):
    fake_cache, fake_celery = _patch_session_env(monkeypatch)
    session_id = "dbg_stop"
    session_key = f"{sessions_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"
    fake_cache.store[session_key] = {
        "session_id": session_id,
        "owner_user_id": 3,
        "status": "RUNNING",
        "last_heartbeat_at": "2026-04-06T23:59:59+00:00",
    }

    result = asyncio.run(sessions_api.stop_session(session_id, current_user={"id": 3}))

    assert result == {"ok": True}
    updated_meta = fake_cache.store[session_key]
    assert isinstance(updated_meta, dict)
    assert updated_meta["status"] == sessions_api.SESSION_STATUS_TERMINATED
    assert updated_meta["last_heartbeat_at"] == "2026-04-07T00:00:00+00:00"
    assert fake_cache.expiries[session_key] == 60
    assert fake_celery.calls == [("app.tasks.pythonlab.stop_session", [session_id])]


def test_cleanup_sessions_only_stops_owned_active_sessions(monkeypatch):
    fake_cache, fake_celery = _patch_session_env(monkeypatch)
    user_id = 11
    user_sessions_key = f"{sessions_api.CACHE_KEY_USER_SESSIONS_PREFIX}:{user_id}:sessions"
    fake_cache.client.sets[user_sessions_key] = {"dbg_active", "dbg_inactive", "dbg_missing", "dbg_other_owner"}
    fake_cache.store[f"{sessions_api.CACHE_KEY_SESSION_PREFIX}:dbg_active"] = {
        "session_id": "dbg_active",
        "owner_user_id": user_id,
        "status": "RUNNING",
        "ttl_seconds": 1800,
        "last_heartbeat_at": "before",
    }
    fake_cache.store[f"{sessions_api.CACHE_KEY_SESSION_PREFIX}:dbg_inactive"] = {
        "session_id": "dbg_inactive",
        "owner_user_id": user_id,
        "status": sessions_api.SESSION_STATUS_TERMINATED,
        "ttl_seconds": 1800,
        "last_heartbeat_at": "before",
    }
    fake_cache.store[f"{sessions_api.CACHE_KEY_SESSION_PREFIX}:dbg_other_owner"] = {
        "session_id": "dbg_other_owner",
        "owner_user_id": 99,
        "status": "RUNNING",
        "ttl_seconds": 1800,
        "last_heartbeat_at": "before",
    }

    result = asyncio.run(sessions_api.cleanup_sessions(current_user={"id": user_id}))

    assert result == {"ok": True, "stopped": ["dbg_active"], "stopped_count": 1}
    active_meta = fake_cache.store[f"{sessions_api.CACHE_KEY_SESSION_PREFIX}:dbg_active"]
    assert isinstance(active_meta, dict)
    assert active_meta["status"] == sessions_api.SESSION_STATUS_TERMINATING
    assert active_meta["last_heartbeat_at"] == "2026-04-07T00:00:00+00:00"
    assert "dbg_active" not in fake_cache.client.sets[user_sessions_key]
    assert "dbg_inactive" not in fake_cache.client.sets[user_sessions_key]
    assert "dbg_missing" not in fake_cache.client.sets[user_sessions_key]
    assert "dbg_other_owner" in fake_cache.client.sets[user_sessions_key]
    assert fake_celery.calls == [("app.tasks.pythonlab.stop_session", ["dbg_active"])]


def test_create_session_rejects_requirements(monkeypatch):
    _patch_session_env(monkeypatch)
    payload = sessions_api.DebugSessionCreateRequest(
        title="pythonlab",
        code="print('hi')\n",
        runtime_mode="debug",
        entry_path="main.py",
        requirements=["numpy"],
    )
    request = _make_request("/api/v2/pythonlab/sessions")

    try:
        asyncio.run(sessions_api.create_session(request, payload, current_user={"id": 1}))
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "requirements" in str(exc.detail)
