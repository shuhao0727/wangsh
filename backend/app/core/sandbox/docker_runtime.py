import asyncio
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
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout_s,
            )
            return (
                process.returncode or 0,
                stdout.decode().strip() if stdout else "",
                stderr.decode().strip() if stderr else "",
            )
        except asyncio.TimeoutError:
            try:
                process.kill()
            except ProcessLookupError:
                pass
            raise RuntimeError(
                f"Command timed out after {timeout_s}s: {' '.join(cmd)}"
            )
    except Exception as exc:
        raise RuntimeError(f"Failed to run command {' '.join(cmd)}: {exc}") from exc
