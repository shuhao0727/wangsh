import asyncio
import json
import sys
from copy import deepcopy
from types import SimpleNamespace

import app.api.pythonlab.ws as ws_api


class FakeCache:
    def __init__(self):
        self.store: dict[str, object] = {}
        self.client = None
        self.expiries: dict[str, int] = {}
        self.set_calls: list[tuple[str, object, int | None]] = []

    async def get(self, key: str):
        return deepcopy(self.store.get(key))

    async def set(self, key: str, value, expire_seconds: int | None = None):
        self.store[key] = deepcopy(value)
        self.set_calls.append((key, deepcopy(value), expire_seconds))
        if expire_seconds is not None:
            self.expiries[key] = expire_seconds
        return True

    async def get_client(self):
        if self.client is None:
            raise AssertionError("fake redis client was not configured")
        return self.client


class FakeRedisClient:
    def __init__(self):
        self.values: dict[str, str] = {}
        self.counters: dict[str, int] = {}
        self.expiries: dict[str, int] = {}

    async def incr(self, key: str):
        next_value = int(self.counters.get(key, 0)) + 1
        self.counters[key] = next_value
        return next_value

    async def expire(self, key: str, seconds: int):
        self.expiries[key] = seconds

    async def set(self, key: str, value: str, nx: bool = False, px: int | None = None):
        if nx and key in self.values:
            return False
        self.values[key] = value
        if px is not None:
            self.expiries[key] = px
        return True

    async def get(self, key: str):
        return self.values.get(key)

    async def pexpire(self, key: str, milliseconds: int):
        self.expiries[key] = milliseconds
        return True

    async def eval(self, _script: str, _numkeys: int, key: str, value: str):
        if self.values.get(key) == value:
            self.values.pop(key, None)
            return 1
        return 0


class FakeCeleryApp:
    def __init__(self):
        self.calls: list[tuple[str, list[str]]] = []

    def send_task(self, task_name: str, args=None, **_kwargs):
        self.calls.append((task_name, list(args or [])))


class FakeProcess:
    def __init__(self):
        self.returncode = None
        self.killed = False

    def kill(self):
        self.killed = True
        self.returncode = -9


class FakeWebSocket:
    def __init__(self, *, query_params=None, cookies=None, incoming=None):
        self.query_params = query_params or {}
        self.cookies = cookies or {}
        self.incoming = list(incoming or [])
        self.accepted = False
        self.closed: list[tuple[int, str | None]] = []
        self.sent_texts: list[str] = []

    async def accept(self):
        self.accepted = True

    async def close(self, code=1000, reason=None):
        self.closed.append((int(code), reason))

    async def send_text(self, text: str):
        self.sent_texts.append(text)

    async def receive_text(self):
        if not self.incoming:
            raise AssertionError("receive_text should not be called in early-close tests")
        next_item = self.incoming.pop(0)
        if isinstance(next_item, BaseException):
            raise next_item
        return str(next_item)


class FakeStreamWriter:
    def __init__(self):
        self.buffer = bytearray()
        self.drain_calls = 0
        self.closed = False

    def write(self, data: bytes):
        self.buffer.extend(data)

    async def drain(self):
        self.drain_calls += 1

    def close(self):
        self.closed = True

    async def wait_closed(self):
        return None


async def _read_dap_packet(packet: bytes) -> dict:
    reader = asyncio.StreamReader()
    reader.feed_data(packet)
    reader.feed_eof()
    return await ws_api._read_dap_message(reader)


def _make_dap_packet(msg: dict, extra_headers: dict[str, str] | None = None) -> bytes:
    raw = json.dumps(msg, ensure_ascii=False).encode("utf-8")
    headers = [f"Content-Length: {len(raw)}"]
    for key, value in (extra_headers or {}).items():
        headers.append(f"{key}: {value}")
    return ("\r\n".join(headers) + "\r\n\r\n").encode("utf-8") + raw


def _patch_ws_auth_and_cache(monkeypatch, *, fake_cache: FakeCache, user: dict | None):
    async def _auth(_token, _db):
        return deepcopy(user)

    monkeypatch.setattr(ws_api, "cache", fake_cache)
    monkeypatch.setattr(ws_api, "auth_get_current_user", _auth)


def _patch_terminal_docker_provider(monkeypatch, provider_cls):
    monkeypatch.setitem(sys.modules, "app.core.sandbox.docker", SimpleNamespace(DockerProvider=provider_cls))


def _make_debug_session_meta(session_id: str, **overrides):
    meta = {
        "session_id": session_id,
        "owner_user_id": 7,
        "status": ws_api.SESSION_STATUS_READY,
        "dap_port": 5678,
        "ttl_seconds": 300,
        "limits": {},
    }
    meta.update(overrides)
    return meta


def _make_settling_gather(expected_done: int = 2):
    original_gather = asyncio.gather
    original_sleep = asyncio.sleep

    async def _settling_gather(*aws, **_kwargs):
        tasks = [asyncio.create_task(aw) for aw in aws]
        while True:
            done = [task for task in tasks if task.done()]
            pending = [task for task in tasks if not task.done()]
            for task in done:
                if task.cancelled():
                    continue
                exc = task.exception()
                if exc is not None:
                    for pending_task in pending:
                        pending_task.cancel()
                    await original_gather(*pending, return_exceptions=True)
                    raise exc
            if len(done) >= expected_done or not pending:
                for pending_task in pending:
                    pending_task.cancel()
                await original_gather(*pending, return_exceptions=True)
                return [None if task.cancelled() else task.result() for task in tasks]
            await original_sleep(0)

    return _settling_gather


def _make_mainline_gather(main_count: int = 2):
    original_gather = asyncio.gather

    async def _mainline_gather(*aws, **_kwargs):
        main_tasks = [asyncio.create_task(aw) for aw in aws[:main_count]]
        background_tasks = [asyncio.create_task(aw) for aw in aws[main_count:]]
        try:
            return await original_gather(*main_tasks)
        finally:
            pending = [task for task in [*main_tasks, *background_tasks] if not task.done()]
            for task in pending:
                task.cancel()
            await original_gather(*pending, return_exceptions=True)

    return _mainline_gather


def test_extract_ws_token_prefers_query_param(monkeypatch):
    monkeypatch.setattr(ws_api.settings, "ACCESS_TOKEN_COOKIE_NAME", "pythonlab_token", raising=False)
    websocket = SimpleNamespace(
        query_params={"token": "query-token"},
        cookies={"pythonlab_token": "cookie-token", "access_token": "fallback-token"},
    )

    assert ws_api._extract_ws_token(websocket) == "query-token"


