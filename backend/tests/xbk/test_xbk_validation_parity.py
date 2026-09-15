"""XBK-02/04 acceptance: real routers, parsers, schemas and ORM on synthetic SQLite.

Run using an import-time offline bootstrap and --noconftest. No real app lifespan,
credentials, PG, Redis or authentication are exercised. The async session facade
executes original SQL, including PostgreSQL upsert expressions, on SQLite.
"""
import asyncio
import csv
import io
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session

from app.api.endpoints.xbk import courses, import_export, selections, students
from app.core.deps import require_admin
from app.core.exception_handlers import generic_exception_handler
from app.db.database import get_db
from app.models import XbkCourse, XbkSelection, XbkStudent

YEAR = "2032-2033"
TERM = "上学期"
PERIOD = {"year": YEAR, "term": TERM}
STUDENT = {**PERIOD, "grade": "高一", "class_name": "合成1班", "student_no": "0012", "name": "合成甲", "gender": "男"}
COURSE = {**PERIOD, "grade": "高一", "course_code": "0007", "course_name": "合成课程", "teacher": "合成教师", "quota": 3, "location": "合成教室"}
SELECTION = {**PERIOD, "grade": "高一", "student_no": "0012", "name": "合成甲", "course_code": "0007"}
PAYLOADS = {"students": STUDENT, "courses": COURSE, "selections": SELECTION}
MODELS = {"students": XbkStudent, "courses": XbkCourse, "selections": XbkSelection}
CASES = []


class AsyncFacade:
    def __init__(self, session, trace):
        self.session, self.trace = session, trace

    async def execute(self, statement):
        compiled = statement.compile(dialect=self.session.bind.dialect)
        self.trace.append({"sql": str(compiled), "params": compiled.params})
        return self.session.execute(statement)

    def add(self, row):
        self.session.add(row)

    async def commit(self):
        self.session.commit()
        self.trace.append({"transaction": "commit"})

    async def rollback(self):
        self.session.rollback()
        self.trace.append({"transaction": "rollback"})

    async def refresh(self, row):
        self.session.refresh(row)


@pytest.fixture
def env(request):
    trace = []
    CASES.append({"id": request.node.name, "trace": trace})
    engine = create_engine("sqlite:///:memory:")

    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    for model in MODELS.values():
        model.__table__.create(engine)
    session = Session(engine, expire_on_commit=False)
    db = AsyncFacade(session, trace)
    app = FastAPI()
    app.add_exception_handler(Exception, generic_exception_handler)
    for module in (students, courses, selections):
        app.include_router(module.router, prefix="/data")
    app.include_router(import_export.router)

    async def synthetic_db():
        return db

    async def synthetic_admin():
        return {"id": -1, "role_code": "admin", "synthetic": True}

    app.dependency_overrides[get_db] = synthetic_db
    app.dependency_overrides[require_admin] = synthetic_admin

    async def call(method, path, **kwargs):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app, raise_app_exceptions=False), base_url="http://synthetic.invalid") as client:
            response = await client.request(method, path, **kwargs)
        trace.append({"method": method, "path": path, "request": kwargs.get("json", kwargs.get("params")),
                      "status": response.status_code, "response": response.json()})
        return response

    async def imp(scope, rows, *, preview=False, skip=False):
        content = io.StringIO()
        writer = csv.DictWriter(content, fieldnames=list(PAYLOADS[scope]))
        writer.writeheader()
        writer.writerows(rows)
        trace.append({"csv_scope": scope, "rows": rows})
        return await call("POST", "/import/preview" if preview else "/import",
                          params={"scope": scope, "skip_invalid": str(skip).lower()},
                          files={"file": ("synthetic.csv", content.getvalue().encode(), "text/csv")})

    def seed(*rows):
        session.add_all(rows)
        session.commit()

    def snapshot():
        with Session(engine) as fresh:
            result = {scope: [{c.name: getattr(row, c.name) for c in model.__table__.columns}
                              for row in fresh.scalars(select(model).order_by(model.id))]
                      for scope, model in MODELS.items()}
        trace.append({"fresh_session": result})
        return result

    yield SimpleNamespace(call=call, imp=imp, seed=seed, snapshot=snapshot, trace=trace, session=session, engine=engine)
    session.close()
    engine.dispose()


