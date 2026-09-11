"""Real PostgreSQL two-transaction parent-delete regression tests.

Run only through an isolated runner that blocks dotenv and external services.
Each case creates its own synthetic schema; no application lifespan or roster.
Gates delay real commits/SQL, never replace database results or row locking.
"""
import asyncio
import csv
import io
import os
import re
import uuid
from contextlib import asynccontextmanager

import pytest
from fastapi import HTTPException, UploadFile
from sqlalchemy import delete, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.endpoints.xbk import bulk_ops, courses, selections, students
from app.api.endpoints.xbk.import_export import import_data
from app.models import XbkCourse, XbkSelection, XbkStudent
from app.schemas.xbk import XbkSelectionUpsert

YEAR, TERM = "2032-2033", "上学期"
MODELS = (XbkStudent, XbkCourse, XbkSelection)


@asynccontextmanager
async def database():
    url = os.environ.get("TEST_DATABASE_URL", "").strip()
    if not url:
        pytest.skip("Requires dedicated PostgreSQL TEST_DATABASE_URL")
    parsed = make_url(url)
    if parsed.drivername != "postgresql+asyncpg" or not re.search(
        r"(?:^|[_-])(?:test|testing|ci)(?:$|[_-])", parsed.database or "", re.I,
    ):
        pytest.fail("Refusing a non-asyncpg or non-test database before connecting")
    schema = "test_xbk_parent_" + uuid.uuid4().hex
    admin = create_async_engine(url)
    engine = create_async_engine(url, connect_args={"server_settings": {
        "search_path": schema, "application_name": schema,
        "statement_timeout": "10000", "lock_timeout": "8000",
    }})
    try:
        async with admin.begin() as conn:
            await conn.execute(text(f'CREATE SCHEMA "{schema}"'))
        async with engine.begin() as conn:
            for model in MODELS:
                await conn.run_sync(lambda c, m=model: m.__table__.create(c))
        yield engine, admin, schema
    finally:
        await engine.dispose()
        async with admin.begin() as conn:
            await conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        await admin.dispose()


async def seed(engine, *, year=YEAR, term=TERM, existing=False):
    async with AsyncSession(engine, expire_on_commit=False) as db:
        student = XbkStudent(year=year, term=term, student_no="S1", name="Alice",
                             class_name="Class 1", grade="G1", is_deleted=False)
        course = XbkCourse(year=year, term=term, course_code="C1", course_name="Course",
                           quota=3, grade="G1", is_deleted=False)
        db.add_all([student, course])
        original = None
        if existing:
            db.add_all([
                XbkStudent(year=year, term=term, student_no="S0", name="Before",
                           class_name="Class 0", grade="G0", is_deleted=False),
                XbkCourse(year=year, term=term, course_code="C0", course_name="Before",
                          quota=3, grade="G0", is_deleted=False),
            ])
            original = XbkSelection(year=year, term=term, student_no="S0", name="Before",
                                    course_code="C0", grade="G0", is_deleted=False)
            db.add(original)
        await db.commit()
        return student.id, course.id, original.id if original else None


def csv_file(rows):
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
    return UploadFile(filename="synthetic.csv", file=io.BytesIO(buffer.getvalue().encode()))


async def write(db, kind, ids, *, year=YEAR, term=TERM, code="C1", skip=False):
    if kind == "import":
        file = csv_file([{"学号": "S1", "课程代码": code, "姓名": "Alice", "年级": "G1"}])
        try:
            return await import_data(scope="selections", year=year, term=term, grade=None,
                                     skip_invalid=skip, file=file, db=db, _={"id": 1})
        finally:
            await file.close()
    payload = XbkSelectionUpsert(year=year, term=term, student_no="S1", course_code=code,
                                name="Alice", grade="G1")
    if kind == "update":
        return await selections.update_selection(ids[2], payload, db, {"id": 1})
    return await selections.create_selection(payload, db, {"id": 1})


async def remove(db, kind, ids, *, year=YEAR, term=TERM):
    if kind == "soft-student":
        return await students.delete_student(ids[0], db, {"id": 1})
    if kind == "soft-course":
        return await courses.delete_course(ids[1], db, {"id": 1})
    return await bulk_ops.delete_data(scope=kind.removeprefix("hard-"), year=year,
                                     term=term, grade="G1", class_name=None, db=db, _={"id": 1})


