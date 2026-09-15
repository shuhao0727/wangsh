"""Import boundary/transaction regressions; all database calls are in-memory fakes."""

import asyncio
import io
import struct
import zipfile
from types import SimpleNamespace

import pandas as pd
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import SQLAlchemyError
from starlette.datastructures import UploadFile

from app.api.endpoints.xbk import import_export as imports
from app.core.exception_handlers import generic_exception_handler
from app.models import XbkCourse, XbkSelection, XbkStudent


ROWS = {
    "students": {"年份": "2026", "学期": "上学期", "班级": "高一(1)班", "学号": "0012", "姓名": "学生甲"},
    "courses": {"年份": "2026", "学期": "上学期", "课程代码": "0012", "课程名称": "课程甲"},
    "selections": {"年份": "2026", "学期": "上学期", "学号": "0012", "课程代码": "C01"},
}


def upload(rows=None, *, content=None, filename="sample.xlsx", columns=None):
    if content is not None:
        return UploadFile(filename=filename, file=io.BytesIO(content))
    frame = pd.DataFrame(rows, columns=columns)
    stream = io.BytesIO()
    frame.to_excel(stream, index=False, engine="openpyxl")
    stream.seek(0)
    return UploadFile(filename=filename, file=stream)


class FakeDb:
    def __init__(self, existing=(), fail_write=None, fail_commit=False, *, parents=None):
        self.existing = list(existing)
        self.parents = parents or {}
        self.parent_queries = []
        self.fail_write = fail_write
        self.fail_commit = fail_commit
        self.queries = []
        self.writes = []
        self.added = []
        self.selection_rows = []
        self._flushed_adds = 0
        self.commits = 0
        self.rollbacks = 0

    def _orm_records(self, table, source, *, parent_source):
        records = []
        for index, raw in enumerate(source, 1):
            if table == "xbk_students":
                deleted = bool(raw[3]) if parent_source and len(raw) > 3 else len(raw) == 3
                records.append(SimpleNamespace(
                    id=index, year=raw[0], term=raw[1], student_no=raw[2],
                    name=raw[3] if len(raw) >= 5 else "学生甲",
                    grade=raw[4] if len(raw) >= 5 else "高一",
                    class_name="1班", gender=None, is_deleted=deleted,
                ))
            elif table == "xbk_courses":
                deleted = bool(raw[3]) if parent_source and len(raw) > 3 else len(raw) == 3
                records.append(SimpleNamespace(
                    id=index, year=raw[0], term=raw[1], course_code=raw[2],
                    course_name="课程甲", grade="高一", teacher=None,
                    quota=30, location=None, is_deleted=deleted,
                ))
            else:
                records.append(SimpleNamespace(
                    id=index, year=raw[0], term=raw[1], student_no=raw[2],
                    course_code=raw[3], grade=None, name=None, is_deleted=True,
                ))
        return records

    async def execute(self, statement):
        if statement.is_select:
            self.queries.append(statement)
            sql = str(statement.compile(dialect=postgresql.dialect()))
            if "count(" in sql.lower():
                if statement._group_by_clauses:
                    return SimpleNamespace(all=lambda: [])
                return SimpleNamespace(scalar_one=lambda: 0)
            table = next(iter(statement.selected_columns)).table.name
            table_column_count = len(statement.get_final_froms()[0].columns)
            if (len(statement.selected_columns) == 1 or statement._for_update_arg is not None
                    or len(statement.selected_columns) == table_column_count):
                # Explicit discovery/ORM lock shape fake, not concurrency evidence.
                is_parent = table in self.parents
                if is_parent:
                    self.parent_queries.append(statement)
                fields = ("year", "term", "student_no") if table == "xbk_students" else (
                    ("year", "term", "course_code") if table == "xbk_courses" else
                    ("year", "term", "student_no", "course_code"))
                if table == "xbk_selections":
                    source = self.existing if "xbk_students" in self.parents else ()
                else:
                    source = self.parents.get(table, ()) if is_parent else self.existing
                records = self._orm_records(table, source, parent_source=is_parent)
                if len(statement.selected_columns) == 1:
                    rows = [row.id for row in records]
                else:
                    rows = records
                    if table == "xbk_selections":
                        self.selection_rows = records
                return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: rows))
            if table in ("xbk_students", "xbk_courses") and "is_deleted IS false" in sql:
                # Parent records are separate from the imported table's existing
                # keys. Honor both requested period/key and soft-delete state.
                assert len(statement.selected_columns) == 3
                self.parent_queries.append(statement)
                keys = next(iter(statement.compile().params.values()))
                rows = [row[:3] for row in self.parents.get(table, ())
                        if row[3] is False and row[:3] in keys]
                return SimpleNamespace(all=lambda: rows)
            if len(statement.selected_columns) == 5:
                return SimpleNamespace(all=lambda: [row if len(row) == 5 else (*row, "学生甲", None) for row in self.existing])
            return SimpleNamespace(all=lambda: [row[:len(statement.selected_columns)] for row in self.existing])
        self.writes.append(statement)
        if self.fail_write == len(self.writes):
            raise SQLAlchemyError("private database diagnostic must not reach clients")
        if statement.table.name == "xbk_students":
            # Explicit fake successful DML RETURNING result, not a real DB id
            # or evidence of PostgreSQL atomic identity/concurrency behavior.
            fake_id = len(self.writes)
            return SimpleNamespace(scalar_one_or_none=lambda: fake_id)
        return None

    def add(self, row):
        self.added.append(row)

    async def flush(self):
        for row in self.added[self._flushed_adds:]:
            values = {
                column.key: getattr(row, column.key)
                for column in row.__table__.columns
                if column.key not in {"id", "created_at"}
            }
            statement = postgresql.insert(type(row)).values(**values)
            self.writes.append(statement)
            if self.fail_write == len(self.writes):
                raise SQLAlchemyError("private database diagnostic must not reach clients")
            if row.id is None:
                row.id = len(self.writes)
        self._flushed_adds = len(self.added)

    async def commit(self):
        if self.fail_commit:
            raise SQLAlchemyError("private commit error")
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1