def seed_parents(env):
    env.seed(XbkStudent(**STUDENT), XbkCourse(**COURSE))


# All text storage limits are checked through both HTTP writes and file uploads.
LIMITS = {
    "students": {"term": 20, "grade": 20, "class_name": 50, "student_no": 50, "name": 50, "gender": 10},
    "courses": {"term": 20, "grade": 20, "course_code": 50, "course_name": 200, "teacher": 100, "location": 200},
    "selections": {"term": 20, "grade": 20, "student_no": 50, "name": 50, "course_code": 50},
}
REQUIRED = {"students": ("term", "class_name", "student_no", "name"),
            "courses": ("term", "course_code", "course_name"), "selections": ("term", "student_no")}
INVALID_TEXT = [(scope, field, value) for scope, fields in LIMITS.items() for field, size in fields.items()
                for value in ("x" * (size + 1), "a\x00b")]
INVALID_TEXT += [(scope, field, value) for scope, fields in REQUIRED.items() for field in fields
                 for value in ("", " \t\u3000")]


@pytest.mark.parametrize("method", ["POST", "PUT"])
@pytest.mark.parametrize("scope,field,value", INVALID_TEXT)
def test_text_rejected_equally_without_writes(env, scope, field, value, method):
    seed_parents(env)
    env.seed(XbkSelection(**SELECTION))
    before = env.snapshot()
    payload = {**PAYLOADS[scope], field: value}
    path = f"/data/{scope}" + (f"/{before[scope][0]['id']}" if method == "PUT" else "")

    async def scenario():
        preview = await env.imp(scope, [payload], preview=True)
        assert preview.status_code == 200, preview.text
        assert preview.json()["invalid_rows"] == 1 and preview.json()["valid_rows"] == 0
        assert preview.json()["errors"][0]["row"] == 2
        imported = await env.imp(scope, [payload])
        assert imported.status_code == 422, imported.text
        assert imported.json()["detail"]["row"] == 2
        manual = await env.call(method, path, json=payload)
        assert manual.status_code == 422, manual.text
        assert any(field in error["loc"] for error in manual.json()["detail"])
        assert env.snapshot() == before
        assert not any(t.get("transaction") == "commit" for t in env.trace)

    asyncio.run(scenario())


@pytest.mark.parametrize("parent", ["student", "course"])
@pytest.mark.parametrize("state", ["missing", "deleted", "other_term", "other_year"])
@pytest.mark.parametrize("skip", [False, True])
def test_parent_reference_parity_and_batch_atomicity(env, parent, state, skip):
    # A valid first row would be written by a broken streaming implementation.
    seed_parents(env)
    env.seed(XbkStudent(**{**STUDENT, "student_no": "0099", "name": "合成乙"}),
             XbkCourse(**{**COURSE, "course_code": "0099"}))
    bad = {**SELECTION, ("student_no" if parent == "student" else "course_code"): "bad"}
    model, base = (XbkStudent, STUDENT) if parent == "student" else (XbkCourse, COURSE)
    values = {**base, ("student_no" if parent == "student" else "course_code"): "bad"}
    if state != "missing":
        values.update({"is_deleted": True} if state == "deleted" else
                      {"term": "下学期"} if state == "other_term" else {"year": "2033-2034"})
        env.seed(model(**values))
    before = env.snapshot()

    async def scenario():
        for method in ("POST", "PUT"):
            if method == "PUT":
                env.seed(XbkSelection(**{**SELECTION, "student_no": "0099", "course_code": "0099"}))
            path = "/data/selections" + (f"/{env.snapshot()['selections'][0]['id']}" if method == "PUT" else "")
            manual_before = env.snapshot()
            response = await env.call(method, path, json=bad)
            assert response.status_code == 404, response.text
            assert ("学生" if parent == "student" else "课程") in response.json()["detail"]
            assert env.snapshot() == manual_before
        baseline = env.snapshot()
        preview = await env.imp("selections", [SELECTION, bad], preview=True)
        assert preview.status_code == 200, preview.text
        report = preview.json()
        assert (report["valid_rows"], report["invalid_rows"]) == (1, 1)
        assert report["errors"][0]["row"] == 3
        assert ("学生" if parent == "student" else "课程") in " ".join(report["errors"][0]["errors"])
        assert env.snapshot() == baseline
        response = await env.imp("selections", [SELECTION, bad], skip=skip)
        if skip:
            assert response.status_code == 200, response.text
            assert (response.json()["processed"], response.json()["invalid"]) == (1, 1)
            assert response.json()["errors"] == report["errors"]
            assert len(env.snapshot()["selections"]) == len(baseline["selections"]) + 1
        else:
            assert response.status_code == 422, response.text
            assert response.json()["detail"] == report["errors"][0]
            assert env.snapshot() == baseline
        assert env.snapshot()["students"] == before["students"]
        assert env.snapshot()["courses"] == before["courses"]

    asyncio.run(scenario())


