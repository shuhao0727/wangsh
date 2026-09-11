"""BIZ-04: real student router/JWT/service/ORM, no business DB, Redis or AI.

SQLite discards timestamp offsets. The fixture stores UTC and restores aware
values on config loads, emulating TIMESTAMPTZ at that boundary only. These tests
verify window decisions, NOT PostgreSQL conversion or concurrent row locking.
"""

import asyncio
import datetime as datetime_module
import secrets
import socket
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import attributes

from app.api.endpoints.assessment import student as student_api
from app.core import session_guard
from app.core.config import settings
from app.db.database import Base, get_db
from app.models import AuthAuthority, AuthSessionState, User
from app.models.agents import AIAgent
from app.models.assessment import (
    AssessmentAnswer, AssessmentConfig, AssessmentQuestion, AssessmentSession,
)
from app.services.assessment import session_service
from app.services.auth import create_access_token

UTC = timezone.utc
NOW = datetime(2032, 6, 1, 4, 0, tzinfo=UTC)
PREFIX = "/api/v1/assessment"


class WindowHarness:
    def __init__(self):
        self.clock = SimpleNamespace(now=NOW)
        self.db_timezone = UTC
        self.db_factory = None
        self.app = None
        self.ai_calls = 0
        self.question_reads = []
        self.assessment_writes = []

    async def request(self, method, path, *, user_id=1, **kwargs):
        headers = {}
        if user_id is not None:
            token = create_access_token({
                "sub": f"window-user-{user_id}", "sn": f"window-nonce-{user_id}",
            })
            headers["Authorization"] = f"Bearer {token}"
        async with AsyncClient(
            transport=ASGITransport(app=self.app),
            base_url="http://isolated.invalid", headers=headers,
        ) as client:
            return await client.request(method, PREFIX + path, **kwargs)

    async def start(self, config_id, *, user_id=1):
        return await self.request(
            "POST", "/sessions/start", user_id=user_id, json={"config_id": config_id},
        )

    async def seed(self, start=None, end=None, *, enabled=True, questions=True, mode="fixed"):
        # Only the SQLite fixture normalizes storage; production uses TIMESTAMPTZ.
        async with self.db_factory() as db:
            config = AssessmentConfig(
                title="Synthetic window assessment", enabled=enabled,
                available_start=start.astimezone(UTC) if start else None,
                available_end=end.astimezone(UTC) if end else None,
                question_config="{}", total_score=10, time_limit_minutes=60,
            )
            db.add(config)
            await db.flush()
            if questions:
                db.add_all([AssessmentQuestion(
                    config_id=config.id, question_type="choice", content=f"Synthetic {i}",
                    options='{"A":"yes","B":"no"}', correct_answer="A", score=5,
                    source="manual", mode=mode, knowledge_point=f"Synthetic point {i}",
                ) for i in (1, 2)])
            await db.commit()
            return config.id

    async def state(self):
        # A fresh DB session verifies committed rows, not an identity-map object.
        async with self.db_factory() as db:
            sessions = (await db.execute(select(
                AssessmentSession.id, AssessmentSession.config_id, AssessmentSession.user_id,
                AssessmentSession.status, AssessmentSession.started_at, AssessmentSession.total_score,
            ).order_by(AssessmentSession.id))).all()
            answers = (await db.execute(select(
                AssessmentAnswer.id, AssessmentAnswer.session_id, AssessmentAnswer.question_id,
                AssessmentAnswer.student_answer, AssessmentAnswer.answered_at,
            ).order_by(AssessmentAnswer.id))).all()
            return {"sessions": [tuple(row) for row in sessions], "answers": [tuple(row) for row in answers]}