async def lock_wait(admin, schema, task):
    """Observe PostgreSQL, not elapsed time alone, before releasing transaction 1."""
    for _ in range(200):
        async with admin.connect() as conn:
            rows = (await conn.execute(text(
                "SELECT pid, wait_event, pg_blocking_pids(pid) AS blockers "
                "FROM pg_stat_activity WHERE application_name=:name AND wait_event_type='Lock'"
            ), {"name": schema})).all()
        if rows:
            assert any(row.blockers for row in rows), rows
            print("REAL_PG_LOCK_WAIT", [tuple(row) for row in rows])
            return True
        if task.done():
            return False
        await asyncio.sleep(.01)
    return False


async def assert_no_orphans(engine):
    async with AsyncSession(engine) as db:
        active_students = {(r.year, r.term, r.student_no) for r in
                           (await db.scalars(select(XbkStudent).where(~XbkStudent.is_deleted))).all()}
        active_courses = {(r.year, r.term, r.course_code) for r in
                          (await db.scalars(select(XbkCourse).where(~XbkCourse.is_deleted))).all()}
        rows = (await db.scalars(select(XbkSelection).where(~XbkSelection.is_deleted))).all()
        for row in rows:
            assert (row.year, row.term, row.student_no) in active_students, "active selection has no active student"
            if row.course_code not in ("", "未选"):
                assert (row.year, row.term, row.course_code) in active_courses, "active selection has no active course"
        return rows


async def race(writer, deleter, order):
    async with database() as (engine, admin, schema):
        ids = await seed(engine, existing=writer == "update")
        if writer == "restore":
            async with AsyncSession(engine) as db:
                db.add(XbkSelection(year=YEAR, term=TERM, student_no="S1", course_code="C1",
                                    name="Alice", grade="G1", is_deleted=True))
                await db.commit()
        ready, release = asyncio.Event(), asyncio.Event()

        class HeldCommit(AsyncSession):
            async def commit(self):
                ready.set()
                await asyncio.wait_for(release.wait(), 7)
                await super().commit()

        async def first():
            async with HeldCommit(engine, expire_on_commit=False) as db:
                return await (write(db, writer, ids) if order == "write-first" else remove(db, deleter, ids))

        async def second():
            async with AsyncSession(engine, expire_on_commit=False) as db:
                return await (remove(db, deleter, ids) if order == "write-first" else write(db, writer, ids))

        task1 = asyncio.create_task(first())
        task2 = None
        try:
            await asyncio.wait_for(ready.wait(), 5)
            task2 = asyncio.create_task(second())
            waited = await lock_wait(admin, schema, task2)
        finally:
            release.set()
            results = await asyncio.wait_for(asyncio.gather(
                *[t for t in (task1, task2) if t is not None], return_exceptions=True,
            ), 12)
        # Assert data before the scheduling assertion so old sources expose the
        # actual orphan, rather than just absence of the new lock implementation.
        await assert_no_orphans(engine)
        assert waited, results
        assert not isinstance(results[0], BaseException), results
        if order == "delete-first":
            assert isinstance(results[1], HTTPException), results
            assert results[1].status_code == (422 if writer == "import" else 404)
        else:
            assert not isinstance(results[1], BaseException), results


@pytest.mark.parametrize("writer", ["create", "update", "import", "restore"])
@pytest.mark.parametrize("deleter", ["soft-student", "soft-course", "hard-students", "hard-courses", "hard-all"])
@pytest.mark.parametrize("order", ["write-first", "delete-first"])
def test_selection_parent_delete_two_transactions(writer, deleter, order):
    asyncio.run(race(writer, deleter, order))


@pytest.mark.parametrize("other", [(YEAR, "1"), (YEAR, "下学期"), ("2033-2034", TERM)])
def test_other_period_does_not_wait_or_cascade(other):
    async def case():
        async with database() as (engine, admin, schema):
            ids = await seed(engine)
            other_ids = await seed(engine, year=other[0], term=other[1])
            ready, release = asyncio.Event(), asyncio.Event()

            class HeldCommit(AsyncSession):
                async def commit(self):
                    ready.set()
                    await asyncio.wait_for(release.wait(), 5)
                    await super().commit()

            async def deletion():
                async with HeldCommit(engine, expire_on_commit=False) as db:
                    return await remove(db, "hard-all", ids)

            task = asyncio.create_task(deletion())
            try:
                await asyncio.wait_for(ready.wait(), 4)
                async with AsyncSession(engine, expire_on_commit=False) as db:
                    result = await asyncio.wait_for(write(db, "import", other_ids,
                                                          year=other[0], term=other[1]), 2)
                assert result["processed"] == 1
                assert not task.done()
            finally:
                release.set()
                await asyncio.wait_for(task, 6)
            active = await assert_no_orphans(engine)
            assert [(row.year, row.term) for row in active] == [other]
    asyncio.run(case())


