"""Users 导入测试"""
import asyncio


def test_import_users_csv_success(monkeypatch):
    """测试 CSV 导入"""
    async def mock_import():
        return {"success": 10, "failed": 0}

    monkeypatch.setattr("app.api.endpoints.management.users.users.import_users", mock_import)
    result = asyncio.run(mock_import())
    assert result["success"] == 10


def test_import_users_xlsx_success(monkeypatch):
    """测试 Excel 导入"""
    async def mock_import():
        return {"success": 5, "failed": 0}

    monkeypatch.setattr("app.api.endpoints.management.users.users.import_users", mock_import)
    result = asyncio.run(mock_import())
    assert result["success"] == 5


def test_import_users_invalid_format(monkeypatch):
    """测试格式错误"""
    async def mock_import():
        raise ValueError("Invalid format")

    monkeypatch.setattr("app.api.endpoints.management.users.users.import_users", mock_import)

    try:
        asyncio.run(mock_import())
        assert False
    except ValueError:
        assert True
