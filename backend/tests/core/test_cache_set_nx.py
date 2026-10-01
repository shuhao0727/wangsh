import asyncio

from app.utils.cache import RedisCache


def test_cache_set_passes_nx_and_expire_to_redis_client(monkeypatch):
    captured = {}

    class _FakeClient:
        async def set(self, key, value, ex=None, nx=False):
            captured["key"] = key
            captured["value"] = value
            captured["ex"] = ex
            captured["nx"] = nx
            return True

    cache = RedisCache()

    async def _fake_get_client():
        return _FakeClient()

    monkeypatch.setattr(cache, "get_client", _fake_get_client)

    ok = asyncio.run(cache.set("unit:test:key", {"a": 1}, expire_seconds=7, nx=True))

    assert ok is True
    assert captured["key"] == "unit:test:key"
    assert captured["ex"] == 7
    assert captured["nx"] is True


def test_cache_initialization_is_single_flight(monkeypatch):
    """Concurrent Dify requests must not create one Redis pool per coroutine."""
    cache = RedisCache()
    state = (cache._client, cache._initialized, cache._loop, cache._initialize_locks)
    calls = 0
    fake_client = object()

    async def fake_initialize():
        nonlocal calls
        calls += 1
        await asyncio.sleep(0.01)
        cache._loop = asyncio.get_running_loop()
        cache._client = fake_client
        cache._initialized = True

    monkeypatch.setattr(cache, "initialize", fake_initialize)

    async def run():
        return await asyncio.gather(*(cache.get_client() for _ in range(60)))

    try:
        clients = asyncio.run(run())
        assert calls == 1
        assert all(client is fake_client for client in clients)
    finally:
        cache._client, cache._initialized, cache._loop, cache._initialize_locks = state