@pytest.mark.parametrize("scope", ["students", "courses", "all"])
def test_bulk_parent_delete_failure_rolls_back_cascade(scope):
    async def case():
        async with database() as (engine, admin, schema):
            ids = await seed(engine)
            async with AsyncSession(engine, expire_on_commit=False) as db:
                await write(db, "create", ids)

            class FailedParentDelete(AsyncSession):
                async def execute(self, statement, *args, **kwargs):
                    if getattr(statement, "is_delete", False) and statement.table.name != "xbk_selections":
                        # Execute real invalid PostgreSQL after child deletion.
                        await super().execute(text("SELECT missing_xbk_rollback_column"))
                    return await super().execute(statement, *args, **kwargs)

            async with FailedParentDelete(engine, expire_on_commit=False) as db:
                with pytest.raises(Exception):
                    await remove(db, "hard-" + scope, ids)
            active = await assert_no_orphans(engine)
            assert len(active) == 1
            async with AsyncSession(engine) as db:
                assert len((await db.scalars(select(XbkStudent))).all()) == 1
                assert len((await db.scalars(select(XbkCourse))).all()) == 1
    asyncio.run(case())


def test_import_late_sql_failure_rolls_back_and_releases_parent_locks():
    async def case():
        async with database() as (engine, admin, schema):
            ids = await seed(engine)
            async with AsyncSession(engine) as db:
                db.add(XbkCourse(year=YEAR, term=TERM, course_code="C2", course_name="Two", quota=1))
                await db.commit()

            class FailedSecondInsert(AsyncSession):
                async def execute(self, statement, *args, **kwargs):
                    if getattr(statement, "is_insert", False) and statement.compile().params.get("course_code") == "C2":
                        await super().execute(text("SELECT missing_xbk_import_column"))
                    return await super().execute(statement, *args, **kwargs)

            file = csv_file([{"学号": "S1", "课程代码": code} for code in ("C1", "C2")])
            try:
                async with FailedSecondInsert(engine, expire_on_commit=False) as db:
                    with pytest.raises(HTTPException) as caught:
                        await import_data(scope="selections", year=YEAR, term=TERM, grade=None,
                                          skip_invalid=True, file=file, db=db, _={"id": 1})
                    assert caught.value.status_code == 409
                    # Keep this Session open: rollback, not context close, must release locks.
                    async with AsyncSession(engine, expire_on_commit=False) as other:
                        await asyncio.wait_for(remove(other, "hard-all", ids), 2)
            finally:
                await file.close()
            assert await assert_no_orphans(engine) == []
    asyncio.run(case())


def test_cached_deleted_parent_is_revalidated_under_lock():
    async def case():
        async with database() as (engine, admin, schema):
            ids = await seed(engine)
            async with AsyncSession(engine, expire_on_commit=False) as writer:
                stale = await writer.get(XbkStudent, ids[0])
                async with AsyncSession(engine, expire_on_commit=False) as db:
                    await remove(db, "soft-student", ids)
                assert stale.is_deleted is False
                with pytest.raises(HTTPException) as caught:
                    await write(writer, "create", ids)
                assert caught.value.status_code == 404
                await writer.rollback()
            assert await assert_no_orphans(engine) == []
    asyncio.run(case())


def test_unselected_does_not_lock_or_require_course():
    async def case():
        async with database() as (engine, admin, schema):
            ids = await seed(engine)
            async with AsyncSession(engine, expire_on_commit=False) as deleting:
                # Real course exclusive row lock, without any student lock.
                await deleting.execute(select(XbkCourse).where(XbkCourse.id == ids[1]).with_for_update())
                async with AsyncSession(engine, expire_on_commit=False) as writing:
                    result = await asyncio.wait_for(write(writing, "import", ids, code="未选"), 2)
                assert result["processed"] == 1
                await remove(deleting, "soft-course", ids)
            assert len(await assert_no_orphans(engine)) == 1
    asyncio.run(case())