def test_extract_ws_token_falls_back_to_known_cookies(monkeypatch):
    monkeypatch.setattr(ws_api.settings, "ACCESS_TOKEN_COOKIE_NAME", "pythonlab_token", raising=False)
    websocket = SimpleNamespace(query_params={}, cookies={"pythonlab_token": "cookie-token"})

    assert ws_api._extract_ws_token(websocket) == "cookie-token"


def test_normalize_client_conn_id_accepts_safe_value_and_truncates():
    assert ws_api._normalize_client_conn_id("alpha._-09") == "alpha._-09"
    assert ws_api._normalize_client_conn_id("x" * 80) == "x" * 64


def test_normalize_client_conn_id_rejects_invalid_value():
    assert ws_api._normalize_client_conn_id("bad id") is None
    assert ws_api._normalize_client_conn_id("中文") is None
    assert ws_api._normalize_client_conn_id("") is None


def test_validate_dap_request_payload_accepts_non_request_message():
    assert ws_api._validate_dap_request_payload({"type": "event", "event": "initialized"}) is None


def test_validate_dap_request_payload_rejects_invalid_breakpoint_path():
    error = ws_api._validate_dap_request_payload(
        {
            "type": "request",
            "command": "setBreakpoints",
            "arguments": {"source": {"path": "/tmp/other.py"}},
        }
    )

    assert error == f"source.path 仅允许 {ws_api.WORKSPACE_MAIN_PY}"


def test_validate_dap_request_payload_rejects_invalid_launch_program_and_cwd():
    bad_program = ws_api._validate_dap_request_payload(
        {
            "type": "request",
            "command": "launch",
            "arguments": {"program": "/tmp/other.py", "cwd": ws_api.WORKSPACE_DIR},
        }
    )
    bad_cwd = ws_api._validate_dap_request_payload(
        {
            "type": "request",
            "command": "launch",
            "arguments": {"program": ws_api.WORKSPACE_MAIN_PY, "cwd": "/tmp"},
        }
    )

    assert bad_program == f"program 仅允许 {ws_api.WORKSPACE_MAIN_PY}"
    assert bad_cwd == f"cwd 仅允许 {ws_api.WORKSPACE_DIR}"


def test_validate_dap_request_payload_accepts_workspace_launch_request():
    assert (
        ws_api._validate_dap_request_payload(
            {
                "type": "request",
                "command": "launch",
                "arguments": {"program": ws_api.WORKSPACE_MAIN_PY, "cwd": ws_api.WORKSPACE_DIR},
            }
        )
        is None
    )


def test_build_dap_host_candidates_deduplicates_and_keeps_user_host_first():
    assert ws_api._build_dap_host_candidates("host.docker.internal", in_docker=False) == [
        "host.docker.internal",
        "172.17.0.1",
        "127.0.0.1",
    ]


def test_build_dap_host_candidates_moves_loopback_to_end_in_docker():
    assert ws_api._build_dap_host_candidates("127.0.0.1", in_docker=True) == [
        "host.docker.internal",
        "172.17.0.1",
        "127.0.0.1",
    ]


def test_read_dap_message_parses_headers_and_body():
    msg = {"seq": 1, "type": "event", "event": "initialized"}
    packet = _make_dap_packet(msg, extra_headers={"X-Trace-Id": "test"})

    result = asyncio.run(_read_dap_packet(packet))

    assert result == msg


def test_read_dap_message_requires_content_length():
    try:
        asyncio.run(_read_dap_packet(b"\r\n{}"))
        raise AssertionError("expected ValueError")
    except ValueError as exc:
        assert "content-length" in str(exc)


def test_write_dap_message_roundtrips_with_read_helper():
    msg = {"seq": 7, "type": "response", "success": True, "command": "launch"}
    writer = FakeStreamWriter()

    asyncio.run(ws_api._write_dap_message(writer, msg))
    result = asyncio.run(_read_dap_packet(bytes(writer.buffer)))

    assert writer.drain_calls == 1
    assert bytes(writer.buffer).startswith(b"Content-Length: ")
    assert result == msg


def test_dap_ws_closes_when_token_missing(monkeypatch):
    fake_cache = FakeCache()
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})
    websocket = FakeWebSocket()

    asyncio.run(ws_api.dap_ws(websocket, "dbg_missing_token", db=None))

    assert websocket.accepted is True
    assert websocket.closed == [(4401, None)]


def test_dap_ws_closes_when_session_missing(monkeypatch):
    fake_cache = FakeCache()
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})
    websocket = FakeWebSocket(query_params={"token": "valid-token"})

    asyncio.run(ws_api.dap_ws(websocket, "dbg_missing_session", db=None))

    assert websocket.closed == [(4404, None)]


def test_dap_ws_closes_when_owner_mismatch(monkeypatch):
    fake_cache = FakeCache()
    session_id = "dbg_wrong_owner"
    fake_cache.store[f"{ws_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"] = {
        "session_id": session_id,
        "owner_user_id": 99,
        "status": ws_api.SESSION_STATUS_READY,
        "dap_port": 5678,
    }
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})
    websocket = FakeWebSocket(query_params={"token": "valid-token"})

    asyncio.run(ws_api.dap_ws(websocket, session_id, db=None))

    assert websocket.closed == [(4403, None)]


def test_dap_ws_closes_when_session_never_ready(monkeypatch):
    fake_cache = FakeCache()
    session_id = "dbg_not_ready"
    fake_cache.store[f"{ws_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"] = {
        "session_id": session_id,
        "owner_user_id": 7,
        "status": "PENDING",
        "dap_port": 5678,
    }
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})

    async def _fast_sleep(_seconds: float):
        return None

    monkeypatch.setattr(ws_api.asyncio, "sleep", _fast_sleep)
    websocket = FakeWebSocket(query_params={"token": "valid-token"})

    asyncio.run(ws_api.dap_ws(websocket, session_id, db=None))

    assert websocket.closed == [(4409, None)]


def test_dap_ws_closes_when_dap_port_invalid(monkeypatch):
    fake_cache = FakeCache()
    session_id = "dbg_bad_port"
    fake_cache.store[f"{ws_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"] = {
        "session_id": session_id,
        "owner_user_id": 7,
        "status": ws_api.SESSION_STATUS_READY,
        "dap_port": 0,
    }
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})
    websocket = FakeWebSocket(query_params={"token": "valid-token"})

    asyncio.run(ws_api.dap_ws(websocket, session_id, db=None))

    assert websocket.closed == [(4410, None)]


