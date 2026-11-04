"""Docker transport contract: synthetic UNIX socketpair, never a real daemon."""
import asyncio
import os
import socket
from contextlib import suppress

import pytest

from app.core.sandbox import docker_terminal


class FakeProcess:
    def __init__(self):
        self.returncode = None
        self.killed = False

    def kill(self):
        self.killed = True
        self.returncode = -9

    async def wait(self):
        return self.returncode


@pytest.fixture
def daemon(monkeypatch):
    state = {'peer': None, 'process': FakeProcess(), 'commands': []}

    async def spawn(*args, **kwargs):
        state['commands'].append(args)
        assert kwargs['stdin'] == kwargs['stdout']
        state['peer'] = socket.socket(fileno=os.dup(kwargs['stdin']))
        state['peer'].setblocking(False)
        return state['process']

    monkeypatch.setattr(docker_terminal.asyncio, 'create_subprocess_exec', spawn)
    yield state
    if state['peer'] is not None:
        state['peer'].close()


async def read_request(state):
    while state['peer'] is None:
        await asyncio.sleep(0)
    loop = asyncio.get_running_loop()
    request = b''
    while not request.endswith(b'\r\n\r\n'):
        request += await loop.sock_recv(state['peer'], 4096)
    return request


def test_attach_waits_for_upgrade_and_preserves_first_output(daemon):
    async def scenario():
        attach = asyncio.create_task(docker_terminal.attach_docker_tty('a' * 64))
        request = await read_request(daemon)
        assert b'POST /containers/' + b'a' * 64 + b'/attach?' in request
        assert b'logs=0' in request and b'Connection: Upgrade\r\n' in request
        assert not attach.done()
        await asyncio.get_running_loop().sock_sendall(
            daemon['peer'],
            b'HTTP/1.1 101 UPGRADED\r\nConnection: Upgrade\r\nUpgrade: tcp\r\n\r\n8\r\n',
        )
        process, fd = await attach
        try:
            assert os.read(fd, 4096) == b'8\r\n'
            os.write(fd, b'hello\n')
            assert await asyncio.get_running_loop().sock_recv(daemon['peer'], 4096) == b'hello\n'
            assert process is daemon['process']
            assert daemon['commands'] == [('docker', 'system', 'dial-stdio')]
        finally:
            os.close(fd)
    asyncio.run(scenario())


@pytest.mark.parametrize('response', [
    b'HTTP/1.1 403 Forbidden\r\n\r\n',
    b'HTTP/1.1 101 UPGRADED\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n',
    b'HTTP/1.1 200 OK\r\n\r\n',
    b'not-http\r\n\r\n',
    b'HTTP/1.1 101 UPGRADED\r\nX-Oversized: ' + b'x' * 17000 + b'\r\n\r\n',
])
def test_rejected_or_invalid_handshake_never_exposes_a_ready_fd(daemon, response):
    async def scenario():
        attach = asyncio.create_task(docker_terminal.attach_docker_tty('a' * 64))
        await read_request(daemon)
        with suppress(BrokenPipeError, ConnectionResetError):
            await asyncio.get_running_loop().sock_sendall(daemon['peer'], response)
        with pytest.raises(RuntimeError, match='终端'):
            await attach
        assert daemon['process'].killed
        assert await asyncio.get_running_loop().sock_recv(daemon['peer'], 1) == b''
    asyncio.run(scenario())


@pytest.mark.parametrize('failure', ['eof', 'timeout', 'cancel'])
def test_attach_failure_reaps_only_its_transport(daemon, failure):
    async def scenario():
        attach = asyncio.create_task(docker_terminal.attach_docker_tty('a' * 64, timeout=0.05))
        await read_request(daemon)
        if failure == 'eof':
            daemon['peer'].shutdown(socket.SHUT_WR)
        elif failure == 'cancel':
            attach.cancel()
        error = asyncio.CancelledError if failure == 'cancel' else TimeoutError if failure == 'timeout' else RuntimeError
        with pytest.raises(error):
            await attach
        assert daemon['process'].killed
    asyncio.run(scenario())


def test_attach_requires_an_exact_container_id(daemon):
    with pytest.raises(ValueError):
        asyncio.run(docker_terminal.attach_docker_tty('student-controlled-name'))
    assert not daemon['commands']
