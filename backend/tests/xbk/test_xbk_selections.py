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

    def scalars(self):
        return self

    def all(self):
        return self._value if isinstance(self._value, list) else ([] if self._value is None else [self._value])



class _CrudDb:
    def __init__(self, execute_values, *, students=(), courses=()):
        self.execute_values = list(execute_values)
        self.parents = {"xbk_students": students, "xbk_courses": courses}
        self.parent_queries = []
        self.added = []
        self.commit_count = 0
        self.refresh_count = 0

    async def execute(self, statement):
        table = statement.get_final_froms()[0].name
        if table in self.parents:
            # Query-shape adapter only; actual lock behavior is tested on PG.
            fields = ("year", "term", "student_no" if table == "xbk_students" else "course_code")
            keys = next(iter(statement.compile().params.values()))
            if tuple(column.key for column in statement.selected_columns) == ("id",):
                return _ScalarResult([row.id for row in self.parents[table]
                                      if tuple(getattr(row, field) for field in fields) in keys])
            assert statement._for_update_arg is not None
            self.parent_queries.append(table)  # actual SHARE-lock query
            return _ScalarResult(list(self.parents[table]))
        return _ScalarResult(self.execute_values.pop(0) if self.execute_values else [])

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
        year="2026-2027",
        term="上",
        class_name="1班",
        student_no="2026001",
        name="张三",
        is_deleted=False,
    )


def _course():
    return XbkCourse(
        id=2,
        year="2026-2027",
        term="上",
        course_code="CS101",
        course_name="计算机基础",
        quota=30,
        is_deleted=False,
    )


def test_create_selection_validates_relations_and_persists():
    db = _CrudDb([None], students=[_student()], courses=[_course()])

    result = asyncio.run(create_selection(_payload(), db, {"role_code": "admin"}))

    assert result["id"] == 1
    assert result["student_no"] == "2026001"
    assert result["course_code"] == "CS101"
    assert db.parent_queries == ["xbk_students", "xbk_courses", "xbk_students", "xbk_courses"]
    assert len(db.added) == 1
    assert db.commit_count == 1


def test_create_selection_rejects_missing_student():
    db = _CrudDb([], courses=[_course()])

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(create_selection(_payload(), db, {"role_code": "admin"}))

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "学生不存在（请先维护学生名单；须为同学年、同学期且未删除）"
    assert db.added == []
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


@pytest.mark.parametrize("parent_kind", ["student", "course"])
@pytest.mark.parametrize("change", [{"is_deleted": True}, {"year": "2025-2026"}, {"term": "下"}])
def test_create_selection_rejects_inactive_or_other_period_parent(parent_kind, change):
    student, course = _student(), _course()
    parent = student if parent_kind == "student" else course
    for field, value in change.items():
        setattr(parent, field, value)
    db = _CrudDb([], students=[student], courses=[course])

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(create_selection(_payload(), db, {"role_code": "admin"}))

    label, advice = ("学生", "请先维护学生名单") if parent_kind == "student" else ("课程", "请先维护选课目录")
    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == f"{label}不存在（{advice}；须为同学年、同学期且未删除）"
    assert db.added == []
    assert db.commit_count == 0
    assert db.refresh_count == 0


def test_create_unselected_requires_only_active_student():
    db = _CrudDb([None], students=[_student()])
    payload = XbkSelectionUpsert(**{**_payload().model_dump(), "course_code": ""})

    result = asyncio.run(create_selection(payload, db, {"role_code": "admin"}))

    assert result["id"] == 1
    assert result["student_no"] == "2026001"
    assert result["course_code"] == "未选"
    assert db.parent_queries == ["xbk_students", "xbk_students"]
    assert len(db.added) == 1
    assert db.commit_count == 1
