"""Users 导入测试"""
import asyncio
import io
from types import SimpleNamespace

from fastapi import UploadFile

from app.api.endpoints.management.users import users as users_api


class _ScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _Savepoint:
    def __init__(self):
        self.rollback_count = 0

    async def rollback(self):
        self.rollback_count += 1


class _ImportDb:
    def __init__(self, existing_user, begin_nested_failures=0):
        self.existing_user = existing_user
        self.begin_nested_failures = begin_nested_failures
        self.commit_count = 0
        self.savepoints = []
        self.added = []

    async def begin_nested(self):
        if self.begin_nested_failures:
            self.begin_nested_failures -= 1
            raise RuntimeError("savepoint unavailable")
        savepoint = _Savepoint()
        self.savepoints.append(savepoint)
        return savepoint

    async def execute(self, _query):
        return _ScalarResult(self.existing_user)

    def add(self, value):
        self.added.append(value)

    async def flush(self):
        return None

    async def commit(self):
        self.commit_count += 1

    async def rollback(self):
        return None


def test_admin_import_cannot_modify_existing_privileged_user():
    existing_user = SimpleNamespace(
        id=1,
        student_id="A001",
        username="root",
        full_name="超级管理员",
        study_year=None,
        class_name=None,
        role_code="super_admin",
        is_active=True,
    )
    db = _ImportDb(existing_user)
    csv_content = (
        "学号,姓名,学年,班级,状态,用户名,角色\n"
        "A001,被篡改,2026,高一(1)班,false,hijacked,student\n"
    ).encode("utf-8")
    upload = UploadFile(filename="users.csv", file=io.BytesIO(csv_content))

    result = asyncio.run(
        users_api.import_users(
            upload,
            {"id": 10, "role_code": "admin"},
            db,
        )
    )

    assert result.success is False
    assert result.updated_count == 0
    assert result.error_count == 1
    assert result.errors[0].message == "403: 无权修改管理员或超级管理员"
    assert existing_user.full_name == "超级管理员"
    assert existing_user.username == "root"
    assert existing_user.is_active is True
    assert db.savepoints[0].rollback_count == 1


def test_admin_import_rejects_privileged_role_instead_of_downgrading():
    db = _ImportDb(existing_user=None)
    csv_content = (
        "学号,姓名,学年,班级,状态,用户名,角色\n"
        "A002,越权账号,2026,高一(1)班,true,admin2,admin\n"
    ).encode("utf-8")
    upload = UploadFile(filename="users.csv", file=io.BytesIO(csv_content))

    result = asyncio.run(
        users_api.import_users(
            upload,
            {"id": 10, "role_code": "admin"},
            db,
        )
    )

    assert result.success is False
    assert result.imported_count == 0
    assert result.error_count == 1
    assert result.errors[0].message == "403: 管理员只能设置学生或教师角色"
    assert db.savepoints[0].rollback_count == 1


def test_import_savepoint_creation_failure_is_reported_per_row_and_next_row_continues():
    db = _ImportDb(existing_user=None, begin_nested_failures=1)
    csv_content = (
        "学号,姓名,学年,班级,状态,用户名,角色\n"
        "A002,首行失败,2026,高一(1)班,true,first,student\n"
        "A003,继续导入,2026,高一(1)班,true,second,student\n"
    ).encode("utf-8")
    upload = UploadFile(filename="users.csv", file=io.BytesIO(csv_content))

    result = asyncio.run(
        users_api.import_users(
            upload,
            {"id": 10, "role_code": "admin"},
            db,
        )
    )

    assert result.success is False
    assert result.total_rows == 2
    assert result.imported_count == 1
    assert result.error_count == 1
    assert result.errors[0].row_number == 1
    assert result.errors[0].message == "savepoint unavailable"
    assert len(db.added) == 1
    assert db.commit_count == 1