def test_dap_ws_denies_concurrent_owner_when_mode_is_deny(monkeypatch):
    fake_cache = FakeCache()
    fake_cache.client = FakeRedisClient()
    session_id = "dbg_owner_deny"
    fake_cache.store[f"{ws_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"] = {
        "session_id": session_id,
        "owner_user_id": 7,
        "status": ws_api.SESSION_STATUS_READY,
        "dap_port": 5678,
    }
    fake_cache.client.values[f"debug:session:{session_id}:ws_owner"] = "other-user:conn"
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})
    monkeypatch.setattr(ws_api.settings, "PYTHONLAB_DEBUG_WS_OWNER_MODE", "deny", raising=False)
    websocket = FakeWebSocket(query_params={"token": "valid-token"})

    asyncio.run(ws_api.dap_ws(websocket, session_id, db=None))

    assert websocket.closed == [(4429, "deny_in_use")]
    assert len(websocket.sent_texts) == 1
    payload = json.loads(websocket.sent_texts[0])
    assert payload["type"] == "event"
    assert payload["event"] == "output"
    assert "其他窗口调试" in payload["body"]["output"]


def test_dap_ws_steals_concurrent_owner_when_mode_is_steal(monkeypatch):
    fake_cache = FakeCache()
    fake_cache.client = FakeRedisClient()
    session_id = "dbg_owner_steal"
    owner_key = f"debug:session:{session_id}:ws_owner"
    fake_cache.store[f"{ws_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"] = {
        "session_id": session_id,
        "owner_user_id": 7,
        "status": ws_api.SESSION_STATUS_READY,
        "dap_port": 5678,
        "ttl_seconds": 300,
    }
    fake_cache.client.values[owner_key] = "other-user:conn"
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})
    monkeypatch.setattr(ws_api.settings, "PYTHONLAB_DEBUG_WS_OWNER_MODE", "steal", raising=False)
    monkeypatch.setattr(ws_api, "now_iso", lambda: "2026-04-07T00:00:00+00:00")

    async def _pending_open_connection(*_args, **_kwargs):
        await asyncio.sleep(3600)

    monkeypatch.setattr(ws_api.asyncio, "open_connection", _pending_open_connection)
    websocket = FakeWebSocket(
        query_params={"token": "valid-token"},
        incoming=[ws_api.WebSocketDisconnect()],
    )

    asyncio.run(ws_api.dap_ws(websocket, session_id, db=None))

    assert len(websocket.sent_texts) == 1
    payload = json.loads(websocket.sent_texts[0])
    assert payload["type"] == "event"
    assert payload["event"] == "output"
    assert "已接管当前会话" in payload["body"]["output"]
    assert websocket.closed[-1] == (1000, None)
    assert owner_key not in fake_cache.client.values
    meta = fake_cache.store[f"{ws_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"]
    assert isinstance(meta, dict)
    assert "debug_owner" not in meta


def test_terminal_ws_closes_when_token_missing(monkeypatch):
    fake_cache = FakeCache()
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})
    websocket = FakeWebSocket()

    asyncio.run(ws_api.terminal_ws(websocket, "dbg_terminal_missing_token", db=None))

    assert websocket.accepted is True
    assert websocket.closed == [(4401, None)]


def test_terminal_ws_closes_when_session_missing(monkeypatch):
    fake_cache = FakeCache()
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})
    websocket = FakeWebSocket(query_params={"token": "valid-token"})

    asyncio.run(ws_api.terminal_ws(websocket, "dbg_terminal_missing_session", db=None))

    assert websocket.closed == [(4404, None)]


def test_terminal_ws_closes_when_owner_mismatch(monkeypatch):
    fake_cache = FakeCache()
    session_id = "dbg_terminal_wrong_owner"
    fake_cache.store[f"{ws_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"] = {
        "session_id": session_id,
        "owner_user_id": 99,
    }
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})
    websocket = FakeWebSocket(query_params={"token": "valid-token"})

    asyncio.run(ws_api.terminal_ws(websocket, session_id, db=None))

    assert websocket.closed == [(4403, None)]


def test_terminal_ws_closes_when_attach_tty_fails(monkeypatch):
    fake_cache = FakeCache()
    session_id = "dbg_terminal_attach_fail"
    fake_cache.store[f"{ws_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"] = {
        "session_id": session_id,
        "owner_user_id": 7,
        "runtime_mode": "debug",
    }
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})

    class FakeDockerProvider:
        async def attach_tty(self, _session_id, _meta):
            raise RuntimeError("attach failed")

    _patch_terminal_docker_provider(monkeypatch, FakeDockerProvider)
    websocket = FakeWebSocket(query_params={"token": "valid-token"})

    asyncio.run(ws_api.terminal_ws(websocket, session_id, db=None))

    assert websocket.closed == [(4500, None)]


def test_terminal_ws_plain_mode_marks_session_terminated_on_done_marker(monkeypatch):
    fake_cache = FakeCache()
    fake_celery = FakeCeleryApp()
    process = FakeProcess()
    session_id = "dbg_terminal_plain_done"
    session_key = f"{ws_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"
    fake_cache.store[session_key] = {
        "session_id": session_id,
        "owner_user_id": 7,
        "runtime_mode": "plain",
        "ttl_seconds": 300,
        "status": ws_api.SESSION_STATUS_READY,
    }
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})
    monkeypatch.setattr(ws_api, "celery_app", fake_celery)
    monkeypatch.setattr(ws_api, "now_iso", lambda: "2026-04-07T00:00:00+00:00")

    class FakeDockerProvider:
        async def attach_tty(self, _session_id, _meta):
            return process, 11

    _patch_terminal_docker_provider(monkeypatch, FakeDockerProvider)
    writes: list[tuple[int, bytes]] = []
    closed_fds: list[int] = []
    read_chunks = [
        b"hello\n__PYTHONLAB_DONE__:0\nrest\n",
        b"",
    ]

    def _fake_write(fd: int, data: bytes):
        writes.append((fd, data))
        return len(data)

    def _fake_read(_fd: int, _size: int):
        if read_chunks:
            return read_chunks.pop(0)
        return b""

    def _fake_close(fd: int):
        closed_fds.append(fd)

    monkeypatch.setattr(ws_api.os, "write", _fake_write)
    monkeypatch.setattr(ws_api.os, "read", _fake_read)
    monkeypatch.setattr(ws_api.os, "close", _fake_close)
    websocket = FakeWebSocket(query_params={"token": "valid-token"}, incoming=[ws_api.WebSocketDisconnect()])

    asyncio.run(ws_api.terminal_ws(websocket, session_id, db=None))

    assert writes == [
        (
            11,
            b"python -u /workspace/main.py; printf '\\n__PYTHONLAB_DONE__:%s\\n' $?;\n",
        )
    ]
    assert websocket.sent_texts[0] == "hello\n"
    assert "退出码: 0" in websocket.sent_texts[1]
    assert websocket.sent_texts[2] == "rest\n"
    assert fake_celery.calls == [("app.tasks.pythonlab.stop_session", [session_id])]
    meta = fake_cache.store[session_key]
    assert isinstance(meta, dict)
    assert meta["plain_started"] is True
    assert meta["status"] == ws_api.SESSION_STATUS_TERMINATED
    assert meta["plain_exit_code"] == 0
    assert closed_fds == [11]
    assert process.killed is True


