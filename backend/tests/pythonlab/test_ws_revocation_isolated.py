"""Real ASGI/JWT/logout/SQLite + optional dedicated UNIX Redis; synthetic DAP.

Run with dotenv/conftest disabled and network denied except the exact dedicated
Redis UNIX socket. No normal DB/Redis, Docker or debugpy is used by this suite.
"""
import asyncio
import json
import os
import socket
import sys
from contextlib import asynccontextmanager, suppress
from types import SimpleNamespace
from urllib.parse import urlencode

import pytest

from app.api.pythonlab.ws import handlers, connection_auth, session_auth
from app.core import session_guard
from app.services import auth as auth_service
from app.utils.cache import RedisCache
from test_logout_revocation_isolated import isolated  # noqa: F401
from test_ws_session_auth_isolated import BusinessCache
from test_pythonlab_v2_ws_behavior import FakeCeleryApp

_ORIGINAL_CONNECT = socket.socket.connect


async def wait_for_task_cleanup(baseline, timeout=1.0):
    """Allow async driver/session finalizers to finish before leak assertion."""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout
    while True:
        pending = [task for task in asyncio.all_tasks() - baseline if not task.done()]
        if not pending:
            return
        remaining = deadline - loop.time()
        if remaining <= 0:
            break
        await asyncio.sleep(min(0.01, remaining))
    pending = [task for task in asyncio.all_tasks() - baseline if not task.done()]
    assert not pending, f"background tasks survived cleanup: {pending!r}"


class ASGIWebSocketClient:
    """An actual WebSocket ASGI scope; no replacement of the endpoint or auth."""

    def __init__(self, app, endpoint, token):
        path = '/api/v2/pythonlab/sessions/synthetic-session/' + endpoint
        self.scope = {
            'type': 'websocket', 'asgi': {'version': '3.0', 'spec_version': '2.4'},
            'http_version': '1.1', 'scheme': 'ws', 'path': path, 'raw_path': path.encode(),
            'root_path': '', 'query_string': urlencode({'token': token}).encode(),
            'headers': [(b'host', b'isolated.invalid')], 'client': ('192.0.2.10', 12345),
            'server': ('isolated.invalid', 80), 'subprotocols': [], 'state': {},
        }
        self.app = app
        self.incoming = asyncio.Queue()
        self.messages = []
        self.closed = asyncio.Event()
        self.task = None

    async def __aenter__(self):
        self.incoming.put_nowait({'type': 'websocket.connect'})
        self.task = asyncio.create_task(self.app(self.scope, self.incoming.get, self.send))
        return self

    async def send(self, message):
        self.messages.append(message)
        if message['type'] == 'websocket.close':
            self.closed.set()

    def input(self, text):
        self.incoming.put_nowait({'type': 'websocket.receive', 'text': text})

    async def expect_revoked(self, timeout=4):
        await asyncio.wait_for(self.closed.wait(), timeout)
        assert [m['code'] for m in self.messages if m['type'] == 'websocket.close'] == [4401]
        await asyncio.wait_for(asyncio.shield(self.task), timeout)

    async def __aexit__(self, *args):
        self.incoming.put_nowait({'type': 'websocket.disconnect', 'code': 1000})
        if self.task and not self.task.done():
            self.task.cancel()
        if self.task:
            with suppress(asyncio.CancelledError):
                await self.task


@asynccontextmanager
async def auth_store(h, monkeypatch, kind):
    if kind == 'memory':
        yield h.cache
        return
    path = os.environ.get('WS_B_REDIS_SOCKET')
    if not path:
        pytest.skip('requires explicitly provisioned dedicated Redis UNIX socket')
    # The harness blocks all sockets; restore ONLY this exact UNIX socket. The
    # external runner independently enforces the same address via an audit hook.
    def exact_connect(sock, address):
        if sock.family != socket.AF_UNIX or address != path:
            raise AssertionError('only dedicated Redis UNIX socket allowed')
        return _ORIGINAL_CONNECT(sock, address)
    monkeypatch.setattr(socket.socket, 'connect', exact_connect)
    import redis.asyncio as redis
    client = redis.Redis(unix_socket_path=path, decode_responses=True)
    # Real production get/set/error semantics without singleton initialization or
    # any config/environment-derived server. This is a newly allocated instance.
    cache = object.__new__(RedisCache)
    cache._client, cache._initialized = client, True
    cache._loop = asyncio.get_running_loop()
    monkeypatch.setattr(session_guard, 'cache', cache)
    try:
        assert await client.ping()
        yield cache
    finally:
        # These are the only authentication keys the synthetic two-user fixture
        # can create; no scan/flush or normal instance is ever used.
        await client.delete('auth:session:uid:1', 'auth:session:uid:2', 'auth:session:ip:192.0.2.10')
        await client.aclose()


