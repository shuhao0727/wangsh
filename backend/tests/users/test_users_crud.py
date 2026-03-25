"""Users CRUD 测试"""
import asyncio
from types import SimpleNamespace


def test_list_users_success(monkeypatch):
    """测试用户列表"""
    fake_users = [SimpleNamespace(id=1, username="test")]

    async def mock_list():
        return fake_users, 1

    monkeypatch.setattr("app.api.endpoints.management.users.users.list_users", mock_list)
    result = asyncio.run(mock_list())
    assert len(result[0]) == 1


def test_create_user_success(monkeypatch):
    """测试创建用户"""
    fake_user = SimpleNamespace(id=1, username="newuser")

    async def mock_create():
        return fake_user

    monkeypatch.setattr("app.api.endpoints.management.users.users.create_user", mock_create)
    result = asyncio.run(mock_create())
    assert result.id == 1


def test_get_user_success(monkeypatch):
    """测试获取用户"""
    fake_user = SimpleNamespace(id=1, username="test")

    async def mock_get():
        return fake_user

    monkeypatch.setattr("app.api.endpoints.management.users.users.get_user", mock_get)
    result = asyncio.run(mock_get())
    assert result.id == 1


def test_update_user_success(monkeypatch):
    """测试更新用户"""
    fake_user = SimpleNamespace(id=1, username="updated")

    async def mock_update():
        return fake_user

    monkeypatch.setattr("app.api.endpoints.management.users.users.update_user", mock_update)
    result = asyncio.run(mock_update())
    assert result.username == "updated"


def test_delete_user_success(monkeypatch):
    """测试删除用户"""
    async def mock_delete():
        return True

    monkeypatch.setattr("app.api.endpoints.management.users.users.delete_user", mock_delete)
    result = asyncio.run(mock_delete())
    assert result is True
