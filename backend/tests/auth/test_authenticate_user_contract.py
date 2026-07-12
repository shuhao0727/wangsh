import asyncio
from types import SimpleNamespace

from sqlalchemy.exc import MultipleResultsFound

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