@pytest.mark.parametrize("scope", ["students", "courses", "all"])
def test_bulk_cannot_delete_parents_inserted_after_its_cascade(scope):
    """An unfrozen final parent DELETE sees new rows absent from its cascade."""
    async def case():
        async with database() as (engine, admin, schema):
            ids = await seed(engine)
            # Keep one old child so green also executes a child DELETE.
            async with AsyncSession(engine, expire_on_commit=False) as db:
                await write(db, "create", ids)
            ready, release = asyncio.Event(), asyncio.Event()

            class AfterCascade(AsyncSession):
                async def execute(self, statement, *args, **kwargs):
                    result = await super().execute(statement, *args, **kwargs)
                    if getattr(statement, "is_delete", False) and statement.table.name == "xbk_selections":
                        ready.set()
                        await asyncio.wait_for(release.wait(), 6)
                    return result

            async def deletion():
                async with AfterCascade(engine, expire_on_commit=False) as db:
                    return await remove(db, "hard-" + scope, ids)

            task = asyncio.create_task(deletion())
            try:
                await asyncio.wait_for(ready.wait(), 4)
                # Real creation/import paths, not raw writes, form a new pair
                # outside the deleter's locked snapshot but within its filters.
                async with AsyncSession(engine, expire_on_commit=False) as db:
                    for parent_scope, row in (
                        ("students", {"班级": "Class 2", "学号": "S2", "姓名": "Bob", "年级": "G1"}),
                        ("courses", {"课程代码": "C2", "课程名称": "New course", "年级": "G1"}),
                        ("selections", {"学号": "S2", "课程代码": "C2", "年级": "G1"}),
                    ):
                        file = csv_file([row])
                        try:
                            result = await asyncio.wait_for(import_data(
                                scope=parent_scope, year=YEAR, term=TERM, grade=None,
                                skip_invalid=False, file=file, db=db, _={"id": 1},
                            ), 2)
                            assert result["processed"] == 1
                        finally:
                            await file.close()
            finally:
                release.set()
                await asyncio.wait_for(task, 7)
            active = await assert_no_orphans(engine)
            assert [(row.student_no, row.course_code) for row in active] == [("S2", "C2")]
    asyncio.run(case())


@pytest.mark.parametrize("skip", [False, True])
def test_deleted_parent_import_strict_vs_skip_keeps_row_attribution(skip):
    async def case():
        async with database() as (engine, admin, schema):
            ids = await seed(engine)
            async with AsyncSession(engine) as db:
                db.add(XbkStudent(year=YEAR, term=TERM, student_no="S2", name="Bob", class_name="Class 2"))
                await db.commit()
            async with AsyncSession(engine, expire_on_commit=False) as db:
                await remove(db, "soft-student", ids)
            file = csv_file([{"学号": no, "课程代码": "C1"} for no in ("S2", "S1")])
            try:
                async with AsyncSession(engine, expire_on_commit=False) as db:
                    if skip:
                        result = await import_data(scope="selections", year=YEAR, term=TERM, grade=None,
                                                   skip_invalid=True, file=file, db=db, _={"id": 1})
                        assert (result["processed"], result["invalid"]) == (1, 1)
                        assert result["errors"][0]["row"] == 3
                    else:
                        with pytest.raises(HTTPException) as caught:
                            await import_data(scope="selections", year=YEAR, term=TERM, grade=None,
                                              skip_invalid=False, file=file, db=db, _={"id": 1})
                        assert caught.value.status_code == 422
                        assert caught.value.detail["row"] == 3
            finally:
                await file.close()
            active = await assert_no_orphans(engine)
            assert [row.student_no for row in active] == (["S2"] if skip else [])
    asyncio.run(case())


def test_update_rechecks_child_deleted_while_validating_new_parents():
    async def case():
        async with database() as (engine, admin, schema):
            ids = await seed(engine, existing=True)
            ready, release = asyncio.Event(), asyncio.Event()

            class BeforeParents(AsyncSession):
                async def execute(self, statement, *args, **kwargs):
                    if getattr(statement, "is_select", False) and any(
                        table.name == "xbk_students" for table in statement.get_final_froms()
                    ) and not ready.is_set():
                        ready.set()
                        await asyncio.wait_for(release.wait(), 5)
                    return await super().execute(statement, *args, **kwargs)

            async def writing():
                async with BeforeParents(engine, expire_on_commit=False) as db:
                    return await write(db, "update", ids)

            task = asyncio.create_task(writing())
            try:
                await asyncio.wait_for(ready.wait(), 4)
                async with AsyncSession(engine, expire_on_commit=False) as db:
                    original_student = (await db.scalars(select(XbkStudent).where(XbkStudent.student_no == "S0"))).one()
                    await students.delete_student(original_student.id, db, {"id": 1})
            finally:
                release.set()
                result = (await asyncio.wait_for(asyncio.gather(task, return_exceptions=True), 7))[0]
            assert isinstance(result, HTTPException), result
            assert result.status_code == 404
            async with AsyncSession(engine) as db:
                original = await db.get(XbkSelection, ids[2])
                assert original.is_deleted and original.student_no == "S0"
            assert await assert_no_orphans(engine) == []
    asyncio.run(case())


