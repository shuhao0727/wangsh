import asyncio
from datetime import date, datetime
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

    def scalar_one(self):
        return self._value

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
    # 先查询会话是否存在，再查询成员身份
    db = _FakeDB([session, None])  # 会话存在，但不是成员
    user = {"id": 7, "role_code": "student"}

    with pytest.raises(HTTPException) as exc:
        asyncio.run(gd.ensure_session_view_access(db, session_id=11, user=user))

    assert exc.value.status_code == 403
    assert db.execute_count == 2  # 先检查会话，再检查成员


def test_ensure_session_view_access_returns_404_when_session_not_found():
    db = _FakeDB([None])  # 会话不存在
    user = {"id": 7, "role_code": "student"}

    with pytest.raises(HTTPException) as exc:
        asyncio.run(gd.ensure_session_view_access(db, session_id=999, user=user))

    assert exc.value.status_code == 404
    assert db.execute_count == 1  # 只检查会话是否存在


def test_ensure_session_view_access_allows_admin_without_membership():
    session = SimpleNamespace(id=22)
    db = _FakeDB([session])  # 管理员只检查会话是否存在
    user = {"id": 1, "role_code": "admin"}

    # ensure_session_view_access 不返回任何内容，只检查权限
    result = asyncio.run(gd.ensure_session_view_access(db, session_id=22, user=user))
    assert result is None  # 函数返回 None
    assert db.execute_count == 1  # 管理员只检查会话是否存在


def test_ensure_session_view_access_allows_super_admin_without_membership():
    session = SimpleNamespace(id=33)
    db = _FakeDB([session])  # super_admin 只检查会话是否存在
    user = {"id": 2, "role_code": "super_admin"}

    result = asyncio.run(gd.ensure_session_view_access(db, session_id=33, user=user))
    assert result is None  # 函数返回 None
    assert db.execute_count == 1  # super_admin 只检查会话是否存在


def test_admin_list_messages_returns_pagination():
    message = SimpleNamespace(id=5, session_id=22, user_id=1, user_display_name="管理员", content="hello", created_at=datetime.now())
    db = _FakeDB([3, [message]])

    rows, total, page_n, total_pages = asyncio.run(
        gd.admin_list_messages(db, session_id=22, page=2, size=2)
    )

    assert rows == [message]
    assert total == 3
    assert page_n == 2
    assert total_pages == 2
    assert db.execute_count == 2


def test_admin_list_sessions_returns_pagination():
    session = SimpleNamespace(
        id=22,
        session_date=date(2026, 4, 11),
        class_name="高一(1)班",
        group_no="1",
        group_name="第一组",
        message_count=0,
        created_at=datetime.now(),
        last_message_at=None,
    )
    db = _FakeDB([3, [session]])

    rows, total, page_n, total_pages = asyncio.run(
        gd.admin_list_sessions(
            db,
            start_date=None,
            end_date=None,
            class_name=None,
            group_no=None,
            group_name=None,
            user_name=None,
            page=2,
            size=2,
        )
    )

    assert rows == [session]
    assert total == 3
    assert page_n == 2
    assert total_pages == 2
    assert db.execute_count == 2


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


def test_admin_messages_endpoint_returns_paginated_response(monkeypatch):
    now = datetime.now()
    row = SimpleNamespace(
        id=9,
        session_id=22,
        user_id=1,
        user_display_name="管理员",
        content="hello",
        created_at=now,
    )

    async def fake_admin_list_messages(_db, *, session_id, page, size):
        assert session_id == 22
        assert page == 2
        assert size == 3
        return [row], 7, 2, 3

    monkeypatch.setattr(gd_api, "admin_list_messages", fake_admin_list_messages)

    resp = asyncio.run(
        gd_api.admin_get_messages(
            session_id=22,
            page=2,
            size=3,
            db=object(),
            _={"id": 1, "role_code": "admin"},
        )
    )

    assert resp.total == 7
    assert resp.page == 2
    assert resp.page_size == 3
    assert resp.total_pages == 3
    assert len(resp.items) == 1
    assert resp.items[0].id == 9


def test_admin_analyses_endpoint_maps_limit_to_service_size(monkeypatch):
    now = datetime.now()
    row = SimpleNamespace(
        id=11,
        session_id=22,
        agent_id=4,
        analysis_type="summary",
        prompt="prompt",
        result_text="result",
        created_at=now,
        compare_session_ids=None,
    )

    async def fake_admin_list_analyses(_db, *, session_id, page, size):
        assert session_id == 22
        assert page == 1
        assert size == 15
        return [row], 1

    monkeypatch.setattr(gd_api, "admin_list_analyses", fake_admin_list_analyses)

    resp = asyncio.run(
        gd_api.admin_get_analyses(
            session_id=22,
            limit=15,
            db=object(),
            _={"id": 1, "role_code": "admin"},
        )
    )

    assert len(resp.items) == 1
    assert resp.items[0].id == 11


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
