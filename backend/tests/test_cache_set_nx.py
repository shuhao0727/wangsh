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
