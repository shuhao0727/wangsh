"""Opt-in real asyncpg cancellation; run only inside a no-dotenv isolated runner.

TEST_DATABASE_URL must name a dedicated test database. Each case owns a unique
schema. PostgreSQL trigger sleeps occur inside INSERT or deferred COMMIT, not
in a Python SQL facade. ASGI cases use the real FastAPI dependency exit; retained
callers deliberately demand the stronger function-local rollback contract.
"""
import asyncio
import csv
import io
import json
from pathlib import Path
import os
import re
import unittest
import uuid
from unittest.mock import patch

import httpx
import pytest
from fastapi import FastAPI, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.endpoints.xbk import import_export
from app.db import database
from app.models import XbkCourse, XbkSelection, XbkStudent

MODELS = {'students': XbkStudent, 'courses': XbkCourse, 'selections': XbkSelection}
YEAR, TERM = '2032-2033', '上学期'


def dedicated_url():
    value = os.environ.get('TEST_DATABASE_URL', '')
    if not value:
        pytest.skip('requires explicitly allocated PostgreSQL test database')
    parsed = make_url(value)
    if parsed.drivername != 'postgresql+asyncpg' or not re.search(
        r'(?:^|[_-])(?:test|testing|ci)(?:$|[_-])', parsed.database or '', re.I
    ):
        pytest.fail('refusing non-test database before connecting')
    return value


def csv_bytes(scope):
    rows = {
        'students': [{'班级': '合成班', '学号': f'S{i}', '姓名': f'合成{i}'} for i in (1, 2)],
        'courses': [{'课程代码': f'C{i}', '课程名称': f'合成课程{i}', '限报人数': 5} for i in (1, 2)],
        'selections': [{'学号': f'S{i}', '姓名': f'合成{i}', '课程代码': f'C{i}'} for i in (1, 2)],
    }[scope]
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
    return out.getvalue().encode()


