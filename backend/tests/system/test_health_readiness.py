import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

import app.api.endpoints.system.health as health_api


def _db_mock():
    result = MagicMock()
    result.scalar.return_value = 1
    db = AsyncMock()
    db.execute.return_value = result
    return db


class _SessionContext:
    def __init__(self, db):
        self.db = db

    async def __aenter__(self):
        return self.db

    async def __aexit__(self, exc_type, exc, tb):
        return False


def test_health_exposes_view_contract_and_requires_it_for_ready(monkeypatch):
    db = _db_mock()
    redis_client = AsyncMock()
    redis_client.ping.return_value = True

    async def fake_get_client():
        return redis_client

    async def fake_contract(_db):
        return {"status": "healthy", "reason": "ok"}

    monkeypatch.setattr(health_api.cache, "get_client", fake_get_client)
    monkeypatch.setattr(health_api, "check_conversations_view_contract", fake_contract)

    result = asyncio.run(health_api.health_check(db=db))

    assert result["status"] == "healthy"
    assert result["checks"]["view_contract"] == "healthy"


def test_health_is_not_ready_when_view_contract_is_unhealthy(monkeypatch):
    db = _db_mock()
    redis_client = AsyncMock()
    redis_client.ping.return_value = True

    async def fake_get_client():
        return redis_client

    async def fake_contract(_db):
        return {"status": "unhealthy", "reason": "view_missing_or_columns_mismatch"}

    monkeypatch.setattr(health_api.cache, "get_client", fake_get_client)
    monkeypatch.setattr(health_api, "check_conversations_view_contract", fake_contract)

    result = asyncio.run(health_api.health_check(db=db))

    assert result["status"] == "unhealthy"
    assert result["checks"]["view_contract"] == "unhealthy"


def test_health_exposes_agent_secrets_and_requires_it_for_ready(monkeypatch):
    """A decryptable (or absent) stored key must not block readiness."""
    db = _db_mock()
    redis_client = AsyncMock()
    redis_client.ping.return_value = True

    async def fake_get_client():
        return redis_client

    async def fake_contract(_db):
        return {"status": "healthy", "reason": "ok"}

    async def fake_secrets(_db):
        return {"status": "healthy", "reason": "ok", "checked": 2}

    monkeypatch.setattr(health_api.cache, "get_client", fake_get_client)
    monkeypatch.setattr(health_api, "check_conversations_view_contract", fake_contract)
    monkeypatch.setattr(health_api, "check_agent_secret_contract", fake_secrets)

    result = asyncio.run(health_api.health_check(db=db))

    assert result["status"] == "healthy"
    assert result["checks"]["agent_secrets"] == "healthy"


def test_health_is_not_ready_when_agent_api_key_cannot_be_decrypted(monkeypatch):
    """Regression: dev/prod used different AGENT_API_KEY_ENCRYPTION_KEY.

    Both stacks share one Postgres directory, so stored ciphertext stayed
    readable as a row while every agent chat failed with "未配置API地址或密钥".
    Readiness must surface that instead of reporting healthy.
    """
    db = _db_mock()
    redis_client = AsyncMock()
    redis_client.ping.return_value = True

    async def fake_get_client():
        return redis_client

    async def fake_contract(_db):
        return {"status": "healthy", "reason": "ok"}

    async def fake_secrets(_db):
        return {
            "status": "unhealthy",
            "reason": "agent_api_key_undecryptable",
            "agent_ids": [1],
        }

    monkeypatch.setattr(health_api.cache, "get_client", fake_get_client)
    monkeypatch.setattr(health_api, "check_conversations_view_contract", fake_contract)
    monkeypatch.setattr(health_api, "check_agent_secret_contract", fake_secrets)

    result = asyncio.run(health_api.health_check(db=db))

    assert result["status"] == "unhealthy"
    assert result["checks"]["agent_secrets"] == "unhealthy"
    assert health_api.readiness_http_status(result["status"]) == 503


def test_check_agent_secret_contract_flags_undecryptable_rows(monkeypatch):
    """The checker itself must name the agent ids that failed to decrypt."""
    from app.utils import agent_secrets

    class _Row(tuple):
        pass

    rows = [ _Row((1, "good-token")), _Row((7, "bad-token")) ]

    result = MagicMock()
    result.all.return_value = rows
    db = AsyncMock()
    db.execute.return_value = result

    monkeypatch.setattr(
        agent_secrets, "try_decrypt_api_key",
        lambda token: None if token == "bad-token" else "sk-ok",
    )

    out = asyncio.run(health_api.check_agent_secret_contract(db))

    assert out["status"] == "unhealthy"
    assert out["reason"] == "agent_api_key_undecryptable"
    assert out["agent_ids"] == [7]