@pytest.mark.parametrize("marker", ["", " \t", "未选"])
@pytest.mark.parametrize("student_state", ["active", "missing", "deleted", "other_term"])
def test_unselected_marker_requires_only_active_same_period_student(env, marker, student_state):
    if student_state != "missing":
        values = {**STUDENT}
        if student_state == "deleted":
            values["is_deleted"] = True
        if student_state == "other_term":
            values["term"] = "下学期"
        env.seed(XbkStudent(**values))
    payload = {**SELECTION, "course_code": marker}

    async def scenario():
        preview = await env.imp("selections", [payload], preview=True)
        assert preview.status_code == 200
        assert preview.json()["valid_rows"] == int(student_state == "active")
        manual = await env.call("POST", "/data/selections", json=payload)
        assert manual.status_code == (200 if student_state == "active" else 404), manual.text
        imported = await env.imp("selections", [payload])
        assert imported.status_code == (200 if student_state == "active" else 422), imported.text
        rows = env.snapshot()["selections"]
        assert len(rows) == int(student_state == "active")
        if rows:
            assert rows[0]["course_code"] == "未选"
            assert imported.json()["updated"] == 1

    asyncio.run(scenario())


@pytest.mark.parametrize("scope", list(MODELS))
def test_legal_normalized_create_update_and_import(env, scope):
    payload = dict(PAYLOADS[scope])
    if scope == "selections":
        seed_parents(env)
    for field in payload:
        if isinstance(payload[field], str):
            payload[field] = " \t" + payload[field] + "\u3000 "
    payload["grade"] = " "  # Optional text normalizes to None, not an empty identity.

    async def scenario():
        manual = await env.call("POST", f"/data/{scope}", json=payload)
        assert manual.status_code == 200, manual.text
        body = manual.json()
        assert body["grade"] is None
        for field, value in PAYLOADS[scope].items():
            if field != "grade":
                assert body[field] == value
        edited = await env.call("PUT", f"/data/{scope}/{body['id']}", json=payload)
        assert edited.status_code == 200
        preview = await env.imp(scope, [payload], preview=True)
        assert preview.status_code == 200 and preview.json()["valid_rows"] == 1
        imported = await env.imp(scope, [payload])
        assert imported.status_code == 200, imported.text
        assert imported.json()["updated"] == 1
        assert len(env.snapshot()[scope]) == 1

    asyncio.run(scenario())


@pytest.mark.parametrize("quota", [-1, 2147483648, 1.5, True, "NaN", "Infinity", "1e100"])
def test_quota_invalid_parity(env, quota):
    payload = {**COURSE, "quota": quota}

    async def scenario():
        for method in ("POST", "PUT"):
            response = await env.call(method, "/data/courses" + ("/1" if method == "PUT" else ""), json=payload)
            assert response.status_code == 422, response.text
        preview = await env.imp("courses", [payload], preview=True)
        assert preview.json()["invalid_rows"] == 1
        response = await env.imp("courses", [payload])
        assert response.status_code == 422
        assert env.snapshot()["courses"] == []

    asyncio.run(scenario())


@pytest.mark.parametrize("quota,expected", [(0, 0), (2147483647, 2147483647), ("3.0", 3), ("2e1", 20), (" ", 0), (None, 0)])
def test_quota_legal_parity(env, quota, expected):
    payload = {**COURSE, "quota": quota}

    async def scenario():
        manual = await env.call("POST", "/data/courses", json=payload)
        assert manual.status_code == 200, manual.text
        assert manual.json()["quota"] == expected
        imported = await env.imp("courses", [payload])
        assert imported.status_code == 200, imported.text
        assert env.snapshot()["courses"][0]["quota"] == expected

    asyncio.run(scenario())


