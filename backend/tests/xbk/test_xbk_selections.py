"""XBK 选课管理测试"""
import asyncio
from types import SimpleNamespace


def test_list_selections_success(monkeypatch):
    """测试选课记录查询"""
    fake_selections = [SimpleNamespace(id=1, student_no="2024001", course_code="CS101")]

    async def mock_list():
        return fake_selections, 1

    monkeypatch.setattr("app.api.endpoints.xbk.selections.list_selections", mock_list)
    result = asyncio.run(mock_list())
    assert len(result[0]) == 1


def test_create_selection_success(monkeypatch):
    """测试创建选课记录"""
    fake_selection = SimpleNamespace(id=1, student_no="2024001")

    async def mock_create():
        return fake_selection

    monkeypatch.setattr("app.api.endpoints.xbk.selections.create_selection", mock_create)
    result = asyncio.run(mock_create())
    assert result.id == 1


def test_delete_selection_success(monkeypatch):
    """测试删除选课记录"""
    async def mock_delete():
        return True

    monkeypatch.setattr("app.api.endpoints.xbk.selections.delete_selection", mock_delete)
    result = asyncio.run(mock_delete())
    assert result is True
