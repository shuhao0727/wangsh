"""DM-01 点名对象级授权的纯合成隔离回归。"""

import asyncio

import pytest
from fastapi import HTTPException

from app.services.xxjs.dianming_access import (
    authorize_dianming_class_read,
    resolve_dianming_read_scope,
)


class _RowsResult:
    def __init__(self, rows=()):
        self._rows = list(rows)

    def all(self):
        return self._rows

    def scalars(self):
        return self


class _CapturingDB:
    def __init__(self, results=()):
        self.results = list(results)
        self.statements = []

    async def execute(self, statement):
        self.statements.append(statement)
        if self.results:
            return self.results.pop(0)
        return _RowsResult()


def _student(**overrides):
    user = {
        "id": 101,
        "role_code": "student",
        "class_name": "高一(1)班",
        "study_year": "2026",
    }
    user.update(overrides)
    return user


def _assert_forbidden(callable_):
    with pytest.raises(HTTPException) as exc_info:
        callable_()
    assert exc_info.value.status_code == 403
    return exc_info.value


def test_admin_and_super_admin_keep_global_read_scope():
    for role in ("admin", "super_admin"):
        scope = resolve_dianming_read_scope({"id": 1, "role_code": role})
        assert scope.is_global


def test_student_scope_requires_both_authoritative_object_keys():
    scope = resolve_dianming_read_scope(_student())
    assert (scope.year, scope.class_name) == ("2026", "高一(1)班")

    for missing in ("study_year", "class_name"):
        user = _student(**{missing: None})
        error = _assert_forbidden(lambda user=user: resolve_dianming_read_scope(user))
        assert "可核验" in error.detail


def test_student_can_read_only_exact_authoritative_class_object():
    authorize_dianming_class_read(
        _student(), year="2026", class_name="高一(1)班"
    )

    for year, class_name in (
        ("2025", "高一(1)班"),
        ("2026", "高一(2)班"),
    ):
        error = _assert_forbidden(
            lambda year=year, class_name=class_name: authorize_dianming_class_read(
                _student(), year=year, class_name=class_name
            )
        )
        assert "其他班级" in error.detail


def test_teacher_is_denied_until_explicit_relation_has_an_authoritative_source():
    # sys_users.class_name 当前被模型定义为学生字段，不能把教师随手填写的
    # 同名字段误当成任课授权。
    error = _assert_forbidden(
        lambda: resolve_dianming_read_scope(
            {
                "id": 201,
                "role_code": "teacher",
                "class_name": "高一(1)班",
                "study_year": "2026",
            }
        )
    )
    assert "教师" in error.detail
    assert "授权" in error.detail


def test_unknown_role_is_denied():
    error = _assert_forbidden(
        lambda: resolve_dianming_read_scope({"id": 301, "role_code": "guest"})
    )
    assert "无权" in error.detail


def test_list_classes_filters_student_to_authoritative_object():
    from app.api.endpoints.xxjs.dianming import list_classes

    db = _CapturingDB([_RowsResult([("2026", "高一(1)班", 35)])])
    result = asyncio.run(list_classes(db=db, _=_student()))

    assert result == [{"year": "2026", "class_name": "高一(1)班", "count": 35}]
    compiled = db.statements[0].compile()
    sql = str(compiled)
    assert "WHERE" in sql
    assert "xxjs_dianming.year" in sql
    assert "xxjs_dianming.class_name" in sql
    assert {value for value in compiled.params.values()} >= {"2026", "高一(1)班"}


def test_list_students_rejects_cross_class_before_querying_database():
    from app.api.endpoints.xxjs.dianming import list_students

    db = _CapturingDB()
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            list_students(
                year="2026",
                class_name="高一(2)班",
                db=db,
                _=_student(),
            )
        )
    assert exc_info.value.status_code == 403
    assert db.statements == []


def test_admin_and_super_admin_can_query_any_class():
    from app.api.endpoints.xxjs.dianming import list_students

    for role in ("admin", "super_admin"):
        db = _CapturingDB([_RowsResult()])
        result = asyncio.run(
            list_students(
                year="2026",
                class_name="高一(9)班",
                db=db,
                _={"id": 1, "role_code": role},
            )
        )
        assert result == []
        assert len(db.statements) == 1


def test_revoked_student_relation_is_rejected_on_the_next_request():
    from app.api.endpoints.xxjs.dianming import list_students

    user = _student()
    allowed_db = _CapturingDB([_RowsResult()])
    asyncio.run(
        list_students(
            year="2026", class_name="高一(1)班", db=allowed_db, _=user
        )
    )
    assert len(allowed_db.statements) == 1

    # 模拟认证权威记录撤销班级关系后，下一请求拿到的新身份快照。
    user["class_name"] = None
    revoked_db = _CapturingDB()
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            list_students(
                year="2026", class_name="高一(1)班", db=revoked_db, _=user
            )
        )
    assert exc_info.value.status_code == 403
    assert revoked_db.statements == []
