"""BIZ-02: isolated real router/request schema/service/SQLite ORM regression.

Run through a no-dotenv, socket-blocked external runner with --noconftest.
Synthetic identity replaces get_current_user, not the real role guard. Background
profile jobs are recorded rather than run; this is NOT a production/auth/AI E2E.
Response models are validated explicitly: these routes declare no response_model.
"""

import asyncio
import socket
from contextlib import asynccontextmanager

import pytest
from fastapi import FastAPI, HTTPException, Request
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.endpoints.assessment import student as student_api
from app.core.deps import get_current_user
from app.db.database import Base, get_db
from app.models import User
from app.models.agents import AIAgent
from app.models.assessment import (
    AssessmentAnswer, AssessmentBasicProfile, AssessmentConfig,
    AssessmentQuestion, AssessmentSession,
)
from app.schemas.assessment.session import (
    AnswerResult, QuestionForStudent, SessionResultResponse, SessionStartResponse,
    SessionSubmitResponse,
)
from app.services.assessment import session_service

PREFIX = "/api/v1/assessment"
RESULT_ERROR = "该检测尚未提交，无法查看结果"


class ResultVisibilityHarness:
    def __init__(self):
        self.app = None
        self.db_factory = None
        self.background_calls = []
        self.ai_calls = []

    async def request(self, method, path, *, user_id=1, role="student", **kwargs):
        headers = {"x-synthetic-role": role}
        if user_id is not None:
            headers["x-synthetic-user"] = str(user_id)
        async with AsyncClient(
            transport=ASGITransport(app=self.app), base_url="http://isolated.invalid",
            headers=headers,
        ) as client:
            return await client.request(method, PREFIX + path, **kwargs)

    async def start(self):
        response = await self.request("POST", "/sessions/start", json={"config_id": 1})
        assert response.status_code == 200, response.text
        start = SessionStartResponse.model_validate(response.json())
        assert start.total_questions == 2
        response = await self.request("GET", f"/sessions/{start.session_id}/questions")
        assert response.status_code == 200, response.text
        questions = response.json()
        for question in questions:
            QuestionForStudent.model_validate(question)
            assert "correct_answer" not in question and "explanation" not in question
        return start.session_id, questions

    async def answer(self, session_id, question, value="A"):
        response = await self.request(
            "POST", f"/sessions/{session_id}/answer",
            json={"answer_id": question["answer_id"], "student_answer": value},
        )
        assert response.status_code == 200, response.text
        feedback = AnswerResult.model_validate(response.json())
        assert feedback.correct_answer == "A"
        assert feedback.explanation.startswith("Synthetic explanation")
        assert feedback.is_correct is (value == "A")
        assert feedback.earned_score == (5 if value == "A" else 0)
        return response.json()

    async def state(self):
        # Fresh sessions prove committed state, not cached identity-map mutations.
        async with self.db_factory() as db:
            sessions = (await db.execute(select(
                AssessmentSession.id, AssessmentSession.status,
                AssessmentSession.earned_score, AssessmentSession.submitted_at,
            ).order_by(AssessmentSession.id))).all()
            answers = (await db.execute(select(
                AssessmentAnswer.id, AssessmentAnswer.student_answer,
                AssessmentAnswer.ai_score, AssessmentAnswer.is_correct,
                AssessmentAnswer.answered_at,
            ).order_by(AssessmentAnswer.id))).all()
            return {"sessions": [tuple(r) for r in sessions], "answers": [tuple(r) for r in answers]}


