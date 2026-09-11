import asyncio
import errno
import fcntl
import hashlib
import json
import os
from pathlib import Path
import tempfile
import time
import uuid
from typing import List, Tuple

from loguru import logger

from app.utils.cache import cache


class RedisDistributedLock:
    """Serialize Docker container operations across backend processes."""

    def __init__(self, lock_name: str, timeout: int = 30, retry_interval: float = 0.1):
        self.lock_key = f"lock:docker_pool:{lock_name}"
        self.timeout = timeout
        self.retry_interval = retry_interval
        self.identifier = str(uuid.uuid4())
        self._locked = False

    async def __aenter__(self):
        client = await cache.get_client()
        end_time = time.time() + self.timeout
        while time.time() < end_time:
            if await client.set(
                self.lock_key,
                self.identifier,
                nx=True,
                px=self.timeout * 1000,
            ):
                self._locked = True
                return self
            await asyncio.sleep(self.retry_interval)

        raise TimeoutError(f"Could not acquire lock for {self.lock_key}")

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if not self._locked:
            return

        try:
            client = await cache.get_client()
            script = """
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
            """
            await client.eval(script, 1, self.lock_key, self.identifier)  # type: ignore[misc]
        except Exception as exc:
            logger.error(f"Error releasing lock {self.lock_key}: {exc}")
        finally:
            self._locked = False


async def run_async(cmd: List[str], timeout_s: int = 30) -> Tuple[int, str, str]:
    """Run a subprocess without blocking the event loop."""
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout_s)
        return (
            process.returncode or 0,
            stdout.decode().strip() if stdout else "",
            stderr.decode().strip() if stderr else "",
        )
    except (asyncio.TimeoutError, asyncio.CancelledError):
        try:
            process.kill()
        except ProcessLookupError:
            pass
        await process.wait()
        # Keep timeout/cancellation identity for the caller's retry policy.
        raise


class DockerTransportError(ConnectionError):
    """A recognized daemon transport failure during a read-only probe."""


def _raise_inspect_failure(stderr: str, permanent_message: str) -> None:
    # Docker CLI versions use different dial diagnostics. Fail closed for unknown
    # output and authorization/configuration failures, including mixed messages.
    diagnostic = " ".join(stderr.lower().split())
    forbidden = ("permission", "access denied", "access is denied", "not permitted",
                 "unauthorized", "forbidden", "authorization", "authentication",
                 "certificate", "x509:", "tls", "invalid",
                 "malformed", "unsupported")
    blocked = any(term in diagnostic for term in forbidden)
    unavailable = diagnostic.startswith("cannot connect to the docker daemon at ")
    dial = diagnostic.startswith(("error during connect:",
                                  "failed to connect to the docker api at "))
    transient = any(term in diagnostic for term in (
        "connection refused", "connection reset by peer", "i/o timeout",
        "network is unreachable", "no route to host", "context deadline exceeded",
    )) or ("dial unix " in diagnostic and "no such file or directory" in diagnostic)
    if not blocked and (unavailable or (dial and transient)):
        # Do not include endpoint URLs/credentials from raw CLI stderr.
        raise DockerTransportError("Docker daemon temporarily unavailable during read-only inspection")
    raise RuntimeError(permanent_message)


async def inspect_container(run, name: str):
    """Absence is distinct from an unavailable daemon; never rm on uncertainty."""
    import json
    rc, out, err = await run(['docker', 'inspect', name], timeout_s=10)
    if rc:
        if 'no such object:' in err.lower() or 'no such container:' in err.lower():
            return None
        _raise_inspect_failure(err, '无法核对已有运行环境，请联系老师检查 Docker。')
    info = json.loads(out)
    if not isinstance(info, list) or len(info) != 1 or not info[0].get('Id'):
        raise RuntimeError('已有运行环境信息不完整，拒绝覆盖。')
    return info[0]


def _check_resource_settings(info, expected) -> None:
    config = info.get('Config') or {}
    host = info.get('HostConfig') or {}
    mode = expected['mode']
    if (config.get('Labels') or {}).get('wangsh.pythonlab.runtime-mode') != mode:
        raise RuntimeError('运行环境模式不兼容，请先停止旧会话。')
    actual = {key: host.get(key) for key in expected['host']}
    if actual != expected['host'] or config.get('Image') != expected['image'] or config.get('User') != '1000:1000':
        raise RuntimeError('运行环境资源或镜像不兼容，请先停止旧会话。')


def _check_mount_and_network(info, expected) -> None:
    mounts = info.get('Mounts') or []
    if not any(m.get('Destination') == '/workspace' and m.get('Source') == expected['mount'] and m.get('RW') for m in mounts):
        raise RuntimeError('运行环境工作区不兼容，请先停止旧会话。')
    if expected['mode'] == 'plain' and (info.get('HostConfig') or {}).get('NetworkMode') != 'none':
        raise RuntimeError('运行环境网络不兼容，请先停止旧会话。')