class PostgresCancellation(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.events = []
        self.schema = 'test_r5_cancel_' + uuid.uuid4().hex
        self.admin = create_async_engine(dedicated_url())
        self.addAsyncCleanup(self.admin.dispose)
        async with self.admin.begin() as conn:
            await conn.execute(text(f'CREATE SCHEMA "{self.schema}"'))
        self.addAsyncCleanup(self.drop_schema)
        self.engine = create_async_engine(dedicated_url(), connect_args={'server_settings': {
            'search_path': self.schema, 'application_name': self.schema,
            'statement_timeout': '15000', 'lock_timeout': '12000',
        }})
        self.addAsyncCleanup(self.engine.dispose)
        self.Session = async_sessionmaker(self.engine, expire_on_commit=False)
        async with self.engine.begin() as conn:
            for model in MODELS.values():
                await conn.run_sync(model.__table__.create)

    async def asyncTearDown(self):
        out = os.environ.get("R5_XBK_ARTIFACTS")
        if out:
            Path(out, self.id().split(".")[-1] + "-trace.json").write_text(json.dumps(self.events, indent=2))

    async def drop_schema(self):
        async with self.admin.begin() as conn:
            await conn.execute(text(f'DROP SCHEMA IF EXISTS "{self.schema}" CASCADE'))

    async def prepare(self, scope, stage):
        if scope == 'selections':
            async with self.Session() as db:
                for i in (1, 2):
                    db.add(XbkStudent(year=YEAR, term=TERM, student_no=f'S{i}', name=f'合成{i}', class_name='合成班', is_deleted=False))
                    db.add(XbkCourse(year=YEAR, term=TERM, course_code=f'C{i}', course_name=f'合成课程{i}', quota=5, is_deleted=False))
                await db.commit()
        table = MODELS[scope].__tablename__
        key = 'course_code' if scope == 'courses' else 'student_no'
        # The first row is already written before the second INSERT blocks.
        # For COMMIT the deferred trigger blocks while the transaction is still open.
        condition = f"NEW.{key} = '{'C' if scope == 'courses' else 'S'}2'"
        async with self.engine.begin() as conn:
            await conn.execute(text(f"""CREATE FUNCTION r5_gate() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN IF {condition} THEN PERFORM pg_sleep(10); END IF; RETURN NEW; END $$"""))
            trigger = 'CREATE CONSTRAINT TRIGGER' if stage == 'commit' else 'CREATE TRIGGER'
            deferred = 'DEFERRABLE INITIALLY DEFERRED' if stage == 'commit' else ''
            await conn.execute(text(f'{trigger} r5_gate AFTER INSERT ON {table} {deferred} FOR EACH ROW EXECUTE FUNCTION r5_gate()'))

    async def wait_sleep(self, task, wait_event="PgSleep"):
        async with asyncio.timeout(8):
            while True:
                if task.done():
                    await task
                    self.fail('import finished before the database gate')
                async with self.admin.connect() as conn:
                    rows = (await conn.execute(text('''SELECT pid, query FROM pg_stat_activity
                        WHERE application_name=:app AND wait_event=:wait AND state='active' '''), {'app': self.schema, 'wait': wait_event})).all()
                    if rows:
                        pid, query = rows[0]
                        locks = (await conn.execute(text('SELECT count(*) FROM pg_locks WHERE pid=:pid AND granted AND locktype=\'relation\''), {'pid': pid})).scalar_one()
                        self.assertGreater(locks, 0)
                        self.events.append({"event": "in_flight_postgres", "wait_event": wait_event, "pid": pid, "query": query, "granted_relation_locks": locks})
                        return pid, query
                await asyncio.sleep(.02)

    async def call(self, db, scope):
        file = UploadFile(filename='synthetic.csv', file=io.BytesIO(csv_bytes(scope)))
        try:
            return await import_export.import_data(scope=scope, year=YEAR, term=TERM, grade=None,
                skip_invalid=False, file=file, db=db, _={'id': 1})
        finally:
            await file.close()

    async def count(self, scope):
        async with self.engine.connect() as conn:
            return (await conn.execute(text(f'SELECT count(*) FROM {MODELS[scope].__tablename__}'))).scalar_one()

    async def assert_released(self, pid, scope):
        async with asyncio.timeout(6):
            while True:
                async with self.admin.connect() as conn:
                    held = (await conn.execute(text("SELECT count(*) FROM pg_locks WHERE pid=:pid AND locktype IN ('relation','transactionid')"), {'pid': pid})).scalar_one()
                    if not held:
                        break
                await asyncio.sleep(.02)
        self.events.append({'event': 'locks_released', 'pid': pid, 'remaining_locks': held})
        self.assertEqual(await self.count(scope), 0, 'cancelled batch persisted')
        async with self.engine.begin() as conn:
            await conn.execute(text("SET LOCAL lock_timeout='500ms'"))
            await conn.execute(text(f'LOCK TABLE {MODELS[scope].__tablename__} IN ACCESS EXCLUSIVE MODE NOWAIT'))
            if scope == 'selections':
                for model in (XbkStudent, XbkCourse):
                    await conn.execute(text(f'LOCK TABLE {model.__tablename__} IN ACCESS EXCLUSIVE MODE NOWAIT'))
            await conn.execute(text(f'DROP TRIGGER r5_gate ON {MODELS[scope].__tablename__}'))

    async def run_sql_failure(self, scope):
        await self.prepare(scope, 'insert')
        key = 'course_code' if scope == 'courses' else 'student_no'
        second = 'C2' if scope == 'courses' else 'S2'
        async with self.engine.begin() as conn:
            await conn.execute(text(f"""CREATE OR REPLACE FUNCTION r5_gate() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN IF NEW.{key} = '{second}' THEN RAISE EXCEPTION 'synthetic late-row failure' USING ERRCODE='23514';
                END IF; RETURN NEW; END $$"""))
        async with self.Session() as db:
            pid = (await db.execute(text('SELECT pg_backend_pid()'))).scalar_one()
            with self.assertRaises(HTTPException) as caught:
                await self.call(db,scope)
            self.assertEqual(caught.exception.status_code,409)
            self.assertFalse(db.in_transaction())
            await self.assert_released(pid,scope)
            self.assertEqual((await self.call(db,scope))['processed'],2)
        self.assertEqual(await self.count(scope),2)
        self.events.append({'event':'late_sql_failure_409_rollback_same_session_retry', 'scope':scope})

    async def run_repeated_cancel(self, lifecycle):
        scope = 'selections'
        await self.prepare(scope, 'insert')
        rollback_entered = asyncio.Event()
        class InterruptedRollbackSession(AsyncSession):
            async def rollback(inner):
                if not inner.info.get('rollback_interrupted'):
                    inner.info['rollback_interrupted'] = True
                    rollback_entered.set()
                    await asyncio.Future()
                await super().rollback()
        sessions = []
        def factory():
            db = InterruptedRollbackSession(self.engine, expire_on_commit=False)
            sessions.append(db)
            return db
        app = FastAPI()
        app.include_router(import_export.router)
        app.dependency_overrides[import_export.require_admin] = lambda: {'id': 1}
        db = factory() if lifecycle == 'retained' else None
        try:
            with patch.object(database, 'AsyncSessionLocal', factory):
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://isolated', trust_env=False) as client:
                    task = asyncio.create_task(self.call(db, scope) if db is not None else
                        client.post('/import',params={'scope':scope,'year':YEAR,'term':TERM,'skip_invalid':'false'},
                            files={'file':('synthetic.csv',csv_bytes(scope),'text/csv')}))
                    pid, _ = await self.wait_sleep(task)
                    task.cancel()
                    await asyncio.wait_for(rollback_entered.wait(),3)
                    task.cancel()
                    with self.assertRaises(asyncio.CancelledError):
                        await task
                    await self.assert_released(pid,scope)
                    if lifecycle == 'retained':
                        # Repeated cancellation may interrupt local cleanup. The
                        # caller remains responsible for close/rollback, no shield.
                        self.assertTrue(db.in_transaction())
                        await db.rollback()
                    else:
                        self.assertFalse(sessions[0].in_transaction(), 'get_db exit must close after interrupted rollback')
                    self.events.append({'event':'second_cancel_during_rollback', 'lifecycle':lifecycle,
                        'caller_cleanup_required':lifecycle == 'retained'})
                    async with self.Session() as retry_db:
                        self.assertEqual((await self.call(retry_db,scope))['processed'],2)
        finally:
            if db is not None:
                await db.close()

    async def test_preflight_parent_lock_cancel_retained(self):
        await self.run_cancel('selections', 'preflight', 'retained')

    async def test_preflight_parent_lock_cancel_asgi(self):
        await self.run_cancel('selections', 'preflight', 'asgi')

    async def test_repeated_cancel_retained_requires_caller_cleanup(self):
        await self.run_repeated_cancel('retained')

    async def test_repeated_cancel_asgi_dependency_closes(self):
        await self.run_repeated_cancel('asgi')

    async def run_tcp(self, scope, abort):
        # Only bind an explicitly allocated loopback port; never start normal app.
        if os.environ.get('R5_XBK_HTTP_PORT') != '18881':
            pytest.skip('requires allocated isolated HTTP18881')
        import uvicorn
        await self.prepare(scope, 'insert')
        app = FastAPI()
        app.include_router(import_export.router)
        app.dependency_overrides[import_export.require_admin] = lambda: {'id': 1}
        entered, exited = asyncio.Event(), asyncio.Event()
        request_task = None
        responses = []

        async def wrapped(scope_, receive, send):
            nonlocal request_task
            if scope_['type'] != 'http':
                return await app(scope_, receive, send)
            request_task = asyncio.current_task()
            entered.set()
            async def record_send(message):
                if message['type'] == 'http.response.start':
                    responses.append(message['status'])
                await send(message)
            try:
                await app(scope_, receive, record_send)
            finally:
                exited.set()

        server = uvicorn.Server(uvicorn.Config(wrapped, host='127.0.0.1', port=18881,
            lifespan='off', access_log=False, log_level='critical'))
        serving = asyncio.create_task(server.serve())
        try:
            async with asyncio.timeout(5):
                while not server.started:
                    if serving.done():
                        await serving
                        self.fail('isolated HTTP server did not start')
                    await asyncio.sleep(.01)
            with patch.object(database, 'AsyncSessionLocal', self.Session):
                # Actual HTTP multipart over TCP; disconnect after INSERT is on wire.
                request = httpx.Request('POST', 'http://127.0.0.1:18881/import',
                    params={'scope':scope,'year':YEAR,'term':TERM,'skip_invalid':'false'},
                    files={'file':('synthetic.csv',csv_bytes(scope),'text/csv')})
                body = request.read()
                reader, writer = await asyncio.open_connection('127.0.0.1',18881)
                try:
                    head = b'POST ' + request.url.raw_path + b' HTTP/1.1\r\n'
                    head += b''.join(k+b': '+v+b'\r\n' for k,v in request.headers.raw)
                    writer.write(head+b'\r\n'+body)
                    await writer.drain()
                    await asyncio.wait_for(entered.wait(),3)
                    pid, _ = await self.wait_sleep(request_task)
                finally:
                    writer.close()
                    await writer.wait_closed()
                await asyncio.sleep(.1)
                self.assertFalse(exited.is_set(), 'TCP disconnect unexpectedly cancelled handler')
                self.events.append({'event':'tcp_client_disconnected', 'handler_still_running':True})
                if abort:
                    # Explicit server-side task cancellation, not invented automatic
                    # disconnect cancellation. Both still exercise actual get_db exit.
                    request_task.cancel()
                    await asyncio.wait_for(exited.wait(),6)
                    await self.assert_released(pid,scope)
                    async with httpx.AsyncClient(base_url='http://127.0.0.1:18881', trust_env=False) as client:
                        retry = await client.post('/import',params={'scope':scope,'year':YEAR,'term':TERM,'skip_invalid':'false'},
                            files={'file':('synthetic.csv',csv_bytes(scope),'text/csv')})
                        self.assertEqual(retry.status_code,200,retry.text)
                    self.events.append({'event':'explicit_server_cancel_cleanup_then_retry', 'status':200})
                else:
                    # Uvicorn/FastAPI need not abort a fully uploaded request just
                    # because its recipient has gone. A completed commit is valid.
                    await asyncio.wait_for(exited.wait(),12)
                    self.assertEqual(responses,[200])
                    self.events.append({'event':'disconnected_request_completed', 'status':200})
                self.assertEqual(await self.count(scope),2)
        finally:
            server.should_exit = True
            await asyncio.wait_for(serving,5)

    async def test_tcp_disconnect_can_complete(self):
        await self.run_tcp('students',False)

    async def run_cancel(self, scope, stage, lifecycle):
        await self.prepare(scope, stage)
        blocker = None
        if stage == 'preflight':
            blocker = await self.engine.connect()
            self.addAsyncCleanup(blocker.close)
            await blocker.execute(text("SELECT id FROM xbk_courses WHERE course_code='C2' FOR UPDATE"))
        wait_event = 'transactionid' if blocker is not None else 'PgSleep'
        expected_query = 'SELECT' if blocker is not None else ('COMMIT' if stage == 'commit' else 'INSERT')
        if lifecycle == 'retained':
            async with self.Session() as db:
                task = asyncio.create_task(self.call(db, scope))
                pid, query = await self.wait_sleep(task, wait_event)
                self.assertIn(expected_query, query.upper())
                task.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await task
                if blocker is not None:
                    await blocker.rollback()
                await self.assert_released(pid, scope)
                # Stronger than HTTP dependency exit; current R4 did not promise it.
                self.assertFalse(db.in_transaction(), 'retained caller still owns failed transaction')
                result = await self.call(db, scope)
                self.assertEqual(result['processed'], 2)
        else:
            app = FastAPI()
            app.include_router(import_export.router)
            app.dependency_overrides[import_export.require_admin] = lambda: {'id': 1}
            closed = asyncio.Event()
            sessions = []
            def factory():
                session = self.Session()
                original_close = session.close
                async def close():
                    try:
                        await original_close()
                    finally:
                        closed.set()
                session.close = close
                sessions.append(session)
                return session
            with patch.object(database, 'AsyncSessionLocal', factory):
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://isolated') as client:
                    task = asyncio.create_task(client.post('/import', params={'scope':scope, 'year':YEAR, 'term':TERM, 'skip_invalid':'false'}, files={'file':('synthetic.csv', csv_bytes(scope), 'text/csv')}))
                    pid, query = await self.wait_sleep(task, wait_event)
                    self.assertIn(expected_query, query.upper())
                    task.cancel()
                    with self.assertRaises(asyncio.CancelledError):
                        await task
                    await asyncio.wait_for(closed.wait(), 3)
                    self.assertFalse(sessions[0].in_transaction())
                    if blocker is not None:
                        await blocker.rollback()
                    await self.assert_released(pid, scope)
                    retry = await client.post('/import', params={'scope':scope, 'year':YEAR, 'term':TERM, 'skip_invalid':'false'}, files={'file':('synthetic.csv', csv_bytes(scope), 'text/csv')})
                    self.assertEqual(retry.status_code, 200, retry.text)
                    self.assertEqual(retry.json()['processed'], 2)
        self.assertEqual(await self.count(scope), 2)


for _scope in MODELS:
    for _stage in ('insert', 'commit'):
        for _lifecycle in ('retained', 'asgi'):
            def make_case(scope=_scope, stage=_stage, lifecycle=_lifecycle):
                async def case(self):
                    await self.run_cancel(scope, stage, lifecycle)
                return case
            setattr(PostgresCancellation, f'test_{_scope}_{_stage}_{_lifecycle}', make_case())

for _scope in MODELS:
    def make_tcp(scope=_scope):
        async def case(self):
            await self.run_tcp(scope, True)
        return case
    setattr(PostgresCancellation, f'test_{_scope}_tcp_server_cancel', make_tcp())

for _scope in MODELS:
    def make_sql_failure(scope=_scope):
        async def case(self):
            await self.run_sql_failure(scope)
        return case
    setattr(PostgresCancellation, f'test_{_scope}_late_sql_failure_retry', make_sql_failure())
