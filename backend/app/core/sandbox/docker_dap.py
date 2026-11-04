"""DAP bytes over an exact Docker exec, never a publicly bound debugpy port."""
import asyncio
from contextlib import suppress
import re


_PROXY = r'''
import os
import select
import socket
import sys

peer = socket.create_connection(('127.0.0.1', int(sys.argv[1])), timeout=5)
peer.settimeout(None)
os.write(1, b'PYTHONLAB_DAP_READY_V1\n')
try:
    while True:
        readable, _, _ = select.select([0, peer], [], [])
        if 0 in readable:
            data = os.read(0, 65536)
            if not data:
                break
            peer.sendall(data)
        if peer in readable:
            data = peer.recv(65536)
            if not data:
                break
            view = memoryview(data)
            while view:
                view = view[os.write(1, view):]
finally:
    peer.close()
'''


class DockerDapWriter:
    def __init__(self, process):
        self.process = process
        self.closed = False

    def write(self, data):
        self.process.stdin.write(data)

    async def drain(self):
        await self.process.stdin.drain()

    def close(self):
        if not self.closed:
            self.closed = True
            self.process.stdin.close()

    async def wait_closed(self):
        self.close()
        try:
            await asyncio.wait_for(self.process.wait(), 2)
        except TimeoutError:
            with suppress(ProcessLookupError):
                self.process.kill()
            await self.process.wait()


async def connect_docker_dap(container_id: str, port: int, *, timeout: float = 8):
    if not re.fullmatch(r'[0-9a-f]{64}', container_id) or type(port) is not int or not 1 <= port <= 65535:
        raise ValueError('DAP传输必须使用已核准容器标识和调试端口')
    process = await asyncio.create_subprocess_exec(
        'docker', 'exec', '-i', container_id, 'python', '-I', '-u', '-c', _PROXY, str(port),
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    writer = DockerDapWriter(process)
    try:
        async with asyncio.timeout(timeout):
            ready = await process.stdout.readline()
        if ready != b'PYTHONLAB_DAP_READY_V1\n':
            raise RuntimeError('沙箱内部DAP连接未就绪')
        return process.stdout, writer
    except BaseException:
        await writer.wait_closed()
        raise
