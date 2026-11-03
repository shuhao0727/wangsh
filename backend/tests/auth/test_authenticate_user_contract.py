import asyncio
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import MultipleResultsFound
from sqlalchemy.orm import Session

from app.services import auth


class _Result:
    def __init__(self, users):
        self.users = users if isinstance(users, list) else [users]

    def scalar_one_or_none(self):
        if len(self.users) > 1:
            raise MultipleResultsFound()
        return self.users[0] if self.users else None

    def scalars(self):
        return self

    def all(self):
        return self.users


class _DB:
    def __init__(self, users):
        self.users = users

    async def execute(self, _query):
        return _Result(self.users)


def _user(
    *,
    user_id=7,
    role_code="teacher",
    hashed_password="hashed",
    student_id="T007",
    full_name="Teacher",
):
    return SimpleNamespace(
        id=user_id,
        role_code=role_code,
        username=role_code,
        student_id=student_id,
        full_name=full_name,
        class_name=None,
        study_year=None,
        hashed_password=hashed_password,
        is_active=True,
        is_deleted=False,
        created_at=None,
        updated_at=None,
    )


def test_hashed_account_can_still_login_with_student_id(monkeypatch):
    monkeypatch.setattr(
        "app.utils.security.verify_password",
        lambda *_args: False,
    )

    result = asyncio.run(auth.authenticate_user(_DB(_user()), "Teacher", "T007"))

    assert result is not None
    assert result["role_code"] == "teacher"


def test_hashed_account_can_login_with_password(monkeypatch):
    monkeypatch.setattr(
        "app.utils.security.verify_password",
        lambda plain, hashed: plain == "secret" and hashed == "hashed",
    )

    result = asyncio.run(auth.authenticate_user(_DB(_user()), "Teacher", "secret"))

    assert result is not None


def test_passwordless_staff_account_can_login_with_student_id():
    result = asyncio.run(
        auth.authenticate_user(
            _DB(_user(role_code="admin", hashed_password=None)),
            "Teacher",
            "T007",
        )
    )

    assert result is not None
    assert result["role_code"] == "admin"


def test_duplicate_full_names_are_disambiguated_by_student_id(monkeypatch):
    monkeypatch.setattr(
        "app.utils.security.verify_password",
        lambda *_args: False,
    )
    users = [
        _user(user_id=7, student_id="T007", full_name="Same Name"),
        _user(user_id=8, student_id="T008", full_name="Same Name"),
    ]

    result = asyncio.run(auth.authenticate_user(_DB(users), "Same Name", "T008"))

    assert result is not None
    assert result["id"] == 8


def test_login_and_legacy_db_lookup_share_safe_identity_fields(monkeypatch):
    user = _user()
    user.api_key = "must-not-be-returned"
    monkeypatch.setattr(auth, "verify_token", lambda _token: {"sub": "Teacher"})

    login = asyncio.run(auth.authenticate_user(_DB(user), "Teacher", "T007"))
    legacy = asyncio.run(auth.get_current_user("synthetic-token", db=_DB(user)))

    fields = [
        "id", "role_code", "username", "student_id", "full_name",
        "class_name", "study_year", "is_active", "created_at", "updated_at",
    ]
    assert list(login) == fields
    assert login == legacy == {field: getattr(user, field) for field in fields}
    assert "hashed_password" not in login
    assert "api_key" not in legacy


@pytest.mark.parametrize(
    "active,deleted,include_inactive,credential,accepted",
    [
        (True, False, False, "T007", True),
        (False, False, False, "T007", False),
        (False, False, True, "T007", True),
        (False, False, True, "wrong", False),
        (True, True, True, "T007", False),
        (False, True, True, "T007", False),
    ],
)
def test_inactive_and_deleted_user_filters_preserve_contract(
    monkeypatch, active, deleted, include_inactive, credential, accepted
):
    """真实内存 SQLite 执行过滤，不以忽略 WHERE 的 DB 替身证明账号状态约束。"""
    engine = create_engine("sqlite:///:memory:")
    auth.User.__table__.create(engine)
    monkeypatch.setattr(auth, "verify_password", lambda *_args: False)

    class AsyncDB:
        def __init__(self, session):
            self.session = session

        async def execute(self, query):
            return self.session.execute(query)

    try:
        with Session(engine) as session:
            session.add(auth.User(
                id=7, username="teacher", full_name="Teacher", student_id="T007",
                hashed_password="synthetic-hash", role_code="teacher",
                is_active=active, is_deleted=deleted,
            ))
            session.flush()
            result = asyncio.run(auth.authenticate_user_auto(
                AsyncDB(session), "Teacher", credential, include_inactive=include_inactive,
            ))
            assert (result is not None) is accepted
            if accepted:
                assert result["is_active"] is active
    finally:
        engine.dispose()


def test_matching_multiple_users_still_rejects_login(monkeypatch):
    monkeypatch.setattr(auth, "verify_password", lambda *_args: True)
    users = [_user(user_id=7), _user(user_id=8)]

    assert asyncio.run(auth.authenticate_user(_DB(users), "Teacher", "secret")) is None


def test_ambiguous_legacy_lookup_still_rejects_identity(monkeypatch):
    monkeypatch.setattr(auth, "verify_token", lambda _token: {"sub": "Teacher"})
    users = [_user(user_id=7), _user(user_id=8)]

    assert asyncio.run(auth.get_current_user("synthetic-token", db=_DB(users))) is None
