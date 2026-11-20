"""Measure real refill SQL on in-memory SQLite under the offline test bootstrap."""
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import event
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models import User
from app.models.it.knn import KnnBatch, KnnRosterEntry, KnnSubmission
from app.schemas.it.knn import Freeze, Refill, student_key
from app.services.it import knn, knn_common, knn_exports


TEACHER = {"id": 1, "role_code": "teacher"}
BATCH_ID = "knn-refill-fixture"
CLOCK = datetime(2032, 6, 1, 10)
NUMBERS = ["Ab-01", *(f"{n:03d}" for n in range(65, 1, -1))]


class RefillQueryTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        self.addAsyncCleanup(engine.dispose)
        self.sessions = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
        self.selects = []

        @event.listens_for(engine.sync_engine, "before_cursor_execute")
        def capture(_conn, _cursor, statement, _parameters, _context, _many):
            sql = " ".join(statement.split())
            if sql.startswith("SELECT "):
                self.selects.append(sql)

        async with engine.begin() as conn:
            await conn.exec_driver_sql("PRAGMA foreign_keys=ON")
            tables = [User.__table__, KnnBatch.__table__, KnnRosterEntry.__table__, KnnSubmission.__table__]
            await conn.run_sync(lambda sync_conn: KnnBatch.metadata.create_all(sync_conn, tables=tables))
            await conn.execute(User.__table__.insert().values(id=1, full_name="合成教师", role_code="teacher"))
            await conn.execute(KnnBatch.__table__.insert().values(
                id=BATCH_ID, title="合成班级", created_by=1, state="closed", created_at=CLOCK,
                starts_at=CLOCK - timedelta(hours=1), ends_at=CLOCK,
            ))
            # Insert backwards so ordering by the stored position is observable.
            roster = [dict(id=len(NUMBERS) - position, batch_id=BATCH_ID, student_no=number,
                           student_key=student_key(number), position=position,
                           current_revision=2 if position == 0 else 1)
                      for position, number in reversed(list(enumerate(NUMBERS)))]
            await conn.execute(KnnRosterEntry.__table__.insert(), roster)
            answers = [dict(roster_id=entry["id"], revision=entry["current_revision"],
                            request_id=f"fixture-current-{entry['id']}", payload_hash="0" * 64,
                            features=[6, 3, 7, 1, 4, 2], label="力量类", display_consent=True,
                            submitted_at=CLOCK) for entry in roster]
            answers.append(dict(roster_id=len(NUMBERS), revision=1, request_id="fixture-old",
                                payload_hash="0" * 64, features=[1, 0, 2, 0, 3, 0], label="耐力类",
                                display_consent=False, submitted_at=CLOCK - timedelta(minutes=1)))
            await conn.execute(KnnSubmission.__table__.insert(), answers)
        async with self.sessions() as db:
            with patch.object(knn_exports, "now", return_value=CLOCK):
                self.snapshot = await knn_exports.freeze(db, BATCH_ID, Freeze(), TEACHER)

    async def read_detail(self, db):
        return await knn_common.details(db, await knn_common.get_batch(db, BATCH_ID, TEACHER))

    async def check_refill_queries(self, numbers):
        targets = {student_key(number) for number in numbers}
        async with self.sessions() as db:
            original = await self.read_detail(db)
        self.assertEqual((original["expected"], original["submitted"], original["missing"]), (65, 65, 0))
        self.assertEqual([row["student_no"] for row in original["rows"]], NUMBERS)
        self.assertEqual((original["rows"][0]["answer"]["revision"], original["rows"][0]["answer"]["label"]),
                         (2, "力量类"))

        counts = []
        for allowed in (True, False):
            async with self.sessions() as db:
                self.selects.clear()
                result = await knn.allow_refill(db, BATCH_ID, Refill(student_numbers=numbers, allowed=allowed), TEACHER)
                roster_reads = sum(" FROM it_knn_roster " in sql for sql in self.selects)
                answer_reads = sum(" FROM it_knn_submissions " in sql for sql in self.selects)
                counts.append((roster_reads, answer_reads))
                print(f"KNN roster={len(NUMBERS)} targets={len(numbers)} allowed={allowed}: "
                      f"roster SELECTs={roster_reads}, current-answer SELECTs={answer_reads}")
            expected_rows = [dict(row, refill_allowed=allowed and student_key(row["student_no"]) in targets)
                             for row in original["rows"]]
            self.assertEqual(result, dict(original, rows=expected_rows, pending_refill=len(numbers) if allowed else 0))
            async with self.sessions() as db:
                self.assertEqual(await self.read_detail(db), result)
                self.assertEqual(await knn_exports.frozen(db, BATCH_ID, TEACHER), self.snapshot)
                history = await knn.history(db, BATCH_ID, "ab-01", TEACHER)
                self.assertEqual([(a["revision"], a["label"]) for a in history["answers"]], [(2, "力量类"), (1, "耐力类")])
        self.assertEqual(counts, [(1, 1), (1, 1)])

    async def test_single_refill_reads_roster_once(self):
        await self.check_refill_queries([" ab-01 "])

    async def test_whole_class_refill_reads_roster_once(self):
        await self.check_refill_queries([student_key(number) for number in reversed(NUMBERS)])

    async def test_invalid_target_rolls_back_without_partial_grant(self):
        async with self.sessions() as db:
            db.add(KnnRosterEntry(batch_id=BATCH_ID, student_no="001", student_key="1", position=len(NUMBERS)))
            await db.commit()
        async with self.sessions() as db:
            for numbers, status in [(["ab-01", "1"], 409), (["ab-01", "1", "absent"], 404)]:
                with self.assertRaises(HTTPException) as denied:
                    await knn.allow_refill(db, BATCH_ID, Refill(student_numbers=numbers), TEACHER)
                self.assertEqual(denied.exception.status_code, status)
                self.assertFalse(db.in_transaction())
        async with self.sessions() as db:
            self.assertEqual((await self.read_detail(db))["pending_refill"], 0)

    async def test_commit_error_rolls_back_flushed_grant(self):
        async with self.sessions() as db:
            async def reject_commit():
                await db.flush()
                raise RuntimeError("synthetic commit failure")

            data = Refill(student_numbers=["ab-01"])
            with patch.object(db, "commit", reject_commit):
                with self.assertRaisesRegex(RuntimeError, "synthetic commit failure"):
                    await knn.allow_refill(db, BATCH_ID, data, TEACHER)
            self.assertFalse(db.in_transaction())
            self.assertEqual((await self.read_detail(db))["pending_refill"], 0)
            self.assertEqual((await knn.allow_refill(db, BATCH_ID, data, TEACHER))["pending_refill"], 1)