@pytest.fixture
def isolated(monkeypatch):
    h = WindowHarness()

    def deny_network(*args, **kwargs):
        raise AssertionError("isolated assessment tests must not connect to external services")

    async def read_memory_nonce(key):
        for user_id in (1, 2, 3):
            if key == f"auth:session:uid:{user_id}":
                return {"nonce": f"window-nonce-{user_id}"}
        return None

    async def unexpected_ai(*args, **kwargs):
        h.ai_calls += 1
        raise AssertionError("window rejection must happen before AI generation")

    class FrozenDatetimeMeta(type):
        def __instancecheck__(cls, value):
            # sqlite's DATETIME binder must still recognize real datetime values
            # when the pre-fix list imports datetime locally from the stdlib.
            return isinstance(value, datetime)

    class FrozenDatetime(datetime, metaclass=FrozenDatetimeMeta):
        @classmethod
        def now(cls, tz=None):
            return h.clock.now.astimezone(tz) if tz else h.clock.now.replace(tzinfo=None)

    monkeypatch.setattr(socket.socket, "connect", deny_network)
    monkeypatch.setattr(settings, "SECRET_KEY", secrets.token_urlsafe(48))
    monkeypatch.setattr(settings, "AUTH_ENFORCE_SAME_IP_PER_REQUEST", False)
    monkeypatch.setattr(session_guard, "cache", SimpleNamespace(get=read_memory_nonce))
    monkeypatch.setattr(session_service, "_ai_generate_realtime_question", unexpected_ai)
    monkeypatch.setattr(session_service, "datetime", FrozenDatetime)
    # Also covers the pre-fix list's local datetime import in the red baseline.
    monkeypatch.setattr(datetime_module, "datetime", FrozenDatetime)

    def restore_aware_config(config, _context, _attrs=None):
        for name in ("available_start", "available_end"):
            value = getattr(config, name)
            if value is not None and value.tzinfo is None:
                attributes.set_committed_value(
                    config, name, value.replace(tzinfo=UTC).astimezone(h.db_timezone),
                )

    @asynccontextmanager
    async def context():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")

        @event.listens_for(engine.sync_engine, "connect")
        def enable_foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")

        @event.listens_for(engine.sync_engine, "before_cursor_execute")
        def track_sql(_conn, _cursor, statement, _parameters, _context, _many):
            sql = statement.lstrip().upper()
            if sql.startswith("SELECT") and "FROM znt_assessment_questions" in statement:
                h.question_reads.append(statement)
            if sql.startswith(("INSERT", "UPDATE", "DELETE")) and any(
                table in statement for table in ("znt_assessment_sessions", "znt_assessment_answers")
            ):
                h.assessment_writes.append(statement)

        h.db_factory = async_sessionmaker(engine, expire_on_commit=False)
        event.listen(AssessmentConfig, "load", restore_aware_config)
        event.listen(AssessmentConfig, "refresh", restore_aware_config)
        try:
            async with engine.begin() as connection:
                await connection.run_sync(lambda c: Base.metadata.create_all(c, tables=[
                    User.__table__, AIAgent.__table__, AssessmentConfig.__table__,
                    AssessmentQuestion.__table__, AssessmentSession.__table__, AssessmentAnswer.__table__,
                    AuthAuthority.__table__, AuthSessionState.__table__,
                ]))
            async with h.db_factory() as db:
                db.add_all([User(
                    id=i, username=f"window-user-{i}", full_name=f"Synthetic window {i}",
                    student_id=f"WINDOW-{i}", role_code="guest" if i == 3 else "student",
                    is_active=True, is_deleted=False,
                ) for i in (1, 2, 3)])
                await db.flush()
                db.add(AuthAuthority(id=1, ready=True))
                db.add_all([AuthSessionState(
                    user_id=i, nonce=f"window-nonce-{i}", ip="", active=True,
                ) for i in (1, 2, 3)])
                await db.commit()

            async def isolated_db():
                async with h.db_factory() as db:
                    yield db

            h.app = FastAPI()
            h.app.include_router(student_api.router, prefix=PREFIX)
            h.app.dependency_overrides[get_db] = isolated_db
            yield h
        finally:
            event.remove(AssessmentConfig, "load", restore_aware_config)
            event.remove(AssessmentConfig, "refresh", restore_aware_config)
            await engine.dispose()

    return context