async def check_reuse(run, info, expected, ws_path, session_id: str, owner=None) -> bool:
    """Only a trusted live journal can authorize reuse; workspace files cannot."""
    if not owner or owner.get("phase") != "live" or owner.get("container_id") != info.get("Id"):
        raise RuntimeError("已有运行环境缺少可信归属，拒绝接管。")
    _check_resource_settings(info, expected)
    _check_mount_and_network(info, expected)
    mode = expected['mode']
    rc, image_id, err = await run(['docker', 'image', 'inspect', expected['image'], '--format', '{{.Id}}'], timeout_s=10)
    if rc:
        _raise_inspect_failure(err, '运行环境镜像版本无法确认，请先停止旧会话。')
    if info.get('Image') != image_id.strip():
        raise RuntimeError('运行环境镜像版本无法确认，请先停止旧会话。')
    try:
        previous_id = owner.get('session_id')
    except (OSError, ValueError, AttributeError):
        previous_id = None
    if previous_id == session_id:
        return True
    if previous_id and mode == 'plain':
        previous_meta = await cache.get(f'debug:session:{previous_id}')
        if isinstance(previous_meta, dict) and previous_meta.get('status') == 'TERMINATED':
            return False
    raise RuntimeError('已有会话仍在使用运行环境或状态未知，请先停止旧会话。')


async def remove_owned_container(run, container_id: str) -> None:
    try:
        rc, _, _ = await run(['docker', 'rm', '-f', container_id], timeout_s=30)
    except Exception as exc:
        # Unknown cleanup outcome must not trigger another create attempt.
        raise RuntimeError('运行环境部分资源清理状态未知，请联系老师检查后再试。') from exc
    if rc:
        raise RuntimeError('运行环境部分资源清理失败，请联系老师检查后再试。')


class WorkspaceOwnership:
    """Host-filesystem fence plus trusted resource journal, outside /workspace.

    All cooperating workers must share this workspace root and flock-capable
    filesystem. Unlike a Redis lease this lock cannot expire during a Docker
    await. Never unlink the lock inode, including when deleting a workspace.
    Mixed-version workers / different mounts are NOT fenced by this protocol.
    """

    def __init__(self, root: Path, workspace: Path, timeout: float = 30):
        relative = workspace.relative_to(root)
        key = hashlib.sha256(str(relative).encode()).hexdigest()
        self.directory = root / '.pythonlab-ownership'
        self.lock_path = self.directory / (key + '.lock')
        self.record_path = self.directory / (key + '.json')
        self.timeout = timeout
        self.fd = None

    async def __aenter__(self):
        self.directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.fd = os.open(self.lock_path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        deadline = time.monotonic() + self.timeout
        try:
            while True:
                try:
                    fcntl.flock(self.fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    return self
                except OSError as exc:
                    if exc.errno not in (errno.EACCES, errno.EAGAIN):
                        raise
                    if time.monotonic() >= deadline:
                        raise TimeoutError('Workspace ownership is busy') from exc
                    await asyncio.sleep(0.01)
        except BaseException:
            os.close(self.fd)
            self.fd = None
            raise

    async def __aexit__(self, *_):
        if self.fd is not None:
            os.close(self.fd)
            self.fd = None

    def read(self):
        if self.fd is None:
            raise RuntimeError('Ownership journal requires its fence')
        try:
            record = json.loads(self.record_path.read_text(encoding='utf-8'))
        except FileNotFoundError:
            return None
        if not isinstance(record, dict) or not record.get('token'):
            raise RuntimeError('Invalid resource ownership journal; refusing mutation')
        return record

    def write(self, record):
        if self.fd is None:
            raise RuntimeError('Ownership journal requires its fence')
        fd, filename = tempfile.mkstemp(dir=self.directory, prefix='.claim-')
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as stream:
                json.dump(record, stream, ensure_ascii=False)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(filename, self.record_path)
            directory_fd = os.open(self.directory, os.O_RDONLY)
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
        finally:
            if os.path.exists(filename):
                os.unlink(filename)

    def claim(self, session_id, meta, name, container_id=None):
        record = {
            'token': uuid.uuid4().hex, 'session_id': session_id,
            'startup_task_id': meta.get('startup_task_id'), 'container_name': name,
            'container_id': container_id, 'phase': 'live' if container_id else 'creating',
        }
        self.write(record)
        return record

    def owns(self, record, session_id, meta):
        # A session id (or a mutable workspace meta.json) is not a generation.
        return bool(
            record and record.get('phase') == 'live'
            and record.get('session_id') == session_id
            and record.get('token') == meta.get('sandbox_owner_token')
            and record.get('container_id') == meta.get('docker_container_id')
        )
