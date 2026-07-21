"""XBK 课程管理端点测试。"""

import asyncio

import pytest
from fastapi import HTTPException

from app.api.endpoints.xbk.courses import create_course, update_course
from app.models import XbkCourse
from app.schemas.xbk import XbkCourseUpsert


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


def _payload(quota=30):
    return XbkCourseUpsert(
        year=2026,
        term="上",
        grade="高一",
        course_code="CS101",
        course_name="计算机基础",
        teacher="王老师",
        quota=quota,
        location="A101",
    )


def test_create_course_persists_payload():
    db = _CrudDb([None])

    result = asyncio.run(create_course(_payload(), db, {"role_code": "admin"}))

    assert result["id"] == 1
    assert result["course_code"] == "CS101"
    assert result["quota"] == 30
    assert len(db.added) == 1
    assert db.commit_count == 1


def test_create_course_rejects_negative_quota():
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(create_course(_payload(-1), _CrudDb([]), {"role_code": "admin"}))

    assert exc_info.value.status_code == 422


def test_update_course_changes_existing_row():
    row = XbkCourse(
        id=6,
        year=2026,
        term="上",
        course_code="OLD",
        course_name="旧课程",
        quota=10,
        is_deleted=False,
    )
    db = _CrudDb([row])

    result = asyncio.run(update_course(6, _payload(), db, {"role_code": "admin"}))

    assert result["course_name"] == "计算机基础"
    assert row.course_code == "CS101"
    assert db.commit_count == 1
    assert db.refresh_count == 1
