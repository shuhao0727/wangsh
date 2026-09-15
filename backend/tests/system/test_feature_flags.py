"""
系统管理 - Feature Flags 测试

覆盖场景：
1. FeatureFlagSchema 验证
2. feature_flags 路由注册检查
3. 公开端点不需要认证
4. 管理端点需要认证
5. 公开端点仅接受14个既有 key，并只投影严格布尔 enabled
"""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException, Response

from app.api.endpoints.system.feature_flags import (
    PUBLIC_FEATURE_FLAG_KEYS,
    PUBLIC_FEATURE_FLAG_NOT_FOUND,
    FeatureFlagSchema,
    get_public_feature_flag,
)


EXPECTED_PUBLIC_FEATURE_FLAG_KEYS = {
    "ai_agents_nav_enabled",
    "informatics_competition_nav_enabled",
    "it_technology_nav_enabled",
    "personal_programs_nav_enabled",
    "articles_nav_enabled",
    "it_dianming_enabled",
    "it_survey_enabled",
    "it_mindmap_enabled",
    "it_python_lab_enabled",
    "it_machine_learning_enabled",
    "it_ai_exploration_enabled",
    "it_agent_exploration_enabled",
    "it_game_lock_cracker_enabled",
    "it_game_repo_enabled",
}


class _ScalarResult:
    def __init__(self, flag):
        self._flag = flag

    def scalar_one_or_none(self):
        return self._flag


def _db_returning(flag):
    db = SimpleNamespace()
    db.execute = AsyncMock(return_value=_ScalarResult(flag))
    return db


def test_feature_flag_schema_basic():
    """FeatureFlagSchema 基本验证"""
    flag = FeatureFlagSchema(key="test_flag", value={"enabled": True})
    assert flag.key == "test_flag"
    assert flag.value == {"enabled": True}


def test_feature_flag_schema_string_value():
    """FeatureFlagSchema 支持字符串值"""
    flag = FeatureFlagSchema(key="version", value="1.0.0")
    assert flag.value == "1.0.0"


def test_feature_flag_schema_null_value():
    """FeatureFlagSchema 支持 None 值"""
    flag = FeatureFlagSchema(key="empty", value=None)
    assert flag.value is None


def test_feature_flag_schema_list_value():
    """FeatureFlagSchema 支持列表值"""
    flag = FeatureFlagSchema(key="items", value=[1, 2, 3])
    assert flag.value == [1, 2, 3]


def test_feature_flags_router_has_endpoints():
    """feature_flags 路由包含所有预期端点"""
    from app.api.endpoints.system.feature_flags import router

    paths = [route.path for route in router.routes if hasattr(route, "path")]
    assert "/system/feature-flags" in paths
    assert "/system/feature-flags/{key}" in paths
    assert "/system/public/feature-flags/{key}" in paths


def test_public_feature_flag_no_auth():
    """公开端点不需要认证"""
    from app.api.endpoints.system.feature_flags import router

    for route in router.routes:
        if not hasattr(route, "path"):
            continue
        if route.path == "/system/public/feature-flags/{key}":
            deps = [d.call for d in route.dependant.dependencies]  # type: ignore[union-attr]
            dep_names = [getattr(d, "__name__", str(d)) for d in deps]
            assert "require_admin" not in dep_names
            assert "require_super_admin" not in dep_names
            return
    assert False, "Public feature flag route not found"


def test_admin_feature_flags_require_auth():
    """管理端点需要管理员认证"""
    from app.api.endpoints.system.feature_flags import router

    admin_paths = {"/system/feature-flags", "/system/feature-flags/{key}"}
    for route in router.routes:
        if not hasattr(route, "path") or route.path not in admin_paths:
            continue
        methods = getattr(route, "methods", set())
        if "GET" not in methods and "POST" not in methods:
            continue
        deps = [d.call for d in route.dependant.dependencies]  # type: ignore[union-attr]
        dep_names = [getattr(d, "__name__", str(d)) for d in deps]
        assert "require_super_admin" in dep_names, f"{route.path} ({methods}) missing require_super_admin"


def test_public_feature_flag_allowlist_matches_existing_consumers():
    assert PUBLIC_FEATURE_FLAG_KEYS == EXPECTED_PUBLIC_FEATURE_FLAG_KEYS
    assert len(PUBLIC_FEATURE_FLAG_KEYS) == 14


@pytest.mark.parametrize("enabled", [True, False])
def test_public_feature_flag_projects_only_boolean_enabled(enabled):
    key = "it_python_lab_enabled"
    db = _db_returning(
        SimpleNamespace(
            key=key,
            value={
                "enabled": enabled,
                "api_key": "synthetic-secret",
                "api_url": "https://internal.invalid",
                "model": "private-model",
                "nested": {"token": "synthetic-token"},
            },
        )
    )
    response = Response()

    result = asyncio.run(get_public_feature_flag(key=key, response=response, db=db))

    assert result.model_dump() == {"key": key, "value": {"enabled": enabled}}
    assert response.headers["cache-control"] == "no-store"
    db.execute.assert_awaited_once()


@pytest.mark.parametrize(
    "stored_value",
    [
        {},
        {"other": True},
        {"enabled": "true"},
        {"enabled": 1},
        {"enabled": None},
        "not-an-object",
        [True],
        None,
    ],
)
def test_public_feature_flag_invalid_or_missing_enabled_preserves_empty_default(stored_value):
    key = "it_dianming_enabled"
    db = _db_returning(SimpleNamespace(key=key, value=stored_value))

    result = asyncio.run(get_public_feature_flag(key=key, response=Response(), db=db))

    assert result.model_dump() == {"key": key, "value": {}}


def test_public_feature_flag_missing_row_preserves_empty_default():
    key = "articles_nav_enabled"
    db = _db_returning(None)

    result = asyncio.run(get_public_feature_flag(key=key, response=Response(), db=db))

    assert result.model_dump() == {"key": key, "value": {}}


@pytest.mark.parametrize(
    "key",
    [
        "python_lab_agent_config",
        "ai_agent_config",
        "unknown_existing_flag",
        "unknown_missing_flag",
    ],
)
def test_public_feature_flag_rejects_non_allowlisted_key_before_query(key):
    db = _db_returning(
        SimpleNamespace(
            key=key,
            value={"enabled": True, "api_key": "synthetic-secret"},
        )
    )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(get_public_feature_flag(key=key, response=Response(), db=db))

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == PUBLIC_FEATURE_FLAG_NOT_FOUND
    db.execute.assert_not_awaited()
