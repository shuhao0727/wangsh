import asyncio
import time

from fastapi import HTTPException, status

from app.utils.cache import cache


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._last: dict[str, float] = {}

    async def check(self, key: str, interval_seconds: float) -> None:
        now = time.monotonic()
        async with self._lock:
            last = self._last.get(key)
            if last is not None and (now - last) < interval_seconds:
                try:
                    await cache.increment("http:429")
                except Exception:
                    pass
                raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="请求过于频繁")
            self._last[key] = now


class RedisRateLimiter:
    async def check(self, key: str, interval_seconds: float) -> None:
        if interval_seconds <= 0:
            return
        ms = max(1, int(interval_seconds * 1000))
        redis_key = f"rl:{key}"
        try:
            client = await cache.get_client()
            ok = await client.set(redis_key, "1", nx=True, px=ms)
            if ok:
                return
        except Exception:
            raise

        try:
            await cache.increment("http:429")
        except Exception:
            pass
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="请求过于频繁")


class RateLimiter:
    def __init__(self) -> None:
        self._mem = InMemoryRateLimiter()
        self._redis = RedisRateLimiter()

    async def check(self, key: str, interval_seconds: float) -> None:
        try:
            await self._redis.check(key, interval_seconds)
        except HTTPException:
            raise
        except Exception:
            await self._mem.check(key, interval_seconds)


rate_limiter = RateLimiter()
