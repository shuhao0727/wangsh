"""Synthetic SQLite semantics for the XBK R1/R2 application-layer contract.

SQLite is used only for deterministic final-state and guard behavior.  It does
not prove PostgreSQL row-lock waiting or concurrent-writer exclusion.
"""

import asyncio
import csv
import io

import pytest
from fastapi import HTTPException, UploadFile
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.api.endpoints.xbk import courses, import_export, selections, students
from app.api.endpoints.xbk.import_export import import_data
from app.models import XbkCourse, XbkSelection, XbkStudent
from app.schemas.xbk import XbkCourseUpsert, XbkSelectionUpsert, XbkStudentUpsert
from app.services.xbk.selection_rules import SelectionMutation, apply_selection_mutations

YEAR, TERM = "2036-2037", "上学期"


class MemoryDb:
    def __init__(self, session):
        self.session = session

    async def execute(self, statement):
        return self.session.execute(statement)

    def add(self, row):
        self.session.add(row)

    async def flush(self):
        self.session.flush()

    async def commit(self):
        self.session.commit()

    async def rollback(self):
        self.session.rollback()

    async def refresh(self, row):
        self.session.refresh(row)


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    for model in (XbkStudent, XbkCourse, XbkSelection):
        model.__table__.create(engine)
    with Session(engine, expire_on_commit=False) as session:
        yield MemoryDb(session)
    engine.dispose()


def roster(no, class_name, *, grade="高一", deleted=False):
    return XbkStudent(
        year=YEAR, term=TERM, grade=grade, class_name=class_name,
        student_no=no, name=no, is_deleted=deleted,
    )


def catalog(code, quota, *, deleted=False):
    return XbkCourse(
        year=YEAR, term=TERM, grade="高一", course_code=code,
        course_name=code, quota=quota, is_deleted=deleted,
    )


def choice(no, code, *, deleted=False):
    return XbkSelection(
        year=YEAR, term=TERM, grade="快照年级", student_no=no,
        name=no, course_code=code, is_deleted=deleted,
    )


def payload(no, code):
    return XbkSelectionUpsert(
        year=YEAR, term=TERM, grade="快照年级", student_no=no,
        name=no, course_code=code,
    )


def seed(db, *rows):
    db.session.add_all(rows)
    db.session.commit()


def csv_upload(rows):
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
    return UploadFile(filename="synthetic.csv", file=io.BytesIO(out.getvalue().encode()))


def active(db):
    return db.session.scalars(select(XbkSelection).where(~XbkSelection.is_deleted).order_by(XbkSelection.student_no)).all()


def test_capacity_is_per_live_roster_grade_and_class_not_cross_class_total(db):
    seed(db, roster("S1", "1班"), roster("S2", "2班"), catalog("C1", 1), choice("S1", "C1"))

    result = asyncio.run(selections.create_selection(payload("S2", "C1"), db, {}))

    assert result["student_no"] == "S2"
    assert [(row.student_no, row.course_code) for row in active(db)] == [("S1", "C1"), ("S2", "C1")]


def test_full_target_class_is_rejected_and_transaction_rolls_back(db):
    seed(db, roster("S1", "1班"), roster("S2", "1班"), catalog("C1", 1), choice("S1", "C1"))

    with pytest.raises(HTTPException) as caught:
        asyncio.run(selections.create_selection(payload("S2", "C1"), db, {}))

    assert caught.value.status_code == 409
    assert "1班" in caught.value.detail
    assert [(row.student_no, row.course_code) for row in active(db)] == [("S1", "C1")]


def test_manual_create_cannot_add_second_active_position(db):
    seed(db, roster("S1", "1班"), catalog("C1", 2), catalog("C2", 2), choice("S1", "C1"))

    with pytest.raises(HTTPException) as caught:
        asyncio.run(selections.create_selection(payload("S1", "C2"), db, {}))

    assert caught.value.status_code == 409
    assert caught.value.detail == "每名学生只能选择一门课程"


