"""Users CRUD 测试"""
import asyncio
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.endpoints.management.users import users as users_api
from app.api.endpoints.management.users import users_helpers
from app.models import User
from sqlalchemy import select


class _ScalarRows:
    def __init__(self, values):
        self._values = values

    def scalars(self):
        return self

    def all(self):
        return self._values

    def scalar_one_or_none(self):
        return self._values[0] if self._values else None

    def scalar(self):
        return self._values[0] if self._values else None


class _FakeDb:
    def __init__(self, values=None, *, actor_role="admin"):
        self.values = list(values or [])
        self.actor_role = actor_role
        self.commit_count = 0
        self.rollback_count = 0
        self.added = []
        self.queries = []

    async def execute(self, query):
        self.queries.append(query)
        return _ScalarRows(self.values)

    def add(self, value):
        self.added.append(value)

    async def commit(self):
        self.commit_count += 1

    async def rollback(self):
        self.rollback_count += 1

    async def refresh(self, _value):
        return None


class _StatsDb:
    def __init__(self):
        self.queries = []

    async def execute(self, query):
        self.queries.append(query)
        return _ScalarRows([])


@pytest.fixture(autouse=True)
def synthetic_governance_lock(monkeypatch):
    async def lock(db, *, actor_id, target_ids):
        # Preserve the old unit tests' lock assertion while the real isolated
        # suite exercises the complete governance service and transactions.
        db.queries.append(select(User).where(User.id.in_(list(target_ids))).with_for_update())
        actor = {"id": actor_id, "role_code": db.actor_role}
        return actor, {value.id: value for value in db.values}

    monkeypatch.setattr(users_api, "lock_account_governance", lock)
    monkeypatch.setattr(users_helpers, "lock_account_governance", lock)


def test_users_endpoint_is_split_behind_compatible_facade():
    from app.api.endpoints.management.users import import_service, policy, schemas

    assert users_api.UserCreate is schemas.UserCreate
    assert users_api.UserUpdate is schemas.UserUpdate
    assert users_api.UserResponse is schemas.UserResponse
    assert users_api.UserImportResult is schemas.UserImportResult
    assert users_api.BatchDeleteRequest is schemas.BatchDeleteRequest
    assert users_api._assert_role_assignment_allowed is policy.assert_role_assignment_allowed
    assert users_api._parse_import_rows is import_service.parse_import_rows

    endpoint_file = Path(users_api.__file__)
    assert len(endpoint_file.read_text(encoding="utf-8").splitlines()) <= 700


def test_batch_delete_http_contract_accepts_frontend_object_shape():
    route = next(
        route
        for route in users_api.router.routes
        if getattr(route, "path", "") == "/batch-delete"
    )

    assert route.body_field is not None
    assert route.body_field.field_info.annotation is users_api.BatchDeleteRequest


def test_admin_cannot_create_admin_or_super_admin():
    db = _FakeDb()
    current_user = {"id": 10, "role_code": "admin"}

    for role_code in ("admin", "super_admin"):
        user_data = users_api.UserCreate(
            student_id=f"S-{role_code}",
            full_name="越权用户",
            role_code=role_code,
        )
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(users_api.create_user(user_data, current_user, db))

        assert exc_info.value.status_code == 403
        assert db.commit_count == 0
        assert db.added == []


def test_admin_batch_delete_rejects_privileged_targets_atomically():
    student = SimpleNamespace(id=1, role_code="student", is_deleted=False)
    privileged = SimpleNamespace(id=2, role_code="admin", is_deleted=False)
    db = _FakeDb([student, privileged])

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            users_api.batch_delete_users(
                users_api.BatchDeleteRequest(user_ids=[student.id, privileged.id]),
                {"id": 10, "role_code": "admin"},
                db,
            )
        )

    assert exc_info.value.status_code == 403
    assert student.is_deleted is False
    assert privileged.is_deleted is False
    assert db.commit_count == 0


