"""Wait for the Engine attach upgrade, not merely the Docker CLI process start."""
import asyncio
from contextlib import suppress
import re
import socket


async def _read_upgrade(stream: socket.socket) -> None:
    loop = asyncio.get_running_loop()
    header = bytearray()
    while not header.endswith(b'\r\n\r\n'):
        if len(header) >= 16384:
            raise RuntimeError('终端附着响应过大')
        chunk = await loop.sock_recv(stream, 1)
        if not chunk:
            raise RuntimeError('终端附着握手提前结束')
        header.extend(chunk)
    lines = bytes(header).lower().split(b'\r\n')
    fields = dict(line.split(b':', 1) for line in lines[1:] if b':' in line)
    if (
        not lines[0].startswith(b'http/1.1 101 ')
        or fields.get(b'upgrade', b'').strip() != b'tcp'
        or b'upgrade' not in {value.strip() for value in fields.get(b'connection', b'').split(b',')}
    ):
        raise RuntimeError('终端附着握手被拒绝')


async def attach_docker_tty(container_id: str, *, timeout: float = 10):
    """Use the CLI's current context/TLS; return a raw TTY fd only after HTTP 101.

    Read just the header bytes: the first program output can share the same
    packet and must remain available to the existing terminal pump.
    """
    if not re.fullmatch(r'[0-9a-f]{64}', container_id):
        raise ValueError('终端附着必须使用已核准的完整容器标识')
    stream, child = socket.socketpair()
    stream.setblocking(False)
    process = None
    try:
        process = await asyncio.create_subprocess_exec(
            'docker', 'system', 'dial-stdio',
            stdin=child.fileno(), stdout=child.fileno(),
            stderr=asyncio.subprocess.DEVNULL,
        )
        child.close()
        request = (
            f'POST /containers/{container_id}/attach?logs=0&stream=1&stdin=1&stdout=1&stderr=1 HTTP/1.1\r\n'
            'Host: docker\r\nConnection: Upgrade\r\nUpgrade: tcp\r\nContent-Length: 0\r\n\r\n'
        ).encode('ascii')
        async with asyncio.timeout(timeout):
            await asyncio.get_running_loop().sock_sendall(stream, request)
            await _read_upgrade(stream)
        return process, stream.detach()
    except BaseException:
        stream.close()
        if process is not None:
            with suppress(ProcessLookupError):
                if process.returncode is None:
                    process.kill()
            with suppress(TimeoutError):
                await asyncio.wait_for(process.wait(), 1)
        raise
    finally:
        child.close()