def selection_parents():
    """Synthetic same-period active roster/catalog, never imported selection keys."""
    return {
        "xbk_students": [("2026-2027", "上学期", key, False) for key in ("0012", "0013")],
        "xbk_courses": [("2026-2027", "上学期", key, False) for key in ("C01", "C02")],
    }


def preview(scope="students", rows=None, **kwargs):
    return asyncio.run(imports.preview_import(
        scope=scope, file=upload(rows if rows is not None else [ROWS[scope]]), db=None, _={}, **kwargs,
    ))


def execute(scope="students", rows=None, db=None, **kwargs):
    return asyncio.run(imports.import_data(
        scope=scope, file=upload(rows if rows is not None else [ROWS[scope]]), db=db or FakeDb(), _={}, **kwargs,
    ))


@pytest.mark.parametrize("encoding", ["utf-8", "utf-8-sig", "gb18030"])
def test_csv_aliases_leading_zeros_and_na_are_literal(encoding):
    content = "year,term,class,student_no,name\n2026,上学期,1班,0012,NA\n"
    result = asyncio.run(imports.preview_import(
        scope="students", file=upload(content=content.encode(encoding), filename="LIST.CSV"), db=None, _={},
    ))
    assert result["valid_rows"] == 1
    assert result["preview"][0]["学号"] == "0012"
    assert result["preview"][0]["姓名"] == "NA"


@pytest.mark.parametrize("identifier,expected", [("000012", "000012"), (12, "12"), (12.0, "12"), ("NA", "NA"), ("NULL", "NULL")])
def test_excel_identifiers_not_inferred_as_numbers_or_na(identifier, expected):
    row = {**ROWS["students"], "学号": identifier}
    assert preview(rows=[row])["preview"][0]["学号"] == expected


@pytest.mark.parametrize("filename,content,status", [
    ("sample.xlsx", b"", 400), ("sample.csv", b"", 400),
    ("sample.xls", b"not an excel document", 400),
    ("sample.xlsx", b"not a zip document", 400),
    ("sample.txt", b"year,name\n2026,ok", 400),
    ("sample.csv", b'a,b\n1,2,3\n', 400),
    ("sample.csv", b'a,b\n"unclosed', 400),
    ("sample.csv", b'\xff', 400),
])
def test_invalid_files_return_safe_client_errors(filename, content, status):
    with pytest.raises(HTTPException) as exc:
        asyncio.run(imports._read_excel(upload(content=content, filename=filename)))
    assert exc.value.status_code == status
    assert "Traceback" not in str(exc.value.detail)


