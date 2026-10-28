"""Users 导入测试"""
import asyncio
import io

from types import SimpleNamespace

from fastapi import UploadFile

from app.api.endpoints.management.users import users as users_api


class _ScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value

    def scalars(self):
        return self

    def all(self):
        return self._value if isinstance(self._value, list) else [self._value]


class _Savepoint:
    def __init__(self):
        self.rollback_count = 0

    async def rollback(self):
        self.rollback_count += 1


class _ImportDb:
    def __init__(self, existing_user, begin_nested_failures=0):
        self.existing_user = existing_user
        self.begin_nested_failures = begin_nested_failures
        self.commit_count = 0
        self.savepoints = []
        self.added = []
        self.execute_count = 0
        self.actor = SimpleNamespace(
            id=10, role_code="admin", is_active=True, is_deleted=False
        )

    def get_bind(self):
        return SimpleNamespace(dialect=SimpleNamespace(name="sqlite"))

    async def begin_nested(self):
        if self.begin_nested_failures:
            self.begin_nested_failures -= 1
            raise RuntimeError("savepoint unavailable")
        savepoint = _Savepoint()
        self.savepoints.append(savepoint)
        return savepoint

    async def execute(self, query):
        self.execute_count += 1
        if query._for_update_arg is not None and query._order_by_clauses:
            rows = [self.actor]
            if self.existing_user is not None:
                rows.append(self.existing_user)
            return _ScalarResult(rows)
        if query._for_update_arg is not None:
            return _ScalarResult(self.existing_user)
        return _ScalarResult(None)

    async def scalar(self, _query):
        return self.existing_user.id if self.existing_user is not None else None

    def add(self, value):
        self.added.append(value)

    async def flush(self):
        return None

    async def commit(self):
        self.commit_count += 1

    async def rollback(self):
        return None


def test_admin_import_cannot_modify_existing_privileged_user():
    existing_user = SimpleNamespace(
        id=1,
        student_id="A001",
        username="root",
        full_name="超级管理员",
        study_year=None,
        class_name=None,
        role_code="super_admin",
        is_active=True,
        is_deleted=False,
    )
    db = _ImportDb(existing_user)
    csv_content = (
        "学号,姓名,学年,班级,状态,用户名,角色\n"
        "A001,被篡改,2026,高一(1)班,false,hijacked,student\n"
    ).encode("utf-8")
    upload = UploadFile(filename="users.csv", file=io.BytesIO(csv_content))

    result = asyncio.run(
        users_api.import_users(
            upload,
            {"id": 10, "role_code": "admin"},
            db,
        )
    )

    assert result.success is False
    assert result.updated_count == 0
    assert result.error_count == 1
    assert result.errors[0].message == "403: 无权修改管理员或超级管理员"
    assert existing_user.full_name == "超级管理员"
    assert existing_user.username == "root"
    assert existing_user.is_active is True
    assert db.savepoints[0].rollback_count == 1


def test_admin_import_rejects_privileged_role_instead_of_downgrading():
    db = _ImportDb(existing_user=None)
    csv_content = (
        "学号,姓名,学年,班级,状态,用户名,角色\n"
        "A002,越权账号,2026,高一(1)班,true,admin2,admin\n"
    ).encode("utf-8")
    upload = UploadFile(filename="users.csv", file=io.BytesIO(csv_content))

    result = asyncio.run(
        users_api.import_users(
            upload,
            {"id": 10, "role_code": "admin"},
            db,
        )
    )

    assert result.success is False
    assert result.imported_count == 0
    assert result.error_count == 1
    assert result.errors[0].message == "403: 管理员只能设置学生或教师角色"
    assert db.savepoints[0].rollback_count == 1


def test_import_savepoint_creation_failure_is_reported_per_row_and_next_row_continues():
    db = _ImportDb(existing_user=None, begin_nested_failures=1)
    csv_content = (
        "学号,姓名,学年,班级,状态,用户名,角色\n"
        "A002,首行失败,2026,高一(1)班,true,first,student\n"
        "A003,继续导入,2026,高一(1)班,true,second,student\n"
    ).encode("utf-8")
    upload = UploadFile(filename="users.csv", file=io.BytesIO(csv_content))

    result = asyncio.run(
        users_api.import_users(
            upload,
            {"id": 10, "role_code": "admin"},
            db,
        )
    )

    assert result.success is False
    assert result.total_rows == 2
    assert result.imported_count == 1
    assert result.error_count == 1
    assert result.errors[0].row_number == 1
    assert result.errors[0].message == "savepoint unavailable"
    assert len(db.added) == 1
    assert db.commit_count == 1