def install_transport(h, monkeypatch, *, gate=None, transport_gate=None):
    h.app.include_router(handlers.router, prefix='/api/v2/pythonlab')
    state = SimpleNamespace(attached=asyncio.Event(), seen=[], detached=False, fd=None, write_fd=None, killed=False)

    class Cache(BusinessCache):
        async def get(self, key):
            if gate and not gate[0].is_set():
                gate[0].set()
                await gate[1].wait()
            return await super().get(key)

    business = Cache()
    business.store[f'{handlers.CACHE_KEY_SESSION_PREFIX}:synthetic-session'] = {
        'session_id': 'synthetic-session', 'owner_user_id': 1,
        'status': handlers.SESSION_STATUS_READY, 'dap_port': 5678,
        'runtime_mode': 'debug', 'ttl_seconds': 300, 'limits': {},
    }
    monkeypatch.setattr(handlers, 'cache', business)
    monkeypatch.setattr(handlers, 'celery_app', FakeCeleryApp())

    class Bridge:
        gateway_seq = 0
        reader_task = flush_task = None
        terminated_seen = closed = attached_marked = False
        async def attach_client(self, websocket, *args, **kwargs):
            state.websocket = websocket
            state.attached.set()
            if transport_gate:
                await transport_gate.wait()
        async def handle_client_text(self, data):
            state.seen.append(data)
        async def detach_client(self, *args):
            state.detached = True
        def should_preserve_runtime(self):
            return False
        async def _send_output(self, text):
            state.seen.append('ERROR:' + text)

    async def bridge_factory(**kwargs):
        state.seen.append('factory')
        return Bridge()

    class Process:
        returncode = None
        def kill(self):
            state.killed = True
            self.returncode = -9
        async def wait(self):
            return self.returncode

    class Provider:
        async def attach_tty(self, *args):
            state.seen.append('attach')
            # socketpair permits bidirectional fd IO and cancellable readiness,
            # but is explicitly a terminal transport double, not a Docker PTY.
            state.terminal_sock, state.peer = socket.socketpair()
            state.fd = state.terminal_sock.detach()
            state.attached.set()
            if transport_gate:
                await transport_gate.wait()
            return Process(), state.fd

    monkeypatch.setattr(handlers, '_get_or_create_dap_bridge', bridge_factory)
    monkeypatch.setitem(sys.modules, 'app.core.sandbox.docker', SimpleNamespace(DockerProvider=Provider))
    state.business = business
    return state


@pytest.mark.parametrize('kind', ['memory', 'redis'])
@pytest.mark.parametrize('endpoint', ['terminal', 'ws'])
def test_logout_between_admission_and_transport(isolated, monkeypatch, kind, endpoint):
    async def scenario():
        async with isolated() as h, auth_store(h, monkeypatch, kind):
            pair = await h.login('a')
            gate = (asyncio.Event(), asyncio.Event())
            state = install_transport(h, monkeypatch, gate=gate)
            # Slow watchdog proves the explicit boundary check, not just polling.
            monkeypatch.setattr(connection_auth, 'REVOCATION_INTERVAL_SECONDS', 30)
            async with ASGIWebSocketClient(h.app, endpoint, pair['access_token']) as ws:
                await asyncio.wait_for(gate[0].wait(), 2)
                await h.logout(pair)
                assert await h.revoked(pair)
                assert not (await session_guard.verify_request_session_detail(1, auth_service.verify_token(pair['access_token'])))['ok']
                gate[1].set()
                await ws.expect_revoked()
                assert not state.seen
    asyncio.run(scenario())