def test_update_reuses_single_position_and_checks_final_collection(db):
    original = choice("S1", "C1")
    seed(db, roster("S1", "1班"), catalog("C1", 1), catalog("C2", 1), original)

    result = asyncio.run(selections.update_selection(original.id, payload("S1", "C2"), db, {}))

    assert result["id"] == original.id
    assert [(row.student_no, row.course_code) for row in active(db)] == [("S1", "C2")]


def test_soft_deleted_exact_selection_is_restored_through_shared_service(db):
    deleted = choice("S1", "C1", deleted=True)
    seed(db, roster("S1", "1班"), catalog("C1", 1), deleted)

    result = asyncio.run(selections.create_selection(payload("S1", "C1"), db, {}))

    assert result["id"] == deleted.id
    assert deleted.is_deleted is False


def test_selection_import_replaces_existing_position_instead_of_creating_second_active_row(db):
    original = choice("S1", "C1")
    seed(db, roster("S1", "1班"), catalog("C1", 1), catalog("C2", 1), original)
    upload = csv_upload([{"学号": "S1", "课程代码": "C2", "姓名": "S1"}])

    async def run():
        try:
            return await import_data("selections", YEAR, TERM, None, False, upload, db, {})
        finally:
            await upload.close()

    result = asyncio.run(run())
    assert result["processed"] == result["updated"] == 1
    assert result["inserted"] == 0
    assert [(row.id, row.course_code) for row in active(db)] == [(original.id, "C2")]


def test_selection_import_rejects_two_final_rows_for_same_student_atomically(db):
    seed(db, roster("S1", "1班"), catalog("C1", 2), catalog("C2", 2))
    upload = csv_upload([
        {"学号": "S1", "课程代码": "C1"},
        {"学号": "S1", "课程代码": "C2"},
    ])

    async def run():
        try:
            return await import_data("selections", YEAR, TERM, None, True, upload, db, {})
        finally:
            await upload.close()

    with pytest.raises(HTTPException) as caught:
        asyncio.run(run())
    assert caught.value.status_code == 409
    assert active(db) == []


def test_student_natural_key_change_rejected_even_for_soft_deleted_history(db):
    student = roster("S1", "1班")
    seed(db, student, choice("S1", "C1", deleted=True))
    changed = XbkStudentUpsert(
        year=YEAR, term=TERM, grade="高一", class_name="1班",
        student_no="S1-NEW", name="S1", gender=None,
    )

    with pytest.raises(HTTPException) as caught:
        asyncio.run(students.update_student(student.id, changed, db, {}))
    assert caught.value.status_code == 409
    assert db.session.get(XbkStudent, student.id).student_no == "S1"


def test_course_code_change_rejected_even_for_soft_deleted_history(db):
    course = catalog("C1", 2)
    seed(db, course, choice("S1", "C1", deleted=True))
    changed = XbkCourseUpsert(
        year=YEAR, term=TERM, grade="高一", course_code="C1-NEW",
        course_name="renamed", quota=2,
    )

    with pytest.raises(HTTPException) as caught:
        asyncio.run(courses.update_course(course.id, changed, db, {}))
    assert caught.value.status_code == 409
    assert db.session.get(XbkCourse, course.id).course_code == "C1"


def test_quota_guard_uses_max_per_class_not_cross_class_total(db):
    course = catalog("C1", 2)
    seed(
        db, roster("S1", "1班"), roster("S2", "2班"), course,
        choice("S1", "C1"), choice("S2", "C1"),
    )
    quota_one = XbkCourseUpsert(
        year=YEAR, term=TERM, grade="高一", course_code="C1",
        course_name="C1", quota=1,
    )
    result = asyncio.run(courses.update_course(course.id, quota_one, db, {}))
    assert result["quota"] == 1

    quota_zero = quota_one.model_copy(update={"quota": 0})
    with pytest.raises(HTTPException) as caught:
        asyncio.run(courses.update_course(course.id, quota_zero, db, {}))
    assert caught.value.status_code == 409
    assert db.session.get(XbkCourse, course.id).quota == 1