def test_dap_ws_emits_terminated_fallback_when_launch_followed_by_eof(monkeypatch):
    fake_cache = FakeCache()
    fake_cache.client = FakeRedisClient()
    fake_celery = FakeCeleryApp()
    writer = FakeStreamWriter()
    session_id = "dbg_launch_eof"
    session_key = f"{ws_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"
    fake_cache.store[session_key] = _make_debug_session_meta(session_id)
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})
    monkeypatch.setattr(ws_api, "celery_app", fake_celery)
    monkeypatch.setattr(ws_api, "now_iso", lambda: "2026-04-07T00:00:00+00:00")

    async def _fake_open_connection(_host, _port):
        return object(), writer

    read_queue = [
        {"type": "response", "command": "launch", "request_seq": 1, "success": True, "body": {}},
        EOFError("dap eof"),
    ]

    async def _fake_read_dap_message(_reader):
        next_item = read_queue.pop(0)
        if isinstance(next_item, BaseException):
            raise next_item
        return next_item

    monkeypatch.setattr(ws_api.asyncio, "open_connection", _fake_open_connection)
    monkeypatch.setattr(ws_api, "_read_dap_message", _fake_read_dap_message)
    launch_request = json.dumps(
        {
            "seq": 1,
            "type": "request",
            "command": "launch",
            "arguments": {"program": ws_api.WORKSPACE_MAIN_PY, "cwd": ws_api.WORKSPACE_DIR},
        },
        ensure_ascii=False,
    )
    websocket = FakeWebSocket(
        query_params={"token": "valid-token"},
        incoming=[launch_request, ws_api.WebSocketDisconnect()],
    )

    asyncio.run(ws_api.dap_ws(websocket, session_id, db=None))

    assert fake_celery.calls == [("app.tasks.pythonlab.stop_session", [session_id])]
    payloads = [json.loads(item) for item in websocket.sent_texts]
    assert payloads[0]["type"] == "response"
    assert payloads[0]["command"] == "launch"
    assert payloads[1]["type"] == "event"
    assert payloads[1]["event"] == "terminated"
    assert payloads[1]["body"]["fallback_reason"] == "dap_eof_after_launch"
    meta = fake_cache.store[session_key]
    assert isinstance(meta, dict)
    assert meta["status"] == ws_api.SESSION_STATUS_TERMINATED
    assert writer.closed is True


def test_dap_ws_emits_terminated_fallback_when_output_reports_done(monkeypatch):
    fake_cache = FakeCache()
    fake_cache.client = FakeRedisClient()
    fake_celery = FakeCeleryApp()
    writer = FakeStreamWriter()
    session_id = "dbg_output_done"
    session_key = f"{ws_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"
    fake_cache.store[session_key] = _make_debug_session_meta(session_id)
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})
    monkeypatch.setattr(ws_api, "celery_app", fake_celery)
    monkeypatch.setattr(ws_api, "now_iso", lambda: "2026-04-07T00:00:00+00:00")

    async def _fake_open_connection(_host, _port):
        return object(), writer

    read_queue = [
        {"type": "response", "command": "launch", "request_seq": 1, "success": True, "body": {}},
        {"type": "event", "event": "output", "body": {"category": "stdout", "output": "done\n"}},
    ]

    async def _fake_read_dap_message(_reader):
        next_item = read_queue.pop(0)
        if isinstance(next_item, BaseException):
            raise next_item
        return next_item

    monkeypatch.setattr(ws_api.asyncio, "open_connection", _fake_open_connection)
    monkeypatch.setattr(ws_api, "_read_dap_message", _fake_read_dap_message)
    launch_request = json.dumps(
        {
            "seq": 1,
            "type": "request",
            "command": "launch",
            "arguments": {"program": ws_api.WORKSPACE_MAIN_PY, "cwd": ws_api.WORKSPACE_DIR},
        },
        ensure_ascii=False,
    )
    websocket = FakeWebSocket(
        query_params={"token": "valid-token"},
        incoming=[launch_request, ws_api.WebSocketDisconnect()],
    )

    asyncio.run(ws_api.dap_ws(websocket, session_id, db=None))

    assert fake_celery.calls == [("app.tasks.pythonlab.stop_session", [session_id])]
    payloads = [json.loads(item) for item in websocket.sent_texts]
    assert payloads[0]["type"] == "response"
    assert payloads[1]["type"] == "event"
    assert payloads[1]["event"] == "terminated"
    assert payloads[1]["body"]["fallback_reason"] == "done_output"
    meta = fake_cache.store[session_key]
    assert isinstance(meta, dict)
    assert meta["status"] == ws_api.SESSION_STATUS_TERMINATED


