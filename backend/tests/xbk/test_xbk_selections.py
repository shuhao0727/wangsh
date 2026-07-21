"""XBK 选课管理端点测试。"""

import asyncio

import pytest
from fastapi import HTTPException

from app.api.endpoints.xbk.selections import create_selection, delete_selection
from app.models import XbkCourse, XbkSelection, XbkStudent
from app.schemas.xbk import XbkSelectionUpsert


class _ScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _CrudDb:
    def __init__(self, execute_values):
        self.execute_values = list(execute_values)
        self.added = []
        self.commit_count = 0
        self.refresh_count = 0

    async def execute(self, _statement):
        return _ScalarResult(self.execute_values.pop(0))

    def add(self, value):
        self.added.append(value)

    async def commit(self):
        self.commit_count += 1

    async def rollback(self):
        return None

    async def refresh(self, value):
        self.refresh_count += 1
        if value.id is None:
            value.id = 1


def _payload():
    return XbkSelectionUpsert(
        year=2026,
        term="上",
        grade="高一",
        student_no="2026001",
        name="张三",
        course_code="CS101",
    )


def _student():
    return XbkStudent(
        id=1,
        year=2026,
        term="上",
        class_name="1班",
        student_no="2026001",
        name="张三",
        is_deleted=False,
    )


def _course():
    return XbkCourse(
        id=2,
        year=2026,
        term="上",
        course_code="CS101",
        course_name="计算机基础",
        quota=30,
        is_deleted=False,
    )


def test_create_selection_validates_relations_and_persists():
    db = _CrudDb([_student(), _course(), None])

    result = asyncio.run(create_selection(_payload(), db, {"role_code": "admin"}))

    assert result["id"] == 1
    assert result["student_no"] == "2026001"
    assert result["course_code"] == "CS101"
    assert len(db.added) == 1
    assert db.commit_count == 1


def test_create_selection_rejects_missing_student():
    db = _CrudDb([None])

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(create_selection(_payload(), db, {"role_code": "admin"}))

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "学生不存在（请先维护学生名单）"
    assert db.commit_count == 0


def test_delete_selection_soft_deletes_existing_row():
    row = XbkSelection(
        id=9,
        year=2026,
        term="上",
        student_no="2026001",
        course_code="CS101",
        is_deleted=False,
    )
    db = _CrudDb([row])

    result = asyncio.run(delete_selection(9, db, {"role_code": "admin"}))

    assert result is None
    assert row.is_deleted is True
    assert db.commit_count == 1