WINDOW_CASES = [
    pytest.param(None, None, None, id="unbounded"),
    pytest.param(-1, 1, None, id="within"),
    pytest.param(1, 2, "该测评尚未开始", id="future"),
    pytest.param(-2, -1, "该测评已结束", id="closed"),
    pytest.param(0, 1, None, id="exact-start"),
    pytest.param(-1, 0, None, id="exact-end"),
    pytest.param(0, 0, None, id="single-instant"),
    pytest.param(0.000001, None, "该测评尚未开始", id="one-us-before-start"),
    pytest.param(None, -0.000001, "该测评已结束", id="one-us-after-end"),
    pytest.param(-0.000001, None, None, id="start-only-open"),
    pytest.param(None, 0.000001, None, id="end-only-open"),
]


@pytest.mark.parametrize("start_delta,end_delta,error", WINDOW_CASES)
@pytest.mark.parametrize("offset_hours", [0, 8, -5], ids=["UTC", "UTC+08", "UTC-05"])
def test_list_and_direct_start_share_inclusive_window(isolated, start_delta, end_delta, error, offset_hours):
    async def scenario():
        async with isolated() as h:
            h.db_timezone = timezone(timedelta(hours=offset_hours))
            start = (NOW + timedelta(seconds=start_delta)).astimezone(h.db_timezone) if start_delta is not None else None
            end = (NOW + timedelta(seconds=end_delta)).astimezone(h.db_timezone) if end_delta is not None else None
            config_id = await h.seed(start, end)
            available = await h.request("GET", "/available")
            assert available.status_code == 200, available.text
            assert [item["id"] for item in available.json()] == ([config_id] if error is None else [])
            response = await h.start(config_id)
            state = await h.state()
            if error:
                assert response.status_code == 422, f"{response.text}; committed={state}"
                assert response.json() == {"detail": error}
                assert state == {"sessions": [], "answers": []}
                assert h.question_reads == []
                assert h.assessment_writes == []
            else:
                assert response.status_code == 200, response.text
                result = response.json()
                assert result["total_questions"] == 2
                assert result["total_score"] == 10
                assert len(state["sessions"]) == 1
                assert state["sessions"][0][:4] == (result["session_id"], config_id, 1, "in_progress")
                assert state["sessions"][0][4].replace(tzinfo=UTC) == NOW
                assert state["sessions"][0][5] == 10
                assert len(state["answers"]) == 2
                assert all(answer[1] == result["session_id"] for answer in state["answers"])
                assert h.question_reads  # Prove the SQL sentinels observe normal work.
                assert h.assessment_writes
            assert h.ai_calls == 0
    asyncio.run(scenario())


@pytest.mark.parametrize("window_change", ["deadline-passed", "rescheduled-future"])
def test_existing_session_can_resume_outside_window_but_other_user_cannot_start(isolated, window_change):
    async def scenario():
        async with isolated() as h:
            config_id = await h.seed(NOW - timedelta(minutes=1), NOW + timedelta(minutes=1))
            first = await h.start(config_id)
            assert first.status_code == 200
            session_id = first.json()["session_id"]
            questions = (await h.request("GET", f"/sessions/{session_id}/questions")).json()
            answered = await h.request("POST", f"/sessions/{session_id}/answer", json={
                "answer_id": questions[0]["answer_id"], "student_answer": "A",
            })
            assert answered.status_code == 200, answered.text
            before = await h.state()
            if window_change == "deadline-passed":
                h.clock.now = NOW + timedelta(minutes=2)
                expected_error = "该测评已结束"
            else:
                async with h.db_factory() as db:
                    config = await db.get(AssessmentConfig, config_id)
                    config.available_start = NOW + timedelta(days=1)
                    config.available_end = NOW + timedelta(days=2)
                    await db.commit()
                expected_error = "该测评尚未开始"
            available = await h.request("GET", "/available")
            assert available.status_code == 200
            assert available.json() == []
            h.question_reads.clear()
            resumed = await h.start(config_id)
            assert resumed.status_code == 200, resumed.text
            assert resumed.json() == first.json()
            assert await h.state() == before
            assert h.question_reads == []
            denied = await h.start(config_id, user_id=2)
            assert denied.status_code == 422, denied.text
            assert denied.json() == {"detail": expected_error}
            assert await h.state() == before
            continued = await h.request("POST", f"/sessions/{session_id}/answer", json={
                "answer_id": questions[1]["answer_id"], "student_answer": "A",
            })
            assert continued.status_code == 200, continued.text
            after = await h.state()
            assert after["sessions"] == before["sessions"]
            assert [a[0] for a in after["answers"]] == [a[0] for a in before["answers"]]
            assert all(a[3] == "A" for a in after["answers"])
            assert h.ai_calls == 0
    asyncio.run(scenario())