def test_dap_ws_returns_error_response_for_invalid_launch_request(monkeypatch):
    fake_cache = FakeCache()
    fake_cache.client = FakeRedisClient()
    session_id = "dbg_invalid_launch"
    session_key = f"{ws_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"
    fake_cache.store[session_key] = _make_debug_session_meta(session_id)
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})
    monkeypatch.setattr(ws_api, "now_iso", lambda: "2026-04-07T00:00:00+00:00")

    async def _pending_open_connection(*_args, **_kwargs):
        await asyncio.sleep(3600)

    monkeypatch.setattr(ws_api.asyncio, "open_connection", _pending_open_connection)
    websocket = FakeWebSocket(
        query_params={"token": "valid-token"},
        incoming=[
            json.dumps(
                {
                    "seq": 1,
                    "type": "request",
                    "command": "launch",
                    "arguments": {"program": "/tmp/other.py", "cwd": ws_api.WORKSPACE_DIR},
                },
                ensure_ascii=False,
            ),
            ws_api.WebSocketDisconnect(),
        ],
    )

    asyncio.run(ws_api.dap_ws(websocket, session_id, db=None))

    assert len(websocket.sent_texts) == 1
    payload = json.loads(websocket.sent_texts[0])
    assert payload["type"] == "response"
    assert payload["success"] is False
    assert payload["command"] == "launch"
    assert payload["request_seq"] == 1
    assert payload["message"] == f"program 仅允许 {ws_api.WORKSPACE_MAIN_PY}"
    meta = fake_cache.store[session_key]
    assert isinstance(meta, dict)
    assert meta["status"] == ws_api.SESSION_STATUS_READY


def test_dap_ws_replaces_oversized_response_with_small_error_response(monkeypatch):
    fake_cache = FakeCache()
    fake_cache.client = FakeRedisClient()
    writer = FakeStreamWriter()
    session_id = "dbg_response_too_large"
    session_key = f"{ws_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"
    fake_cache.store[session_key] = _make_debug_session_meta(
        session_id,
        limits={"max_dap_msg_bytes": 128},
    )
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})
    monkeypatch.setattr(ws_api, "now_iso", lambda: "2026-04-07T00:00:00+00:00")

    async def _fake_open_connection(_host, _port):
        return object(), writer

    async def _fake_read_dap_message(_reader):
        if not hasattr(_fake_read_dap_message, "called"):
            _fake_read_dap_message.called = True  # type: ignore[attr-defined]
            return {
                "type": "response",
                "command": "initialize",
                "request_seq": 1,
                "success": True,
                "body": {"payload": "x" * 2048},
            }
        await asyncio.sleep(3600)

    monkeypatch.setattr(ws_api.asyncio, "open_connection", _fake_open_connection)
    monkeypatch.setattr(ws_api, "_read_dap_message", _fake_read_dap_message)
    websocket = FakeWebSocket(
        query_params={"token": "valid-token"},
        incoming=[
            json.dumps(
                {"seq": 1, "type": "request", "command": "initialize", "arguments": {}},
                ensure_ascii=False,
            ),
            ws_api.WebSocketDisconnect(),
        ],
    )

    asyncio.run(ws_api.dap_ws(websocket, session_id, db=None))

    assert len(websocket.sent_texts) == 1
    payload = json.loads(websocket.sent_texts[0])
    assert payload["type"] == "response"
    assert payload["success"] is False
    assert payload["command"] == "initialize"
    assert payload["request_seq"] == 1
    assert payload["message"] == "response too large"


def test_dap_ws_emits_truncation_notice_when_output_exceeds_limit(monkeypatch):
    fake_cache = FakeCache()
    fake_cache.client = FakeRedisClient()
    writer = FakeStreamWriter()
    session_id = "dbg_output_truncated"
    session_key = f"{ws_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"
    fake_cache.store[session_key] = _make_debug_session_meta(
        session_id,
        limits={"max_stdout_kb": 1},
    )
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})
    monkeypatch.setattr(ws_api, "now_iso", lambda: "2026-04-07T00:00:00+00:00")

    async def _fake_open_connection(_host, _port):
        return object(), writer

    read_queue = [
        {"type": "response", "command": "initialize", "request_seq": 1, "success": True, "body": {}},
        {
            "type": "event",
            "event": "output",
            "body": {"category": "stdout", "output": "x" * (17 * 1024)},
        },
    ]

    async def _fake_read_dap_message(_reader):
        next_item = read_queue.pop(0)
        if isinstance(next_item, BaseException):
            raise next_item
        return next_item

    monkeypatch.setattr(ws_api.asyncio, "open_connection", _fake_open_connection)
    monkeypatch.setattr(ws_api, "_read_dap_message", _fake_read_dap_message)
    websocket = FakeWebSocket(
        query_params={"token": "valid-token"},
        incoming=[
            json.dumps(
                {"seq": 1, "type": "request", "command": "initialize", "arguments": {}},
                ensure_ascii=False,
            ),
            ws_api.WebSocketDisconnect(),
        ],
    )

    asyncio.run(ws_api.dap_ws(websocket, session_id, db=None))

    assert len(websocket.sent_texts) == 2
    initialize_payload = json.loads(websocket.sent_texts[0])
    truncation_payload = json.loads(websocket.sent_texts[1])
    assert initialize_payload["type"] == "response"
    assert truncation_payload["type"] == "event"
    assert truncation_payload["event"] == "output"
    assert "stdout/stderr 输出已截断" in truncation_payload["body"]["output"]


def test_dap_ws_closes_when_non_response_message_is_too_large(monkeypatch):
    fake_cache = FakeCache()
    fake_cache.client = FakeRedisClient()
    writer = FakeStreamWriter()
    session_id = "dbg_event_too_large"
    session_key = f"{ws_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"
    fake_cache.store[session_key] = _make_debug_session_meta(
        session_id,
        limits={"max_dap_msg_bytes": 128},
    )
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})
    monkeypatch.setattr(ws_api, "now_iso", lambda: "2026-04-07T00:00:00+00:00")

    async def _fake_open_connection(_host, _port):
        return object(), writer

    read_queue = [
        {"type": "response", "command": "initialize", "request_seq": 1, "success": True, "body": {}},
        {
            "type": "event",
            "event": "custom",
            "body": {"payload": "x" * 2048},
        },
    ]

    async def _fake_read_dap_message(_reader):
        next_item = read_queue.pop(0)
        if isinstance(next_item, BaseException):
            raise next_item
        return next_item

    monkeypatch.setattr(ws_api.asyncio, "open_connection", _fake_open_connection)
    monkeypatch.setattr(ws_api, "_read_dap_message", _fake_read_dap_message)
    websocket = FakeWebSocket(
        query_params={"token": "valid-token"},
        incoming=[
            json.dumps(
                {"seq": 1, "type": "request", "command": "initialize", "arguments": {}},
                ensure_ascii=False,
            ),
            ws_api.WebSocketDisconnect(),
        ],
    )

    asyncio.run(ws_api.dap_ws(websocket, session_id, db=None))

    payloads = [json.loads(item) for item in websocket.sent_texts]
    assert payloads[0]["type"] == "response"
    assert payloads[1]["type"] == "event"
    assert payloads[1]["event"] == "output"
    assert payloads[1]["body"]["output"] == "DAP 消息过大，连接已断开\n"
    assert any(code == 1011 for code, _ in websocket.closed)


