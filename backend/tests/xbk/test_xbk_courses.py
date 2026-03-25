"""XBK 课程管理测试"""
import asyncio
from types import SimpleNamespace


def test_list_courses_success(monkeypatch):
    """测试课程列表查询"""
    fake_courses = [SimpleNamespace(id=1, course_code="CS101", name="计算机基础")]

    async def mock_list():
        return fake_courses, 1

    monkeypatch.setattr("app.api.endpoints.xbk.data.list_courses", mock_list)
    result = asyncio.run(mock_list())
    assert len(result[0]) == 1


def test_create_course_success(monkeypatch):
    """测试创建课程"""
    fake_course = SimpleNamespace(id=1, course_code="CS101")

    async def mock_create():
        return fake_course

    monkeypatch.setattr("app.api.endpoints.xbk.data.create_course", mock_create)
    result = asyncio.run(mock_create())
    assert result.id == 1


def test_update_course_success(monkeypatch):
    """测试更新课程"""
    fake_course = SimpleNamespace(id=1, name="新课程名")

    async def mock_update():
        return fake_course

    monkeypatch.setattr("app.api.endpoints.xbk.data.update_course", mock_update)
    result = asyncio.run(mock_update())
    assert result.name == "新课程名"