def test_existing_session_for_other_config_does_not_bypass_window(isolated):
    async def scenario():
        async with isolated() as h:
            open_id = await h.seed()
            first = await h.start(open_id)
            assert first.status_code == 200, first.text
            closed_id = await h.seed(end=NOW - timedelta(seconds=1))
            before = await h.state()
            h.question_reads.clear()
            response = await h.start(closed_id)
            assert response.status_code == 422, response.text
            assert response.json() == {"detail": "该测评已结束"}
            assert await h.state() == before
            assert h.question_reads == []
            assert h.ai_calls == 0
    asyncio.run(scenario())


@pytest.mark.parametrize("status", ["pending", "submitted", "graded", "archived"])
def test_non_progress_session_does_not_bypass_closed_window(isolated, status):
    async def scenario():
        async with isolated() as h:
            config_id = await h.seed(end=NOW + timedelta(seconds=1))
            first = await h.start(config_id)
            assert first.status_code == 200
            async with h.db_factory() as db:
                session = await db.get(AssessmentSession, first.json()["session_id"])
                session.status = status
                await db.commit()
            before = await h.state()
            h.clock.now = NOW + timedelta(seconds=2)
            response = await h.start(config_id)
            assert response.status_code == 422, response.text
            assert response.json() == {"detail": "该测评已结束"}
            assert await h.state() == before
    asyncio.run(scenario())


@pytest.mark.parametrize("condition", ["missing", "disabled", "disabled-existing", "empty"])
def test_existing_rejections_are_preserved(isolated, condition):
    async def scenario():
        async with isolated() as h:
            config_id = 999
            expected = "测评配置不存在"
            if condition != "missing":
                config_id = await h.seed(enabled=condition != "disabled", questions=condition != "empty")
                expected = "题库为空，请先添加题目或知识点配置" if condition == "empty" else "该测评尚未开放"
            if condition == "disabled-existing":
                first = await h.start(config_id)
                assert first.status_code == 200
                async with h.db_factory() as db:
                    config = await db.get(AssessmentConfig, config_id)
                    config.enabled = False
                    await db.commit()
            before = await h.state()
            response = await h.start(config_id)
            assert response.status_code == 422, response.text
            assert response.json() == {"detail": expected}
            assert await h.state() == before
    asyncio.run(scenario())


@pytest.mark.parametrize("window", ["future", "closed"])
@pytest.mark.parametrize("pool", ["empty", "adaptive"])
def test_window_rejection_precedes_question_loading_and_ai(isolated, window, pool):
    async def scenario():
        async with isolated() as h:
            config_id = await h.seed(
                start=NOW + timedelta(seconds=1) if window == "future" else None,
                end=NOW - timedelta(seconds=1) if window == "closed" else None,
                questions=pool != "empty", mode="adaptive",
            )
            response = await h.start(config_id)
            assert response.status_code == 422, response.text
            assert response.json() == {"detail": "该测评尚未开始" if window == "future" else "该测评已结束"}
            assert await h.state() == {"sessions": [], "answers": []}
            assert h.ai_calls == 0
            assert h.question_reads == []
            assert h.assessment_writes == []
    asyncio.run(scenario())


@pytest.mark.parametrize("user_id,status", [(None, 401), (3, 403)], ids=["anonymous", "guest"])
def test_authentication_and_role_checks_remain_real(isolated, user_id, status):
    async def scenario():
        async with isolated() as h:
            config_id = await h.seed()
            response = await h.start(config_id, user_id=user_id)
            assert response.status_code == status, response.text
            assert await h.state() == {"sessions": [], "answers": []}
    asyncio.run(scenario())