def test_file_size_is_bounded_before_parser(monkeypatch):
    monkeypatch.setattr(imports, "MAX_IMPORT_BYTES", 8)
    parser_called = []
    monkeypatch.setattr(imports, "_parse_import_file", lambda *args: parser_called.append(args))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(imports._read_excel(upload(content=b"123456789", filename="sample.csv")))
    assert exc.value.status_code == 413
    assert parser_called == []


def test_expanded_xlsx_is_bounded_before_parser(monkeypatch):
    monkeypatch.setattr(imports, "MAX_IMPORT_EXPANDED_BYTES", 8)
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("xl/sharedStrings.xml", "x" * 100)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(imports._read_excel(upload(content=stream.getvalue())))
    assert exc.value.status_code == 413


@pytest.mark.parametrize("extension", [".csv", ".xlsx"])
def test_row_limit(monkeypatch, extension):
    monkeypatch.setattr(imports, "MAX_IMPORT_ROWS", 2)
    file = upload(content=b"a\n1\n2\n3", filename="sample.csv") if extension == ".csv" else upload([{"a": n} for n in range(3)])
    with pytest.raises(HTTPException) as exc:
        asyncio.run(imports._read_excel(file))
    assert exc.value.status_code == 413


@pytest.mark.parametrize("extension", [".csv", ".xlsx"])
def test_column_limit(monkeypatch, extension):
    monkeypatch.setattr(imports, "MAX_IMPORT_COLUMNS", 2)
    file = upload(content=b"a,b,c\n1,2,3", filename="sample.csv") if extension == ".csv" else upload([{"a": 1, "b": 2, "c": 3}])
    with pytest.raises(HTTPException) as exc:
        asyncio.run(imports._read_excel(file))
    assert exc.value.status_code == 413


def test_xls_missing_engine_has_conversion_message(monkeypatch):
    def missing_engine(*args, **kwargs):
        assert kwargs["engine"] == "xlrd"
        raise ImportError("dependency internal path")
    monkeypatch.setattr(imports.pd, "read_excel", missing_engine)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(imports._read_excel(upload(content=b"legacy workbook", filename="sample.xls")))
    assert exc.value.status_code == 400
    assert "另存为 .xlsx" in exc.value.detail
    assert "internal path" not in exc.value.detail


def test_legacy_xls_named_xlsx_export_remains_readable():
    result = asyncio.run(imports._read_excel(upload([ROWS["students"]], filename="legacy.xls")))
    assert result.iloc[0]["学号"] == "0012"


@pytest.mark.parametrize("columns", [
    ["学号", "学号"], [" 学号 ", "学号"], ["学号", "student_id"],
    ["student_no", "studentId"],
])
@pytest.mark.parametrize("extension", [".xlsx", ".csv"])
def test_duplicate_headers_and_aliases_rejected(columns, extension):
    if extension == ".csv":
        file = upload(content=(",".join(columns) + "\n001,002").encode(), filename="sample.csv")
    else:
        file = upload([["001", "002"]], columns=columns)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(imports.preview_import(scope="students", file=file, db=None, _={}))
    assert exc.value.status_code == 422
    assert "重复列" in str(exc.value.detail)


@pytest.mark.parametrize("scope", ROWS)
@pytest.mark.parametrize("endpoint", ["preview_import", "import_data"])
def test_header_only_wrong_schema_rejected_consistently(scope, endpoint):
    with pytest.raises(HTTPException) as exc:
        asyncio.run(getattr(imports, endpoint)(scope=scope, file=upload([], columns=["姓名"]), db=FakeDb(), _={}))
    assert exc.value.status_code == 422
    assert "缺少必要列" in str(exc.value.detail)


@pytest.mark.parametrize("scope", ROWS)
def test_valid_empty_template_is_noop(scope):
    for endpoint in [imports.preview_import, imports.import_data]:
        db = FakeDb()
        result = asyncio.run(endpoint(scope=scope, file=upload([], columns=imports._template_columns(scope)), db=db, _={}))
        assert result["total_rows"] == 0
        assert result["errors"] == []
        assert db.writes == [] and db.commits == 0