@pytest.mark.parametrize("scope", list(MODELS))
@pytest.mark.parametrize("skip", [False, True])
def test_mixed_field_error_batch_contract(env, scope, skip):
    if scope == "selections":
        seed_parents(env)
    bad = {**PAYLOADS[scope], "term": "\x00"}

    async def scenario():
        response = await env.imp(scope, [PAYLOADS[scope], bad], skip=skip)
        assert response.status_code == (200 if skip else 422), response.text
        assert len(env.snapshot()[scope]) == int(skip)
        if skip:
            assert (response.json()["processed"], response.json()["invalid"]) == (1, 1)
            assert response.json()["errors"][0]["row"] == 3

    asyncio.run(scenario())


@pytest.mark.parametrize("scope,field,size", [(scope, field, size) for scope, fields in LIMITS.items() for field, size in fields.items()])
def test_exact_storage_limit_and_leading_zero_roundtrip(env, scope, field, size):
    payload = {**PAYLOADS[scope], field: "0" * size}
    if scope == "selections":
        env.seed(XbkStudent(**{**STUDENT, "term": payload["term"], "student_no": payload["student_no"]}),
                 XbkCourse(**{**COURSE, "term": payload["term"], "course_code": payload["course_code"]}))

    async def scenario():
        manual = await env.call("POST", f"/data/{scope}", json=payload)
        assert manual.status_code == 200, manual.text
        assert manual.json()[field] == payload[field]
        updated = await env.call("PUT", f"/data/{scope}/{manual.json()['id']}", json=payload)
        assert updated.status_code == 200
        preview = await env.imp(scope, [payload], preview=True)
        assert preview.status_code == 200 and preview.json()["valid_rows"] == 1
        imported = await env.imp(scope, [payload])
        assert imported.status_code == 200, imported.text
        assert imported.json()["updated"] == 1
        assert env.snapshot()[scope][0][field] == payload[field]

    asyncio.run(scenario())


@pytest.mark.parametrize("scope", list(MODELS))
def test_optional_blanks_are_none(env, scope):
    fields = {"students": ["grade", "gender"], "courses": ["grade", "teacher", "location"], "selections": ["grade", "name"]}[scope]
    payload = {**PAYLOADS[scope], **{field: " \t\u3000" for field in fields}}
    if scope == "selections":
        seed_parents(env)

    async def scenario():
        response = await env.call("POST", f"/data/{scope}", json=payload)
        assert response.status_code == 200, response.text
        assert all(response.json()[field] is None for field in fields)
        response = await env.imp(scope, [payload])
        assert response.status_code == 200, response.text
        assert all(env.snapshot()[scope][0][field] is None for field in fields)

    asyncio.run(scenario())


@pytest.mark.parametrize("parent", ["student", "course"])
def test_execute_rechecks_parent_after_successful_preview(env, parent):
    seed_parents(env)

    async def scenario():
        preview = await env.imp("selections", [SELECTION], preview=True)
        assert preview.json()["valid_rows"] == 1
        model = XbkStudent if parent == "student" else XbkCourse
        row = env.session.scalars(select(model)).one()
        row.is_deleted = True
        env.session.commit()
        response = await env.imp("selections", [SELECTION])
        assert response.status_code == 422, response.text
        assert env.snapshot()["selections"] == []

    asyncio.run(scenario())


@pytest.mark.parametrize("scope", list(MODELS))
def test_real_sql_failure_rolls_back_earlier_update_and_restore(env, scope):
    from sqlalchemy import text

    if scope == "selections":
        seed_parents(env)
        env.seed(XbkStudent(**{**STUDENT, "student_no": "FAIL"}))
    env.seed(MODELS[scope](**PAYLOADS[scope], is_deleted=True))
    key = "course_code" if scope == "courses" else "student_no"
    before = env.snapshot()
    with env.engine.begin() as connection:
        connection.execute(text(f"""CREATE TRIGGER synthetic_failure BEFORE INSERT ON {MODELS[scope].__tablename__}
            WHEN NEW.{key} = 'FAIL' BEGIN SELECT RAISE(ABORT, 'synthetic private diagnostic'); END"""))
    invalid = {**PAYLOADS[scope], key: "FAIL"}

    async def scenario():
        response = await env.imp(scope, [PAYLOADS[scope], invalid])
        assert response.status_code == 500, response.text
        assert response.json()["detail"] == "服务器内部错误"
        assert "synthetic private diagnostic" not in response.text
        assert any(t.get("transaction") == "rollback" for t in env.trace)
        assert env.snapshot() == before

    asyncio.run(scenario())


