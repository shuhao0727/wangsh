"""Opt-in real PostgreSQL proof for the XBK final-seat transaction decision."""

import asyncio
import os
import re
import uuid
from contextlib import asynccontextmanager

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.api.endpoints.xbk.selections import create_selection
from app.models import XbkCourse, XbkSelection, XbkStudent
from app.schemas.xbk import XbkSelectionUpsert

YEAR, TERM = "2037-2038", "上学期"


@asynccontextmanager
async def isolated_pg():
    url = os.environ.get("TEST_DATABASE_URL", "").strip()
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to a dedicated PostgreSQL test database")
    parsed = make_url(url)
    if parsed.drivername != "postgresql+asyncpg" or not re.search(
        r"(?:^|[_-])(?:test|testing|ci)(?:$|[_-])", parsed.database or "", re.I,
    ):
        pytest.fail("Refusing non-asyncpg or non-test database before connecting")
    schema = "test_xbk_selection_" + uuid.uuid4().hex
    admin = create_async_engine(url)
    engine = create_async_engine(url, connect_args={"server_settings": {
        "search_path": schema, "application_name": schema,
        "statement_timeout": "10000", "lock_timeout": "8000",
    }})
    try:
        async with admin.begin() as conn:
            await conn.execute(text(f'CREATE SCHEMA "{schema}"'))
        async with engine.begin() as conn:
            for model in (XbkStudent, XbkCourse, XbkSelection):
                await conn.run_sync(lambda sync, table=model.__table__: table.create(sync))
        yield engine, admin, schema
    finally:
        await engine.dispose()
        async with admin.begin() as conn:
            await conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        await admin.dispose()


def payload(no):
    return XbkSelectionUpsert(
        year=YEAR, term=TERM, grade="快照", student_no=no, name=no, course_code="C1",
    )


def test_concurrent_last_seat_waits_then_rechecks_final_capacity():
    async def scenario():
        async with isolated_pg() as (engine, admin, schema):
            async with AsyncSession(engine) as db:
                db.add_all([
                    XbkStudent(year=YEAR, term=TERM, grade="高一", class_name="1班", student_no="S1", name="S1"),
                    XbkStudent(year=YEAR, term=TERM, grade="高一", class_name="1班", student_no="S2", name="S2"),
                    XbkCourse(year=YEAR, term=TERM, grade="高一", course_code="C1", course_name="C1", quota=1),
                ])
                await db.commit()

            ready, release = asyncio.Event(), asyncio.Event()

            class HeldCommit(AsyncSession):
                async def commit(self):
                    ready.set()
                    await asyncio.wait_for(release.wait(), 7)
                    await super().commit()

            async def first():
                async with HeldCommit(engine, expire_on_commit=False) as db:
                    return await create_selection(payload("S1"), db, {})

            async def second():
                async with AsyncSession(engine, expire_on_commit=False) as db:
                    return await create_selection(payload("S2"), db, {})

            task1 = asyncio.create_task(first())
            await asyncio.wait_for(ready.wait(), 5)
            task2 = asyncio.create_task(second())
            waited = False
            try:
                for _ in range(200):
                    async with admin.connect() as conn:
                        waited = bool((await conn.execute(text(
                            "SELECT count(*) FROM pg_stat_activity WHERE application_name=:name "
                            "AND wait_event_type='Lock' AND cardinality(pg_blocking_pids(pid)) > 0"
                        ), {"name": schema})).scalar())
                    if waited or task2.done():
                        break
                    await asyncio.sleep(.01)
            finally:
                release.set()
            results = await asyncio.wait_for(asyncio.gather(task1, task2, return_exceptions=True), 12)

            assert waited, results
            assert isinstance(results[0], dict), results
            assert isinstance(results[1], HTTPException), results
            assert results[1].status_code == 409
            async with AsyncSession(engine) as db:
                count = await db.scalar(
                    select(func.count()).select_from(XbkSelection).where(~XbkSelection.is_deleted)
                )
                assert count == 1

    asyncio.run(scenario())