def test_student_move_into_full_class_is_rejected(db):
    moving = roster("S1", "1班")
    seed(
        db, moving, roster("S2", "2班"), catalog("C1", 1),
        choice("S1", "C1"), choice("S2", "C1"),
    )
    move = XbkStudentUpsert(
        year=YEAR, term=TERM, grade="高一", class_name="2班",
        student_no="S1", name="S1", gender=None,
    )

    with pytest.raises(HTTPException) as caught:
        asyncio.run(students.update_student(moving.id, move, db, {}))
    assert caught.value.status_code == 409
    assert db.session.get(XbkStudent, moving.id).class_name == "1班"


def test_student_import_uses_parent_guard_for_move_into_full_class(db):
    moving = roster("S1", "1班")
    seed(
        db, moving, roster("S2", "2班"), catalog("C1", 1),
        choice("S1", "C1"), choice("S2", "C1"),
    )
    upload = csv_upload([{"年级": "高一", "班级": "2班", "学号": "S1", "姓名": "S1"}])

    async def run():
        try:
            return await import_data("students", YEAR, TERM, "高一", False, upload, db, {})
        finally:
            await upload.close()

    with pytest.raises(HTTPException) as caught:
        asyncio.run(run())
    assert caught.value.status_code == 409
    assert db.session.get(XbkStudent, moving.id).class_name == "1班"


def test_course_import_uses_parent_guard_for_unsafe_quota_reduction(db):
    course = catalog("C1", 1)
    seed(db, roster("S1", "1班"), course, choice("S1", "C1"))
    upload = csv_upload([{"课程代码": "C1", "课程名称": "C1", "各班限报人数": "0"}])

    async def run():
        try:
            return await import_data("courses", YEAR, TERM, "高一", False, upload, db, {})
        finally:
            await upload.close()

    with pytest.raises(HTTPException) as caught:
        asyncio.run(run())
    assert caught.value.status_code == 409
    assert db.session.get(XbkCourse, course.id).quota == 1


def test_shared_batch_service_counts_final_state_for_course_swap(db):
    first, second = choice("S1", "C1"), choice("S2", "C2")
    seed(
        db, roster("S1", "1班"), roster("S2", "1班"),
        catalog("C1", 1), catalog("C2", 1), first, second,
    )

    result = asyncio.run(apply_selection_mutations(db, [
        SelectionMutation(payload("S1", "C2").model_dump(), selection_id=first.id),
        SelectionMutation(payload("S2", "C1").model_dump(), selection_id=second.id),
    ]))
    asyncio.run(db.commit())

    assert result.updated == 2
    assert [(row.student_no, row.course_code) for row in active(db)] == [("S1", "C2"), ("S2", "C1")]


def test_update_cannot_leave_source_student_with_multiple_active_positions(db):
    first, second, moving = choice("S1", "C1"), choice("S1", "C2"), choice("S1", "C3")
    seed(
        db, roster("S1", "1班"), roster("S2", "1班"),
        catalog("C1", 3), catalog("C2", 3), catalog("C3", 3),
        first, second, moving,
    )

    with pytest.raises(HTTPException) as caught:
        asyncio.run(selections.update_selection(moving.id, payload("S2", "C3"), db, {}))

    assert caught.value.status_code == 409
    assert "最多只能有一个" in caught.value.detail
    assert [(row.student_no, row.course_code) for row in active(db)] == [
        ("S1", "C1"), ("S1", "C2"), ("S1", "C3"),
    ]


def test_model_declares_postgresql_active_selection_unique_index_without_sqlite_ddl():
    index = next(
        item
        for item in XbkSelection.__table__.indexes
        if item.name == "uq_xbk_selections_active_period_student"
    )

    assert index.unique is True
    assert [column.name for column in index.columns] == ["year", "term", "student_no"]
    assert str(index.dialect_options["postgresql"]["where"]) == "is_deleted IS FALSE"
    assert index._ddl_if is not None
    assert index._ddl_if.dialect == "postgresql"


