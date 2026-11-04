"""Synthetic Docker exec stream: no daemon, network or workspace code execution."""
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.sandbox import docker_dap


class InputStream:
    def __init__(self, process):
        self.process = process
        self.closed = False
        self.buffer = bytearray()

    def write(self, data):
        self.buffer.extend(data)

    async def drain(self):
        return None

    def close(self):
        self.closed = True
        self.process.exited.set()


class Process:
    def __init__(self):
        self.returncode = None
        self.exited = asyncio.Event()
        self.stdin = InputStream(self)
        self.stdout = asyncio.StreamReader()
        self.killed = False

    async def wait(self):
        await self.exited.wait()
        self.returncode = 0
        return self.returncode

    def kill(self):
        self.killed = True
        self.exited.set()


@pytest.fixture
def transport(monkeypatch):
    state = SimpleNamespace(process=None, calls=[])

    async def spawn(*args, **kwargs):
        state.calls.append((args, kwargs))
        state.process = Process()
        return state.process

    monkeypatch.setattr(docker_dap.asyncio, 'create_subprocess_exec', spawn)
    return state


async def spawned(state):
    while state.process is None:
        await asyncio.sleep(0)
    return state.process


def test_exec_ready_precedes_stream_and_first_dap_packet_is_preserved(transport):
    async def scenario():
        connecting = asyncio.create_task(docker_dap.connect_docker_dap('a' * 64, 5678))
        process = await spawned(transport)
        assert not connecting.done()
        process.stdout.feed_data(b'PYTHONLAB_DAP_READY_V1\nContent-Length: 2\r\n\r\n{}')
        reader, writer = await connecting
        assert await reader.readexactly(23) == b'Content-Length: 2\r\n\r\n{}'
        writer.write(b'client-request')
        await writer.drain()
        assert process.stdin.buffer == b'client-request'
        args, kwargs = transport.calls[0]
        assert args[:4] == ('docker', 'exec', '-i', 'a' * 64)
        assert args[4:8] == ('python', '-I', '-u', '-c')
        assert args[-1] == '5678'
        assert '-t' not in args
        writer.close()
        await writer.wait_closed()
        assert process.stdin.closed and process.returncode == 0
    asyncio.run(scenario())


@pytest.mark.parametrize('failure', ['eof', 'invalid-ready', 'timeout', 'cancel'])
def test_exec_failure_closes_transport_without_ready_or_dap_fallback(transport, failure):
    async def scenario():
        connecting = asyncio.create_task(docker_dap.connect_docker_dap('a' * 64, 5678, timeout=.03))
        process = await spawned(transport)
        if failure == 'eof':
            process.stdout.feed_eof()
        elif failure == 'invalid-ready':
            process.stdout.feed_data(b'not-a-ready-line\n')
        elif failure == 'cancel':
            connecting.cancel()
        error = asyncio.CancelledError if failure == 'cancel' else TimeoutError if failure == 'timeout' else RuntimeError
        with pytest.raises(error):
            await connecting
        assert process.stdin.closed
        assert process.returncode == 0
    asyncio.run(scenario())


@pytest.mark.parametrize('container,port', [('user-container', 5678), ('a' * 64, 0), ('a' * 64, 65536), ('a' * 64, True)])
def test_exec_rejects_non_exact_id_and_invalid_port_before_spawn(transport, container, port):
    with pytest.raises(ValueError):
        asyncio.run(docker_dap.connect_docker_dap(container, port))
    assert not transport.calls


def test_docker_meta_uses_owned_provider_without_host_tcp(monkeypatch):
    from app.api.pythonlab.ws import dap_transport
    state = SimpleNamespace(session_id='synthetic', meta={'docker_container_id': 'a' * 64, 'sandbox_owner_token': 'generation'}, host_candidates=['127.0.0.1'], port=5678, ws_log=lambda *args, **kwargs: None)
    owned = AsyncMock(return_value=('reader', 'writer'))
    monkeypatch.setattr(dap_transport, 'open_owned_dap', owned)
    tcp = AsyncMock(side_effect=AssertionError('must not use host TCP'))
    result = asyncio.run(dap_transport.connect_dap(state, tcp))
    assert result == ('reader', 'writer')
    owned.assert_awaited_once_with('synthetic', state.meta)
    tcp.assert_not_awaited()


def test_partial_docker_identity_never_falls_back_to_host_tcp(monkeypatch):
    from app.api.pythonlab.ws import dap_transport
    state = SimpleNamespace(session_id='synthetic', meta={'docker_container_id': 'a' * 64}, host_candidates=['127.0.0.1'], port=5678)
    owned = AsyncMock(side_effect=RuntimeError('missing generation'))
    monkeypatch.setattr(dap_transport, 'open_owned_dap', owned)
    tcp = AsyncMock(side_effect=AssertionError('no insecure fallback'))
    with pytest.raises(RuntimeError, match='generation'):
        asyncio.run(dap_transport.connect_dap(state, tcp))
    tcp.assert_not_awaited()
