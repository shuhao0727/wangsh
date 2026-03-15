"""
rate_limit 测试
覆盖：Redis 正常限流、Redis 故障降级到内存、interval=0 跳过
"""
import asyncio
from fastapi import HTTPException

from app.utils.rate_limit import RedisRateLimiter, InMemoryRateLimiter, RateLimiter


def test_redis_rate_limiter_allows_first_request(monkeypatch):
    async def fake_set(key, value, nx=False, px=None):
        return True  # nx=True 且 key 不存在，返回 True 表示设置成功

    async def fake_get_client():
        class FakeClient:
            async def set(self, key, value, nx=False, px=None):
                return True
        return FakeClient()

    limiter = RedisRateLimiter()

    import app.utils.rate_limit as rl_module
    import app.utils.cache as cache_module

    async def fake_get_client_inner():
        class FakeClient:
            async def set(self, key, value, nx=False, px=None):
                return True
        return FakeClient()

    monkeypatch.setattr(cache_module.cache, "get_client", fake_get_client_inner)
    monkeypatch.setattr(cache_module.cache, "increment", AsyncMock_increment())

    # 第一次请求应该通过
    asyncio.run(limiter.check("test-key", 2.0))


def AsyncMock_increment():
    async def _increment(key, amount=1):
        return 1
    return _increment


def test_redis_rate_limiter_blocks_second_request(monkeypatch):
    import app.utils.cache as cache_module

    async def fake_get_client():
        class FakeClient:
            async def set(self, key, value, nx=False, px=None):
                return None  # key 已存在，返回 None 表示未设置
        return FakeClient()

    monkeypatch.setattr(cache_module.cache, "get_client", fake_get_client)
    monkeypatch.setattr(cache_module.cache, "increment", AsyncMock_increment())

    limiter = RedisRateLimiter()
    try:
        asyncio.run(limiter.check("test-key", 2.0))
        assert False, "应该抛出 429"
    except HTTPException as e:
        assert e.status_code == 429


def test_redis_rate_limiter_skips_when_interval_zero(monkeypatch):
    limiter = RedisRateLimiter()
    # interval=0 应该直接返回，不做任何检查
    asyncio.run(limiter.check("any-key", 0))


def test_in_memory_rate_limiter_allows_first():
    limiter = InMemoryRateLimiter()
    asyncio.run(limiter.check("key1", 10.0))


def test_in_memory_rate_limiter_blocks_rapid_repeat():
    import app.utils.cache as cache_module

    async def fake_increment(key, amount=1):
        return 1

    limiter = InMemoryRateLimiter()
    # 第一次通过
    asyncio.run(limiter.check("key2", 10.0))
    # 立即第二次应该被拦截
    try:
        asyncio.run(limiter.check("key2", 10.0))
        assert False, "应该抛出 429"
    except HTTPException as e:
        assert e.status_code == 429


def test_rate_limiter_falls_back_to_memory_on_redis_error(monkeypatch):
    """Redis 故障时应降级到内存限流"""
    import app.utils.cache as cache_module

    async def fake_get_client():
        raise ConnectionError("Redis 不可用")

    monkeypatch.setattr(cache_module.cache, "get_client", fake_get_client)

    limiter = RateLimiter()
    # 第一次应该通过（内存限流）
    asyncio.run(limiter.check("fallback-key", 10.0))


def test_rate_limiter_different_keys_independent():
    limiter = InMemoryRateLimiter()
    asyncio.run(limiter.check("user:1", 10.0))
    asyncio.run(limiter.check("user:2", 10.0))
    # 不同 key 互不影响，两次都应该通过
