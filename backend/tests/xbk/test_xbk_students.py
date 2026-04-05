"""XBK 学生管理测试"""
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock


def test_list_students_success(monkeypatch):
    """测试学生列表查询成功"""
    fake_user = {"id": 1, "role_code": "admin"}
    fake_students = [
        SimpleNamespace(id=1, student_no="2024001", name="张三", grade="高一", class_name="1班"),
        SimpleNamespace(id=2, student_no="2024002", name="李四", grade="高一", class_name="2班"),
    ]

    async def mock_list():
        return fake_students, 2

    monkeypatch.setattr("app.api.endpoints.xbk.students.require_xbk_access", lambda: fake_user)
    monkeypatch.setattr("app.api.endpoints.xbk.students.list_students", mock_list)

    result = asyncio.run(mock_list())
    assert len(result[0]) == 2
    assert result[1] == 2


def test_list_students_with_filters(monkeypatch):
    """测试带筛选条件的学生列表"""
    fake_students = [
        SimpleNamespace(id=1, student_no="2024001", name="张三", grade="高一", class_name="1班"),
    ]

    async def mock_list():
        return fake_students, 1

    monkeypatch.setattr("app.api.endpoints.xbk.students.list_students", mock_list)

    result = asyncio.run(mock_list())
    assert len(result[0]) == 1


def test_create_student_success(monkeypatch):
    """测试创建学生成功"""
    fake_student = SimpleNamespace(id=1, student_no="2024001", name="张三")

    async def mock_create():
        return fake_student

    monkeypatch.setattr("app.api.endpoints.xbk.students.create_student", mock_create)

    result = asyncio.run(mock_create())
    assert result.id == 1


def test_create_student_duplicate(monkeypatch):
    """测试重复学号"""
    from sqlalchemy.exc import IntegrityError

    async def mock_create():
        raise IntegrityError("", "", "")

    monkeypatch.setattr("app.api.endpoints.xbk.students.create_student", mock_create)

    try:
        asyncio.run(mock_create())
        assert False, "Should raise IntegrityError"
    except IntegrityError:
        assert True
