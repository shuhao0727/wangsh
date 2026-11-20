"""Teacher and student lesson flow through the real classroom and assessment routers.

Run locally with the offline collection safeguards in tests/README.md. SQLite
covers sequential commits and the activity detail timeout check. PostgreSQL row
locks and the bulk overdue poll, JWT, Redis and workers need separate coverage.
"""

import socket
from datetime import datetime, timedelta, timezone
from functools import partial
from types import SimpleNamespace
from typing import Annotated
from unittest.mock import AsyncMock, call

import pytest
import pytest_asyncio
from fastapi import Depends, FastAPI, Header, HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import attributes

from app.api import api_router
from app.core.deps import get_current_user
from app.db.database import Base, get_db
from app.models import User
from app.models.agents import AIAgent
from app.models.assessment import (
    AssessmentAnswer,
    AssessmentBasicProfile,
    AssessmentConfig,
    AssessmentQuestion,
    AssessmentSession,
)
from app.models.classroom import ClassroomActivity, ClassroomPlan, ClassroomPlanItem, ClassroomResponse
from app.services import classroom, classroom_lifecycle
from app.services.assessment import session_service


START = datetime(2032, 6, 1, 4, tzinfo=timezone.utc)
CLASS_NAME = "合成课堂班级"
ASSESSMENT_TITLE = "HTTPS 课堂自测"
TEACHER, STUDENT, CLASSMATE = 1, 2, 3


@pytest_asyncio.fixture
async def lesson(monkeypatch):
    clock = SimpleNamespace(now=START)
    publish = AsyncMock()
    enqueue = AsyncMock()
    generate_profile = AsyncMock()

    class FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return clock.now.astimezone(tz) if tz is not None else clock.now.replace(tzinfo=None)

    def reject_network(*args, **kwargs):
        pytest.fail("The classroom role flow must run without network connections")

    for module in (classroom, classroom_lifecycle, session_service):
        monkeypatch.setattr(module, "datetime", FrozenDatetime)
    monkeypatch.setattr(socket.socket, "connect", reject_network)
    monkeypatch.setattr(socket.socket, "connect_ex", reject_network)
    monkeypatch.setattr(socket, "getaddrinfo", reject_network)
    monkeypatch.setattr(classroom, "publish", publish)
    monkeypatch.setattr(classroom, "enqueue_auto_analysis", enqueue)
    monkeypatch.setattr(session_service, "_generate_basic_profile_bg", generate_profile)

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    sessions = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)

    @event.listens_for(engine.sync_engine, "connect")
    def enable_foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    def restore_utc(row, _context, _refreshed_fields=None):
        # SQLite strips offsets. The fixture stores only UTC and restores it on read.
        for name in ("available_start", "available_end", "started_at", "submitted_at"):
            value = row.__dict__.get(name)
            if value is not None and value.tzinfo is None:
                attributes.set_committed_value(row, name, value.replace(tzinfo=timezone.utc))

    timestamp_models = (ClassroomActivity, AssessmentConfig, AssessmentSession)
    for model in timestamp_models:
        event.listen(model, "load", restore_utc)
        event.listen(model, "refresh", restore_utc)
    try:
        tables = [model.__table__ for model in (
            User, AIAgent, ClassroomActivity, ClassroomPlan, ClassroomPlanItem, ClassroomResponse,
            AssessmentConfig, AssessmentQuestion, AssessmentSession, AssessmentAnswer, AssessmentBasicProfile,
        )]
        async with engine.begin() as connection:
            await connection.run_sync(lambda c: Base.metadata.create_all(c, tables=tables))
        async with sessions() as db:
            db.add_all([
                User(id=TEACHER, full_name="合成教师", role_code="teacher"),
                User(id=STUDENT, full_name="合成学生", role_code="student", class_name=CLASS_NAME),
                User(id=CLASSMATE, full_name="合成同班学生", role_code="student", class_name=CLASS_NAME),
            ])
            config = AssessmentConfig(
                title=ASSESSMENT_TITLE, enabled=True, total_score=10, time_limit_minutes=10,
                available_start=START - timedelta(minutes=1), available_end=START + timedelta(seconds=20),
            )
            db.add(config)
            await db.flush()
            config_id = config.id
            db.add_all([
                AssessmentQuestion(
                    config_id=config_id, question_type="fill", source="manual", mode="fixed",
                    content=prompt, correct_answer=answer, score=score,
                )
                for prompt, answer, score in (
                    ("HTTPS 的默认端口？", "443", 4), ("HTTPS 使用什么加密协议？", "TLS", 6),
                )
            ])
            await db.commit()

        async def isolated_db():
            async with sessions() as db:
                yield db

        async def fixture_identity(
            user_id: Annotated[int, Header(alias="x-fixture-user")],
            db: Annotated[AsyncSession, Depends(get_db)],
        ):
            user = await db.get(User, user_id)
            if user is None:
                raise HTTPException(401, "Unknown fixture identity")
            return {"id": user.id, "role_code": user.role_code, "class_name": user.class_name}

        app = FastAPI()
        app.include_router(api_router, prefix="/api/v1")
        app.dependency_overrides.update({get_db: isolated_db, get_current_user: fixture_identity})
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://isolated.invalid") as client:
            async def request(method, path, *, actor=STUDENT, expected=200, **kwargs):
                response = await client.request(
                    method, f"/api/v1{path}", headers={"x-fixture-user": str(actor)}, **kwargs,
                )
                assert response.status_code == expected, f"{method} {path}: {response.status_code} {response.text}"
                return response.json()

            yield SimpleNamespace(
                request=request, clock=clock, config_id=config_id,
                publish=publish, enqueue=enqueue, generate_profile=generate_profile,
            )
    finally:
        for model in timestamp_models:
            event.remove(model, "load", restore_utc)
            event.remove(model, "refresh", restore_utc)
        await engine.dispose()