# ---------------------------------------------------------------------------
# 提交 5：畸形文件必须 400，非法角色必须行级报错
# ---------------------------------------------------------------------------
import pytest  # noqa: E402
from fastapi import HTTPException  # noqa: E402
from openpyxl import Workbook  # noqa: E402

from app.api.endpoints.management.users import import_service  # noqa: E402


def test_parse_csv_rows_rejects_non_utf8_bytes_with_400():
    # 0xff 不是合法 UTF-8 起始字节，旧实现会让 UnicodeDecodeError 冒泡成 500
    content = "学号,姓名\nS1,张三\n".encode("utf-8") + b"\xff\xfe\x00"

    with pytest.raises(HTTPException) as exc_info:
        import_service.parse_csv_rows(content)

    assert exc_info.value.status_code == 400
    assert "UTF-8" in exc_info.value.detail


def test_parse_xlsx_rows_rejects_broken_zip_with_400():
    with pytest.raises(HTTPException) as exc_info:
        import_service.parse_xlsx_rows(b"this is definitely not a zip archive")

    assert exc_info.value.status_code == 400
    assert "Excel" in exc_info.value.detail


def test_parse_xlsx_rows_rejects_truncated_workbook_with_400():
    buffer = io.BytesIO()
    workbook = Workbook()
    workbook.active.append(["学号", "姓名"])
    workbook.active.append(["X9", "截断"])
    workbook.save(buffer)

    with pytest.raises(HTTPException) as exc_info:
        import_service.parse_xlsx_rows(buffer.getvalue()[:200])

    assert exc_info.value.status_code == 400


def test_parse_xlsx_rows_still_reads_valid_workbook():
    buffer = io.BytesIO()
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.append(["学号", "姓名", "角色"])
    worksheet.append(["XL-1", "表格一", "student"])
    workbook.save(buffer)

    fieldnames, rows = import_service.parse_xlsx_rows(buffer.getvalue())

    assert fieldnames == ["学号", "姓名", "角色"]
    assert list(rows)[0] == {"学号": "XL-1", "姓名": "表格一", "角色": "student"}


def test_invalid_role_is_row_level_error_not_silent_downgrade():
    db = _ImportDb(existing_user=None)
    csv_content = "学号,姓名,角色\nROLE-1,非法角色,not_a_role\n".encode("utf-8")
    upload = UploadFile(filename="users.csv", file=io.BytesIO(csv_content))

    result = asyncio.run(
        users_api.import_users(upload, {"id": 10, "role_code": "super_admin"}, db)
    )

    assert result.success is False
    assert result.imported_count == 0
    assert result.error_count == 1
    assert "角色值无效" in result.errors[0].message
    # 关键：不能静默降级成 student 并入库
    assert db.added == []
    assert db.savepoints[0].rollback_count == 1


def test_invalid_middle_row_keeps_surrounding_rows_committed():
    db = _ImportDb(existing_user=None)
    csv_content = (
        "学号,姓名,角色\n"
        "MID-1,前一行,student\n"
        "MID-BAD,中间坏行,not_a_role\n"
        "MID-3,后一行,student\n"
    ).encode("utf-8")
    upload = UploadFile(filename="users.csv", file=io.BytesIO(csv_content))

    result = asyncio.run(
        users_api.import_users(upload, {"id": 10, "role_code": "super_admin"}, db)
    )

    assert result.imported_count == 2
    assert result.error_count == 1
    assert result.errors[0].row_number == 2
    # 逐行 savepoint：只回滚坏行，其余照常提交（保持既有语义，不改整份回滚）
    assert db.savepoints[1].rollback_count == 1
    assert db.commit_count == 1
    assert sorted(user.student_id for user in db.added) == ["MID-1", "MID-3"]


