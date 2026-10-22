"""KNN contracts on disposable PostgreSQL, never ordinary settings or conftest.

Use only a reviewed external bootstrap that disables dotenv/secrets, clears the
environment and restricts network to its dedicated PostgreSQL before importing
this module. The opt-in below is an additional guard, not isolation by itself.
"""
import asyncio
import csv
from datetime import datetime, timedelta, timezone
import importlib.util
import io
import os
from pathlib import Path
import unittest
from unittest.mock import patch
from uuid import uuid4
from urllib.parse import urlparse

if os.environ.get("KNN_ISOLATED_TEST") != "1":
    raise unittest.SkipTest("requires a reviewed isolated KNN PostgreSQL runner")
TEST_URL = os.environ.get("TEST_DATABASE_URL", "")
_parsed = urlparse(TEST_URL)
if (_parsed.scheme != "postgresql+asyncpg" or _parsed.hostname != "127.0.0.1"
        or _parsed.path != "/knn_collection_test" or _parsed.port != 5432):
    raise RuntimeError("KNN tests require the dedicated disposable PostgreSQL database")

from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import FastAPI, HTTPException, Request
import httpx
from pydantic import ValidationError
from sqlalchemy import inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.endpoints.it.knn import admin_router, router
from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.it.knn import KnnBatch, KnnRosterEntry, KnnSubmission
from app.schemas.it.knn import BatchCreate, BatchUpdate, Freeze, Refill, Submit, student_key
from app.services.it import knn, knn_common, knn_exports

TEACHER = {"id": 1, "role_code": "teacher"}
OTHER = {"id": 2, "role_code": "teacher"}
ADMIN = {"id": 3, "role_code": "admin"}
# 六类运动的每周参与天数（教学设计只采集天数）。
FEATURES = [3, 2, 4, 1, 5, 3]
MIGRATION_PATH = Path(__file__).resolve().parents[2] / "alembic/versions/20261020_0001_knn_collection.py"


def configuration(numbers=None, **changes):
    clock = datetime.now(timezone.utc)
    values = {"title": "合成测试班级", "starts_at": clock - timedelta(hours=1),
              "ends_at": clock + timedelta(hours=2)}
    if numbers is not None:
        values["student_numbers"] = numbers
    values.update(changes)
    return BatchCreate(**values)


def submission(number="1", revision=0, **changes):
    values = {"student_no": number, "request_id": str(uuid4()), "expected_revision": revision,
              "features": FEATURES, "label": "耐力类", "display_consent": False}
    values.update(changes)
    return Submit(**values)


class ContractTests(unittest.TestCase):
    def test_default_roster_and_number_identity(self):
        self.assertEqual(configuration().student_numbers, [str(n) for n in range(1, 66)])
        self.assertEqual(student_key(" 001 "), "1")
        self.assertEqual(student_key("a01"), student_key("A01"))
        self.assertNotEqual(student_key("A01"), student_key("A1"))
        for numbers in [["01", "1"], ["a1", "A1"], ["中文"], ["=A1"], []]:
            with self.subTest(numbers=numbers), self.assertRaises(ValidationError):
                configuration(numbers)

    def test_strict_features_consent_and_extra_fields(self):
        for changes in [{"features": FEATURES[:-1]}, {"features": FEATURES + [1]},
                        {"features": [True] + FEATURES[1:]}, {"features": [8] + FEATURES[1:]},
                        {"features": [1.0] + FEATURES[1:]}, {"display_consent": "false"},
                        {"expected_revision": True}, {"unknown": 1}, {"label": "其他"}]:
            with self.subTest(changes=changes), self.assertRaises(ValidationError):
                submission(**changes)

    def test_time_and_title_validation(self):
        for changes in [{"title": "  "}, {"starts_at": datetime.now()},
                        {"ends_at": datetime.now()}, {"ends_at": datetime.now(timezone.utc) - timedelta(days=2)}]:
            with self.subTest(changes=changes), self.assertRaises(ValidationError):
                configuration(**changes)


class PostgreSQLTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.schema = "knn_test_" + uuid4().hex
        self.control = create_async_engine(TEST_URL)
        async with self.control.begin() as connection:
            await connection.execute(text(f'CREATE SCHEMA "{self.schema}"'))
        self.engine = create_async_engine(TEST_URL, connect_args={"server_settings": {"search_path": self.schema}})
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False, autoflush=False)
        migration_spec = importlib.util.spec_from_file_location("knn_migration", MIGRATION_PATH)
        self.migration = importlib.util.module_from_spec(migration_spec)
        migration_spec.loader.exec_module(self.migration)
        async with self.engine.begin() as connection:
            await connection.execute(text("CREATE TABLE sys_users (id integer PRIMARY KEY)"))
            await connection.execute(text("INSERT INTO sys_users VALUES (1), (2), (3)"))
            await connection.run_sync(self.run_migration, "upgrade")

    def run_migration(self, connection, direction):
        with Operations.context(MigrationContext.configure(connection)):
            getattr(self.migration, direction)()

    async def asyncTearDown(self):
        await self.engine.dispose()
        async with self.control.begin() as connection:
            await connection.execute(text(f'DROP SCHEMA "{self.schema}" CASCADE'))
        await self.control.dispose()

    async def create(self, numbers=None, open_batch=True, **changes):
        async with self.sessions() as db:
            data = await knn.create_batch(db, configuration(numbers, **changes), TEACHER)
            if open_batch:
                data = await knn.change_state(db, data["id"], "schedule", TEACHER)
            return data

    async def answer(self, batch_id, data=None):
        async with self.sessions() as db:
            return await knn.submit(db, batch_id, data or submission())

    async def refill(self, batch_id, numbers=None, allowed=True):
        async with self.sessions() as db:
            return await knn.allow_refill(db, batch_id, Refill(student_numbers=numbers or ["1"], allowed=allowed), TEACHER)

    async def count_answers(self):
        async with self.sessions() as db:
            return len((await db.scalars(select(KnnSubmission))).all())

    async def test_migration_constraints_downgrade_upgrade(self):
        self.assertEqual(self.migration.down_revision, "f1a2b3c4d5e6")
        async with self.engine.begin() as connection:
            tables = await connection.run_sync(lambda c: inspect(c).get_table_names())
            self.assertEqual(set(tables), {"sys_users", "it_knn_batches", "it_knn_roster", "it_knn_submissions"})
            uniques = await connection.run_sync(lambda c: inspect(c).get_unique_constraints("it_knn_submissions"))
            self.assertEqual({u["name"] for u in uniques}, {"uq_knn_submission_revision", "uq_knn_submission_request"})
            await connection.run_sync(self.run_migration, "downgrade")
            self.assertEqual(await connection.run_sync(lambda c: inspect(c).get_table_names()), ["sys_users"])
            await connection.run_sync(self.run_migration, "upgrade")
        data = await self.create()
        self.assertEqual((data["expected"], data["submitted"], data["missing"]), (65, 0, 65))

    async def test_database_rejects_invalid_window_and_duplicate_roster(self):
        data = await self.create(["1"])
        async with self.sessions() as db:
            with self.assertRaises(IntegrityError):
                await db.execute(text("UPDATE it_knn_batches SET ends_at = starts_at WHERE id = :id"), {"id": data["id"]})
            await db.rollback()
            db.add(KnnRosterEntry(batch_id=data["id"], student_no="01", student_key="1", position=2, current_revision=0))
            with self.assertRaises(IntegrityError):
                await db.commit()
            await db.rollback()

    async def test_phase_exact_start_end_and_early_close(self):
        data = await self.create(["1"])
        async with self.sessions() as db:
            batch = await knn_common.get_batch(db, data["id"])
            for clock, expected in [(batch.starts_at - timedelta(microseconds=1), "scheduled"),
                                    (batch.starts_at, "open"), (batch.ends_at - timedelta(microseconds=1), "open"),
                                    (batch.ends_at, "ended")]:
                with patch.object(knn_common, "now", return_value=clock):
                    self.assertEqual(knn_common.phase(batch), expected)
            await knn.change_state(db, data["id"], "close", TEACHER)
        with self.assertRaises(HTTPException) as denied:
            await self.answer(data["id"])
        self.assertEqual(denied.exception.status_code, 409)

    async def test_future_and_draft_block_submission(self):
        clock = datetime.now(timezone.utc)
        for open_batch, starts_at in [(False, clock - timedelta(hours=1)), (True, clock + timedelta(hours=1))]:
            batch = await self.create(["1"], open_batch=open_batch, starts_at=starts_at)
            with self.assertRaises(HTTPException) as denied:
                await self.answer(batch["id"])
            self.assertEqual(denied.exception.status_code, 409)
        self.assertEqual(await self.count_answers(), 0)

    async def test_parallel_submissions_serialize_and_reject_duplicate(self):
        batch = await self.create(["1"])
        results = await asyncio.gather(self.answer(batch["id"]), self.answer(batch["id"]), return_exceptions=True)
        self.assertEqual(sum(isinstance(r, dict) for r in results), 1)
        errors = [r for r in results if isinstance(r, HTTPException)]
        self.assertEqual([e.status_code for e in errors], [409])
        self.assertEqual(await self.count_answers(), 1)

    async def test_parallel_identical_request_replays_receipt(self):
        batch = await self.create(["1"])
        data = submission()
        results = await asyncio.gather(self.answer(batch["id"], data), self.answer(batch["id"], data))
        self.assertEqual(results[0], results[1])
        self.assertEqual(await self.count_answers(), 1)
        changed = data.model_copy(update={"label": "力量类"})
        with self.assertRaises(HTTPException) as denied:
            await self.answer(batch["id"], changed)
        self.assertEqual(denied.exception.status_code, 409)

    async def test_cancel_while_waiting_for_batch_lock_rolls_back_and_can_retry(self):
        batch = await self.create(["1"])
        async with self.sessions() as blocker, self.sessions() as db:
            await knn_common.get_batch(blocker, batch["id"], lock=True)
            pid = await db.scalar(text("SELECT pg_backend_pid()"))
            task = asyncio.create_task(knn.submit(db, batch["id"], submission()))
            try:
                async with self.engine.connect() as observer:
                    for _ in range(100):
                        waiting = await observer.scalar(text("SELECT wait_event_type = 'Lock' FROM pg_stat_activity WHERE pid = :pid"), {"pid": pid})
                        await observer.commit()
                        if waiting:
                            break
                        await asyncio.sleep(0.01)
                    else:
                        self.fail("submission did not actually wait for the PostgreSQL parent lock")
                task.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await task
                self.assertFalse(db.in_transaction())
                await blocker.rollback()
                result = await knn.submit(db, batch["id"], submission())
                self.assertEqual(result["revision"], 1)
                self.assertEqual(await self.count_answers(), 1)
            finally:
                if not task.done():
                    task.cancel()
                    await asyncio.gather(task, return_exceptions=True)
                await blocker.rollback()

    async def test_public_list_omits_drafts_closed_and_expired(self):
        live = await self.create(["1"])
        await self.create(["1"], open_batch=False)
        closed = await self.create(["1"])
        async with self.sessions() as db:
            await knn.change_state(db, closed["id"], "close", TEACHER)
        expired = await self.create(["1"], starts_at=datetime.now(timezone.utc) - timedelta(hours=2))
        async with self.sessions() as db:
            batch = await knn_common.get_batch(db, expired["id"])
            batch.ends_at = datetime.now(timezone.utc) - timedelta(hours=1)
            await db.commit()
            public = await knn.list_batches(db)
            self.assertEqual([b["id"] for b in public], [live["id"]])
            self.assertTrue(all(set(b) == {"id", "title", "starts_at", "ends_at", "phase"} for b in public))

    async def test_refill_preserves_history_and_old_replay_does_not_consume_grant(self):
        batch = await self.create(["1"])
        original = submission()
        first = await self.answer(batch["id"], original)
        await self.refill(batch["id"])
        self.assertEqual(await self.answer(batch["id"], original), first)
        async with self.sessions() as db:
            checked = await knn.check_student(db, batch["id"], "01")
            self.assertTrue(checked["refill_allowed"])
        second = await self.answer(batch["id"], submission(revision=1, label="力量类"))
        self.assertEqual(second["revision"], 2)
        async with self.sessions() as db:
            history = await knn.history(db, batch["id"], "1", TEACHER)
            self.assertEqual([a["revision"] for a in history["answers"]], [2, 1])
            self.assertEqual([a["label"] for a in history["answers"]], ["力量类", "耐力类"])
            self.assertFalse((await knn.check_student(db, batch["id"], "1"))["can_submit"])
            await knn.change_state(db, batch["id"], "close", TEACHER)
        self.assertEqual(await self.answer(batch["id"], original), first)
        self.assertEqual(await self.count_answers(), 2)

    async def test_stale_revision_and_revoked_refill_rejected(self):
        batch = await self.create(["1"])
        await self.answer(batch["id"])
        await self.refill(batch["id"])
        with self.assertRaises(HTTPException):
            await self.answer(batch["id"], submission(revision=0))
        await self.refill(batch["id"], allowed=False)
        with self.assertRaises(HTTPException):
            await self.answer(batch["id"], submission(revision=1))
        self.assertEqual(await self.count_answers(), 1)

    async def test_bulk_refill_atomic_and_submitted_removal_rollback(self):
        batch = await self.create(["1", "2"])
        await self.answer(batch["id"])
        with self.assertRaises(HTTPException):
            await self.refill(batch["id"], ["1", "2"])
        async with self.sessions() as db:
            self.assertFalse((await knn.check_student(db, batch["id"], "1"))["refill_allowed"])
            with self.assertRaises(HTTPException):
                await knn.update_batch(db, batch["id"], BatchUpdate(**configuration(["2"]).model_dump()), TEACHER)
            detail = await knn_common.details(db, await knn_common.get_batch(db, batch["id"]))
            self.assertEqual([r["student_no"] for r in detail["rows"]], ["1", "2"])
            self.assertEqual(detail["submitted"], 1)

    async def test_unknown_student_and_teacher_ownership(self):
        batch = await self.create(["1"])
        async with self.sessions() as db:
            for function in [lambda: knn.check_student(db, batch["id"], "999"),
                             lambda: knn_common.get_batch(db, batch["id"], OTHER)]:
                with self.assertRaises(HTTPException):
                    await function()
            self.assertEqual((await knn.list_batches(db, OTHER)), [])
            self.assertEqual(len(await knn.list_batches(db, ADMIN)), 1)
            self.assertEqual((await knn_common.get_batch(db, batch["id"], ADMIN)).id, batch["id"])

    async def test_delete_allowed_except_while_collecting(self):
        # 草稿、待开始、已结束都允许连同名单与答案一并删除。
        draft = await self.create(["1"], open_batch=False)
        async with self.sessions() as db:
            self.assertEqual(await knn.delete_batch(db, draft["id"], TEACHER), {"ok": True})
            with self.assertRaises(HTTPException) as missing:
                await knn_common.get_batch(db, draft["id"])
            self.assertEqual(missing.exception.status_code, 404)

        # 已有提交的已结束批次同样可以删除，级联清理名单与答案。
        finished = await self.create(["1", "2"])
        await self.answer(finished["id"], submission("1"))
        async with self.sessions() as db:
            await knn.change_state(db, finished["id"], "close", TEACHER)
        async with self.sessions() as db:
            self.assertEqual(await knn.delete_batch(db, finished["id"], TEACHER), {"ok": True})
            with self.assertRaises(HTTPException):
                await knn_common.get_batch(db, finished["id"])

        # 采集中禁止删除。
        opened = await self.create(["1"])
        async with self.sessions() as db:
            with self.assertRaises(HTTPException) as busy:
                await knn.delete_batch(db, opened["id"], TEACHER)
            self.assertEqual(busy.exception.status_code, 409)

    async def test_freeze_requires_four_and_consent_then_stays_immutable(self):
        batch = await self.create(["1", "2", "3", "4"])
        async with self.sessions() as db:
            with self.assertRaises(HTTPException):
                await knn_exports.freeze(db, batch["id"], Freeze(), TEACHER)
        for number in ["1", "2", "3", "4"]:
            await self.answer(batch["id"], submission(number))
        async with self.sessions() as db:
            with self.assertRaises(HTTPException):
                await knn_exports.freeze(db, batch["id"], Freeze(), TEACHER)
        await self.refill(batch["id"])
        await self.answer(batch["id"], submission(revision=1, display_consent=True))
        async with self.sessions() as db:
            snapshot = await knn_exports.freeze(db, batch["id"], Freeze(a_student_no="01"), TEACHER)
            self.assertEqual(set(snapshot), {"version", "aId", "students"})
            self.assertEqual(snapshot["aId"], "S01")
            self.assertEqual(len(snapshot["students"]), 4)
            self.assertTrue(all(set(s) == {"id", "label", "features"} for s in snapshot["students"]))
            with self.assertRaises(HTTPException):
                await knn_exports.freeze(db, batch["id"], Freeze(), TEACHER)
        await self.refill(batch["id"])
        await self.answer(batch["id"], submission(revision=2, label="技巧类"))
        async with self.sessions() as db:
            self.assertEqual(await knn_exports.frozen(db, batch["id"], TEACHER), snapshot)
            self.assertEqual(snapshot["students"][0]["label"], "耐力类")

    async def test_csv_missing_and_latest_revision(self):
        batch = await self.create(["1", "2"])
        await self.answer(batch["id"])
        await self.refill(batch["id"])
        await self.answer(batch["id"], submission(revision=1, label="力量类"))
        async with self.sessions() as db:
            content = await knn_exports.export_csv(db, batch["id"], TEACHER)
        self.assertTrue(content.startswith("\ufeff"))
        rows = list(csv.reader(io.StringIO(content.lstrip("\ufeff"))))
        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[1][0:4], ["1", "已提交", "2", "否"])
        self.assertEqual(rows[1][16], "力量类")
        self.assertEqual(rows[2][0:4], ["2", "未提交", "0", "否"])
        for dangerous in ["=SUM(1)", "+1", "-1", "@x", "\t=x"]:
            self.assertTrue(knn_exports.csv_cell(dangerous).startswith("'"))

    async def test_asgi_anonymous_collection_staff_roles_and_public_shape(self):
        batch = await self.create(["1"])
        app = FastAPI()
        app.include_router(router)
        app.include_router(admin_router)

        async def database():
            async with self.sessions() as db:
                yield db

        async def identity(request: Request):
            role = request.headers.get("x-test-role")
            if not role:
                raise HTTPException(401, "synthetic unauthenticated")
            return {"id": 2 if role == "teacher" else 3, "role_code": role}

        app.dependency_overrides[get_db] = database
        app.dependency_overrides[get_current_user] = identity
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://isolated.test") as client:
            public = await client.get(f"/it/knn/batches/{batch['id']}")
            self.assertEqual(public.status_code, 200)
            self.assertEqual(public.headers["cache-control"], "no-store")
            self.assertEqual(set(public.json()), {"id", "title", "starts_at", "ends_at", "phase"})
            checked = await client.post(f"/it/knn/batches/{batch['id']}/check", json={"student_no": "01"})
            self.assertTrue(checked.json()["can_submit"])
            self.assertNotIn("answer", checked.json())
            submitted = await client.post(f"/it/knn/batches/{batch['id']}/submissions", json=submission().model_dump(mode="json"))
            self.assertEqual(submitted.status_code, 201)
            self.assertEqual(set(submitted.json()), {"student_no", "revision", "submitted_at"})
            for role, expected in [(None, 401), ("student", 403), ("teacher", 403), ("admin", 200), ("super_admin", 200)]:
                response = await client.get(f"/admin/it/knn/batches/{batch['id']}", headers={"x-test-role": role} if role else {})
                self.assertEqual(response.status_code, expected, role)
            protected = [
                ("GET", "/admin/it/knn/batches", None),
                ("POST", "/admin/it/knn/batches", configuration().model_dump(mode="json")),
                ("PUT", f"/admin/it/knn/batches/{batch['id']}", configuration(["1"]).model_dump(mode="json")),
                ("DELETE", f"/admin/it/knn/batches/{batch['id']}", None),
                ("POST", f"/admin/it/knn/batches/{batch['id']}/state", {"action": "close"}),
                ("POST", f"/admin/it/knn/batches/{batch['id']}/refill", {"student_numbers": ["1"]}),
                ("GET", f"/admin/it/knn/batches/{batch['id']}/history/1", None),
                ("GET", f"/admin/it/knn/batches/{batch['id']}/export.csv", None),
                ("POST", f"/admin/it/knn/batches/{batch['id']}/freeze", {}),
                ("GET", f"/admin/it/knn/batches/{batch['id']}/frozen", None),
            ]
            for method, path, body in protected:
                for role, expected in [(None, 401), ("student", 403)]:
                    response = await client.request(method, path, json=body, headers={"x-test-role": role} if role else {})
                    self.assertEqual(response.status_code, expected, (method, path, role))
            malformed = await client.post(f"/it/knn/batches/{batch['id']}/submissions", json={})
            self.assertEqual(malformed.status_code, 422)


if __name__ == "__main__":
    unittest.main()
