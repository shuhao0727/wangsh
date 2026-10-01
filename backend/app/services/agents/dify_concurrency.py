"""Distributed concurrency leases for long-lived Dify streams.

A local asyncio semaphore cannot protect a multi-worker deployment.  This module
uses one Redis sorted set per Dify agent/provider and Lua scripts so acquire,
renew, and release are atomic across workers and containers.
"""

from __future__ import annotations

import asyncio
import secrets
import time
from typing import Optional

from loguru import logger

from app.core.config import settings
from app.utils.cache import cache


_ACQUIRE_LUA = """
local now = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local expires_at = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
if redis.call('ZCARD', KEYS[1]) >= limit then
    return 0
end
redis.call('ZADD', KEYS[1], expires_at, ARGV[4])
redis.call('PEXPIRE', KEYS[1], math.max(tonumber(ARGV[5]), 1000))
return 1
"""

_RENEW_LUA = """
local member = ARGV[1]
if redis.call('ZSCORE', KEYS[1], member) == false then
    return 0
end
redis.call('ZADD', KEYS[1], tonumber(ARGV[2]), member)
redis.call('PEXPIRE', KEYS[1], math.max(tonumber(ARGV[3]), 1000))
return 1
"""

_RELEASE_LUA = """
return redis.call('ZREM', KEYS[1], ARGV[1])
"""


class DifyConcurrencyBusy(Exception):
    """The configured Dify concurrency limit was reached before the deadline."""

    def __init__(self, retry_after: int):
        self.retry_after = max(1, int(retry_after))
        super().__init__(f"Dify concurrency limit reached; retry after {self.retry_after}s")


class DifyConcurrencyUnavailable(Exception):
    """Redis cannot be used to enforce the distributed lease."""


class DifyConcurrencyLease:
    """A renewable, owner-token-based lease for one Dify stream."""

    def __init__(
        self,
        resource_key: str,
        *,
        limit: Optional[int] = None,
        wait_seconds: Optional[float] = None,
        lease_seconds: Optional[int] = None,
    ) -> None:
        self.resource_key = _lease_key(resource_key)
        self.limit = max(1, int(limit if limit is not None else settings.DIFY_MAX_CONCURRENCY))
        self.wait_seconds = max(
            0.0,
            float(
                wait_seconds
                if wait_seconds is not None
                else settings.DIFY_CONCURRENCY_WAIT_SECONDS
            ),
        )
        self.lease_seconds = max(
            5,
            int(
                lease_seconds
                if lease_seconds is not None
                else settings.DIFY_CONCURRENCY_LEASE_SECONDS
            ),
        )
        self.token = secrets.token_urlsafe(18)
        self.acquired = False
        self.lost = False
        self._lost_event: Optional[asyncio.Event] = None
        self._renew_task: Optional[asyncio.Task] = None

    async def acquire(self) -> "DifyConcurrencyLease":
        self._lost_event = asyncio.Event()
        if not settings.DIFY_CONCURRENCY_ENABLED:
            self.acquired = True
            return self

        deadline = time.monotonic() + self.wait_seconds
        while True:
            try:
                client = await cache.get_client()
                now_ms = int(time.time() * 1000)
                lease_ms = self.lease_seconds * 1000
                result = await client.eval(
                    _ACQUIRE_LUA,
                    1,
                    self.resource_key,
                    now_ms,
                    self.limit,
                    now_ms + lease_ms,
                    self.token,
                    lease_ms * 2,
                )
            except Exception as exc:
                logger.warning("Dify 并发租约 Redis 不可用: key={}, error={}", self.resource_key, exc)
                raise DifyConcurrencyUnavailable from exc

            if int(result or 0) == 1:
                self.acquired = True
                self._renew_task = asyncio.create_task(
                    self._renew_loop(),
                    name=f"dify-lease-renew:{self.token}",
                )
                return self

            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise DifyConcurrencyBusy(
                    retry_after=max(1, int(round(self.lease_seconds / 2)))
                )
            await asyncio.sleep(min(0.2, remaining))

    async def _renew_loop(self) -> None:
        interval = max(1.0, self.lease_seconds / 3)
        try:
            while self.acquired:
                await asyncio.sleep(interval)
                if not self.acquired:
                    return
                client = await cache.get_client()
                now_ms = int(time.time() * 1000)
                lease_ms = self.lease_seconds * 1000
                renewed = await client.eval(
                    _RENEW_LUA,
                    1,
                    self.resource_key,
                    self.token,
                    now_ms + lease_ms,
                    lease_ms * 2,
                )
                if int(renewed or 0) != 1:
                    self._mark_lost(
                        "Dify 并发租约已被 Redis 回收，拒绝继续把流当作已受保护请求"
                    )
                    return
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            self._mark_lost(f"Dify 并发租约续租异常: {exc}")

    def _mark_lost(self, message: str) -> None:
        self.lost = True
        if self._lost_event is not None:
            self._lost_event.set()
        logger.warning("{}: key={}", message, self.resource_key)

    def is_held(self) -> bool:
        return self.acquired and not self.lost

    async def wait_lost(self) -> bool:
        if self.lost:
            return True
        if self._lost_event is None:
            return False
        await self._lost_event.wait()
        return True

    async def release(self) -> None:
        if not self.acquired:
            return
        self.acquired = False
        if self._renew_task is not None:
            current = asyncio.current_task()
            if self._renew_task is not current:
                self._renew_task.cancel()
                try:
                    await self._renew_task
                except asyncio.CancelledError:
                    pass
            self._renew_task = None

        if not settings.DIFY_CONCURRENCY_ENABLED:
            return
        try:
            client = await cache.get_client()
            await client.eval(_RELEASE_LUA, 1, self.resource_key, self.token)
        except Exception as exc:
            # TTL and the owner token protect against permanent leaked capacity.
            logger.warning("Dify 并发租约释放失败，将等待 TTL 回收: key={}, error={}", self.resource_key, exc)

    async def __aenter__(self) -> "DifyConcurrencyLease":
        if not self.acquired:
            await self.acquire()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self.release()


def _lease_key(resource_key: str) -> str:
    # circuit_key is already bounded to provider type + agent id.  Keep a stable
    # namespace so leases cannot collide with ordinary application cache keys.
    return f"wangsh:dify:concurrency:{resource_key}"