def test_role_value_is_case_insensitive_after_normalization():
    parsed = import_service._parse_import_user(
        {"学号": "C1", "姓名": "大小写", "角色": "STUDENT"}
    )
    assert parsed["role_code"] == "student"

    parsed_teacher = import_service._parse_import_user(
        {"学号": "C2", "姓名": "教师", "角色": " Teacher "}
    )
    assert parsed_teacher["role_code"] == "teacher"


# ---------------------------------------------------------------------------
# 文件级错误必须整体失败：400/413 不能被降级成行级 error，也不能留下脏数据
# ---------------------------------------------------------------------------


class _LeakTrackingDb(_ImportDb):
    """记录 rollback 是否被调用，用于断言「文件级错误后事务被清理」。"""

    def __init__(self, existing_user=None):
        super().__init__(existing_user=existing_user)
        self.rollback_count = 0

    async def rollback(self):
        self.rollback_count += 1


def _xlsx_with_truncated_sheet_xml(keep_fraction: float = 0.95) -> bytes:
    """构造 zip 容器合法、但 sheet1.xml 被截断的真实 xlsx。

    这类文件能通过 load_workbook，只有迭代到中途才抛异常，
    正是 row_generator 里那段 400 归一化的目标场景。
    """
    import zipfile

    from openpyxl import Workbook

    buffer = io.BytesIO()
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.append(["学号", "姓名", "角色"])
    for index in range(200):
        worksheet.append([f"S{index:04d}", f"学生{index}", "student"])
    workbook.save(buffer)

    source = zipfile.ZipFile(io.BytesIO(buffer.getvalue()))
    sheet_xml = source.read("xl/worksheets/sheet1.xml")
    truncated = sheet_xml[: int(len(sheet_xml) * keep_fraction)]

    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as target:
        for item in source.infolist():
            payload = source.read(item.filename)
            if item.filename == "xl/worksheets/sheet1.xml":
                payload = truncated
            target.writestr(item, payload)
    return output.getvalue()


def test_corrupted_xlsx_mid_iteration_returns_400_and_writes_nothing():
    """迭代中途发现损坏 → 400，且已 flush 的行必须被回滚，不能落库半份数据。"""
    db = _LeakTrackingDb(existing_user=None)
    upload = UploadFile(
        filename="broken.xlsx",
        file=io.BytesIO(_xlsx_with_truncated_sheet_xml()),
    )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            users_api.import_users(
                upload, {"id": 10, "role_code": "super_admin"}, db
            )
        )

    assert exc_info.value.status_code == 400
    assert "Excel" in exc_info.value.detail
    # 关键：文件级错误不得提交任何行，且必须显式清理事务
    assert db.commit_count == 0
    assert db.rollback_count >= 1


def test_row_limit_exceeded_returns_413_and_writes_nothing(monkeypatch):
    """超出单次导入行数上限同样属于文件级错误：413，不得降级成行级 error。"""
    monkeypatch.setattr(import_service, "MAX_USER_IMPORT_ROWS", 2)
    db = _LeakTrackingDb(existing_user=None)
    csv_content = (
        "学号,姓名,角色\n"
        "L-1,第一行,student\n"
        "L-2,第二行,student\n"
        "L-3,第三行,student\n"
    ).encode("utf-8")
    upload = UploadFile(filename="users.csv", file=io.BytesIO(csv_content))

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            users_api.import_users(
                upload, {"id": 10, "role_code": "super_admin"}, db
            )
        )

    assert exc_info.value.status_code == 413
    assert db.commit_count == 0
    assert db.rollback_count >= 1


def test_row_level_error_still_commits_without_failing_request():
    """回归保护：逐行错误必须仍然是 200 + error_count，不能被上面的放行逻辑影响。"""
    db = _LeakTrackingDb(existing_user=None)
    csv_content = (
        "学号,姓名,角色\n"
        "OK-1,正常行,student\n"
        "BAD-2,坏角色,not_a_role\n"
    ).encode("utf-8")
    upload = UploadFile(filename="users.csv", file=io.BytesIO(csv_content))

    result = asyncio.run(
        users_api.import_users(upload, {"id": 10, "role_code": "super_admin"}, db)
    )

    assert result.success is False
    assert result.imported_count == 1
    assert result.error_count == 1
    assert result.errors[0].row_number == 2
    # 行级错误照常提交，且不应触发整体 rollback
    assert db.commit_count == 1
    assert db.rollback_count == 0
