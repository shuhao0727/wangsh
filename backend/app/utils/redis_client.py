"""redis-py client construction, with distinct Sentinel discovery/data options.

TLS options belong to the connection/pool redis-py creates, not an external
SSLContext. Clients own their pools; Sentinel clients also own their discovery
connections so a failed initialization or shutdown closes both paths.
"""

from typing import Any, Mapping, Optional, Sequence

import redis as sync_redis
import redis.asyncio as async_redis


def redis_tls_kwargs(
    *, enabled: bool, cert_reqs: str = "required",
    ca_certs: Optional[str] = None, ca_data: Optional[str] = None,
    check_hostname: Optional[bool] = None,
    certfile: Optional[str] = None, keyfile: Optional[str] = None,
) -> dict[str, Any]:
    if not enabled:
        return {}
    cert_reqs = str(cert_reqs).lower()
    if cert_reqs not in {"required", "optional", "none"}:
        raise ValueError(f"Unsupported REDIS_SSL_CERT_REQS: {cert_reqs!r}")
    kwargs: dict[str, Any] = {
        "ssl": True,
        "ssl_cert_reqs": cert_reqs,
        "ssl_check_hostname": cert_reqs != "none" if check_hostname is None else check_hostname,
    }
    for name, value in (("ssl_ca_certs", ca_certs), ("ssl_ca_data", ca_data),
                        ("ssl_certfile", certfile), ("ssl_keyfile", keyfile)):
        if value:
            kwargs[name] = value
    return kwargs


def _connection_options(options: Mapping[str, Any]) -> dict[str, Any]:
    kwargs = dict(options)
    if "ssl_context" in kwargs:
        raise ValueError("redis-py requires certificate arguments, not ssl_context")
    enabled = kwargs.pop("ssl_enabled", False)
    tls = redis_tls_kwargs(
        enabled=enabled,
        cert_reqs=kwargs.pop("ssl_cert_reqs", "required"),
        check_hostname=kwargs.pop("ssl_check_hostname", None),
        ca_certs=kwargs.pop("ssl_ca_certs", None),
        ca_data=kwargs.pop("ssl_ca_data", None),
        certfile=kwargs.pop("ssl_certfile", None),
        keyfile=kwargs.pop("ssl_keyfile", None),
    )
    kwargs.setdefault("decode_responses", True)
    kwargs.setdefault("socket_connect_timeout", 5)
    kwargs.setdefault("socket_keepalive", True)
    kwargs.update(tls)
    return kwargs


def create_async_redis_client(*, host: str, port: int, **options: Any) -> async_redis.Redis:
    return async_redis.Redis(host=host, port=port, **_connection_options(options))


def create_sync_redis_client(*, host: str, port: int, **options: Any) -> sync_redis.Redis:
    return sync_redis.Redis(host=host, port=port, **_connection_options(options))


def _discovery_options(
    data_options: Mapping[str, Any], sentinel_password: Optional[str],
    sentinel_options: Optional[Mapping[str, Any]],
) -> dict[str, Any]:
    # db, max_connections and master authentication are not discovery options.
    discovery = {k: v for k, v in data_options.items()
                 if k.startswith("ssl") or k.startswith("socket_")}
    discovery["password"] = sentinel_password
    if sentinel_options is not None:
        # Normalize once after merging: a CA/hostname override must not be
        # discarded merely because ssl_enabled was omitted from the override.
        discovery["ssl_enabled"] = discovery.pop("ssl", False)
        discovery.update(sentinel_options)
        discovery = _connection_options(discovery)
    if "ssl_context" in discovery:
        raise ValueError("Sentinel discovery does not support ssl_context")
    return discovery


class _AsyncSentinelRedis(async_redis.Redis):
    _discovery_clients: Sequence[async_redis.Redis] = ()

    async def aclose(self, close_connection_pool: Optional[bool] = None) -> None:
        try:
            await super().aclose(close_connection_pool=close_connection_pool)
        finally:
            for client in self._discovery_clients:
                await client.aclose()


class _SyncSentinelRedis(sync_redis.Redis):
    _discovery_clients: Sequence[sync_redis.Redis] = ()

    def close(self) -> None:
        try:
            super().close()
        finally:
            for client in self._discovery_clients:
                client.close()


def create_async_sentinel_client(
    *, sentinels: Sequence[tuple[str, int]], master_name: str,
    sentinel_password: Optional[str] = None,
    sentinel_options: Optional[Mapping[str, Any]] = None, **options: Any,
) -> async_redis.Redis:
    data = _connection_options(options)
    manager = async_redis.Sentinel(
        list(sentinels), sentinel_kwargs=_discovery_options(data, sentinel_password, sentinel_options),
        **data,
    )
    client = manager.master_for(master_name, redis_class=_AsyncSentinelRedis)
    client._discovery_clients = manager.sentinels
    return client


def create_sync_sentinel_client(
    *, sentinels: Sequence[tuple[str, int]], master_name: str,
    sentinel_password: Optional[str] = None,
    sentinel_options: Optional[Mapping[str, Any]] = None, **options: Any,
) -> sync_redis.Redis:
    data = _connection_options(options)
    manager = sync_redis.Sentinel(
        list(sentinels), sentinel_kwargs=_discovery_options(data, sentinel_password, sentinel_options),
        **data,
    )
    client = manager.master_for(master_name, redis_class=_SyncSentinelRedis)
    client._discovery_clients = manager.sentinels
    return client
