import asyncio

import pytest

import app.services.agents.dify_concurrency as concurrency
from app.core.config import settings
from app.services.agents.providers.dify_provider import DifyProvider


class _FakeRedis:
    def __init__(self, results):
        self.results = list(results)
        self.calls = []

    async def eval(self, script, numkeys, *args):
        self.calls.append((script, numkeys, args))
        return self.results.pop(0) if self.results else 0


def _set_concurrency_settings(monkeypatch, *, enabled=True, wait=0.0, limit=1, lease=5):
    monkeypatch.setattr(settings, "DIFY_CONCURRENCY_ENABLED", enabled)
    monkeypatch.setattr(settings, "DIFY_CONCURRENCY_WAIT_SECONDS", wait)
    monkeypatch.setattr(settings, "DIFY_MAX_CONCURRENCY", limit)
    monkeypatch.setattr(settings, "DIFY_CONCURRENCY_LEASE_SECONDS", lease)


def test_lease_acquire_and_release_use_owner_token(monkeypatch):
    _set_concurrency_settings(monkeypatch)
    client = _FakeRedis([1, 1])

    async def fake_get_client():
        return client

    monkeypatch.setattr(concurrency.cache, "get_client", fake_get_client)

    async def run():
        lease = concurrency.DifyConcurrencyLease("DifyProvider:agent:7")
        await lease.acquire()
        token = lease.token
        await lease.release()
        return token

    token = asyncio.run(run())

    assert len(client.calls) == 2
    acquire_script, _, acquire_args = client.calls[0]
    release_script, _, release_args = client.calls[1]
    assert "ZREMRANGEBYSCORE" in acquire_script
    assert acquire_args[2] == 1  # configured concurrency limit
    assert acquire_args[4] == token
    assert "ZREM" in release_script
    assert release_args[1] == token


def test_lease_busy_has_bounded_wait(monkeypatch):
    _set_concurrency_settings(monkeypatch, wait=0.0)
    client = _FakeRedis([0])

    async def fake_get_client():
        return client

    monkeypatch.setattr(concurrency.cache, "get_client", fake_get_client)

    async def run():
        lease = concurrency.DifyConcurrencyLease("agent:7")
        await lease.acquire()

    with pytest.raises(concurrency.DifyConcurrencyBusy) as exc_info:
        asyncio.run(run())
    assert exc_info.value.retry_after == 2


def test_lease_fails_closed_when_redis_is_unavailable(monkeypatch):
    _set_concurrency_settings(monkeypatch)

    async def fake_get_client():
        raise ConnectionError("redis down")

    monkeypatch.setattr(concurrency.cache, "get_client", fake_get_client)

    async def run():
        await concurrency.DifyConcurrencyLease("agent:7").acquire()

    with pytest.raises(concurrency.DifyConcurrencyUnavailable):
        asyncio.run(run())


def test_disabled_lease_does_not_require_redis(monkeypatch):
    _set_concurrency_settings(monkeypatch, enabled=False)

    async def fail_get_client():
        raise AssertionError("Redis should not be touched when disabled")

    monkeypatch.setattr(concurrency.cache, "get_client", fail_get_client)

    async def run():
        lease = concurrency.DifyConcurrencyLease("agent:7")
        await lease.acquire()
        await lease.release()
        return lease.acquired

    assert asyncio.run(run()) is False


def test_dify_stream_returns_provider_busy_without_calling_upstream(monkeypatch):
    import app.services.agents.chat_stream as chat_stream

    class _BusyLease:
        def __init__(self, *_args, **_kwargs):
            pass

        async def acquire(self):
            raise concurrency.DifyConcurrencyBusy(retry_after=3)

        async def release(self):
            return None

    class _UnexpectedClient:
        def stream(self, *args, **kwargs):
            raise AssertionError("upstream must not be called while busy")

    monkeypatch.setattr(chat_stream, "DifyConcurrencyLease", _BusyLease)
    monkeypatch.setattr(chat_stream, "get_http_client", lambda: _UnexpectedClient())

    provider = DifyProvider("https://dify.example/v1", "app-key")

    async def collect():
        chunks = []
        async for chunk in chat_stream._stream_dify(
            provider, [{"role": "user", "content": "hello"}], "", "tester", {}, circuit_key="dify:test"
        ):
            chunks.append(chunk)
        return b"".join(chunks).decode("utf-8")

    output = asyncio.run(collect())
    assert '"error": "provider_busy"' in output
    assert '"retry_after": 3' in output


def test_stream_stops_when_lease_is_lost(monkeypatch):
    import app.services.agents.chat_stream as chat_stream

    class _LostLease:
        def __init__(self, *_args, **_kwargs):
            self.released = False

        async def acquire(self):
            return self

        def is_held(self):
            return False

        async def wait_lost(self):
            return True

        async def release(self):
            self.released = True

    class _UnexpectedClient:
        def stream(self, *args, **kwargs):
            raise AssertionError("upstream must not be read after the lease is lost")

    monkeypatch.setattr(chat_stream, "DifyConcurrencyLease", _LostLease)
    monkeypatch.setattr(chat_stream, "get_http_client", lambda: _UnexpectedClient())

    provider = DifyProvider("https://dify.example/v1", "app-key")

    async def collect():
        chunks = []
        async for chunk in chat_stream._stream_dify(
            provider, [{"role": "user", "content": "hello"}], "", "tester", {}, circuit_key="dify:test"
        ):
            chunks.append(chunk)
        return b"".join(chunks).decode("utf-8")

    output = asyncio.run(collect())
    assert '"error": "concurrency_unavailable"' in output
