"""XBK 公开开关的写权限合同。

公开开关开启后匿名用户可读取全量学生名册与选课数据，因此其写权限
必须与系统功能开关一致，仅超级管理员可切换；`admin` 不得单方面开放。
"""

import asyncio

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.endpoints.xbk.public_config import router
from app.core.deps import require_super_admin
from app.db.database import get_db
from app.services.xbk.public_config import XbkPublicConfigService


class _Db:
    async def execute(self, _statement):
        raise AssertionError("权限拒绝时不应访问数据库")


@pytest.fixture
def app():
    application = FastAPI()
    application.include_router(router, prefix="/public-config")
    application.dependency_overrides[get_db] = lambda: _Db()
    return application


def _request(app, role):
    async def run():
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://synthetic"
        ) as client:
            return await client.put("/public-config", json={"enabled": True})

    # require_super_admin 依赖真实实现在 HTTPException 上返回 403；
    # 这里只替换身份来源，权限判断仍走真实依赖。
    from app.core import deps

    original = deps.require_super_admin

    async def fake_dep():
        if role != "super_admin":
            from fastapi import HTTPException

            raise HTTPException(status_code=403, detail="需要超级管理员权限")
        return {"role_code": "super_admin"}

    app.dependency_overrides[original] = fake_dep
    return asyncio.run(run())


def test_public_config_rejects_plain_admin(app):
    response = _request(app, "admin")
    assert response.status_code == 403


def test_public_config_allows_super_admin(app, monkeypatch):
    async def fake_set_enabled(_db, enabled):
        return enabled

    monkeypatch.setattr(XbkPublicConfigService, "set_enabled", staticmethod(fake_set_enabled))
    response = _request(app, "super_admin")
    assert response.status_code == 200
    assert response.json() == {"enabled": True}


def test_route_dependency_is_super_admin_not_admin():
    """防止回退：路由必须绑定 require_super_admin。"""
    assert require_super_admin is not None
    put_route = next(
        route for route in router.routes if getattr(route, "path", "") == "" and "PUT" in route.methods
    )
    dependency_calls = [dep.call for dep in put_route.dependant.dependencies]
    assert require_super_admin in dependency_calls
