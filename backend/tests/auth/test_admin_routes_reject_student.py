"""学生 token → 管理端点 → 403 的 HTTP 全栈代表用例（审计 T-1）。

全仓此前缺少"student token 打到 require_admin 端点返回 403"的 HTTP 级用例
（既有测试多为依赖级 _assert_depends_on 或对象级 fake 调用）。本文件挑 3 个
典型 require_admin 端点，用 TestClient + dependency_overrides（同
tests/it/test_games_api.py 模式）走完整 HTTP 栈：

  - 用户管理列表 GET /users/
  - 测评管理配置列表 GET /assessment/admin/configs
  - model-discovery supported-providers GET /model-discovery/supported-providers

断言：student → 403（守卫先于业务逻辑拒绝，服务不会被调用）；未认证 → 401
（真实 get_current_user 链路）；admin → 放行（supported-providers 直接 200，
作为守卫正例）。
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.core.deps as deps
from app.api.endpoints.agents.model_discovery import router as model_discovery_router
from app.api.endpoints.assessment import admin as assessment_admin
from app.api.endpoints.management.users import router as users_router
from app.db.database import get_db

_ROLE_IDS = {"student": 100, "admin": 300}


def _user(role_code):
    return {
        "id": _ROLE_IDS[role_code],
        "role_code": role_code,
        "full_name": role_code,
        "is_active": True,
    }


# (用例名, HTTP 方法, 路径, router, prefix)
ADMIN_ENDPOINTS = [
    ("users_list", "get", "/users/", users_router, "/users"),
    ("assessment_admin_configs", "get", "/assessment/admin/configs", assessment_admin.router, "/assessment/admin"),
    ("model_discovery_providers", "get", "/model-discovery/supported-providers", model_discovery_router, "/model-discovery"),
]


def _make_app(router, prefix, user=None):
    app = FastAPI()
    app.include_router(router, prefix=prefix)

    async def _fake_db():
        return object()

    app.dependency_overrides[get_db] = _fake_db
    if user is not None:
        async def _current_user():
            return user

        app.dependency_overrides[deps.get_current_user] = _current_user
    return app


@pytest.mark.parametrize("case", ADMIN_ENDPOINTS, ids=[c[0] for c in ADMIN_ENDPOINTS])
def test_admin_endpoints_reject_student(case):
    app = _make_app(case[3], case[4], user=_user("student"))
    client = TestClient(app, raise_server_exceptions=False)

    response = getattr(client, case[1])(case[2])

    assert response.status_code == 403


@pytest.mark.parametrize("case", ADMIN_ENDPOINTS, ids=[c[0] for c in ADMIN_ENDPOINTS])
def test_admin_endpoints_reject_unauthenticated(case):
    # 不覆盖 get_current_user：真实链路，无 token → 401
    app = _make_app(case[3], case[4])
    client = TestClient(app, raise_server_exceptions=False)

    response = getattr(client, case[1])(case[2])

    assert response.status_code == 401


def test_supported_providers_allows_admin_positive_control():
    app = _make_app(model_discovery_router, "/model-discovery", user=_user("admin"))
    client = TestClient(app, raise_server_exceptions=False)

    response = client.get("/model-discovery/supported-providers")

    assert response.status_code == 200
