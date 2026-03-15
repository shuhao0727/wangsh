"""
health 端点测试
覆盖：ping、version、health 降级逻辑、config 权限控制
"""
import asyncio
from unittest.mock import AsyncMock
from fastapi import HTTPException

import app.api.endpoints.system.health as health_api
from app.core.config import settings


def test_ping():
    result = asyncio.run(health_api.ping())
    assert result["message"] == "pong"
    assert "timestamp" in result
    assert result["service"] == settings.PROJECT_NAME


def test_version():
    result = asyncio.run(health_api.version())
    assert result["name"] == settings.PROJECT_NAME
    assert result["version"] == settings.VERSION
    assert "timestamp" in result


def _make_db_mock(scalar_value=1):
    """构造一个 db mock，scalar() 是同步方法"""
    from unittest.mock import MagicMock
    mock_result = MagicMock()
    mock_result.scalar.return_value = scalar_value
    mock_db = AsyncMock()
    mock_db.execute.return_value = mock_result
    return mock_db


def test_health_all_healthy(monkeypatch):
    mock_db = _make_db_mock(scalar_value=1)

    mock_client = AsyncMock()
    mock_client.ping.return_value = True

    async def fake_get_client():
        return mock_client

    monkeypatch.setattr(health_api.cache, "get_client", fake_get_client)

    result = asyncio.run(health_api.health_check(db=mock_db))

    assert result["status"] == "healthy"
    assert result["checks"]["database"] == "healthy"
    assert result["checks"]["redis"] == "healthy"


def test_health_redis_down(monkeypatch):
    mock_db = _make_db_mock(scalar_value=1)

    async def fake_get_client():
        raise ConnectionError("Redis 不可用")

    monkeypatch.setattr(health_api.cache, "get_client", fake_get_client)

    result = asyncio.run(health_api.health_check(db=mock_db))

    assert result["status"] == "degraded"
    assert result["checks"]["database"] == "healthy"
    assert result["checks"]["redis"] == "unhealthy"


def test_health_db_down(monkeypatch):
    mock_db = AsyncMock()
    mock_db.execute.side_effect = Exception("DB 连接失败")

    try:
        asyncio.run(health_api.health_check(db=mock_db))
        assert False, "应该抛出 HTTPException"
    except HTTPException as e:
        assert e.status_code == 503


def test_config_blocked_in_production(monkeypatch):
    monkeypatch.setattr(settings, "DEBUG", False)

    try:
        asyncio.run(health_api.config_check())
        assert False, "非 DEBUG 模式应该返回 403"
    except HTTPException as e:
        assert e.status_code == 403


def test_config_available_in_debug(monkeypatch):
    monkeypatch.setattr(settings, "DEBUG", True)

    result = asyncio.run(health_api.config_check())

    assert "project" in result
    assert "database" in result
    assert "redis" in result
    # 不应该暴露敏感字段
    assert "password" not in str(result).lower()
    assert "secret" not in str(result).lower()