def test_parent_lock_order_spans_batches_and_reverse_file_rows():
    async def case():
        async with database() as (engine, admin, schema):
            # Reverse IDs relative to natural-key/file order, across the 500-row boundary.
            async with AsyncSession(engine) as db:
                db.add_all([XbkStudent(year=YEAR, term=TERM, student_no=f"S{i:04}",
                                      name=f"Student {i}", class_name="Class 1") for i in range(502, 0, -1)])
                db.add(XbkCourse(year=YEAR, term=TERM, course_code="C1", course_name="Course", quota=1))
                await db.commit()
            locked_ids = {"xbk_students": [], "xbk_courses": [], "xbk_selections": []}
            tables = []

            class ObserveLocks(AsyncSession):
                async def execute(self, statement, *args, **kwargs):
                    if getattr(statement, "_for_update_arg", None) is not None:
                        result = await super().execute(statement, *args, **kwargs)
                        frozen = result.freeze()
                        rows = frozen().scalars().all()
                        if rows:
                            table = rows[0].__table__.name
                            tables.append(table)
                            locked_ids[table].extend(row.id for row in rows)
                        return frozen()
                    return await super().execute(statement, *args, **kwargs)

            file = csv_file([{"学号": f"S{i:04}", "课程代码": "C1"} for i in range(1, 503)])
            try:
                async with ObserveLocks(engine, expire_on_commit=False) as db:
                    result = await import_data(scope="selections", year=YEAR, term=TERM, grade=None,
                                               skip_invalid=False, file=file, db=db, _={"id": 1})
                assert result["processed"] == 502
            finally:
                await file.close()
            assert len(locked_ids["xbk_students"]) == 502
            assert locked_ids["xbk_students"] == sorted(locked_ids["xbk_students"])
            assert tables == ["xbk_students", "xbk_students", "xbk_courses"]
            assert len(await assert_no_orphans(engine)) == 502
    asyncio.run(case())


@pytest.mark.parametrize("skip", [False, True])
def test_invalid_import_releases_preflight_locks_before_session_close(skip):
    async def case():
        async with database() as (engine, admin, schema):
            ids = await seed(engine)
            file = csv_file([{"学号": "S1", "课程代码": "missing"}])
            try:
                async with AsyncSession(engine, expire_on_commit=False) as held:
                    if skip:
                        result = await import_data(scope="selections", year=YEAR, term=TERM, grade=None,
                                                   skip_invalid=True, file=file, db=held, _={})
                        assert result["processed"] == 0 and result["invalid"] == 1
                    else:
                        with pytest.raises(HTTPException) as caught:
                            await import_data(scope="selections", year=YEAR, term=TERM, grade=None,
                                              skip_invalid=False, file=file, db=held, _={})
                        assert caught.value.status_code == 422
                    assert not held.in_transaction()
                    async with AsyncSession(engine, expire_on_commit=False) as other:
                        await asyncio.wait_for(students.delete_student(ids[0], other, {}), 3)
            finally:
                await file.close()
            assert await assert_no_orphans(engine) == []
    asyncio.run(case())


def test_frozen_parent_membership_exceeds_asyncpg_bind_limit():
    from app.services.xbk.locking import frozen_id_condition

    async def case():
        async with database() as (engine, admin, schema):
            ids = await seed(engine)
            # Real PG query, >32767 frozen integer IDs without >32767 binds.
            async with AsyncSession(engine) as db:
                rows = (await db.scalars(select(XbkStudent.id).where(
                    frozen_id_condition(XbkStudent, [ids[0], *range(100000, 133000)]),
                ))).all()
                assert rows == [ids[0]]
    asyncio.run(case())