@pytest.mark.asyncio
async def test_teacher_posts_lesson_student_resumes_closed_assessment_and_reviews(lesson):
    student = lesson.request
    teacher = partial(lesson.request, actor=TEACHER)
    first = await teacher("POST", "/classroom/admin/", json={
        "title": "HTTPS 端口热身", "activity_type": "fill_blank", "class_name": CLASS_NAME,
        "description": f"热身后开始《{ASSESSMENT_TITLE}》", "correct_answer": "443", "time_limit": 30,
    })
    second = await teacher("POST", "/classroom/admin/", json={
        "title": "HTTPS 协议复盘", "activity_type": "fill_blank", "class_name": CLASS_NAME,
        "correct_answer": "TLS", "time_limit": 0,
    })
    first_id, second_id = first["id"], second["id"]
    plan = await teacher("POST", "/classroom/plans/admin", json={
        "title": "HTTPS 合成课堂", "activity_ids": [first_id, second_id],
    })
    plan_path = f"/classroom/plans/admin/{plan['id']}"
    activity_path = f"/classroom/{first_id}"
    forbidden = await student("POST", f"{plan_path}/start", expected=403)
    assert forbidden["detail"] == "需要教职工权限"
    await teacher("POST", f"{plan_path}/start")
    posted = await teacher("POST", f"{plan_path}/next")
    first_item, second_item = posted["items"]
    assert posted["current_item_id"] == first_item["id"]
    student_plan = await student("GET", "/classroom/plans/active-plan")
    assert (student_plan["id"], student_plan["current_item_id"]) == (plan["id"], first_item["id"])
    activity = await student("GET", activity_path)
    assert (activity["status"], activity["remaining_seconds"]) == ("active", 30)
    response = await student("POST", f"{activity_path}/respond", json={"answer": "443"})
    assert (response["answer"], response["is_correct"]) == ("443", True)

    available_url = "/assessment/available"
    available = await student("GET", available_url)
    config, = [item for item in available if f"《{item['title']}》" in activity["description"]]
    assert config["id"] == lesson.config_id
    start_url = "/assessment/sessions/start"
    start_data = {"config_id": config["id"]}
    started = await student("POST", start_url, json=start_data)
    assert datetime.fromisoformat(started["started_at"]) == START
    session_id = started["session_id"]
    session_path = f"/assessment/sessions/{session_id}"
    questions = await student("GET", f"{session_path}/questions")
    answer_ids = {question["content"]: question["answer_id"] for question in questions}
    port_answer = answer_ids["HTTPS 的默认端口？"]
    protocol_answer = answer_ids["HTTPS 使用什么加密协议？"]
    await student("POST", f"{session_path}/answer", json={"answer_id": port_answer, "student_answer": "443"})

    lesson.clock.now += timedelta(seconds=29)
    nearing_deadline = await student("GET", activity_path)
    assert (nearing_deadline["status"], nearing_deadline["remaining_seconds"]) == ("active", 1)
    # The detail request ends the first activity at its deadline before the teacher advances the plan.
    lesson.clock.now += timedelta(seconds=1)
    expired = await student("GET", activity_path)
    assert (expired["status"], expired["my_answer"]) == ("ended", "443")
    advanced = await teacher("POST", f"{plan_path}/next")
    assert advanced["current_item_id"] == second_item["id"]
    assert [(item["activity_id"], item["status"], item["activity"]["status"]) for item in advanced["items"]] == [
        (first_id, "ended", "ended"), (second_id, "active", "active"),
    ]
    student_plan = await student("GET", "/classroom/plans/active-plan")
    assert student_plan["current_item_id"] == second_item["id"]

    assert await student("GET", available_url) == []
    resume_query = {"include_in_progress": "true"}
    resumable, = await student("GET", available_url, params=resume_query)
    assert (resumable["id"], resumable["session_id"], resumable["session_status"]) == (
        config["id"], session_id, "in_progress",
    )
    assert await student("GET", available_url, actor=CLASSMATE, params=resume_query) == []
    rejected = await student("POST", start_url, actor=CLASSMATE, expected=422, json=start_data)
    assert rejected["detail"] == "该测评已结束"
    resumed = await student("GET", f"{session_path}/resume")
    assert (resumed["session_id"], resumed["started_at"], resumed["time_limit_minutes"]) == (
        session_id, started["started_at"], started["time_limit_minutes"],
    )
    assert {q["answer_id"]: (q["student_answer"], q["is_answered"]) for q in resumed["questions"]} == {
        port_answer: ("443", True), protocol_answer: (None, False),
    }
    await student("POST", f"{session_path}/answer", json={"answer_id": protocol_answer, "student_answer": "SSL"})
    submitted = await student("POST", f"{session_path}/submit")
    assert (submitted["session_id"], submitted["status"], submitted["earned_score"]) == (session_id, "graded", 4)

    result = await student("GET", f"{session_path}/result")
    assert (result["session_id"], result["config_id"], result["status"]) == (session_id, config["id"], "graded")
    assert (result["earned_score"], result["total_score"]) == (4, 10)
    assert datetime.fromisoformat(result["submitted_at"]) == lesson.clock.now
    assert {a["id"]: (a["student_answer"], a["correct_answer"], a["earned_score"]) for a in result["answers"]} == {
        port_answer: ("443", "443", 4), protocol_answer: ("SSL", "TLS", 0),
    }
    classroom_result = await student("GET", f"{activity_path}/result")
    assert (classroom_result["id"], classroom_result["my_answer"], classroom_result["is_correct"]) == (
        first_id, "443", True,
    )
    stats = await teacher("GET", f"/classroom/admin/{first_id}/statistics")
    assert (stats["activity_id"], stats["total_responses"], stats["correct_count"]) == (first_id, 1, 1)
    ended = await teacher("POST", f"{plan_path}/end")
    assert (ended["status"], ended["current_item_id"]) == ("ended", None)
    assert await student("GET", "/classroom/plans/active-plan") is None

    student_events = [
        (record.args[1]["type"], record.args[1]["activity_id"])
        for record in lesson.publish.await_args_list if record.args[0] == f"student_{CLASS_NAME}"
    ]
    assert student_events == [
        ("activity_started", first_id), ("activity_ended", first_id),
        ("activity_started", second_id), ("activity_ended", second_id),
    ]
    assert lesson.enqueue.await_args_list == [call(first_id), call(second_id)]
    lesson.generate_profile.assert_awaited_once_with(session_id, config["id"])