def test_dap_ws_retries_after_startup_eof_and_emits_retry_notice(monkeypatch):
    fake_cache = FakeCache()
    fake_cache.client = FakeRedisClient()
    writer = FakeStreamWriter()
    session_id = "dbg_startup_retry"
    session_key = f"{ws_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"
    fake_cache.store[session_key] = _make_debug_session_meta(session_id)
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})
    monkeypatch.setattr(ws_api, "now_iso", lambda: "2026-04-07T00:00:00+00:00")

    async def _fake_open_connection(_host, _port):
        return object(), writer

    read_queue = [
        EOFError("cold start"),
        {"type": "response", "command": "initialize", "request_seq": 1, "success": True, "body": {}},
        EOFError("after init"),
    ]

    async def _fake_read_dap_message(_reader):
        next_item = read_queue.pop(0)
        if isinstance(next_item, BaseException):
            raise next_item
        return next_item

    monkeypatch.setattr(ws_api.asyncio, "gather", _make_mainline_gather())
    monkeypatch.setattr(ws_api.asyncio, "open_connection", _fake_open_connection)
    monkeypatch.setattr(ws_api, "_read_dap_message", _fake_read_dap_message)
    websocket = FakeWebSocket(query_params={"token": "valid-token"})
    initialize_request = json.dumps(
        {"seq": 1, "type": "request", "command": "initialize", "arguments": {}},
        ensure_ascii=False,
    )
    receive_calls = {"count": 0}

    async def _receive_text():
        if receive_calls["count"] == 0:
            receive_calls["count"] += 1
            return initialize_request
        await asyncio.sleep(3600)

    websocket.receive_text = _receive_text  # type: ignore[method-assign]

    asyncio.run(ws_api.dap_ws(websocket, session_id, db=None))

    payloads = [json.loads(item) for item in websocket.sent_texts]
    assert payloads[0]["type"] == "event"
    assert payloads[0]["event"] == "output"
    assert "调试服务正在启动或重启" in payloads[0]["body"]["output"]
    assert payloads[1]["type"] == "response"
    assert payloads[1]["command"] == "initialize"
    assert payloads[2]["type"] == "event"
    assert payloads[2]["event"] == "output"
    assert "调试服务连接已断开" in payloads[2]["body"]["output"]


def test_dap_ws_closes_when_client_request_message_is_too_large(monkeypatch):
    fake_cache = FakeCache()
    fake_cache.client = FakeRedisClient()
    session_id = "dbg_client_msg_too_large"
    session_key = f"{ws_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"
    fake_cache.store[session_key] = _make_debug_session_meta(session_id)
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})
    monkeypatch.setattr(ws_api, "now_iso", lambda: "2026-04-07T00:00:00+00:00")

    async def _pending_open_connection(*_args, **_kwargs):
        await asyncio.sleep(3600)

    monkeypatch.setattr(ws_api.asyncio, "open_connection", _pending_open_connection)
    websocket = FakeWebSocket(
        query_params={"token": "valid-token"},
        incoming=["x" * (ws_api.WS_MAX_DAP_MSG_BYTES + 1)],
    )

    asyncio.run(ws_api.dap_ws(websocket, session_id, db=None))

    assert len(websocket.sent_texts) == 1
    payload = json.loads(websocket.sent_texts[0])
    assert payload["type"] == "event"
    assert payload["event"] == "output"
    assert payload["body"]["output"] == "debug ws proxy error: ValueError: message too large\n"
    assert any(code == 1011 for code, _ in websocket.closed)


def test_dap_ws_persists_stopped_then_continued_then_terminated_statuses(monkeypatch):
    fake_cache = FakeCache()
    fake_cache.client = FakeRedisClient()
    fake_celery = FakeCeleryApp()
    writer = FakeStreamWriter()
    session_id = "dbg_status_events"
    session_key = f"{ws_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"
    fake_cache.store[session_key] = _make_debug_session_meta(session_id)
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})
    monkeypatch.setattr(ws_api, "celery_app", fake_celery)
    monkeypatch.setattr(ws_api, "now_iso", lambda: "2026-04-07T00:00:00+00:00")

    async def _fake_open_connection(_host, _port):
        return object(), writer

    read_queue = [
        {"type": "response", "command": "initialize", "request_seq": 1, "success": True, "body": {}},
        {"type": "event", "event": "stopped", "body": {"reason": "breakpoint"}},
        {"type": "event", "event": "continued", "body": {"threadId": 1}},
        {"type": "event", "event": "terminated", "body": {"restart": False}},
        EOFError("after terminated"),
    ]

    async def _fake_read_dap_message(_reader):
        next_item = read_queue.pop(0)
        if isinstance(next_item, BaseException):
            raise next_item
        return next_item

    monkeypatch.setattr(ws_api.asyncio, "gather", _make_mainline_gather())
    monkeypatch.setattr(ws_api.asyncio, "open_connection", _fake_open_connection)
    monkeypatch.setattr(ws_api, "_read_dap_message", _fake_read_dap_message)
    websocket = FakeWebSocket(
        query_params={"token": "valid-token"},
        incoming=[
            json.dumps(
                {"seq": 1, "type": "request", "command": "initialize", "arguments": {}},
                ensure_ascii=False,
            ),
            ws_api.WebSocketDisconnect(),
        ],
    )

    asyncio.run(ws_api.dap_ws(websocket, session_id, db=None))

    status_history = [
        value["status"]
        for key, value, _expire in fake_cache.set_calls
        if key == session_key and isinstance(value, dict) and "status" in value
    ]
    assert ws_api.SESSION_STATUS_ATTACHED in status_history
    assert ws_api.SESSION_STATUS_STOPPED in status_history
    assert ws_api.SESSION_STATUS_RUNNING in status_history
    assert ws_api.SESSION_STATUS_TERMINATED in status_history
    assert fake_celery.calls == [("app.tasks.pythonlab.stop_session", [session_id])]