@pytest.mark.parametrize('kind', ['memory', 'redis'])
@pytest.mark.parametrize('endpoint', ['terminal', 'ws'])
@pytest.mark.parametrize('action', ['input', 'idle'])
def test_established_connection_real_logout(isolated, monkeypatch, kind, endpoint, action):
    async def scenario():
        async with isolated() as h, auth_store(h, monkeypatch, kind):
            pair = await h.login('a')
            state = install_transport(h, monkeypatch)
            monkeypatch.setattr(connection_auth, 'REVOCATION_INTERVAL_SECONDS', 30 if action == 'input' else .05)
            initial_tasks = set(asyncio.all_tasks())
            try:
                async with ASGIWebSocketClient(h.app, endpoint, pair['access_token']) as ws:
                    await asyncio.wait_for(state.attached.wait(), 2)
                    if endpoint == 'ws':
                        ws.input('{"type":"request","command":"continue","seq":1}')
                        for _ in range(100):
                            if len(state.seen) > 1:
                                break
                            await asyncio.sleep(.005)
                        assert len(state.seen) == 2  # positive control before logout
                    await h.logout(pair)
                    assert await h.revoked(pair)
                    baseline = list(state.seen)
                    if action == 'input':
                        ws.input('{"type":"request","command":"continue","seq":2}' if endpoint == 'ws' else 'print("revoked")\n')
                    await ws.expect_revoked()
                    assert state.seen == baseline
                    if endpoint == 'terminal':
                        assert state.killed
                        with pytest.raises(OSError):
                            os.fstat(state.fd)
                        state.peer.setblocking(False)
                        assert state.peer.recv(4096) == b''
                    else:
                        assert state.detached
                        assert not state.business.client.values.get('debug:session:synthetic-session:ws_owner')
                await wait_for_task_cleanup(initial_tasks)
            finally:
                if hasattr(state, 'peer'):
                    state.peer.close()
    asyncio.run(scenario())


@pytest.mark.parametrize('kind', ['memory', 'redis'])
@pytest.mark.parametrize('fault', ['missing', 'exception', 'timeout', 'expired', 'relogin'])
@pytest.mark.parametrize('endpoint', ['terminal', 'ws'])
def test_established_fail_closed(isolated, monkeypatch, fault, endpoint, kind):
    async def scenario():
        async with isolated() as h, auth_store(h, monkeypatch, kind) as store:
            pair = await h.login('a')
            state = install_transport(h, monkeypatch)
            monkeypatch.setattr(connection_auth, 'REVOCATION_INTERVAL_SECONDS', .03)
            monkeypatch.setattr(session_auth, 'AUTH_CHECK_TIMEOUT_SECONDS', .08)
            try:
                async with ASGIWebSocketClient(h.app, endpoint, pair['access_token']) as ws:
                    await asyncio.wait_for(state.attached.wait(), 2)
                    if fault == 'missing':
                        if kind == "redis":
                            await store.delete(session_guard._key_user(1))
                        else:
                            store.data.pop(session_guard._key_user(1))
                    elif fault in {'exception', 'timeout'}:
                        async def fail(_key):
                            if fault == 'timeout':
                                await asyncio.Event().wait()
                            raise RuntimeError('synthetic storage failure')
                        monkeypatch.setattr(store._client if kind == 'redis' else store, 'get', fail)
                    elif fault == 'expired':
                        monkeypatch.setattr(session_auth, 'verify_token', lambda token: None)
                    else:
                        await h.login('a')
                    await ws.expect_revoked(timeout=1)
            finally:
                if hasattr(state, 'peer'):
                    state.peer.close()
    asyncio.run(scenario())


def test_revocation_latch_does_not_reopen_on_concurrent_success(monkeypatch):
    async def scenario():
        entered, release = asyncio.Event(), asyncio.Event()
        calls = 0
        async def verify(*args):
            nonlocal calls
            calls += 1
            if calls == 1:
                entered.set()
                await release.wait()
                return True
            return False
        monkeypatch.setattr(session_auth, 'verify_ws_session', verify)
        ws = connection_auth.SessionWebSocket(None, 'synthetic', {'id': 1})
        pending = asyncio.create_task(ws.check_session())
        await entered.wait()
        with pytest.raises(handlers.WebSocketDisconnect):
            await ws.check_session()
        release.set()
        with pytest.raises(handlers.WebSocketDisconnect):
            await pending
        assert ws.revoked
    asyncio.run(scenario())


@pytest.mark.parametrize('kind', ['memory', 'redis'])
@pytest.mark.parametrize('endpoint', ['terminal', 'ws'])
def test_logout_while_attach_in_flight(isolated, monkeypatch, kind, endpoint):
    async def scenario():
        async with isolated() as h, auth_store(h, monkeypatch, kind):
            pair = await h.login('a')
            release = asyncio.Event()
            state = install_transport(h, monkeypatch, transport_gate=release)
            monkeypatch.setattr(connection_auth, 'REVOCATION_INTERVAL_SECONDS', 30)
            try:
                async with ASGIWebSocketClient(h.app, endpoint, pair['access_token']) as ws:
                    await asyncio.wait_for(state.attached.wait(), 2)
                    await h.logout(pair)
                    assert await h.revoked(pair)
                    baseline = list(state.seen)
                    ws.input('continue')
                    release.set()
                    await ws.expect_revoked()
                    assert state.seen == baseline
                    if endpoint == 'terminal':
                        assert state.killed
                        with pytest.raises(OSError):
                            os.fstat(state.fd)
                    else:
                        assert state.detached
                        assert not state.business.client.values.get('debug:session:synthetic-session:ws_owner')
            finally:
                release.set()
                if hasattr(state, 'peer'):
                    state.peer.close()
    asyncio.run(scenario())