def test_both_missing_parents_report_row_and_skip_writes_nothing(env):
    async def scenario():
        preview = await env.imp("selections", [SELECTION], preview=True)
        assert preview.status_code == 200
        report = preview.json()
        assert (report["valid_rows"], report["invalid_rows"]) == (0, 1)
        assert report["errors"][0]["row"] == 2
        assert len(report["errors"][0]["errors"]) == 2
        for word in ("学生", "课程", "同学年", "同学期", "未删除"):
            assert word in str(report["errors"])
        response = await env.imp("selections", [SELECTION], skip=True)
        assert response.status_code == 200
        assert response.json()["processed"] == 0
        assert response.json()["errors"] == report["errors"]
        assert env.snapshot()["selections"] == []
        assert not any(t.get("transaction") == "commit" for t in env.trace)

    asyncio.run(scenario())


def test_parent_queries_chunked_and_grade_snapshot_not_reference(env):
    # Different snapshot grades do not add a new cross-grade rejection policy.
    rows = [{**SELECTION, "student_no": f"{index:05}", "grade": "快照年级"} for index in range(501)]
    env.seed(XbkCourse(**{**COURSE, "grade": "共享年级", "quota": 501}),
             *(XbkStudent(**{**STUDENT, "student_no": row["student_no"]}) for row in rows))

    async def scenario():
        preview = await env.imp("selections", rows, preview=True)
        assert preview.status_code == 200 and preview.json()["valid_rows"] == 501
        checks = [t for t in env.trace if "sql" in t]
        assert len(checks) == 3  # 2 student chunks, 1 deduplicated course chunk.
        assert max(len(t["params"].get("param_1", [])) for t in checks) <= 500
        response = await env.imp("selections", rows)
        assert response.status_code == 200 and response.json()["inserted"] == 501
        assert len(env.snapshot()["selections"]) == 501

    asyncio.run(scenario())


@pytest.mark.parametrize("kind", ["duplicate", "mixed_period"])
@pytest.mark.parametrize("skip", [False, True])
def test_file_wide_safety_guards_remain_fatal(env, kind, skip):
    seed_parents(env)
    other = {**SELECTION}
    if kind == "duplicate":
        other["student_no"] = " 0012 "
    else:
        other["term"] = "下学期"

    async def scenario():
        for preview in (True, False):
            response = await env.imp("selections", [SELECTION, other], preview=preview, skip=skip)
            assert response.status_code == 422, response.text
            assert ("重复" if kind == "duplicate" else "组合") in response.json()["detail"]
        assert env.snapshot()["selections"] == []
        assert not any("sql" in t for t in env.trace)

    asyncio.run(scenario())


@pytest.mark.parametrize("skip", [False, True])
def test_late_identity_guard_rolls_back_real_sql_batch(env, skip):
    """SQLite trigger exercises late conditional upsert, not PG concurrency locks."""
    from sqlalchemy import text

    env.seed(XbkStudent(**STUDENT, is_deleted=True))
    before = env.snapshot()
    with env.engine.begin() as connection:
        connection.execute(text("""CREATE TRIGGER synthetic_identity_change AFTER INSERT ON xbk_students
            WHEN NEW.student_no = '0000' BEGIN
            UPDATE xbk_students SET name = 'Changed after preflight' WHERE student_no = '0012';
            END"""))

    async def scenario():
        response = await env.imp("students", [{**STUDENT, "student_no": "0000"}, STUDENT], skip=skip)
        assert response.status_code == 422, response.text
        assert "另一姓名或年级" in response.json()["detail"]
        assert sum("ON CONFLICT" in item.get("sql", "") for item in env.trace) == 2
        assert any(item.get("transaction") == "rollback" for item in env.trace)
        assert not any(item.get("transaction") == "commit" for item in env.trace)
        # Fresh session sees neither the first insert nor the trigger's identity edit;
        # the existing soft-deleted student has not been restored or overwritten.
        assert env.snapshot() == before

    asyncio.run(scenario())