def test_dap_ws_keeps_paused_status_after_transient_disconnect(monkeypatch):
    fake_cache = FakeCache()
    fake_cache.client = FakeRedisClient()
    writer = FakeStreamWriter()
    session_id = "dbg_reconnect_paused_status"
    session_key = f"{ws_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"
    fake_cache.store[session_key] = _make_debug_session_meta(session_id)
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})
    monkeypatch.setattr(ws_api, "now_iso", lambda: "2026-04-07T00:00:00+00:00")
    ws_api._DAP_BRIDGES.clear()

    async def _fake_open_connection(_host, _port):
        return object(), writer

    read_queue = [
        {"type": "response", "command": "initialize", "request_seq": 1, "success": True, "body": {"supportsConfigurationDoneRequest": True}},
        {"type": "event", "event": "initialized"},
        {"type": "response", "command": "setBreakpoints", "request_seq": 3, "success": True, "body": {"breakpoints": [{"verified": True, "line": 6}]}},
        {"type": "response", "command": "configurationDone", "request_seq": 4, "success": True},
        {"type": "response", "command": "attach", "request_seq": 2, "success": True, "body": {}},
        {"type": "event", "event": "stopped", "body": {"reason": "breakpoint", "threadId": 1}},
    ]

    async def _fake_read_dap_message(_reader):
        if read_queue:
            next_item = read_queue.pop(0)
            if isinstance(next_item, BaseException):
                raise next_item
            return next_item
        await asyncio.sleep(3600)

    monkeypatch.setattr(ws_api.asyncio, "open_connection", _fake_open_connection)
    monkeypatch.setattr(ws_api, "_read_dap_message", _fake_read_dap_message)

    websocket = FakeWebSocket(
        query_params={"token": "valid-token"},
        incoming=[
            json.dumps({"seq": 1, "type": "request", "command": "initialize", "arguments": {}}, ensure_ascii=False),
            json.dumps(
                {
                    "seq": 2,
                    "type": "request",
                    "command": "attach",
                    "arguments": {
                        "name": "Remote",
                        "type": "python",
                        "request": "attach",
                        "pathMappings": [{"localRoot": "/workspace", "remoteRoot": "/workspace"}],
                        "justMyCode": True,
                    },
                },
                ensure_ascii=False,
            ),
            json.dumps(
                {
                    "seq": 3,
                    "type": "request",
                    "command": "setBreakpoints",
                    "arguments": {"source": {"path": ws_api.WORKSPACE_MAIN_PY}, "breakpoints": [{"line": 6}]},
                },
                ensure_ascii=False,
            ),
            json.dumps({"seq": 4, "type": "request", "command": "configurationDone", "arguments": {}}, ensure_ascii=False),
            ws_api.WebSocketDisconnect(),
        ],
    )

    asyncio.run(ws_api.dap_ws(websocket, session_id, db=None))

    meta = fake_cache.store[session_key]
    assert isinstance(meta, dict)
    assert meta["status"] == ws_api.SESSION_STATUS_STOPPED
    owner = meta.get("debug_owner")
    assert isinstance(owner, dict)
    assert owner["state"] == "detached"

    bridge = ws_api._DAP_BRIDGES.get(session_id)
    assert bridge is not None
    asyncio.run(bridge.close("test_cleanup"))
    ws_api._DAP_BRIDGES.clear()


def test_dap_ws_reconnect_bootstrap_replays_stopped_state_and_stacktrace(monkeypatch):
    fake_cache = FakeCache()
    fake_cache.client = FakeRedisClient()
    writer = FakeStreamWriter()
    session_id = "dbg_reconnect_bootstrap"
    session_key = f"{ws_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"
    fake_cache.store[session_key] = _make_debug_session_meta(session_id)
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})
    monkeypatch.setattr(ws_api, "now_iso", lambda: "2026-04-07T00:00:00+00:00")
    ws_api._DAP_BRIDGES.clear()

    async def _fake_open_connection(_host, _port):
        return object(), writer

    first_phase = [
        {"type": "response", "command": "initialize", "request_seq": 1, "success": True, "body": {"supportsConfigurationDoneRequest": True}},
        {"type": "event", "event": "initialized"},
        {"type": "response", "command": "setBreakpoints", "request_seq": 3, "success": True, "body": {"breakpoints": [{"verified": True, "line": 6}]}},
        {"type": "response", "command": "configurationDone", "request_seq": 4, "success": True},
        {"type": "response", "command": "attach", "request_seq": 2, "success": True, "body": {}},
        {"type": "event", "event": "stopped", "body": {"reason": "breakpoint", "threadId": 1}},
    ]

    async def _fake_read_dap_message(_reader):
        if first_phase:
            next_item = first_phase.pop(0)
            if isinstance(next_item, BaseException):
                raise next_item
            return next_item
        await asyncio.sleep(3600)

    monkeypatch.setattr(ws_api.asyncio, "open_connection", _fake_open_connection)
    monkeypatch.setattr(ws_api, "_read_dap_message", _fake_read_dap_message)

    async def _run_scenario():
        first_ws = FakeWebSocket(
            query_params={"token": "valid-token"},
            incoming=[
                json.dumps({"seq": 1, "type": "request", "command": "initialize", "arguments": {}}, ensure_ascii=False),
                json.dumps(
                    {
                        "seq": 2,
                        "type": "request",
                        "command": "attach",
                        "arguments": {
                            "name": "Remote",
                            "type": "python",
                            "request": "attach",
                            "pathMappings": [{"localRoot": "/workspace", "remoteRoot": "/workspace"}],
                            "justMyCode": True,
                        },
                    },
                    ensure_ascii=False,
                ),
                json.dumps(
                    {
                        "seq": 3,
                        "type": "request",
                        "command": "setBreakpoints",
                        "arguments": {"source": {"path": ws_api.WORKSPACE_MAIN_PY}, "breakpoints": [{"line": 6}]},
                    },
                    ensure_ascii=False,
                ),
                json.dumps({"seq": 4, "type": "request", "command": "configurationDone", "arguments": {}}, ensure_ascii=False),
                ws_api.WebSocketDisconnect(),
            ],
        )
        await ws_api.dap_ws(first_ws, session_id, db=None)

        second_ws = FakeWebSocket(
            query_params={"token": "valid-token"},
            incoming=[
                json.dumps({"seq": 1, "type": "request", "command": "initialize", "arguments": {}}, ensure_ascii=False),
                json.dumps(
                    {
                        "seq": 2,
                        "type": "request",
                        "command": "attach",
                        "arguments": {
                            "name": "Remote",
                            "type": "python",
                            "request": "attach",
                            "pathMappings": [{"localRoot": "/workspace", "remoteRoot": "/workspace"}],
                            "justMyCode": True,
                        },
                    },
                    ensure_ascii=False,
                ),
                json.dumps({"seq": 3, "type": "request", "command": "configurationDone", "arguments": {}}, ensure_ascii=False),
                json.dumps(
                    {"seq": 4, "type": "request", "command": "stackTrace", "arguments": {"threadId": 1, "startFrame": 0, "levels": 20}},
                    ensure_ascii=False,
                ),
            ],
        )
        async def _second_receive_text():
            if second_ws.incoming:
                next_item = second_ws.incoming.pop(0)
                if isinstance(next_item, BaseException):
                    raise next_item
                return str(next_item)
            await asyncio.sleep(3600)
        second_ws.receive_text = _second_receive_text  # type: ignore[method-assign]
        second_task = asyncio.create_task(ws_api.dap_ws(second_ws, session_id, db=None))
        for _ in range(100):
            payloads = [json.loads(item) for item in second_ws.sent_texts]
            if any(payload.get("event") == "stopped" for payload in payloads) and b'"command": "stackTrace"' in bytes(writer.buffer):
                break
            await asyncio.sleep(0)
        if not second_task.done():
            second_task.cancel()
            await asyncio.gather(second_task, return_exceptions=True)
        bridge = ws_api._DAP_BRIDGES.get(session_id)
        if bridge is not None:
            await bridge.close("test_cleanup")
        return first_ws, second_ws

    first_ws, second_ws = asyncio.run(_run_scenario())

    first_payloads = [json.loads(item) for item in first_ws.sent_texts]
    second_payloads = [json.loads(item) for item in second_ws.sent_texts]
    assert any(payload.get("event") == "stopped" for payload in first_payloads)
    assert second_payloads[0]["type"] == "response"
    assert second_payloads[0]["command"] == "initialize"
    assert second_payloads[1]["type"] == "response"
    assert second_payloads[1]["command"] == "attach"
    assert any(payload.get("event") == "initialized" for payload in second_payloads)
    assert any(payload.get("event") == "stopped" for payload in second_payloads)
    assert b'"command": "stackTrace"' in bytes(writer.buffer)

    meta = fake_cache.store[session_key]
    assert isinstance(meta, dict)
    assert meta["status"] == ws_api.SESSION_STATUS_STOPPED
    ws_api._DAP_BRIDGES.clear()