def test_manual_writer_maps_database_active_selection_conflict_to_409(monkeypatch):
    from sqlalchemy.exc import IntegrityError

    class Diagnostic:
        constraint_name = "uq_xbk_selections_active_period_student"

    class UniqueViolation(Exception):
        diag = Diagnostic()

    class ConflictDb:
        def __init__(self):
            self.rolled_back = False

        async def rollback(self):
            self.rolled_back = True

    async def fail_with_unique_conflict(*_args, **_kwargs):
        raise IntegrityError("insert", {}, UniqueViolation("unique violation"))

    db = ConflictDb()
    monkeypatch.setattr(selections, "apply_selection_mutations", fail_with_unique_conflict)

    with pytest.raises(HTTPException) as caught:
        asyncio.run(selections.create_selection(payload("S1", "C1"), db, {}))

    assert caught.value.status_code == 409
    assert "已有有效选课" in caught.value.detail
    assert db.rolled_back is True


def test_manual_writer_does_not_mislabel_other_integrity_errors(monkeypatch):
    from sqlalchemy.exc import IntegrityError

    class ConflictDb:
        def __init__(self):
            self.rolled_back = False

        async def rollback(self):
            self.rolled_back = True

    async def fail_with_other_constraint(*_args, **_kwargs):
        raise IntegrityError("insert", {}, Exception("different constraint"))

    db = ConflictDb()
    monkeypatch.setattr(selections, "apply_selection_mutations", fail_with_other_constraint)

    with pytest.raises(IntegrityError):
        asyncio.run(selections.create_selection(payload("S1", "C1"), db, {}))

    assert db.rolled_back is True


def test_selection_import_maps_only_named_active_unique_conflict_to_409(monkeypatch):
    from sqlalchemy.exc import IntegrityError

    class Diagnostic:
        constraint_name = "uq_xbk_selections_active_period_student"

    class UniqueViolation(Exception):
        diag = Diagnostic()

    class ConflictDb:
        def __init__(self):
            self.rolled_back = False

        async def rollback(self):
            self.rolled_back = True

    values = payload("S1", "C1").model_dump()

    async def prepared(*_args, **_kwargs):
        return 1, list(values), [(values, values)], []

    async def no_identity_check(*_args, **_kwargs):
        return None

    async def fail_with_unique_conflict(*_args, **_kwargs):
        raise IntegrityError("insert", {}, UniqueViolation("unique violation"))

    monkeypatch.setattr(import_export, "_prepare_import", prepared)
    monkeypatch.setattr(import_export, "_validate_student_identities", no_identity_check)
    monkeypatch.setattr(import_export, "apply_selection_mutations", fail_with_unique_conflict)
    db = ConflictDb()

    with pytest.raises(HTTPException) as caught:
        asyncio.run(import_data(
            scope="selections",
            year=None,
            term=None,
            grade=None,
            skip_invalid=True,
            file=UploadFile(filename="selections.csv", file=io.BytesIO(b"")),
            db=db,
            _={},
        ))

    assert caught.value.status_code == 409
    assert "已有有效选课" in caught.value.detail
    assert db.rolled_back is True


def test_import_preflight_database_failure_is_not_misreported_as_conflict(monkeypatch):
    from sqlalchemy.exc import OperationalError

    class FailedDb:
        def __init__(self):
            self.rolled_back = False

        async def rollback(self):
            self.rolled_back = True

    async def fail_preflight(*_args, **_kwargs):
        raise OperationalError("select", {}, Exception("database unavailable"))

    monkeypatch.setattr(import_export, "_prepare_import", fail_preflight)
    db = FailedDb()

    with pytest.raises(OperationalError):
        asyncio.run(import_data(
            scope="selections",
            year=None,
            term=None,
            grade=None,
            skip_invalid=True,
            file=UploadFile(filename="selections.csv", file=io.BytesIO(b"")),
            db=db,
            _={},
        ))

    assert db.rolled_back is True
