"""Real dedicated PostgreSQL; synthetic identities/data; deterministic overlap gates.
Gates pause after real ORM reads, never fabricate SQL results or commit outcome.
"""

import asyncio
import unittest
import uuid
import os
import re
import pytest
from sqlalchemy.engine import make_url
from unittest.mock import patch
from fastapi import FastAPI, Request
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.db.database import Base, get_db
from app.core.deps import get_current_user
from app.models import User
from app.models.agents import AIAgent
from app.models.assessment import (
    AssessmentConfig,
    AssessmentQuestion,
    AssessmentSession,
    AssessmentAnswer,
    AssessmentBasicProfile,
    StudentProfile,
)
from app.api.endpoints.assessment import student as api
from app.services.assessment import session_service as svc


def dedicated_url():
    value = os.environ.get("TEST_DATABASE_URL", "").strip()
    if not value:
        pytest.skip(
            "Set TEST_DATABASE_URL to an explicit dedicated PostgreSQL test database"
        )
    parsed = make_url(value)
    if parsed.drivername != "postgresql+asyncpg" or not re.search(
        r"(?:^|[_-])(?:test|testing|ci)(?:$|[_-])", parsed.database or "", re.I
    ):
        pytest.fail(
            "Refusing non-asyncpg or non-test database; no database connection made"
        )
    return value


OBS = []


