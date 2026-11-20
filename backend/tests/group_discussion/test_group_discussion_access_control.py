import asyncio
import json
from contextlib import asynccontextmanager
from datetime import date, datetime
from pathlib import Path
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


class _RenameDB(_FakeDB):
    def __init__(self, session):
        super().__init__([session])
        self.committed = False
        self.refreshed = False

    async def commit(self):
        self.committed = True

    async def refresh(self, _obj):
        self.refreshed = True


def test_set_group_name_returns_refreshed_session():
    session = SimpleNamespace(id=1, created_by_user_id=7, group_name="old")
    db = _RenameDB(session)

    result = asyncio.run(gd.set_group_name(db, session_id=1, user={"id": 7}, group_name="new"))

    assert result is session
    assert session.group_name == "new"
    assert db.committed is True
    assert db.refreshed is True


def test_set_group_name_rejects_non_creator():
    session = SimpleNamespace(id=1, created_by_user_id=7, group_name="old")
    db = _RenameDB(session)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(gd.set_group_name(db, session_id=1, user={"id": 8}, group_name="new"))

    assert exc.value.status_code == 403
    assert db.committed is False


class _FakePubSub:
    async def subscribe(self, channel):
        return None

    async def get_message(self, **kwargs):
        return {"type": "message"}

    async def unsubscribe(self, channel):
        return None

    async def close(self):
        return None


class _FakeClient:
    def pubsub(self):
        return _FakePubSub()


class _FakeSessionContext:
    async def __aenter__(self):
        return object()

    async def __aexit__(self, exc_type, exc, tb):
        return False


def test_group_discussion_stream_breaks_when_membership_revoked(monkeypatch):
    async def fake_get_client():
        return _FakeClient()

    async def reject_access(*args, **kwargs):
        raise HTTPException(status_code=403, detail="not a member")

    async def fail_list(*args, **kwargs):
        raise AssertionError("list_messages must not run after revocation")

    monkeypatch.setattr(gd_api.settings, "GROUP_DISCUSSION_REDIS_ENABLED", True)
    monkeypatch.setattr(gd_api, "cache", SimpleNamespace(get_client=fake_get_client))
    monkeypatch.setattr(gd_api, "AsyncSessionLocal", lambda: _FakeSessionContext())
    monkeypatch.setattr(gd_api, "ensure_session_view_access", reject_access)
    monkeypatch.setattr(gd_api, "list_messages", fail_list)

    async def consume():
        return [
            item
            async for item in gd_api._stream_group_discussion_messages(
                1, 0, {"id": 7, "role_code": "student"}
            )
        ]

    items = asyncio.run(consume())

    assert items
    assert items[0].startswith("event: access_revoked")


class _IdlePubSub(_FakePubSub):
    async def get_message(self, **kwargs):
        return None


class _IdleClient:
    def pubsub(self):
        return _IdlePubSub()


def test_group_discussion_stream_rechecks_access_when_idle(monkeypatch):
    now = 100.0
    member = True
    reads = []

    async def fake_get_client():
        return _IdleClient()

    async def check_access(*args, **kwargs):
        if not member:
            raise HTTPException(status_code=403, detail="not a member")

    async def empty_list(_db, *, session_id, after_id, limit):
        reads.append(after_id)
        return [], after_id

    monkeypatch.setattr(gd_api.settings, "GROUP_DISCUSSION_REDIS_ENABLED", True)
    monkeypatch.setattr(gd_api, "cache", SimpleNamespace(get_client=fake_get_client))
    monkeypatch.setattr(gd_api, "AsyncSessionLocal", lambda: _FakeSessionContext())
    monkeypatch.setattr(gd_api, "ensure_session_view_access", check_access)
    monkeypatch.setattr(gd_api, "list_messages", empty_list)
    loop = SimpleNamespace(time=lambda: now)
    monkeypatch.setattr(gd_api, "asyncio", SimpleNamespace(
        get_running_loop=lambda: loop, CancelledError=asyncio.CancelledError, sleep=asyncio.sleep,
    ))

    async def consume():
        nonlocal now, member
        stream = gd_api._stream_group_discussion_messages(1, 0, {"id": 7, "role_code": "student"})
        try:
            assert await anext(stream) == ":keepalive\n\n"
            member = False
            now += 5
            assert (await anext(stream)).startswith("event: access_revoked")
            with pytest.raises(StopAsyncIteration):
                await anext(stream)
        finally:
            await stream.aclose()

    asyncio.run(consume())
    assert reads == [0]