def test_empty_rows_preserve_excel_error_line_numbers():
    good = ROWS["students"]
    blank = {key: " " for key in good}
    bad = {**good, "姓名": "", "学号": "0013"}
    rows = [good, blank, bad]
    result = preview(rows=rows)
    imported = execute(rows=rows)
    assert result["total_rows"] == 2
    assert result["errors"][0]["row"] == 4
    assert imported["errors"] == result["errors"]
    assert imported["skipped"] == imported["invalid"] == 1


@pytest.mark.parametrize("value", ["2026.5", "NaN", "Infinity", "-Infinity", "1e9999", "2147483648", "abc"])
def test_invalid_year_rejected_without_truncation(value):
    rows = [{**ROWS["students"], "年份": value}]
    assert preview(rows=rows)["invalid_rows"] == 1
    assert execute(rows=rows)["invalid"] == 1


@pytest.mark.parametrize("value", ["1.5", "-1", "NaN", "Infinity", "2147483648"])
def test_quota_must_fit_nonnegative_integer(value):
    rows = [{**ROWS["courses"], "各班限报人数": value}]
    assert preview(scope="courses", rows=rows)["invalid_rows"] == 1
    assert execute(scope="courses", rows=rows)["invalid"] == 1


@pytest.mark.parametrize("scope,column,value", [
    ("students", "学号", "0" * 51), ("students", "姓名", "甲" * 51),
    ("students", "班级", "班" * 51), ("students", "性别", "字" * 11),
    ("students", "年级", "级" * 21), ("students", "学期", "期" * 21),
    ("courses", "课程代码", "x" * 51), ("courses", "课程名称", "字" * 201),
    ("courses", "课程负责人", "字" * 101), ("courses", "上课地点", "字" * 201),
    ("selections", "姓名", "字" * 51), ("selections", "课程代码", "x" * 51),
])
def test_storage_limits_match_preview_execute(scope, column, value):
    rows = [{**ROWS[scope], column: value}]
    result = preview(scope=scope, rows=rows)
    db = FakeDb()
    imported = execute(scope=scope, rows=rows, db=db)
    assert result["invalid_rows"] == imported["invalid"] == 1
    assert result["errors"] == imported["errors"]
    assert db.writes == []


def test_csv_nul_rejected_as_row_error():
    result = asyncio.run(imports.preview_import(scope="students", year=2026, term="上", db=None, _={},
        file=upload(content="班级,学号,姓名\n1班,001,甲\x00乙".encode(), filename="sample.csv")))
    assert result["invalid_rows"] == 1
    assert "空字符" in str(result["errors"])


def test_defaults_are_normalized_and_preview_matches_written_values():
    rows = [{"班级": "1班", "学号": "001", "姓名": "甲"}]
    db = FakeDb()
    result = preview(rows=rows, year=2026, term=" 上 ", grade=" 高一 ")
    execute(rows=rows, db=db, year=2026, term=" 上 ", grade=" 高一 ")
    params = db.writes[0].compile().params
    assert result["preview"][0]["学年"] == str(params["year"]) == "2026-2027"
    assert result["preview"][0]["学期"] == params["term"] == "上"
    assert result["preview"][0]["年级"] == params["grade"] == "高一"


def test_row_defaults_take_precedence_and_no_new_term_grade_enums():
    rows = [{**ROWS["students"], "年级": "跨级", "学期": "上", "年份": "2025"}]
    result = preview(rows=rows, year=2026, term="下学期", grade="高一")
    assert result["valid_rows"] == 1
    assert result["preview"][0]["年级"] == "跨级"
    assert result["preview"][0]["学期"] == "上"
    assert result["preview"][0]["学年"] == "2025-2026"