class PostgresAssessment(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        URL = dedicated_url()
        self.schema = "test_next_" + uuid.uuid4().hex
        self.admin = create_async_engine(URL)
        self.addAsyncCleanup(self.admin.dispose)
        async with self.admin.begin() as c:
            await c.execute(text(f'CREATE SCHEMA "{self.schema}"'))
        self.addAsyncCleanup(self.drop_schema)
        self.engine = create_async_engine(
            URL,
            connect_args={
                "server_settings": {
                    "search_path": self.schema,
                    "statement_timeout": "8000",
                    "lock_timeout": "5000",
                }
            },
        )
        self.addAsyncCleanup(self.engine.dispose)
        self.Session = async_sessionmaker(self.engine, expire_on_commit=False)
        roots = [
            User.__table__,
            AIAgent.__table__,
            AssessmentConfig.__table__,
            AssessmentQuestion.__table__,
            AssessmentSession.__table__,
            AssessmentAnswer.__table__,
            AssessmentBasicProfile.__table__,
            StudentProfile.__table__,
        ]
        tables = set(roots)

        def add_deps(t):
            for fk in t.foreign_keys:
                if fk.column.table not in tables:
                    tables.add(fk.column.table)
                    add_deps(fk.column.table)

        for t in roots:
            add_deps(t)
        async with self.engine.begin() as c:
            await c.run_sync(
                lambda conn: Base.metadata.create_all(conn, tables=list(tables))
            )
        async with self.Session() as db:
            db.add_all(
                [
                    User(
                        id=i,
                        username=f"synthetic-{i}",
                        full_name=f"Synthetic {i}",
                        student_id=f"SYN-{i}",
                        role_code="student",
                        is_active=True,
                        is_deleted=False,
                    )
                    for i in (1, 2)
                ]
            )
            db.add(
                AssessmentConfig(
                    id=1,
                    title="Synthetic PG",
                    enabled=True,
                    question_config="{}",
                    total_score=5,
                    time_limit_minutes=60,
                )
            )
            await db.flush()
            db.add(
                AssessmentQuestion(
                    id=1,
                    config_id=1,
                    question_type="choice",
                    content="Synthetic?",
                    options='{"A":"yes","B":"no"}',
                    correct_answer="A",
                    score=5,
                    explanation="Synthetic explanation",
                    source="manual",
                    mode="fixed",
                )
            )
            await db.flush()
            db.add(
                AssessmentSession(
                    id=1, user_id=1, config_id=1, status="in_progress", total_score=5
                )
            )
            await db.flush()
            db.add(
                AssessmentAnswer(
                    id=1,
                    session_id=1,
                    question_id=1,
                    question_type="choice",
                    max_score=5,
                )
            )
            await db.commit()
        self.app = FastAPI()
        self.app.include_router(api.router, prefix="/assessment")

        async def db_dep():
            async with self.Session() as db:
                yield db

        async def identity(req: Request):
            return {
                "id": int(req.headers.get("x-synthetic-id", "1")),
                "role_code": "student",
            }

        self.app.dependency_overrides[get_db] = db_dep
        self.app.dependency_overrides[get_current_user] = identity
        self.patches = []

        async def deny(*a, **kw):
            raise AssertionError("AI/background forbidden")

        for name in [
            "_ai_grade_answer",
            "_ai_generate_realtime_question",
            "_generate_basic_profile_bg",
            "_generate_advanced_profile_bg",
        ]:
            p = patch.object(svc, name, deny)
            p.start()
            self.addCleanup(p.stop)

    async def drop_schema(self):
        async with self.admin.begin() as c:
            await c.execute(text(f'DROP SCHEMA IF EXISTS "{self.schema}" CASCADE'))

    async def request(self, path, uid=1):
        async with AsyncClient(
            transport=ASGITransport(app=self.app), base_url="http://synthetic.invalid"
        ) as c:
            return await c.get(
                "/assessment" + path, headers={"x-synthetic-id": str(uid)}
            )

    async def call(self, kind, label):
        async with self.Session() as db:
            await db.execute(
                text("SELECT set_config('application_name',:name,false)"),
                {"name": label},
            )
            try:
                if kind == "save":
                    v = await svc.submit_answer(db, 1, 1, 1, "A")
                else:
                    v = await svc.submit_session(db, 1, 1)
                return {"ok": True, "value": v}
            except ValueError as e:
                return {"ok": False, "error": str(e)}

    async def state(self):
        async with self.Session() as db:
            s = await db.get(AssessmentSession, 1)
            a = await db.get(AssessmentAnswer, 1)
            return {
                "status": s.status,
                "earned": s.earned_score,
                "answer": a.student_answer,
                "score": a.ai_score,
            }

    async def overlap(self, first, second):
        entered = asyncio.Event()
        release = asyncio.Event()
        original = svc._load_session

        async def gated(db, *a, **kw):
            value = await original(db, *a, **kw)
            if asyncio.current_task().get_name() == "first":
                entered.set()
                await asyncio.wait_for(release.wait(), 7)
            return value

        with patch.object(svc, "_load_session", gated):
            a = asyncio.create_task(
                self.call(first, self.schema + "_first"), name="first"
            )
            await asyncio.wait_for(entered.wait(), 5)
            b = asyncio.create_task(
                self.call(second, self.schema + "_second"), name="second"
            )
            waited = False
            try:
                for _ in range(150):
                    if b.done():
                        break
                    async with self.admin.connect() as c:
                        waited = bool(
                            (
                                await c.execute(
                                    text(
                                        "SELECT count(*) FROM pg_stat_activity WHERE application_name=:name AND wait_event_type='Lock'"
                                    ),
                                    {"name": self.schema + "_second"},
                                )
                            ).scalar()
                        )
                    if waited:
                        break
                    await asyncio.sleep(0.02)
            finally:
                release.set()
                values = await asyncio.wait_for(asyncio.gather(a, b), 12)
        self.assertTrue(waited, "second writer must wait on a real PostgreSQL lock")
        state = await self.state()
        OBS.append(
            {
                "first": first,
                "second": second,
                "lock_wait_observed": waited,
                "results": values,
                "state": state,
            }
        )
        return values, state

    async def test_result_visibility_and_ownership(self):
        for status in ["in_progress", "pending", "archived", "unknown"]:
            async with self.Session() as db:
                await db.execute(
                    text("UPDATE znt_assessment_sessions SET status=:s"), {"s": status}
                )
                await db.commit()
            r = await self.request("/sessions/1/result")
            self.assertEqual(r.status_code, 422)
            self.assertNotIn("correct_answer", r.text)
        async with self.Session() as db:
            await db.execute(
                text("UPDATE znt_assessment_sessions SET status='in_progress'")
            )
            await db.commit()
        self.assertTrue((await self.call("save", "visibility_save"))["ok"])
        self.assertEqual((await self.request("/sessions/1/result")).status_code, 422)
        self.assertTrue((await self.call("settle", "visibility_settle"))["ok"])
        r = await self.request("/sessions/1/result")
        self.assertEqual(r.status_code, 200)
        self.assertIn("correct_answer", r.text)
        self.assertEqual((await self.request("/sessions/1/result", 2)).status_code, 422)

    async def test_profile_type_and_owner(self):
        async with self.Session() as db:
            for i, typ, target in [
                (1, "individual", "1"),
                (2, "group", "1"),
                (3, "class", "1"),
                (4, "individual", "2"),
            ]:
                db.add(
                    StudentProfile(
                        id=i,
                        profile_type=typ,
                        target_id=target,
                        result_text="Synthetic report",
                        config_id=1,
                    )
                )
            await db.commit()
        for pid, status in [(1, 200), (2, 403), (3, 403), (4, 403), (999, 404)]:
            self.assertEqual(
                (await self.request(f"/my-profiles/{pid}")).status_code, status
            )

    async def test_save_started_before_settlement_is_counted(self):
        values, state = await self.overlap("save", "settle")
        self.assertTrue(all(v["ok"] for v in values))
        self.assertEqual(
            state, {"status": "graded", "earned": 5, "answer": "A", "score": 5}
        )

    async def test_settlement_started_first_rejects_late_answer(self):
        values, state = await self.overlap("settle", "save")
        self.assertTrue(values[0]["ok"])
        self.assertFalse(values[1]["ok"])
        self.assertEqual(
            state, {"status": "graded", "earned": 0, "answer": None, "score": 0}
        )

    async def test_duplicate_settlement_one_winner(self):
        values, state = await self.overlap("settle", "settle")
        self.assertEqual(sum(v["ok"] for v in values), 1)

    async def test_duplicate_answer_one_winner(self):
        values, state = await self.overlap("save", "save")
        self.assertEqual(sum(v["ok"] for v in values), 1)
        self.assertEqual(state["score"], 5)

    async def test_rollback_releases_lock_and_allows_retry(self):
        async with self.Session() as db:

            async def failed_commit():
                await db.flush()
                raise RuntimeError("synthetic commit failure")

            with patch.object(db, "commit", failed_commit):
                with self.assertRaisesRegex(RuntimeError, "synthetic commit failure"):
                    await svc.submit_answer(db, 1, 1, 1, "A")
            await db.rollback()
        self.assertEqual((await self.state())["answer"], None)
        self.assertTrue((await asyncio.wait_for(self.call("save", "retry"), 3))["ok"])
        self.assertTrue((await self.call("settle", "settle_retry"))["ok"])
        self.assertEqual((await self.state())["earned"], 5)

    async def test_other_session_is_not_blocked(self):
        async with self.Session() as db:
            db.add(
                AssessmentSession(
                    id=2, user_id=2, config_id=1, status="in_progress", total_score=5
                )
            )
            await db.flush()
            db.add(
                AssessmentAnswer(
                    id=2,
                    session_id=2,
                    question_id=1,
                    question_type="choice",
                    max_score=5,
                )
            )
            await db.commit()
        async with self.Session() as first:
            await svc._load_session(first, 1, 1, for_update=True)
            async with self.Session() as second:
                result = await asyncio.wait_for(
                    svc.submit_answer(second, 2, 2, 2, "A"), 3
                )
                self.assertEqual(result["earned_score"], 5)
            await first.rollback()

    async def test_waiting_writer_refreshes_preloaded_session(self):
        async with self.Session() as stale:
            cached = await stale.get(AssessmentSession, 1)
            self.assertEqual(cached.status, "in_progress")
            self.assertTrue((await self.call("settle", "other_settle"))["ok"])
            with self.assertRaisesRegex(ValueError, "已提交"):
                await svc.submit_answer(stale, 1, 1, 1, "A")
            await stale.rollback()
        self.assertEqual((await self.state())["answer"], None)

    async def test_preloaded_answer_cannot_overwrite_committed_answer(self):
        async with self.Session() as stale:
            cached = await stale.get(AssessmentAnswer, 1)
            self.assertIsNone(cached.student_answer)
            self.assertTrue((await self.call("save", "other_answer"))["ok"])
            with self.assertRaisesRegex(ValueError, "已提交过答案"):
                await svc.submit_answer(stale, 1, 1, 1, "B")
            await stale.rollback()
        self.assertEqual((await self.state())["answer"], "A")

    async def test_settlement_refreshes_preloaded_answers(self):
        async with self.Session() as stale:
            cached = await svc._load_session(stale, 1, 1, load_answers=True)
            self.assertIsNone(cached.answers[0].student_answer)
            self.assertTrue((await self.call("save", "other_answer"))["ok"])
            result = await svc.submit_session(stale, 1, 1)
            self.assertEqual(result["earned_score"], 5)
        self.assertEqual((await self.state())["score"], 5)

    async def reset_first_start(self):
        async with self.Session() as db:
            await db.execute(text('DELETE FROM znt_assessment_answers'))
            await db.execute(text('DELETE FROM znt_assessment_sessions'))
            await db.commit()

    async def start_as(self, uid, label, config_id=1):
        async with self.Session() as db:
            await db.execute(text("SELECT set_config('application_name',:name,false)"), {"name": label})
            return await svc.start_session(db, config_id, uid)

    async def wait_for_lock(self, task, label):
        for _ in range(150):
            if task.done():
                return False
            async with self.admin.connect() as conn:
                waiting = (await conn.execute(text(
                    "SELECT count(*) FROM pg_stat_activity WHERE application_name=:name AND wait_event_type='Lock'"
                ), {"name": label})).scalar()
            if waiting:
                return True
            await asyncio.sleep(.02)
        return False

    async def test_first_concurrent_start_creates_one_session_and_answer(self):
        await self.reset_first_start()
        entered, release = asyncio.Event(), asyncio.Event()
        original = svc._draw_questions

        async def gated(db, config):
            questions = await original(db, config)
            if asyncio.current_task().get_name() == 'start_first':
                entered.set()
                await asyncio.wait_for(release.wait(), 7)
            return questions

        with patch.object(svc, '_draw_questions', gated):
            first = asyncio.create_task(self.start_as(1, self.schema+'_first'), name='start_first')
            await asyncio.wait_for(entered.wait(), 5)
            second = asyncio.create_task(self.start_as(1, self.schema+'_second'))
            try:
                waiting = await self.wait_for_lock(second, self.schema+'_second')
            finally:
                release.set()
                values = await asyncio.wait_for(asyncio.gather(first, second), 10)
        async with self.Session() as db:
            sessions = (await db.execute(text('SELECT count(*) FROM znt_assessment_sessions'))).scalar()
            answers = (await db.execute(text('SELECT count(*) FROM znt_assessment_answers'))).scalar()
        self.assertEqual(sessions, 1, f'duplicate initial sessions: {values}')
        self.assertEqual(answers, 1)
        self.assertEqual(values[0]['session_id'], values[1]['session_id'])
        self.assertTrue(waiting, 'must observe actual PostgreSQL lock wait, not timing only')

    async def test_start_waits_for_locked_existing_session_instead_of_skipping(self):
        # Fixtures use explicit IDs; synchronize sequences so the red case measures
        # SKIP LOCKED duplication rather than an unrelated primary-key collision.
        async with self.Session() as db:
            for table in ('znt_assessment_sessions', 'znt_assessment_answers'):
                await db.execute(text(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), 1, true)"))
            await db.commit()
        async with self.Session() as owner:
            await svc._load_session(owner, 1, 1, for_update=True)
            other = asyncio.create_task(self.start_as(1, self.schema+'_resume'))
            try:
                waiting = await self.wait_for_lock(other, self.schema+'_resume')
            finally:
                await owner.rollback()
                value = await asyncio.wait_for(other, 8)
        self.assertTrue(waiting)
        self.assertEqual(value['session_id'], 1)

    async def test_start_waits_for_submit_commit_then_starts_new_session(self):
        # Production contract permits a new attempt after the old one is terminal.
        # Hold the real submit transaction's row lock until its commit, not a mock.
        async with self.Session() as db:
            self.assertEqual((await db.execute(text("SHOW transaction_isolation"))).scalar(),
                             "read committed")
            for table in ('znt_assessment_sessions', 'znt_assessment_answers'):
                await db.execute(text(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), 1, true)"))
            await db.commit()
        async with self.Session() as owner:
            await svc._load_session(owner, 1, 1, for_update=True)
            other = asyncio.create_task(self.start_as(1, self.schema+'_after_submit'))
            try:
                waiting = await self.wait_for_lock(other, self.schema+'_after_submit')
                result = await svc.submit_session(owner, 1, 1)
                self.assertEqual(result['session_id'], 1)
            finally:
                await owner.rollback()
                value = await asyncio.wait_for(other, 8)
        self.assertTrue(waiting)
        self.assertNotEqual(value['session_id'], 1)
        async with self.Session() as db:
            rows = (await db.execute(text(
                "SELECT id,status FROM znt_assessment_sessions ORDER BY id"
            ))).all()
        self.assertEqual(len(rows), 2)
        self.assertIn(rows[0].status, ('submitted', 'graded'))
        self.assertEqual(rows[1].status, 'in_progress')

    async def test_other_student_start_does_not_wait_for_first_student(self):
        await self.reset_first_start()
        entered, release = asyncio.Event(), asyncio.Event()
        original = svc._draw_questions

        async def gated(db, config):
            value = await original(db, config)
            if asyncio.current_task().get_name() == 'start_first':
                entered.set()
                await asyncio.wait_for(release.wait(), 7)
            return value

        with patch.object(svc, '_draw_questions', gated):
            first = asyncio.create_task(self.start_as(1, self.schema+'_first'), name='start_first')
            await asyncio.wait_for(entered.wait(), 5)
            try:
                second = await asyncio.wait_for(self.start_as(2, self.schema+'_other'), 3)
            finally:
                release.set()
                value = await asyncio.wait_for(first, 8)
        self.assertNotEqual(value['session_id'], second['session_id'])

    async def test_cancelled_start_rolls_back_and_releases_lock(self):
        await self.reset_first_start()
        entered = asyncio.Event()
        original = svc._draw_questions

        async def cancelled(db, config):
            await original(db, config)
            entered.set()
            await asyncio.Event().wait()

        with patch.object(svc, '_draw_questions', cancelled):
            task = asyncio.create_task(self.start_as(1, self.schema+'_cancel'))
            try:
                await asyncio.wait_for(entered.wait(), 5)
            finally:
                task.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await task
        value = await asyncio.wait_for(self.start_as(1, self.schema+'_retry'), 3)
        self.assertEqual(value['total_questions'], 1)
        async with self.Session() as db:
            self.assertEqual((await db.execute(text('SELECT count(*) FROM znt_assessment_sessions'))).scalar(), 1)

    async def test_different_config_for_same_student_can_start_independently(self):
        await self.reset_first_start()
        async with self.Session() as db:
            db.add(AssessmentConfig(id=2, title='Other synthetic', enabled=True,
                                    question_config='{}', total_score=5, time_limit_minutes=60))
            await db.flush()
            db.add(AssessmentQuestion(id=2, config_id=2, question_type='choice',
                                      content='Other?', correct_answer='A', score=5,
                                      source='manual', mode='fixed'))
            await db.commit()
        entered, release = asyncio.Event(), asyncio.Event()
        original = svc._draw_questions

        async def gated(db, config):
            value = await original(db, config)
            if config.id == 1:
                entered.set()
                await asyncio.wait_for(release.wait(), 7)
            return value

        with patch.object(svc, '_draw_questions', gated):
            first = asyncio.create_task(self.start_as(1, self.schema+'_first'))
            await asyncio.wait_for(entered.wait(), 5)
            try:
                second = await asyncio.wait_for(self.start_as(1, self.schema+'_othercfg', 2), 3)
            finally:
                release.set()
                value = await asyncio.wait_for(first, 8)
        self.assertNotEqual(value['session_id'], second['session_id'])

    async def test_real_deferred_commit_failure_rolls_back_start_then_retry_succeeds(self):
        from sqlalchemy.exc import DBAPIError
        await self.reset_first_start()
        async with self.engine.begin() as conn:
            await conn.execute(text("""CREATE FUNCTION synthetic_commit_failure() RETURNS trigger
                LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic final commit failure'; END $$"""))
            await conn.execute(text("""CREATE CONSTRAINT TRIGGER synthetic_commit_failure
                AFTER INSERT ON znt_assessment_sessions DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE FUNCTION synthetic_commit_failure()"""))
        with self.assertRaisesRegex(DBAPIError, 'synthetic final commit failure'):
            await self.start_as(1, self.schema+'_commit_fail')
        async with self.Session() as db:
            self.assertEqual((await db.execute(text('SELECT count(*) FROM znt_assessment_sessions'))).scalar(), 0)
            self.assertEqual((await db.execute(text('SELECT count(*) FROM znt_assessment_answers'))).scalar(), 0)
        async with self.engine.begin() as conn:
            await conn.execute(text('DROP TRIGGER synthetic_commit_failure ON znt_assessment_sessions'))
        result = await asyncio.wait_for(self.start_as(1, self.schema+'_commit_retry'), 3)
        self.assertEqual(result['total_questions'], 1)

    async def test_cancel_during_adaptive_generation_removes_partial_rows(self):
        await self.reset_first_start()
        async with self.Session() as db:
            db.add(AssessmentQuestion(id=2, config_id=1, question_type='choice',
                                      content='Adaptive synthetic', correct_answer='A', score=5,
                                      source='manual', mode='adaptive', knowledge_point='synthetic'))
            await db.commit()
        entered = asyncio.Event()

        async def waiting_provider(db, *args, **kwargs):
            # Same transaction has really inserted the session and fixed answer.
            self.assertEqual((await db.execute(text('SELECT count(*) FROM znt_assessment_sessions'))).scalar(), 1)
            self.assertEqual((await db.execute(text('SELECT count(*) FROM znt_assessment_answers'))).scalar(), 1)
            entered.set()
            await asyncio.Event().wait()

        with patch.object(svc, '_ai_generate_realtime_question', waiting_provider):
            task = asyncio.create_task(self.start_as(1, self.schema+'_cancel_adaptive'))
            try:
                await asyncio.wait_for(entered.wait(), 5)
            finally:
                task.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await task
        async with self.Session() as db:
            self.assertEqual((await db.execute(text('SELECT count(*) FROM znt_assessment_sessions'))).scalar(), 0)
            self.assertEqual((await db.execute(text('SELECT count(*) FROM znt_assessment_answers'))).scalar(), 0)
        # Default denied-provider fixture now uses the existing placeholder contract.
        result = await asyncio.wait_for(self.start_as(1, self.schema+'_adaptive_retry'), 3)
        self.assertEqual(result['total_questions'], 2)