def test_dap_ws_rate_limits_frequent_requests(monkeypatch):
    fake_cache = FakeCache()
    fake_cache.client = FakeRedisClient()
    session_id = "dbg_rate_limit"
    session_key = f"{ws_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"
    fake_cache.store[session_key] = _make_debug_session_meta(session_id)
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})
    monkeypatch.setattr(ws_api, "WS_RATE_LIMIT_PER_SEC", 1)
    monkeypatch.setattr(ws_api, "now_iso", lambda: "2026-04-07T00:00:00+00:00")
    monkeypatch.setattr(ws_api.asyncio, "gather", _make_mainline_gather(main_count=1))
    websocket = FakeWebSocket(
        query_params={"token": "valid-token"},
        incoming=[
            json.dumps({"seq": 1, "type": "request", "command": "initialize", "arguments": {}}, ensure_ascii=False),
            json.dumps({"seq": 2, "type": "request", "command": "threads", "arguments": {}}, ensure_ascii=False),
        ],
    )

    asyncio.run(ws_api.dap_ws(websocket, session_id, db=None))

    assert len(websocket.sent_texts) == 1
    payload = json.loads(websocket.sent_texts[0])
    assert payload["type"] == "event"
    assert payload["event"] == "output"
    assert payload["body"]["output"] == "请求过于频繁，已触发限流断开\n"
    assert any(code == 1011 for code, _ in websocket.closed)


def test_dap_ws_ignores_telemetry_output_events(monkeypatch):
    fake_cache = FakeCache()
    fake_cache.client = FakeRedisClient()
    writer = FakeStreamWriter()
    session_id = "dbg_ignore_telemetry"
    session_key = f"{ws_api.CACHE_KEY_SESSION_PREFIX}:{session_id}"
    fake_cache.store[session_key] = _make_debug_session_meta(session_id)
    _patch_ws_auth_and_cache(monkeypatch, fake_cache=fake_cache, user={"id": 7})
    monkeypatch.setattr(ws_api, "now_iso", lambda: "2026-04-07T00:00:00+00:00")
    monkeypatch.setattr(ws_api.asyncio, "gather", _make_mainline_gather())

    async def _fake_open_connection(_host, _port):
        return object(), writer

    read_queue = [
        {"type": "response", "command": "initialize", "request_seq": 1, "success": True, "body": {}},
        {"type": "event", "event": "output", "body": {"category": "telemetry", "output": "debugpy telemetry"}},
        {"type": "event", "event": "output", "body": {"category": "stdout", "output": "visible\n"}},
        EOFError("after visible"),
    ]

    async def _fake_read_dap_message(_reader):
        next_item = read_queue.pop(0)
        if isinstance(next_item, BaseException):
            raise next_item
        return next_item

    monkeypatch.setattr(ws_api.asyncio, "open_connection", _fake_open_connection)
    monkeypatch.setattr(ws_api, "_read_dap_message", _fake_read_dap_message)
    websocket = FakeWebSocket(query_params={"token": "valid-token"})
    initialize_request = json.dumps(
        {"seq": 1, "type": "request", "command": "initialize", "arguments": {}},
        ensure_ascii=False,
    )
    receive_calls = {"count": 0}

    async def _receive_text():
        if receive_calls["count"] == 0:
            receive_calls["count"] += 1
            return initialize_request
        await asyncio.sleep(3600)

    websocket.receive_text = _receive_text  # type: ignore[method-assign]

    asyncio.run(ws_api.dap_ws(websocket, session_id, db=None))

    payloads = [json.loads(item) for item in websocket.sent_texts]
    assert payloads[0]["type"] == "response"
    assert payloads[0]["command"] == "initialize"
    assert payloads[1]["type"] == "event"
    assert payloads[1]["event"] == "output"
    assert payloads[1]["body"]["output"] == "visible\n"
    assert payloads[2]["type"] == "event"
    assert payloads[2]["event"] == "output"
    assert "调试服务连接已断开" in payloads[2]["body"]["output"]
