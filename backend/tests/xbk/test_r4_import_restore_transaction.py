"""R4: real SQLite transactions behind an async facade, synthetic records only.

Requires the external offline bootstrap BEFORE collection. No normal conftest,
PG, Redis, HTTP authentication, or actual asyncpg cancellation is exercised.
Cancellation is a real asyncio.Task.cancel at a deterministic await after SQL.
The red assertions require function-local rollback before a retained caller can
reuse the session; they do NOT assert that FastAPI persists cancelled writes.
"""
import asyncio
import csv
from contextlib import asynccontextmanager
import io
import json
import os
from pathlib import Path
import uuid

import pytest

if os.environ.get('R4_XBK_OFFLINE') != '1':
    pytest.skip('Use the reviewed external R4 offline bootstrap', allow_module_level=True)

from fastapi import HTTPException, UploadFile
from sqlalchemy import create_engine, select
from sqlalchemy.dialects.postgresql import Insert
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import database

from app.api.endpoints.xbk.import_export import import_data
from app.models import XbkCourse, XbkSelection, XbkStudent

OUT = Path(os.environ['R4_XBK_ARTIFACTS']).resolve()
MODELS = {'students': XbkStudent, 'courses': XbkCourse, 'selections': XbkSelection}
YEAR, TERM = '2038-2039', '上学期'
PERIODS = [(YEAR, TERM), (YEAR, '下学期'), ('2037-2038', TERM)]


def values(scope, key, *, year=YEAR, term=TERM):
    base = dict(year=year, term=term, grade='高一')
    if scope == 'students':
        return dict(base, student_no=key, name='合成-' + key, class_name='合成班', gender='男')
    if scope == 'courses':
        return dict(base, course_code=key, course_name='合成课程-' + key, quota=2)
    return dict(base, student_no=key, name='合成-' + key, course_code='C')


def snapshot(session):
    return {scope: [dict(row) for row in session.execute(
        select(*model.__table__.columns).order_by(model.id)).mappings()]
        for scope, model in MODELS.items()}


