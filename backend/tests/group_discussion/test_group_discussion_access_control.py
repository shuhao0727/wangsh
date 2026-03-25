import asyncio
from datetime import date
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import app.api.endpoints.agents.ai_agents.group_discussion as gd_api
import app.services.agents.group_discussion as gd


class _FakeScalars:
    def __init__(self, value):
        self._value = value

    def all(self):
        return self._value


class _FakeResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value

    def scalars(self):
        return _FakeScalars(self._value)


class _FakeDB:
    def __init__(self, execute_values):
        self._execute_values = list(execute_values)
        self.execute_count = 0

    async def execute(self, _stmt):
        if self.execute_count >= len(self._execute_values):
            raise AssertionError("unexpected db.execute call")
        value = self._execute_values[self.execute_count]
        self.execute_count += 1
        return _FakeResult(value)


def test_ensure_session_view_access_rejects_student_non_member():
    session = SimpleNamespace(id=11)
    db = _FakeDB([session, None])
    user = {"id": 7, "role_code": "student"}

    with pytest.raises(HTTPException) as exc:
        asyncio.run(gd.ensure_session_view_access(db, session_id=11, user=user))

    assert exc.value.status_code == 403
    assert db.execute_count == 2


def test_ensure_session_view_access_allows_admin_without_membership():
    session = SimpleNamespace(id=22)
    db = _FakeDB([session])
    user = {"id": 1, "role_code": "admin"}

    got = asyncio.run(gd.ensure_session_view_access(db, session_id=22, user=user))

    assert got.id == 22
    assert db.execute_count == 1


def test_messages_endpoint_stops_when_access_denied(monkeypatch):
    called = {"list_called": False}

    async def fake_visibility(_db, _user):
        return None

    async def fake_access(_db, *, session_id, user):
        raise HTTPException(status_code=403, detail="无权限访问该讨论组")

    async def fake_list_messages(_db, *, session_id, after_id, limit):
        called["list_called"] = True
        return [], after_id

    monkeypatch.setattr(gd_api, "_enforce_frontend_visibility", fake_visibility)
    monkeypatch.setattr(gd_api, "ensure_session_view_access", fake_access)
    monkeypatch.setattr(gd_api, "list_messages", fake_list_messages)

    user = {"id": 301, "role_code": "student", "full_name": "张三", "class_name": "高一(1)班"}
    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            gd_api.get_group_discussion_messages(
                session_id=1,
                after_id=0,
                limit=50,
                db=object(),
                current_user=user,
            )
        )

    assert exc.value.status_code == 403
    assert called["list_called"] is False


def test_stream_endpoint_stops_when_access_denied(monkeypatch):
    async def fake_visibility(_db, _user):
        return None

    async def fake_access(_db, *, session_id, user):
        raise HTTPException(status_code=403, detail="无权限访问该讨论组")

    monkeypatch.setattr(gd_api, "_enforce_frontend_visibility", fake_visibility)
    monkeypatch.setattr(gd_api, "ensure_session_view_access", fake_access)

    user = {"id": 301, "role_code": "student", "full_name": "张三", "class_name": "高一(1)班"}
    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            gd_api.stream_group_discussion_messages(
                session_id=1,
                after_id=0,
                db=object(),
                current_user=user,
            )
        )

    assert exc.value.status_code == 403


def test_cross_system_analysis_rejects_invalid_date_before_db_touch():
    class _NoDB:
        async def execute(self, _stmt):
            raise AssertionError("db.execute should not be called for invalid date")

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            gd.admin_cross_system_analysis(
                _NoDB(),
                session_ids=[1],
                agent_id=1,
                admin_user={"id": 1},
                target_date="2026/03/24",
                class_name=None,
            )
        )

    assert exc.value.status_code == 422


def test_cross_system_analysis_rejects_when_no_members():
    session = SimpleNamespace(id=1, session_date=date(2026, 3, 24), class_name="高一(1)班", group_no="1")
    db = _FakeDB(
        [
            [session],  # sessions
            [],  # messages
            [],  # members
        ]
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            gd.admin_cross_system_analysis(
                db,
                session_ids=[1],
                agent_id=1,
                admin_user={"id": 1},
                target_date="2026-03-24",
                class_name="高一(1)班",
            )
        )

    assert exc.value.status_code == 422
    assert "暂无成员" in str(exc.value.detail)

