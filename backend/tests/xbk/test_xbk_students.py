"""XBK 学生管理端点测试。"""

import asyncio

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.api.endpoints.xbk.students import create_student, delete_student
from app.models import XbkStudent
from app.schemas.xbk import XbkStudentUpsert


class _ScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _CrudDb:
    def __init__(self, execute_values, commit_error=None):
        self.execute_values = list(execute_values)
        self.commit_error = commit_error
        self.added = []
        self.commit_count = 0
        self.rollback_count = 0
        self.refresh_count = 0

    async def execute(self, _statement):
        return _ScalarResult(self.execute_values.pop(0))

    def add(self, value):
        self.added.append(value)

    async def commit(self):
        self.commit_count += 1
        if self.commit_error:
            raise self.commit_error

    async def rollback(self):
        self.rollback_count += 1

    async def refresh(self, value):
        self.refresh_count += 1
        if value.id is None:
            value.id = 1


def _payload():
    return XbkStudentUpsert(
        year=2026,
        term="上",
        grade="高一",
        class_name="1班",
        student_no="2026001",
        name="张三",
        gender="男",
    )


def test_create_student_persists_payload():
    db = _CrudDb([None])

    result = asyncio.run(create_student(_payload(), db, {"role_code": "admin"}))

    assert result["id"] == 1
    assert result["student_no"] == "2026001"
    assert result["class_name"] == "1班"
    assert len(db.added) == 1
    assert db.commit_count == 1
    assert db.refresh_count == 1


def test_create_student_rolls_back_integrity_conflict():
    db = _CrudDb([None], IntegrityError("", {}, Exception("duplicate")))

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(create_student(_payload(), db, {"role_code": "admin"}))

    assert exc_info.value.status_code == 409
    assert db.rollback_count == 1


def test_delete_student_soft_deletes_existing_row():
    row = XbkStudent(
        id=8,
        year=2026,
        term="上",
        class_name="1班",
        student_no="2026001",
        name="张三",
        is_deleted=False,
    )
    db = _CrudDb([row])

    result = asyncio.run(delete_student(8, db, {"role_code": "admin"}))

    assert result is None
    assert row.is_deleted is True
    assert db.commit_count == 1