@pytest.mark.parametrize('endpoint', ['terminal', 'ws'])
def test_asgi_cancellation_cleans_tasks(isolated, monkeypatch, endpoint):
    async def scenario():
        async with isolated() as h:
            pair = await h.login('a')
            state = install_transport(h, monkeypatch)
            baseline = set(asyncio.all_tasks())
            try:
                async with ASGIWebSocketClient(h.app, endpoint, pair['access_token']) as ws:
                    await asyncio.wait_for(state.attached.wait(), 2)
                    await asyncio.sleep(.02)
                    ws.task.cancel()
                    with pytest.raises(asyncio.CancelledError):
                        await ws.task
                    if endpoint == 'terminal':
                        assert state.killed
                        with pytest.raises(OSError):
                            os.fstat(state.fd)
                    else:
                        assert state.detached
                await wait_for_task_cleanup(baseline)
            finally:
                if hasattr(state, 'peer'):
                    state.peer.close()
    asyncio.run(scenario())


def test_dap_output_after_logout_is_fenced(isolated, monkeypatch):
    async def scenario():
        async with isolated() as h, auth_store(h, monkeypatch, 'redis'):
            pair = await h.login('a')
            state = install_transport(h, monkeypatch)
            monkeypatch.setattr(connection_auth, 'REVOCATION_INTERVAL_SECONDS', 30)
            async with ASGIWebSocketClient(h.app, 'ws', pair['access_token']) as ws:
                await asyncio.wait_for(state.attached.wait(), 2)
                await state.websocket.send_text('valid output')
                await h.logout(pair)
                assert await h.revoked(pair)
                with pytest.raises(handlers.WebSocketDisconnect):
                    await state.websocket.send_text('revoked output')
                assert [m['text'] for m in ws.messages if m['type'] == 'websocket.send'] == ['valid output']
    asyncio.run(scenario())


@pytest.mark.parametrize('endpoint', ['terminal', 'ws'])
def test_real_redis_default_idle_bound(isolated, monkeypatch, endpoint):
    async def scenario():
        async with isolated() as h, auth_store(h, monkeypatch, 'redis'):
            pair = await h.login('a')
            state = install_transport(h, monkeypatch)
            assert connection_auth.REVOCATION_INTERVAL_SECONDS == 1.0
            try:
                async with ASGIWebSocketClient(h.app, endpoint, pair['access_token']) as ws:
                    await asyncio.wait_for(state.attached.wait(), 2)
                    await h.logout(pair)
                    assert await h.revoked(pair)
                    start = asyncio.get_running_loop().time()
                    await ws.expect_revoked(timeout=4.5)
                    assert asyncio.get_running_loop().time() - start < 4.5
            finally:
                if hasattr(state, 'peer'):
                    state.peer.close()
    asyncio.run(scenario())


def test_cancel_during_dap_owner_acquire_cleans_lease(isolated, monkeypatch):
    async def scenario():
        async with isolated() as h:
            pair = await h.login('a')
            state = install_transport(h, monkeypatch)
            acquired = asyncio.Event()
            original_set = state.business.client.set
            async def acquire_then_wait(key, *args, **kwargs):
                result = await original_set(key, *args, **kwargs)
                if key.endswith(':ws_owner'):
                    acquired.set()
                    await asyncio.Event().wait()
                return result
            monkeypatch.setattr(state.business.client, 'set', acquire_then_wait)
            monkeypatch.setattr(connection_auth, 'REVOCATION_INTERVAL_SECONDS', .03)
            baseline = set(asyncio.all_tasks())
            async with ASGIWebSocketClient(h.app, 'ws', pair['access_token']) as ws:
                await asyncio.wait_for(acquired.wait(), 2)
                await h.logout(pair)
                await ws.expect_revoked()
                assert not state.business.client.values.get('debug:session:synthetic-session:ws_owner')
                assert not state.seen
            await wait_for_task_cleanup(baseline)
    asyncio.run(scenario())