@pytest.mark.parametrize("scope", ROWS)
def test_strict_validation_does_not_write_earlier_valid_rows(scope):
    bad = {**ROWS[scope], "年份": "invalid"}
    db = FakeDb(parents=selection_parents() if scope == "selections" else None)
    with pytest.raises(HTTPException) as exc:
        execute(scope=scope, rows=[ROWS[scope], bad], db=db, skip_invalid=False)
    assert exc.value.status_code == 422 and exc.value.detail["row"] == 3
    assert db.writes == [] and db.commits == 0
    assert db.rollbacks == (1 if scope == "selections" else 0)
    # Parent preflight reads are now required; no target-key reads or writes.
    assert db.queries == db.parent_queries
    assert len(db.parent_queries) == (2 if scope == "selections" else 0)


@pytest.mark.parametrize("scope", ROWS)
def test_skip_invalid_only_writes_valid_rows_and_counts_skips(scope):
    bad = {**ROWS[scope], "年份": "invalid"}
    db = FakeDb(parents=selection_parents() if scope == "selections" else None)
    result = execute(scope=scope, rows=[ROWS[scope], bad], db=db, skip_invalid=True)
    assert result["processed"] == 1 and result["skipped"] == result["invalid"] == 1
    assert result["inserted"] + result["updated"] == result["processed"]
    assert len(db.writes) == 1 and db.commits == 1


@pytest.mark.parametrize("scope", ROWS)
@pytest.mark.parametrize("skip_invalid", [True, False])
def test_duplicate_import_rejected_before_any_write(scope, skip_invalid):
    changed = {**ROWS[scope], "年级": "高二"}
    db = FakeDb()
    for fn in [lambda: preview(scope=scope, rows=[ROWS[scope], changed]),
               lambda: execute(scope=scope, rows=[ROWS[scope], changed], db=db, skip_invalid=skip_invalid)]:
        with pytest.raises(HTTPException) as exc:
            fn()
        assert exc.value.status_code == 422
        assert "重复" in str(exc.value.detail)
    assert not db.writes and db.commits == 0


@pytest.mark.parametrize("scope", ROWS)
def test_mixed_periods_rejected_even_with_skip_invalid(scope):
    rows = [ROWS[scope], {**ROWS[scope], "年份": "2027"}]
    db = FakeDb()
    with pytest.raises(HTTPException, match="不同的学年/学期"):
        preview(scope=scope, rows=rows)
    with pytest.raises(HTTPException, match="不同的学年/学期"):
        execute(scope=scope, rows=rows, db=db, skip_invalid=True)
    assert not db.writes and db.commits == 0


@pytest.mark.parametrize("existing_name,existing_grade", [("另一学生", "高一"), ("学生甲", "高二")])
def test_existing_student_identity_conflict_blocks_preview_and_import(existing_name, existing_grade):
    db = FakeDb(existing=[("2026-2027", "上学期", "0012", existing_name, existing_grade)])
    row = {**ROWS["students"], "年级": "高一"}
    with pytest.raises(HTTPException, match="学生冲突"):
        asyncio.run(imports.preview_import(scope="students", file=upload([row]), db=db, _={}))
    with pytest.raises(HTTPException, match="学生冲突"):
        execute(rows=[row], db=db, skip_invalid=True)
    assert not db.writes and db.commits == 0


def test_existing_same_person_can_update_class_without_changing_identity():
    db = FakeDb(existing=[("2026-2027", "上学期", "0012", "学生甲", "高一")])
    result = execute(rows=[{**ROWS["students"], "年级": "高一", "班级": "2班"}], db=db)
    assert result["updated"] == 1
    assert db.writes[0].compile().params["class_name"] == "2班"


@pytest.mark.parametrize("scope,key", [
    ("students", ("2026-2027", "上学期", "0012")), ("courses", ("2026-2027", "上学期", "0012")),
    ("selections", ("2026-2027", "上学期", "0012", "C01")),
])
def test_soft_deleted_keys_count_as_updates_and_are_restored(scope, key):
    db = FakeDb(existing=[key], parents=selection_parents() if scope == "selections" else None)
    result = execute(scope=scope, db=db)
    assert result["updated"] == 1 and result["inserted"] == 0
    target_queries = [query for query in db.queries if all(query is not parent for parent in db.parent_queries)]
    assert target_queries
    if scope == "selections":
        # Selection restore is now an ORM mutation inside the shared locked
        # decision service, not an independent ON CONFLICT writer.
        assert db.writes == []
        assert len(db.selection_rows) == 1
        assert db.selection_rows[0].is_deleted is False
        assert db.selection_rows[0].course_code == "C01"
    else:
        # The target-key discovery must include soft-deleted rows. Additional
        # parent guards may legitimately query only active selection occupancy.
        assert any(
            len(query.selected_columns) == 3 and "is_deleted IS" not in str(query)
            for query in target_queries
        )
        statement = str(db.writes[0].compile(dialect=postgresql.dialect()))
        assert "ON CONFLICT" in statement
        assert db.writes[0].compile().params["is_deleted"] is False