@pytest.fixture
def result_visibility_isolated(monkeypatch):
    h = ResultVisibilityHarness()

    def deny_network(*args, **kwargs):
        raise AssertionError("BIZ-02 must not open network connections")

    async def deny_ai(*args, **kwargs):
        h.ai_calls.append(True)
        raise AssertionError("BIZ-02 fixed choice questions must not invoke AI")

    async def record_background(*args, **kwargs):
        h.background_calls.append((args, kwargs))

    monkeypatch.setattr(socket.socket, "connect", deny_network)
    monkeypatch.setattr(socket.socket, "connect_ex", deny_network)
    monkeypatch.setattr(socket, "create_connection", deny_network)
    monkeypatch.setattr(session_service, "_ai_grade_answer", deny_ai)
    monkeypatch.setattr(session_service, "_ai_generate_realtime_question", deny_ai)
    monkeypatch.setattr(session_service, "_generate_basic_profile_bg", record_background)
    monkeypatch.setattr(session_service, "_generate_advanced_profile_bg", record_background)

    @asynccontextmanager
    async def context():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")

        @event.listens_for(engine.sync_engine, "connect")
        def enable_fk(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")

        h.db_factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with engine.begin() as connection:
                await connection.run_sync(lambda c: Base.metadata.create_all(c, tables=[
                    User.__table__, AIAgent.__table__, AssessmentConfig.__table__,
                    AssessmentQuestion.__table__, AssessmentSession.__table__,
                    AssessmentAnswer.__table__, AssessmentBasicProfile.__table__,
                ]))
            async with h.db_factory() as db:
                assert (await db.execute(text("PRAGMA foreign_keys"))).scalar_one() == 1
                db.add_all([User(
                    id=i, username=f"biz02-synthetic-{i}", full_name=f"Synthetic {i}",
                    student_id=f"BIZ02-{i}", role_code="student", is_active=True,
                    is_deleted=False,
                ) for i in (1, 2)])
                db.add(AssessmentConfig(
                    id=1, title="Synthetic BIZ-02", enabled=True, question_config="{}",
                    total_score=10, time_limit_minutes=60,
                ))
                await db.flush()
                db.add_all([AssessmentQuestion(
                    config_id=1, question_type="choice", content=f"Synthetic question {i}",
                    options='{"A":"yes","B":"no"}', correct_answer="A", score=5,
                    explanation=f"Synthetic explanation {i}", source="manual", mode="fixed",
                ) for i in (1, 2)])
                await db.commit()

            async def isolated_db():
                async with h.db_factory() as db:
                    yield db

            async def synthetic_identity(request: Request):
                uid = request.headers.get("x-synthetic-user")
                if uid is None:
                    raise HTTPException(401, "Synthetic identity required")
                return {"id": int(uid), "role_code": request.headers["x-synthetic-role"]}

            h.app = FastAPI()
            h.app.include_router(student_api.router, prefix=PREFIX)
            h.app.dependency_overrides[get_db] = isolated_db
            h.app.dependency_overrides[get_current_user] = synthetic_identity
            yield h
        finally:
            await engine.dispose()
            assert not h.ai_calls

    return context


@pytest.mark.parametrize("answered_count", [0, 1, 2], ids=["unanswered", "partly-answered", "all-answered"])
def test_in_progress_result_is_rejected_without_mutation(result_visibility_isolated, answered_count):
    async def scenario():
        async with result_visibility_isolated() as h:
            sid, questions = await h.start()
            for question in questions[:answered_count]:
                await h.answer(sid, question)
            before = await h.state()
            response = await h.request("GET", f"/sessions/{sid}/result")
            assert response.status_code == 422, response.text
            assert response.json() == {"detail": RESULT_ERROR}
            assert "correct_answer" not in response.text and "explanation" not in response.text
            assert await h.state() == before
            assert not h.background_calls
            async with h.db_factory() as db:
                with pytest.raises(ValueError, match=RESULT_ERROR):
                    await session_service.get_session_result(db, sid, 1)
    asyncio.run(scenario())


@pytest.mark.parametrize("status", ["pending", "archived", "unknown"])
def test_non_result_statuses_fail_closed(result_visibility_isolated, status):
    async def scenario():
        async with result_visibility_isolated() as h:
            sid, _ = await h.start()
            async with h.db_factory() as db:
                session = await db.get(AssessmentSession, sid)
                session.status = status
                await db.commit()
            before = await h.state()
            response = await h.request("GET", f"/sessions/{sid}/result")
            assert response.status_code == 422, response.text
            assert response.json() == {"detail": RESULT_ERROR}
            assert await h.state() == before
    asyncio.run(scenario())


@pytest.mark.parametrize("answered_count", [0, 1, 2])
@pytest.mark.parametrize("result_status", ["submitted", "graded"])
def test_completed_results_keep_answer_keys_and_scores(result_visibility_isolated, answered_count, result_status):
    async def scenario():
        async with result_visibility_isolated() as h:
            sid, questions = await h.start()
            for i, question in enumerate(questions[:answered_count]):
                await h.answer(sid, question, "A" if i == 0 else "B")
            response = await h.request("POST", f"/sessions/{sid}/submit")
            assert response.status_code == 200, response.text
            submitted = SessionSubmitResponse.model_validate(response.json())
            expected = 5 if answered_count else 0
            assert (submitted.status, submitted.earned_score, submitted.total_score) == ("graded", expected, 10)
            assert len(h.background_calls) == 1
            # submit_session currently transitions directly to graded. Seed the
            # separately documented submitted status to test backward compatibility.
            if result_status == "submitted":
                async with h.db_factory() as db:
                    session = await db.get(AssessmentSession, sid)
                    session.status = result_status
                    await db.commit()
            before = await h.state()
            assert before["sessions"][0][1:3] == (result_status, expected)
            assert before["sessions"][0][3] is not None
            response = await h.request("GET", f"/sessions/{sid}/result")
            assert response.status_code == 200, response.text
            result = SessionResultResponse.model_validate(response.json())
            assert (result.status, result.earned_score, result.total_score) == (result_status, expected, 10)
            assert len(result.answers) == 2
            assert sum(a.earned_score for a in result.answers) == expected
            by_id = {a.id: a for a in result.answers}
            for i, question in enumerate(questions):
                answer = by_id[question["answer_id"]]
                assert answer.correct_answer == "A"
                assert answer.explanation.startswith("Synthetic explanation")
                assert answer.student_answer == (("A" if i == 0 else "B") if i < answered_count else None)
                if i >= answered_count:
                    assert answer.earned_score == 0 and answer.ai_feedback == "未作答"
            assert await h.state() == before
            async with h.db_factory() as db:
                direct = await session_service.get_session_result(db, sid, 1)
                assert SessionResultResponse.model_validate(direct) == result
            duplicate = await h.request("POST", f"/sessions/{sid}/submit")
            assert duplicate.status_code == 422
            late_answer = await h.request("POST", f"/sessions/{sid}/answer", json={
                "answer_id": questions[0]["answer_id"], "student_answer": "B",
            })
            assert late_answer.status_code == 422
            assert await h.state() == before
    asyncio.run(scenario())


@pytest.mark.parametrize("status", ["in_progress", "submitted", "graded"])
def test_ownership_and_missing_id_keep_existing_errors(result_visibility_isolated, status):
    async def scenario():
        async with result_visibility_isolated() as h:
            sid, _ = await h.start()
            async with h.db_factory() as db:
                session = await db.get(AssessmentSession, sid)
                session.status = status
                await db.commit()
            before = await h.state()
            for target, user_id, error in [
                (sid, 2, "无权访问此检测会话"), (999999, 1, "检测会话不存在"),
            ]:
                response = await h.request("GET", f"/sessions/{target}/result", user_id=user_id)
                assert response.status_code == 422, response.text
                assert response.json() == {"detail": error}
                async with h.db_factory() as db:
                    with pytest.raises(ValueError, match=error):
                        await session_service.get_session_result(db, target, user_id)
            assert await h.state() == before
    asyncio.run(scenario())


@pytest.mark.parametrize("value", ["A", "B"])
def test_legal_single_answer_feedback_and_question_redaction(result_visibility_isolated, value):
    async def scenario():
        async with result_visibility_isolated() as h:
            sid, questions = await h.start()
            await h.answer(sid, questions[0], value)
            before = await h.state()
            assert sum(row[1] is not None for row in before["answers"]) == 1
            response = await h.request("GET", f"/sessions/{sid}/questions")
            assert response.status_code == 200
            for question in response.json():
                QuestionForStudent.model_validate(question)
                assert "correct_answer" not in question and "explanation" not in question
                assert question["is_answered"] is (question["answer_id"] == questions[0]["answer_id"])
            duplicate = await h.request("POST", f"/sessions/{sid}/answer", json={
                "answer_id": questions[0]["answer_id"], "student_answer": "B",
            })
            assert duplicate.status_code == 422
            assert duplicate.json() == {"detail": "该题已提交过答案，不可重复提交"}
            malformed = await h.request("POST", f"/sessions/{sid}/answer", json={"answer_id": "invalid"})
            assert malformed.status_code == 422
            assert await h.state() == before
            assert not h.background_calls
    asyncio.run(scenario())


def test_real_role_guard_with_synthetic_identity(result_visibility_isolated):
    async def scenario():
        async with result_visibility_isolated() as h:
            sid, _ = await h.start()
            response = await h.request("GET", f"/sessions/{sid}/result", role="guest")
            assert response.status_code == 403
            response = await h.request("GET", f"/sessions/{sid}/result", user_id=None)
            assert response.status_code == 401
    asyncio.run(scenario())
