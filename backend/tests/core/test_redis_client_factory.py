import inspect

import pytest

import app.utils.redis_client as cache_module


def test_async_tls_factory_uses_redis_py_primitives_without_ssl_context():
    client = cache_module.create_async_redis_client(
        host="redis.example",
        port=6380,
        ssl_enabled=True,
        ssl_cert_reqs="required",
        ssl_ca_certs="/tmp/test-ca.pem",
        ssl_check_hostname=True,
        max_connections=7,
    )

    pool = client.connection_pool
    assert pool.connection_class.__name__ == "SSLConnection"
    assert pool.connection_kwargs["ssl_cert_reqs"] == "required"
    assert pool.connection_kwargs["ssl_ca_certs"] == "/tmp/test-ca.pem"
    assert pool.connection_kwargs["ssl_check_hostname"] is True
    assert "ssl_context" not in pool.connection_kwargs
    assert "ssl" not in pool.connection_kwargs


def test_sync_tls_factory_uses_redis_py_primitives_without_ssl_context():
    client = cache_module.create_sync_redis_client(
        host="redis.example",
        port=6380,
        ssl_enabled=True,
        ssl_cert_reqs="none",
        ssl_check_hostname=False,
    )

    pool = client.connection_pool
    assert pool.connection_class.__name__ == "SSLConnection"
    assert pool.connection_kwargs["ssl_cert_reqs"] == "none"
    assert pool.connection_kwargs["ssl_check_hostname"] is False
    assert "ssl_context" not in pool.connection_kwargs
    assert "ssl" not in pool.connection_kwargs


def test_plain_factories_do_not_enable_tls():
    async_client = cache_module.create_async_redis_client(
        host="redis.example", port=6379, ssl_enabled=False
    )
    sync_client = cache_module.create_sync_redis_client(
        host="redis.example", port=6379, ssl_enabled=False
    )

    assert async_client.connection_pool.connection_class.__name__ == "Connection"
    assert sync_client.connection_pool.connection_class.__name__ == "Connection"
    assert "ssl_context" not in async_client.connection_pool.connection_kwargs
    assert "ssl_context" not in sync_client.connection_pool.connection_kwargs


@pytest.mark.parametrize(
    "factory_name, sentinel_attr",
    [
        ("create_async_sentinel_client", "async_redis"),
        ("create_sync_sentinel_client", "sync_redis"),
    ],
)
def test_sentinel_tls_is_applied_to_discovery_and_master_data(
    monkeypatch, factory_name, sentinel_attr
):
    captured = {}

    class FakeMaster:
        pass

    class FakeSentinel:
        def __init__(self, sentinels, sentinel_kwargs=None, **connection_kwargs):
            captured["sentinels"] = sentinels
            captured["sentinel_kwargs"] = sentinel_kwargs
            captured["connection_kwargs"] = connection_kwargs
            self.sentinels = []

        def master_for(self, name, **kwargs):
            captured["master_name"] = name
            captured["master_kwargs"] = kwargs
            return FakeMaster()

    module = getattr(cache_module, sentinel_attr)
    monkeypatch.setattr(module, "Sentinel", FakeSentinel)
    factory = getattr(cache_module, factory_name)
    client = factory(
        sentinels=[("sentinel-a", 26379), ("sentinel-b", 26380)],
        master_name="mymaster",
        db=3,
        password="synthetic-only",
        ssl_enabled=True,
        ssl_ca_certs="/tmp/test-ca.pem",
    )

    assert isinstance(client, FakeMaster)
    assert captured["master_name"] == "mymaster"
    for key in ("sentinel_kwargs", "connection_kwargs"):
        assert captured[key]["ssl"] is True
        assert captured[key]["ssl_ca_certs"] == "/tmp/test-ca.pem"
        assert "ssl_context" not in captured[key]
    assert captured["connection_kwargs"]["db"] == 3
    assert captured["connection_kwargs"]["password"] == "synthetic-only"
    assert captured["sentinel_kwargs"]["password"] is None