@pytest.mark.parametrize("scope", ROWS)
@pytest.mark.parametrize("failure", ["write", "commit"])
def test_database_failure_rolls_back_and_preserves_original_exception(scope, failure):
    db = FakeDb(fail_write=2 if failure == "write" else None, fail_commit=failure == "commit",
                parents=selection_parents() if scope == "selections" else None)
    with pytest.raises(SQLAlchemyError) as exc:
        execute(scope=scope, rows=[ROWS[scope], {**ROWS[scope], "学号": "0013", "课程代码": "C02"}], db=db)
    assert "private" in str(exc.value)
    assert db.rollbacks == 1 and db.commits == 0
    assert len(db.writes) == 2


@pytest.mark.parametrize("scope", ROWS)
@pytest.mark.parametrize("failure", ["write", "commit"])
def test_database_failure_http_boundary_returns_sanitized_500(scope, failure):
    db = FakeDb(fail_write=2 if failure == "write" else None, fail_commit=failure == "commit",
                parents=selection_parents() if scope == "selections" else None)
    app = FastAPI()
    app.add_exception_handler(Exception, generic_exception_handler)
    app.include_router(imports.router, prefix="/xbk")
    app.dependency_overrides[imports.require_admin] = lambda: {"role_code": "admin"}
    app.dependency_overrides[imports.get_db] = lambda: db
    rows = [ROWS[scope], {**ROWS[scope], "学号": "0013", "课程代码": "C02"}]
    stream = io.BytesIO()
    pd.DataFrame(rows).to_excel(stream, index=False, engine="openpyxl")

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.post(
            "/xbk/import",
            params={"scope": scope},
            files={"file": ("synthetic.xlsx", stream.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )

    assert response.status_code == 500, response.text
    assert response.json()["detail"] == "服务器内部错误"
    assert "private" not in response.text
    assert db.rollbacks == 1 and db.commits == 0
    assert len(db.writes) == 2


def test_selection_unknown_student_rejected_without_writes():
    db = FakeDb(parents=selection_parents())
    rows = [{**ROWS["selections"], "学号": "unknown", "年级": "跨级", "课程代码": ""}]
    with pytest.raises(HTTPException) as exc:
        execute(scope="selections", rows=rows, db=db, skip_invalid=False)
    assert exc.value.status_code == 422 and exc.value.detail["row"] == 2
    assert "学生不存在" in str(exc.value.detail)
    assert "同学年、同学期且未删除" in str(exc.value.detail)
    assert db.writes == [] and db.commits == 0 and db.rollbacks == 1
    assert db.queries == db.parent_queries and len(db.parent_queries) == 1
    assert "xbk_students" in str(db.parent_queries[0])


def test_selection_blank_code_and_independent_snapshots_preserved():
    db = FakeDb(parents=selection_parents())
    rows = [{**ROWS["selections"], "年级": "跨级", "课程代码": ""}]
    result = execute(scope="selections", rows=rows, db=db, skip_invalid=False)
    assert result["processed"] == result["inserted"] == 1
    assert result["updated"] == result["invalid"] == result["skipped"] == 0
    assert len(db.writes) == db.commits == 1 and db.rollbacks == 0
    params = db.writes[0].compile().params
    assert params["course_code"] == "未选" and params["grade"] == "跨级"
    assert params["name"] is None
    assert len(db.parent_queries) >= 2 and "xbk_students" in str(db.parent_queries[0])
    assert all("xbk_courses" not in str(query) for query in db.queries)


def test_errors_and_preview_return_limits():
    good = ROWS["students"]
    bad = {**good, "年份": "invalid"}
    result = preview(rows=[{**good, "学号": str(i)} for i in range(12)] + [bad] * 52)
    assert result["valid_rows"] == 12 and result["invalid_rows"] == 52
    assert len(result["preview"]) == 10 and len(result["errors"]) == 50


def test_http_preview_and_execute_csv_contract_with_mock_dependencies():
    app = FastAPI()
    app.include_router(imports.router, prefix="/xbk")
    db = FakeDb()
    app.dependency_overrides[imports.require_admin] = lambda: {"role_code": "admin"}
    app.dependency_overrides[imports.get_db] = lambda: db
    content = "班级,学号,姓名\n1班,0012,甲".encode()
    with TestClient(app) as client:
        params = {"scope": "students", "year": 2026, "term": "上学期", "grade": "高一"}
        result = client.post("/xbk/import/preview", params=params, files={"file": ("test.csv", content, "text/csv")})
        assert result.status_code == 200
        assert result.json()["valid_rows"] == 1
        assert db.writes == []
        result = client.post("/xbk/import", params=params, files={"file": ("test.csv", content, "text/csv")})
        assert result.status_code == 200 and result.json()["processed"] == 1
        assert db.commits == 1


def test_native_biff_xls_reader_preserves_text_identifiers():
    pytest.importorskip("xlrd")
    # A minimal BIFF2 worksheet, built entirely in memory (no xlwt dependency).
    def record(opcode, data):
        return struct.pack("<HH", opcode, len(data)) + data
    content = record(0x09, struct.pack("<HH", 0x02, 0x10))
    content += record(0x42, struct.pack("<H", 1252))
    for row_index, row in enumerate([
        ["year", "term", "class", "student_no", "name"],
        ["2031", "first", "class1", "00001", "Test"],
    ]):
        for column_index, value in enumerate(row):
            text = value.encode("ascii")
            content += record(0x04, struct.pack("<HH3sB", row_index, column_index, b"\x00\x00\x00", len(text)) + text)
    content += record(0x0a, b"")
    result = asyncio.run(imports.preview_import(
        scope="students", file=upload(content=content, filename="native.xls"), db=None, _={},
    ))
    assert result["valid_rows"] == 1
    assert result["preview"][0]["学号"] == "00001"


@pytest.mark.parametrize("scope", ROWS)
@pytest.mark.parametrize("endpoint", ["preview_import", "import_data"])
@pytest.mark.parametrize("skip", [False, True])
@pytest.mark.parametrize("kind", ["duplicate", "mixed_period"])
def test_invalid_row_still_participates_in_file_wide_guards(scope, endpoint, skip, kind):
    # Row-level rejection must not conceal a fatal collision or mixed period.
    good = ROWS[scope]
    bad = {**good, "课程名称" if scope == "courses" else "姓名": "x" * 1000}
    if kind == "mixed_period":
        bad["年份"] = "2027"
    db = FakeDb(parents=selection_parents())
    kwargs = {"skip_invalid": skip} if endpoint == "import_data" else {}
    with pytest.raises(HTTPException) as exc:
        asyncio.run(getattr(imports, endpoint)(
            scope=scope, year=None, term=None, grade=None,
            file=upload([good, bad]), db=db, _={}, **kwargs,
        ))
    assert exc.value.status_code == 422
    assert ("第3行与第2行" if kind == "duplicate" else "2个不同") in str(exc.value.detail)
    assert db.queries == db.writes == []
    assert db.commits == 0
    assert db.rollbacks == (1 if endpoint == "import_data" and scope == "selections" else 0)


def test_blank_rows_keep_physical_error_order_through_parent_validation():
    good = ROWS["selections"]
    rows = [
        {**good, "学号": "invalid-field", "姓名": "x" * 1000},
        {key: "" for key in good},
        {**good, "学号": "missing-parent"},
        good,
    ]
    db = FakeDb(parents=selection_parents())
    result = execute(scope="selections", rows=rows, db=db, skip_invalid=True)
    assert result["total_rows"] == 3
    assert [error["row"] for error in result["errors"]] == [2, 4]
    assert result["invalid"] == result["skipped"] == 2
    assert result["processed"] == result["inserted"] == len(db.writes) == 1
    assert db.writes[0].compile().params["student_no"] == good["学号"]
    assert len(db.parent_queries) >= 4
    assert db.commits == 1 and db.rollbacks == 0