def csv_file(scope):
    output = io.StringIO()
    rows = [values(scope, key) for key in ('A', 'Z')]
    writer = csv.DictWriter(output, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
    return UploadFile(filename='r4-synthetic.csv', file=io.BytesIO(output.getvalue().encode()))


class AsyncFacade:
    """Execute original SQL/commit/rollback, gate only scheduling; not PG locking."""
    def __init__(self, session, mode, trace):
        self.session, self.mode, self.trace = session, mode, trace
        self.writes = self.rollbacks = 0
        self.ready = asyncio.Event()

    async def execute(self, statement):
        result = self.session.execute(statement)
        if isinstance(statement, Insert):
            self.writes += 1
            self.trace.append({'event': 'sql_upsert_completed', 'number': self.writes,
                               'in_transaction': self.session.in_transaction()})
            if self.mode == 'after_first_write' and self.writes == 1:
                self.ready.set()
                await asyncio.Future()
        return result

    async def commit(self):
        if self.mode == 'before_commit':
            self.ready.set()
            await asyncio.Future()
        self.session.commit()
        self.trace.append({'event': 'commit'})

    async def rollback(self):
        self.rollbacks += 1
        self.session.rollback()
        self.trace.append({'event': 'rollback'})


@pytest.fixture
def env(request):
    scope = request.param
    path = OUT / ('synthetic-' + uuid.uuid4().hex + '.sqlite')
    engine = create_engine('sqlite:///' + str(path))
    for model in MODELS.values():
        model.__table__.create(engine)
    trace = []
    with Session(engine, expire_on_commit=False) as seed:
        for year, term in PERIODS:
            seed.add(MODELS[scope](**values(scope, 'A', year=year, term=term), is_deleted=True))
        if scope == 'selections':
            for key in ('A', 'Z'):
                seed.add(XbkStudent(**values('students', key), is_deleted=False))
            seed.add(XbkCourse(**values('courses', 'C'), is_deleted=False))
        seed.commit()
        before = snapshot(seed)
    session = Session(engine, expire_on_commit=False)
    try:
        yield scope, engine, session, before, trace
    finally:
        session.close()
        with Session(engine) as observer:
            trace.append({'event': 'after_session_close', 'snapshot': snapshot(observer)})
        engine.dispose()
        (OUT / (request.node.name.replace('/', '_') + '.json')).write_text(
            json.dumps(trace, ensure_ascii=False, default=str, indent=2))
        path.unlink()


async def call(scope, db):
    upload = csv_file(scope)
    try:
        return await import_data(scope=scope, year=YEAR, term=TERM, grade=None,
                                 skip_invalid=False, file=upload, db=db, _={'id': 1})
    finally:
        await upload.close()


def assert_restored_only_target(scope, before, after):
    for other in MODELS:
        if other != scope:
            assert after[other] == before[other]
    original = before[scope][0]
    restored = next(row for row in after[scope] if row['id'] == original['id'])
    assert restored['is_deleted'] is False
    assert restored['created_at'] == original['created_at']
    assert restored['year'] == YEAR and restored['term'] == TERM
    assert [row for row in after[scope] if (row['year'], row['term']) != (YEAR, TERM)] == before[scope][1:]
    assert len(after[scope]) == len(before[scope]) + 1


@pytest.mark.parametrize('env', MODELS, indirect=True)
def test_restore_success_keeps_other_periods_and_row_identity(env):
    scope, engine, session, before, trace = env
    db = AsyncFacade(session, 'normal', trace)
    result = asyncio.run(call(scope, db))
    assert (result['processed'], result['inserted'], result['updated']) == (2, 1, 1)
    with Session(engine) as observer:
        after = snapshot(observer)
    trace.append({'event': 'committed_restore', 'result': result, 'snapshot': after})
    assert_restored_only_target(scope, before, after)


@pytest.mark.parametrize('env', MODELS, indirect=True)
def test_late_sql_failure_rolls_back_restore_and_allows_same_session_retry(env):
    scope, engine, session, before, trace = env
    table = MODELS[scope].__tablename__
    key = 'course_code' if scope == 'courses' else 'student_no'
    # Real database constraint failure on the second INSERT, not fake rollback.
    with engine.begin() as conn:
        conn.exec_driver_sql(f"CREATE TRIGGER r4_fail BEFORE INSERT ON {table} "
                             f"WHEN NEW.{key} = 'Z' BEGIN SELECT RAISE(ABORT, 'r4_private_sql_failure'); END")
    db = AsyncFacade(session, 'normal', trace)
    with pytest.raises(HTTPException) as caught:
        asyncio.run(call(scope, db))
    assert caught.value.status_code == 409
    assert 'r4_private_sql_failure' not in str(caught.value.detail)
    assert db.writes == 1 and db.rollbacks == 1
    assert not session.in_transaction()
    with Session(engine) as observer:
        assert snapshot(observer) == before
    trace.append({'event': 'real_sql_failure_rolled_back', 'http_status': 409, 'before': before})
    with engine.begin() as conn:
        conn.exec_driver_sql('DROP TRIGGER r4_fail')
    result = asyncio.run(call(scope, db))
    assert result['updated'] == 1 and result['inserted'] == 1
    with Session(engine) as observer:
        assert_restored_only_target(scope, before, snapshot(observer))
    trace.append({'event': 'same_session_retry_committed', 'result': result})


@pytest.mark.parametrize('env', MODELS, indirect=True)
@pytest.mark.parametrize('phase', ['after_first_write', 'before_commit'])
def test_cancelled_restore_rolls_back_before_return_to_retained_caller(env, phase):
    scope, engine, session, before, trace = env

    async def exercise():
        db = AsyncFacade(session, phase, trace)
        task = asyncio.create_task(call(scope, db))
        try:
            await asyncio.wait_for(db.ready.wait(), timeout=5)
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task
            pending = session.in_transaction()
            # Capture before cleanup: independent reader must still see old rows.
            local = snapshot(session)
            with Session(engine) as observer:
                external = snapshot(observer)
            trace.append({'event': 'cancel_returned_to_retained_caller', 'phase': phase,
                          'rollbacks': db.rollbacks, 'pending_transaction': pending,
                          'local': local, 'independent_reader': external, 'before': before})
            assert external == before, 'Cancelled writes must not be committed'
            print(f'R4 {scope}/{phase}: rollback={db.rollbacks}, pending={pending}, '
                  f'local_changed={local != before}, independent_reader_unchanged={external == before}')
            # Close proves dependency-lifecycle cleanup is distinct from handler rollback.
            session.close()
            with Session(engine) as observer:
                assert snapshot(observer) == before
            trace.append({'event': 'explicit_close_restores_baseline', 'ok': True})
            assert db.rollbacks == 1 and not pending, (
                'Function-local cancellation rollback missing: task returned CancelledError '
                'with pending restore SQL in retained session; explicit close does clean it up')
        finally:
            if not task.done():
                task.cancel()
            await asyncio.gather(task, return_exceptions=True)

    asyncio.run(exercise())


@pytest.mark.parametrize('env', MODELS, indirect=True)
@pytest.mark.parametrize('phase', ['after_first_write', 'before_commit'])
def test_get_db_dependency_exit_discards_cancelled_restore(env, phase, monkeypatch):
    """Real get_db and AsyncSession __aexit__/close; offline sync SQLite driver.

    Not an HTTP disconnect test or an asyncpg in-flight query cancellation test.
    No manual close is used before the independent-reader assertion.
    """
    scope, engine, session, before, trace = env

    async def exercise():
        db = AsyncSession(sync_session_class=lambda **kwargs: session)
        ready = asyncio.Event()
        real_execute, real_commit, real_close = db.execute, db.commit, db.close
        writes = 0
        closed = False

        async def execute(statement, *args, **kwargs):
            nonlocal writes
            result = await real_execute(statement, *args, **kwargs)
            if isinstance(statement, Insert):
                writes += 1
                if phase == 'after_first_write' and writes == 1:
                    ready.set()
                    await asyncio.Future()
            return result

        async def commit():
            if phase == 'before_commit':
                ready.set()
                await asyncio.Future()
            await real_commit()

        async def close():
            nonlocal closed
            trace.append({'event': 'real_async_session_close_entered',
                          'pending': session.in_transaction()})
            await real_close()
            closed = True

        monkeypatch.setattr(db, 'execute', execute)
        monkeypatch.setattr(db, 'commit', commit)
        monkeypatch.setattr(db, 'close', close)
        monkeypatch.setattr(database, 'AsyncSessionLocal', lambda: db)

        async def request_lifetime():
            async with asynccontextmanager(database.get_db)() as dependency:
                assert dependency is db
                await call(scope, dependency)

        task = asyncio.create_task(request_lifetime())
        try:
            await asyncio.wait_for(ready.wait(), timeout=5)
            assert session.in_transaction()
            assert snapshot(session) != before, 'Cancellation gate must follow actual writes'
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task
            assert closed, 'Actual AsyncSession.close must complete via get_db exit'
            assert not session.in_transaction()
            with Session(engine) as reader:
                after = snapshot(reader)
            assert after == before, 'Actual dependency close must discard all cancelled writes'
            trace.append({'event': 'get_db_exit_independent_reader_baseline',
                          'phase': phase, 'before': before, 'after': after,
                          'async_session_closed': closed})
            print(f'R4 dependency {scope}/{phase}: real_close={closed}, reader_baseline={after == before}')
        finally:
            if not task.done():
                task.cancel()
            await asyncio.gather(task, return_exceptions=True)

    asyncio.run(exercise())
