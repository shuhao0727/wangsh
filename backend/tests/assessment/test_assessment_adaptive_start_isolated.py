"""Adaptive first-question failures must not roll back the owning session.

Real ORM/FKs with synthetic data; provider stubs and one-shot ORM fault injection.
Defaults to SQLite; TEST_DATABASE_URL explicitly enables a dedicated test PostgreSQL.
"""
import asyncio
import json
import os
import re
import uuid
from contextlib import asynccontextmanager
from unittest.mock import patch

import pytest
from sqlalchemy import event, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError, PendingRollbackError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.database import Base
from app.models import User
from app.models.agents import AIAgent
from app.models.assessment import (
    AssessmentAnswer, AssessmentConfig, AssessmentQuestion, AssessmentSession,
)
from app.services.assessment import session_service as svc


@asynccontextmanager
async def isolated_database():
    url = os.environ.get("TEST_DATABASE_URL", "")
    schema = None
    admin = None
    if url:
        parsed = make_url(url)
        assert parsed.drivername == "postgresql+asyncpg"
        assert re.search(r"(?:^|[_-])(?:test|testing|ci)(?:$|[_-])", parsed.database or "", re.I)
        schema = "test_adaptive_" + uuid.uuid4().hex
        admin = create_async_engine(url)
        async with admin.begin() as conn:
            await conn.execute(text(f'CREATE SCHEMA "{schema}"'))
        engine = create_async_engine(url, connect_args={"server_settings": {
            "search_path": schema, "statement_timeout": "8000",
        }})
    else:
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")

        @event.listens_for(engine.sync_engine, "connect")
        def enable_fk(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")

    try:
        tables = {m.__table__ for m in (
            User, AIAgent, AssessmentConfig, AssessmentQuestion,
            AssessmentSession, AssessmentAnswer,
        )}
        pending = list(tables)
        while pending:
            for fk in pending.pop().foreign_keys:
                if fk.column.table not in tables:
                    tables.add(fk.column.table)
                    pending.append(fk.column.table)
        async with engine.begin() as conn:
            await conn.run_sync(lambda c: Base.metadata.create_all(c, tables=list(tables)))
        factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
        async with factory() as db:
            db.add(User(id=1, username="adaptive-synthetic", full_name="Synthetic Student", role_code="student",
                        is_active=True, is_deleted=False))
            db.add(AssessmentConfig(id=1, title="Adaptive synthetic", enabled=True,
                                    question_config="{}", total_score=15))
            await db.flush()
            db.add_all(AssessmentQuestion(
                id=i, config_id=1, content=f"Synthetic {i}", correct_answer="A",
                question_type="choice", score=5, mode="fixed" if i == 1 else "adaptive",
                knowledge_point=f"kp-{i}", adaptive_config='{"prompt_hint":"synthetic hint"}',
            ) for i in (1, 2, 3))
            await db.commit()
        yield factory
    finally:
        await engine.dispose()
        if admin is not None:
            try:
                async with admin.begin() as conn:
                    await conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
            finally:
                await admin.dispose()


@pytest.mark.parametrize("failure", [
    "none", "first", "last", "both", "sql", "answer_flush_first", "answer_flush_last",
])
def test_adaptive_failure_preserves_session_and_all_answers(failure):
    async def scenario():
        async with isolated_database() as factory:
            calls = []
            failed_kps = set()
            flush_faults = []
            sql_errors = []
            engine = factory.kw["bind"].sync_engine

            def fail_answer_insert(mapper, connection, answer):
                if (failure.startswith("answer_flush_") and answer.question_snapshot is not None
                        and answer.knowledge_point in failed_kps and not flush_faults):
                    # Let a real ORM INSERT fail its FK, inside this question's savepoint.
                    flush_faults.append((answer.knowledge_point, connection.in_nested_transaction()))
                    answer.question_id = -1

            def record_sql_error(context):
                sql_errors.append(context.sqlalchemy_exception)

            async def generate(db, config, knowledge_point, question_type, score, **kwargs):
                calls.append(knowledge_point)
                ordinal = len(calls)
                assert kwargs["prompt_hint"] == "synthetic hint"
                should_fail = (failure == "both" or
                               (failure in {"first", "sql", "answer_flush_first"} and ordinal == 1) or
                               (failure in {"last", "answer_flush_last"} and ordinal == 2))
                if should_fail:
                    failed_kps.add(knowledge_point)
                    if failure == "sql":
                        await db.execute(text("INSERT INTO znt_assessment_configs (id, title) VALUES (1, 'duplicate')"))
                    elif not failure.startswith("answer_flush_"):
                        raise RuntimeError("synthetic provider unavailable")
                return {"content": f"Generated {knowledge_point}", "question_type": question_type,
                        "correct_answer": "B", "score": score}

            event.listen(AssessmentAnswer, "before_insert", fail_answer_insert)
            event.listen(engine, "handle_error", record_sql_error)
            try:
                with patch.object(svc, "_ai_generate_realtime_question", generate):
                    async with factory() as db:
                        result = await svc.start_session(db, 1, 1)
                    assert result["total_questions"] == 3
                    assert result["total_score"] == 15
                    assert len(calls) == 2 and set(calls) == {"kp-2", "kp-3"}
                    expected_failed = ({calls[0]} if failure in {"first", "sql", "answer_flush_first"}
                                       else {calls[1]} if failure in {"last", "answer_flush_last"}
                                       else set(calls) if failure == "both" else set())
                    assert failed_kps == expected_failed
                    async with factory() as db:
                        session = await db.get(AssessmentSession, result["session_id"])
                        assert session is not None and session.status == "in_progress"
                        answers = list((await db.execute(select(AssessmentAnswer).order_by(
                            AssessmentAnswer.question_id))).scalars())
                        assert [a.question_id for a in answers] == [1, 2, 3]
                        assert all(a.session_id == session.id and a.max_score == 5 for a in answers)
                        assert not answers[0].is_adaptive
                        by_kp = {a.knowledge_point: a for a in answers[1:]}
                        # Compare persisted answers in actual provider-call order, not question ID order.
                        expected_snapshots = ([False, False] if failure == "both" else
                                              [False, True] if failure in {"first", "sql", "answer_flush_first"} else
                                              [True, False] if failure in {"last", "answer_flush_last"} else
                                              [True, True])
                        assert [by_kp[kp].question_snapshot is not None for kp in calls] == expected_snapshots
                        for answer in answers[1:]:
                            assert answer.is_adaptive and answer.attempt_seq == 1
                            assert (answer.question_snapshot is None) == (answer.knowledge_point in expected_failed)
                            if answer.knowledge_point not in expected_failed:
                                assert json.loads(answer.question_snapshot)["correct_answer"] == "B"
                        calls_before_resume = list(calls)
                        resumed = await svc.start_session(db, 1, 1)
                        assert resumed["session_id"] == session.id
                        assert resumed["total_questions"] == 3
                        assert calls == calls_before_resume
                if failure.startswith("answer_flush_"):
                    assert flush_faults == [(next(iter(expected_failed)), True)]
                else:
                    assert flush_faults == []
                assert len(sql_errors) == (1 if failure == "sql" or failure.startswith("answer_flush_") else 0)
                assert all(isinstance(error, IntegrityError) for error in sql_errors)
            finally:
                event.remove(AssessmentAnswer, "before_insert", fail_answer_insert)
                event.remove(engine, "handle_error", record_sql_error)
    asyncio.run(scenario())


@pytest.mark.parametrize("pending_answer", ["fixed", "placeholder_after_success"])
def test_pre_savepoint_flush_failure_aborts_without_partial_commit(pending_answer):
    async def scenario():
        async with isolated_database() as factory:
            if pending_answer == "placeholder_after_success":
                # Three adaptive calls: success, provider failure, then placeholder preflush failure.
                async with factory() as db:
                    db.add(AssessmentQuestion(
                        id=4, config_id=1, content="Synthetic 4", correct_answer="A",
                        question_type="choice", score=5, mode="adaptive", knowledge_point="kp-4",
                        adaptive_config='{"prompt_hint":"synthetic hint"}',
                    ))
                    await db.commit()
            calls, inserted, faults, sql_errors = [], [], [], []
            engine = factory.kw["bind"].sync_engine

            def fail_pending_insert(mapper, connection, answer):
                target = (not answer.is_adaptive if pending_answer == "fixed" else
                          answer.is_adaptive and answer.question_snapshot is None)
                if target and not faults:
                    faults.append((answer.knowledge_point, connection.in_nested_transaction()))
                    answer.question_id = -1

            def record_insert(mapper, connection, answer):
                inserted.append((answer.knowledge_point, answer.question_snapshot is not None))

            def record_sql_error(context):
                sql_errors.append(context.sqlalchemy_exception)

            async def generate(db, config, knowledge_point, question_type, score, **kwargs):
                calls.append(knowledge_point)
                if len(calls) == 2:
                    assert (calls[0], True) in inserted
                    raise RuntimeError("synthetic second provider failure")
                return {"content": f"Generated {knowledge_point}", "question_type": question_type,
                        "correct_answer": "B", "score": score}

            event.listen(AssessmentAnswer, "before_insert", fail_pending_insert)
            event.listen(AssessmentAnswer, "after_insert", record_insert)
            event.listen(engine, "handle_error", record_sql_error)
            try:
                with patch.object(svc, "_ai_generate_realtime_question", generate):
                    async with factory() as db:
                        with pytest.raises(PendingRollbackError):
                            await svc.start_session(db, 1, 1)
                        assert not db.is_active
                        # No test rollback before observing the failed service transaction.
                    # Session close mirrors request cleanup; inspect durable state with a new session.
                    async with factory() as db:
                        assert list((await db.execute(select(AssessmentSession))).scalars()) == []
                        assert list((await db.execute(select(AssessmentAnswer))).scalars()) == []
                        assert await db.get(AssessmentConfig, 1) is not None
                        question_ids = list((await db.execute(select(AssessmentQuestion.id).order_by(
                            AssessmentQuestion.id))).scalars())
                        assert question_ids == ([1, 2, 3] if pending_answer == "fixed" else [1, 2, 3, 4])
                assert len(sql_errors) == 1 and isinstance(sql_errors[0], IntegrityError)
                if pending_answer == "fixed":
                    assert calls == [] and inserted == []
                    assert faults == [("kp-1", False)]
                else:
                    assert len(calls) == 2 and len(set(calls)) == 2
                    assert set(calls) <= {"kp-2", "kp-3", "kp-4"}
                    assert inserted == [("kp-1", False), (calls[0], True)]
                    assert faults == [(calls[1], False)]
            finally:
                event.remove(AssessmentAnswer, "before_insert", fail_pending_insert)
                event.remove(AssessmentAnswer, "after_insert", record_insert)
                event.remove(engine, "handle_error", record_sql_error)
    asyncio.run(scenario())