def test_tls_factory_rejects_unknown_certificate_requirement():
    with pytest.raises(ValueError, match="Unsupported REDIS_SSL_CERT_REQS"):
        cache_module.redis_tls_kwargs(enabled=True, cert_reqs="broken")


def test_factory_does_not_accept_or_forward_ssl_context():
    signature = inspect.signature(cache_module.create_async_redis_client)
    assert "ssl_context" not in signature.parameters


@pytest.mark.parametrize("factory", [cache_module.create_async_sentinel_client,
                                     cache_module.create_sync_sentinel_client])
def test_sentinel_discovery_has_independent_tls_and_authentication(factory):
    client = factory(sentinels=[("sentinel", 26379)], master_name="test",
                     db=2, password="synthetic-master", ssl_enabled=True,
                     sentinel_password="synthetic-sentinel",
                     sentinel_options={"ssl_enabled": False})
    discovery = client._discovery_clients[0]
    assert client.connection_pool.connection_class.__name__ == "SentinelManagedSSLConnection"
    assert client.connection_pool.connection_kwargs["password"] == "synthetic-master"
    assert discovery.connection_pool.connection_class.__name__ == "Connection"
    assert discovery.connection_pool.connection_kwargs["password"] == "synthetic-sentinel"
    assert discovery.connection_pool.connection_kwargs["db"] == 0


@pytest.mark.parametrize("factory", [cache_module.create_async_sentinel_client,
                                     cache_module.create_sync_sentinel_client])
def test_sentinel_ca_override_keeps_inherited_tls(factory):
    client = factory(sentinels=[("sentinel", 26379)], master_name="test",
                     ssl_enabled=True, ssl_ca_certs="/data/ca.pem",
                     sentinel_options={"ssl_ca_certs": "/discovery/ca.pem"})
    discovery = client._discovery_clients[0]
    assert discovery.connection_pool.connection_class.__name__ == "SSLConnection"
    assert discovery.connection_pool.connection_kwargs["ssl_ca_certs"] == "/discovery/ca.pem"
    assert client.connection_pool.connection_kwargs["ssl_ca_certs"] == "/data/ca.pem"


def test_cache_optional_sentinel_settings_do_not_change_data_settings(monkeypatch):
    import app.utils.cache as app_cache
    monkeypatch.setenv("REDIS_SENTINEL_SSL", "false")
    monkeypatch.setenv("REDIS_SENTINEL_SSL_CA_CERTS", "/discovery/ca.pem")
    options = app_cache._sentinel_connection_options()
    assert options["ssl_enabled"] is False
    assert options["ssl_ca_certs"] == "/discovery/ca.pem"
    monkeypatch.setenv("REDIS_SENTINEL_SSL", "invalid")
    with pytest.raises(ValueError, match="Invalid boolean"):
        app_cache._sentinel_connection_options()


def test_initialize_failure_closes_candidate_and_retry_is_clean(monkeypatch):
    import asyncio
    import app.utils.cache as app_cache

    class FakeClient:
        def __init__(self, fail):
            self.fail, self.closed = fail, False

        async def ping(self):
            if self.fail:
                raise ConnectionError("synthetic initialization failure")
            return True

        async def aclose(self):
            self.closed = True

    candidates = [FakeClient(True), FakeClient(False)]
    pending = list(candidates)
    monkeypatch.setattr(app_cache, "create_async_redis_client", lambda **_kwargs: pending.pop(0))
    monkeypatch.setattr(app_cache.settings, "REDIS_SENTINEL_ENABLED", False)
    cache = object.__new__(app_cache.RedisCache)
    cache._client, cache._initialized, cache._loop = None, False, None
    cache._initialize_locks = {}

    async def run():
        with pytest.raises(ConnectionError):
            await cache.get_client()
        assert candidates[0].closed
        assert cache._client is None
        assert not cache._initialized
        assert await cache.get_client() is candidates[1]
        await cache.close()
        assert candidates[1].closed

    asyncio.run(run())