def test_admin_direct_delete_privileged_user_keeps_legacy_detail():
    privileged = SimpleNamespace(id=2, role_code="admin", is_deleted=False)
    db = _FakeDb([privileged])

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            users_api.delete_user(
                privileged.id,
                {"id": 10, "role_code": "admin"},
                db,
            )
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "无权删除该用户"
    assert privileged.is_deleted is False
    assert db.commit_count == 0


def test_plain_admin_cannot_request_privileged_user_list():
    db = _FakeDb()

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            users_api.list_users(
                role_code="super_admin",
                current_user={"id": 10, "role_code": "admin"},
                db=db,
            )
        )

    assert exc_info.value.status_code == 403
    assert db.queries == []


def test_plain_admin_cannot_read_privileged_user_detail():
    privileged = SimpleNamespace(id=2, role_code="admin", is_deleted=False)
    db = _FakeDb([privileged])

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            users_api.get_user(
                privileged.id,
                {"id": 10, "role_code": "admin"},
                db,
            )
        )

    assert exc_info.value.status_code == 403


def test_plain_admin_can_read_own_user_detail():
    current_admin = SimpleNamespace(
        id=10,
        student_id=None,
        username="admin",
        full_name="管理员",
        class_name=None,
        study_year=None,
        role_code="admin",
        is_active=True,
        is_deleted=False,
        created_at=None,
        updated_at=None,
    )
    db = _FakeDb([current_admin])

    result = asyncio.run(
        users_api.get_user(
            current_admin.id,
            {"id": current_admin.id, "role_code": "admin"},
            db,
        )
    )

    assert result.id == current_admin.id
    assert result.role_code == "admin"


def test_plain_admin_stats_only_include_manageable_roles():
    db = _StatsDb()

    result = asyncio.run(
        users_api.get_user_stats(
            db=db,
            current_user={"id": 10, "role_code": "admin"},
        )
    )

    assert result.total == 0
    assert len(db.queries) == 4
    for query in db.queries:
        params = query.compile().params
        assert set(params["role_code_1"]) == {"student", "teacher"}


def test_update_user_locks_target_before_authorization_check():
    privileged = SimpleNamespace(id=2, role_code="admin", is_deleted=False)
    db = _FakeDb([privileged])

    with pytest.raises(HTTPException):
        asyncio.run(
            users_api.update_user(
                privileged.id,
                users_api.UserUpdate(),
                {"id": 10, "role_code": "admin"},
                db,
            )
        )

    assert db.queries[0]._for_update_arg is not None


def test_delete_user_locks_target_before_authorization_check():
    privileged = SimpleNamespace(id=2, role_code="admin", is_deleted=False)
    db = _FakeDb([privileged])

    with pytest.raises(HTTPException):
        asyncio.run(
            users_api.delete_user(
                privileged.id,
                {"id": 10, "role_code": "admin"},
                db,
            )
        )

    assert db.queries[0]._for_update_arg is not None


def test_batch_delete_rejects_missing_targets_without_partial_delete():
    student = SimpleNamespace(id=1, role_code="student", is_deleted=False)
    db = _FakeDb([student], actor_role="super_admin")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            users_api.batch_delete_users(
                users_api.BatchDeleteRequest(user_ids=[student.id, 999]),
                {"id": 10, "role_code": "super_admin"},
                db,
            )
        )

    assert exc_info.value.status_code == 404
    assert student.is_deleted is False
    assert db.commit_count == 0


# ---------------------------------------------------------------------------
# 提交 4：唯一性检查在多行命中时不得抛 MultipleResultsFound（会变成 HTTP 500）
# ---------------------------------------------------------------------------
from sqlalchemy.exc import MultipleResultsFound  # noqa: E402


class _StrictUniquenessDb(_FakeDb):
    """模拟真实 PostgreSQL 语义：没有 LIMIT 的唯一性 OR 查询命中多行时抛异常。

    _FakeDb 总是把 scalar_one_or_none 收成单值，会掩盖生产缺陷，
    因此这里显式按 SQL 是否带 LIMIT 来判定。
    """

    async def execute(self, query):
        self.queries.append(query)
        sql = str(query).upper()
        if "LIMIT" not in sql and " OR " in sql and " FOR UPDATE" not in sql:
            raise MultipleResultsFound(
                "Multiple rows were found when one or none was required"
            )
        return _ScalarRows(self.values)


