"""Dedicated real PostgreSQL import races, with synthetic CSVs and real row locks.

Opt in with TEST_DATABASE_URL naming an isolated test/testing/ci database.
Only INSERT timing is gated; reads, writes, commits and rollbacks are real.
"""
import asyncio
import csv
import io
import os
import re
import unittest
import uuid

import pytest
from fastapi import HTTPException, UploadFile
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import Insert
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.endpoints.xbk.import_export import import_data
from app.models import XbkStudent


def dedicated_url():
    value = os.environ.get("TEST_DATABASE_URL", "").strip()
    if not value:
        pytest.skip("Set TEST_DATABASE_URL to a dedicated PostgreSQL test database")
    parsed = make_url(value)
    if parsed.drivername != "postgresql+asyncpg" or not re.search(
        r"(?:^|[_-])(?:test|testing|ci)(?:$|[_-])", parsed.database or "", re.I
    ):
        pytest.fail("Refusing non-asyncpg or non-test database before connecting")
    return value


def row(name="Alice", grade="G1", no="S1"):
    return {"班级": "Class 1", "学号": no, "姓名": name, "年级": grade}


def upload(rows):
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
    return UploadFile(filename="synthetic.csv", file=io.BytesIO(out.getvalue().encode()))


class PostgresImportConcurrency(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        url = dedicated_url()
        self.schema = "test_xbk_import_" + uuid.uuid4().hex
        self.admin = create_async_engine(url)
        self.addAsyncCleanup(self.admin.dispose)
        async with self.admin.begin() as conn:
            await conn.execute(text(f'CREATE SCHEMA "{self.schema}"'))
        self.addAsyncCleanup(self.drop_schema)
        self.engine = create_async_engine(url, connect_args={"server_settings": {
            "search_path": self.schema, "application_name": self.schema,
            "statement_timeout": "9000", "lock_timeout": "7000",
        }})
        self.addAsyncCleanup(self.engine.dispose)
        self.Session = async_sessionmaker(self.engine, expire_on_commit=False)
        async with self.engine.begin() as conn:
            await conn.run_sync(lambda c: XbkStudent.__table__.create(c))

    async def drop_schema(self):
        async with self.admin.begin() as conn:
            await conn.execute(text(f'DROP SCHEMA IF EXISTS "{self.schema}" CASCADE'))

    async def call(self, db, rows, skip=True):
        file = upload(rows)
        try:
            return await import_data(scope="students", year="2026-2027", term="上学期",
                                     grade=None, skip_invalid=skip, file=file, db=db, _={"id": 1})
        finally:
            await file.close()

    async def records(self):
        async with self.Session() as db:
            return [(s.student_no, s.name, s.grade, s.is_deleted)
                    for s in (await db.scalars(select(XbkStudent).order_by(XbkStudent.student_no))).all()]

    async def seed(self, name="Alice", grade="G1", deleted=False):
        async with self.Session() as db:
            db.add(XbkStudent(year="2026-2027", term="上学期", student_no="S1",
                              name=name, grade=grade, class_name="Class 0", is_deleted=deleted))
            await db.commit()

    async def overlap(self, first_rows, second_rows):
        ready = [asyncio.Event(), asyncio.Event()]
        written, release = asyncio.Event(), asyncio.Event()

        class GatedSession(AsyncSession):
            async def execute(inner, statement, *args, **kwargs):
                if isinstance(statement, Insert) and statement.compile().params.get("student_no") == "S1":
                    role = inner.info["role"]
                    ready[role].set()
                    await asyncio.wait_for(ready[1-role].wait(), 5)
                    if role == 0:
                        result = await super().execute(statement, *args, **kwargs)
                        written.set()
                        await asyncio.wait_for(release.wait(), 6)
                        return result
                    await asyncio.wait_for(written.wait(), 5)
                return await super().execute(statement, *args, **kwargs)

        async def run(role, rows):
            async with GatedSession(self.engine, info={"role": role}) as db:
                return await self.call(db, rows)

        tasks = [asyncio.create_task(run(0, first_rows)), asyncio.create_task(run(1, second_rows))]
        waited = False
        try:
            await asyncio.wait_for(written.wait(), 6)
            for _ in range(150):
                async with self.admin.connect() as conn:
                    waited = bool((await conn.execute(text(
                        "SELECT count(*) FROM pg_stat_activity WHERE application_name=:name "
                        "AND wait_event_type='Lock'"), {"name": self.schema})).scalar())
                if waited or tasks[1].done():
                    break
                await asyncio.sleep(.02)
        finally:
            release.set()
            results = await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), 12)
        self.assertTrue(waited, f"Expected actual PostgreSQL lock wait; got {results!r}")
        self.assertIsInstance(results[0], dict, results)
        return results

    async def test_concurrent_different_names_cannot_take_over(self):
        results = await self.overlap([row()], [row(name="Bob")])
        self.assertIsInstance(results[1], HTTPException)
        self.assertEqual(results[1].status_code, 422)
        self.assertEqual(await self.records(), [("S1", "Alice", "G1", False)])

    async def test_concurrent_different_nonblank_grades_cannot_take_over(self):
        results = await self.overlap([row()], [row(grade="G2")])
        self.assertIsInstance(results[1], HTTPException)
        self.assertEqual(results[1].status_code, 422)
        self.assertEqual(await self.records(), [("S1", "Alice", "G1", False)])

    async def test_late_identity_conflict_rolls_back_earlier_rows_even_skip_invalid(self):
        results = await self.overlap([row()], [row(name="Other", no="S0"), row(name="Bob")])
        self.assertIsInstance(results[1], HTTPException)
        self.assertEqual(await self.records(), [("S1", "Alice", "G1", False)])

    async def test_same_identity_concurrent_reimport_remains_allowed(self):
        results = await self.overlap([row()], [row()])
        self.assertIsInstance(results[1], dict)
        self.assertEqual(results[1]["processed"], 1)
        self.assertEqual(await self.records(), [("S1", "Alice", "G1", False)])

    async def test_blank_grade_can_be_filled_concurrently(self):
        results = await self.overlap([row(grade="")], [row()])
        self.assertIsInstance(results[1], dict)
        self.assertEqual(await self.records(), [("S1", "Alice", "G1", False)])

    async def test_grade_can_be_cleared_by_same_identity(self):
        results = await self.overlap([row()], [row(grade="")])
        self.assertIsInstance(results[1], dict)
        self.assertEqual(await self.records(), [("S1", "Alice", None, False)])

    async def test_existing_deleted_identity_cannot_be_taken_over(self):
        await self.seed(deleted=True)
        async with self.Session() as db:
            with self.assertRaises(HTTPException) as caught:
                await self.call(db, [row(name="Bob")])
        self.assertEqual(caught.exception.status_code, 422)
        self.assertEqual(await self.records(), [("S1", "Alice", "G1", True)])

    async def test_legacy_unicode_whitespace_identity_can_be_restored(self):
        await self.seed(name="\t\u3000Alice\u00a0\n", grade="\t G1\u3000", deleted=True)
        async with self.Session() as db:
            result = await self.call(db, [row()])
        self.assertEqual(result["processed"], 1)
        self.assertEqual(await self.records(), [("S1", "Alice", "G1", False)])