def test_check_agent_secret_contract_healthy_when_all_decrypt(monkeypatch):
    from app.utils import agent_secrets

    class _Row(tuple):
        pass

    result = MagicMock()
    result.all.return_value = [ _Row((1, "t1")), _Row((4, "t2")) ]
    db = AsyncMock()
    db.execute.return_value = result

    monkeypatch.setattr(agent_secrets, "try_decrypt_api_key", lambda token: "sk-ok")

    out = asyncio.run(health_api.check_agent_secret_contract(db))

    assert out["status"] == "healthy"
    assert out["checked"] == 2


def test_check_agent_secret_contract_requires_configured_key(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "AGENT_API_KEY_ENCRYPTION_KEY", "")

    out = asyncio.run(health_api.check_agent_secret_contract(AsyncMock()))

    assert out["status"] == "unhealthy"
    assert out["reason"] == "encryption_key_not_configured"


def test_readiness_http_status_never_marks_degraded_as_ready():
    assert health_api.readiness_http_status("healthy") == 200
    assert health_api.readiness_http_status("degraded") == 503
    assert health_api.readiness_http_status("unhealthy") == 503


def test_api_health_route_returns_503_for_degraded_readiness(monkeypatch):
    """Exercise the real FastAPI route layer, not only the helper function."""
    from httpx import ASGITransport, AsyncClient

    from main import app

    db = _db_mock()
    redis_client = AsyncMock()
    redis_client.ping.return_value = False

    async def fake_get_client():
        return redis_client

    async def fake_contract(_db):
        return {"status": "healthy", "reason": "ok"}

    monkeypatch.setattr(health_api.cache, "get_client", fake_get_client)
    monkeypatch.setattr(health_api, "check_conversations_view_contract", fake_contract)
    monkeypatch.setattr(health_api, "AsyncSessionLocal", lambda: _SessionContext(db))

    async def request():
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            return await client.get("/api/v1/health")

    response = asyncio.run(request())

    assert response.status_code == 503
    assert response.json()["status"] == "degraded"
    assert response.json()["checks"]["view_contract"] == "healthy"


@pytest.mark.parametrize(
    ("readiness_status", "expected_http_status"),
    [("healthy", 200), ("degraded", 503), ("unhealthy", 503)],
)
def test_api_health_route_maps_readiness_status_to_http(
    monkeypatch, readiness_status, expected_http_status
):
    from httpx import ASGITransport, AsyncClient

    from main import app

    async def fake_readiness(_db):
        return {"status": readiness_status, "checks": {}, "system": {}}

    monkeypatch.setattr(health_api, "readiness_check", fake_readiness)
    monkeypatch.setattr(health_api, "AsyncSessionLocal", lambda: _SessionContext(_db_mock()))

    async def request():
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            return await client.get("/api/v1/health")

    response = asyncio.run(request())

    assert response.status_code == expected_http_status
    assert response.json()["status"] == readiness_status


def test_both_health_routes_return_503_when_session_acquisition_fails(monkeypatch):
    """Session acquisition failures must use the shared unhealthy contract."""
    from httpx import ASGITransport, AsyncClient
    import main as main_module

    class _FailingSessionContext:
        async def __aenter__(self):
            raise RuntimeError("database unavailable")

        async def __aexit__(self, exc_type, exc, tb):
            return False

    failing_factory = lambda: _FailingSessionContext()
    monkeypatch.setattr(health_api, "AsyncSessionLocal", failing_factory)
    monkeypatch.setattr(main_module, "AsyncSessionLocal", failing_factory)

    async def request(path):
        transport = ASGITransport(app=main_module.app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            return await client.get(path)

    async def run():
        return await request("/health"), await request("/api/v1/health")

    root_response, versioned_response = asyncio.run(run())

    for response in (root_response, versioned_response):
        body = response.json()
        assert response.status_code == 503
        assert body["status"] == "unhealthy"
        assert body["checks"]["database"] == "unhealthy"
        assert body["checks"]["view_contract"] == "unhealthy"
        assert body["view_contract"]["reason"] == "database_session_unavailable"