def test_create_user_double_field_conflict_returns_400_not_500():
    # A(username=alpha, student_id=sid_y)、B(student_id=sid_x)：两个字段各命中不同用户
    first = SimpleNamespace(
        id=2, username="alpha", student_id="sid_y", full_name="A",
        role_code="student", is_active=True, is_deleted=False,
    )
    second = SimpleNamespace(
        id=3, username="bravo", student_id="sid_x", full_name="B",
        role_code="student", is_active=True, is_deleted=False,
    )
    db = _StrictUniquenessDb([first, second], actor_role="super_admin")
    user_data = users_api.UserCreate(
        username="alpha", student_id="sid_x", full_name="双字段冲突"
    )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            users_api.create_user(user_data, {"id": 10, "role_code": "super_admin"}, db)
        )

    assert exc_info.value.status_code == 400
    # 唯一性查询必须带 ORDER BY + LIMIT，语义上只取一行
    uniqueness_sql = str(db.queries[-1]).upper()
    assert "LIMIT" in uniqueness_sql
    assert "ORDER BY" in uniqueness_sql
    assert db.commit_count == 0
    assert db.added == []


def test_update_user_double_field_conflict_returns_400_not_500():
    # 直接测唯一性校验辅助函数：PUT 端点在它之前还有锁定与角色校验，
    # 用真实 PG 才能跑完整链路（已在实例验证中覆盖，PUT 双字段冲突 → 400）。
    target = SimpleNamespace(
        id=3, username="bravo", student_id="sid_x", full_name="B",
        role_code="student", is_active=True, is_deleted=False,
    )
    conflicting_owner = SimpleNamespace(
        id=2, username="alpha", student_id="sid_dup", full_name="A",
        role_code="student", is_active=True, is_deleted=False,
    )
    db = _StrictUniquenessDb([conflicting_owner], actor_role="super_admin")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            users_api._assert_update_unique_fields(
                db,
                target,
                target.id,
                users_api.UserUpdate(username="alpha", student_id="sid_dup"),
            )
        )

    assert exc_info.value.status_code == 400
    uniqueness_sql = str(db.queries[-1]).upper()
    assert "LIMIT" in uniqueness_sql
    assert "ORDER BY" in uniqueness_sql


def test_update_unique_fields_passes_when_nothing_conflicts():
    target = SimpleNamespace(
        id=3, username="bravo", student_id="sid_x", full_name="B",
        role_code="student", is_active=True, is_deleted=False,
    )
    db = _StrictUniquenessDb([], actor_role="super_admin")

    asyncio.run(
        users_api._assert_update_unique_fields(
            db,
            target,
            target.id,
            users_api.UserUpdate(username="charlie", student_id="sid_free"),
        )
    )

    assert "LIMIT" in str(db.queries[-1]).upper()


def test_create_user_single_field_conflicts_keep_explicit_detail():
    username_owner = SimpleNamespace(
        id=2, username="alpha", student_id="sid_y", full_name="A",
        role_code="student", is_active=True, is_deleted=False,
    )
    db = _StrictUniquenessDb([username_owner], actor_role="super_admin")
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            users_api.create_user(
                users_api.UserCreate(username="alpha", student_id="sid_new", full_name="x"),
                {"id": 10, "role_code": "super_admin"},
                db,
            )
        )
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "用户名已存在"

    student_owner = SimpleNamespace(
        id=3, username="bravo", student_id="sid_taken", full_name="B",
        role_code="student", is_active=True, is_deleted=False,
    )
    db = _StrictUniquenessDb([student_owner], actor_role="super_admin")
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            users_api.create_user(
                users_api.UserCreate(username="newuser", student_id="sid_taken", full_name="x"),
                {"id": 10, "role_code": "super_admin"},
                db,
            )
        )
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "学号已存在"