@pytest.mark.parametrize("revoke_midway", [False, True])
def test_quiet_stream_drains_backlog_and_rechecks_membership(monkeypatch, revoke_midway):
    session = SimpleNamespace(id=1)
    rows = [
        SimpleNamespace(
            id=message_id, session_id=1, user_id=7, user_display_name="学生",
            content=f"消息 {message_id}", created_at=datetime(2026, 11, 18),
        )
        for message_id in range(11, 246)
    ]
    # The periodic check, first page, and every subsequent fetch each use a
    # scoped DB session. Use the real membership and cursor queries with fake rows.
    connections = iter([
        _FakeDB([session, object()]),
        _FakeDB([session, object(), rows[:200]]),
        _FakeDB([session, None] if revoke_midway else [session, object(), rows[200:]]),
    ])

    @asynccontextmanager
    async def db_session():
        yield next(connections)

    real_list = gd_api.list_messages
    cursors = []

    async def checked_list(db, *, session_id, after_id, limit):
        cursors.append((after_id, limit))
        return await real_list(db, session_id=session_id, after_id=after_id, limit=limit)

    async def no_cached_id(_key):
        return None

    async def idle_pubsub(_channel):
        return _IdlePubSub()

    monkeypatch.setattr(gd_api.settings, "GROUP_DISCUSSION_REDIS_ENABLED", True)
    monkeypatch.setattr(gd.session_service.cache, "get", no_cached_id)
    monkeypatch.setattr(gd_api, "_open_group_discussion_pubsub", idle_pubsub)
    monkeypatch.setattr(gd_api, "AsyncSessionLocal", db_session)
    monkeypatch.setattr(gd_api, "list_messages", checked_list)

    async def consume():
        stream = gd_api._stream_group_discussion_messages(1, 10, {"id": 7, "role_code": "student"})
        try:
            first = await anext(stream)
            assert first.startswith("data: "), first
            first_page = json.loads(first.removeprefix("data: "))
            assert [item["id"] for item in first_page["items"]] == list(range(11, 211))
            assert first_page["next_after_id"] == 210
            second = await anext(stream)
            if revoke_midway:
                assert second.startswith("event: access_revoked")
                with pytest.raises(StopAsyncIteration):
                    await anext(stream)
            else:
                second_page = json.loads(second.removeprefix("data: "))
                assert [item["id"] for item in second_page["items"]] == list(range(211, 246))
                assert second_page["next_after_id"] == 245
        finally:
            await stream.aclose()

    asyncio.run(consume())
    assert cursors == ([(10, 200)] if revoke_midway else [(10, 200), (210, 200)])


def test_stream_retries_read_after_consuming_the_only_notification(monkeypatch):
    class SingleNotification(_FakePubSub):
        notified = False

        async def get_message(self, **kwargs):
            if not self.notified:
                self.notified = True
                return {"type": "message"}
            return None

    async def open_pubsub(_channel):
        return SingleNotification()

    row = SimpleNamespace(
        id=11, session_id=1, user_id=7, user_display_name="学生",
        content="暂时读不到的消息", created_at=datetime(2026, 11, 18),
    )
    reads = iter([([], 10), RuntimeError("synthetic DB failure"), ([row], 11)])

    async def read_messages(_session_id, after_id, _user):
        assert after_id == 10
        result = next(reads)
        if isinstance(result, Exception):
            raise result
        return result

    @asynccontextmanager
    async def db_session():
        yield _FakeDB([SimpleNamespace(id=1), object()])

    monkeypatch.setattr(gd_api, "_open_group_discussion_pubsub", open_pubsub)
    monkeypatch.setattr(gd_api, "AsyncSessionLocal", db_session)
    monkeypatch.setattr(gd_api, "_list_group_discussion_messages", read_messages)

    async def consume():
        stream = gd_api._stream_group_discussion_messages(1, 10, {"id": 7, "role_code": "student"})
        try:
            assert await anext(stream) == ":keepalive\n\n"
            retry = await anext(stream)
            assert retry.startswith("data: "), retry
            assert json.loads(retry.removeprefix("data: "))["next_after_id"] == 11
        finally:
            await stream.aclose()

    asyncio.run(consume())


def test_group_discussion_stream_uses_scoped_db_and_closes_request_db():
    source = Path(gd_api.__file__).read_text(encoding="utf-8")
    assert "await db.close()" in source
    assert "async with AsyncSessionLocal() as poll_db:" in source
