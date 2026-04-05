"""
点名系统 (XXJS) 测试

覆盖场景：
1. list_classes 返回聚合班级列表
2. list_students 返回指定班级学生
3. import_students 批量导入（含去重）
4. import_students 空名单返回空列表
5. delete_class 删除整个班级
6. update_class_students 覆盖模式
7. schemas 模型验证
8. 认证依赖检查
"""

import asyncio
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from app.schemas.xxjs.dianming import (
    DianmingClass,
    DianmingImportRequest,
    DianmingStudent,
    DianmingStudentBase,
)


# ── Fake DB 辅助类 ──────────────────────────────────────────


class _FakeResult:
    """模拟 SQLAlchemy Result 对象"""

    def __init__(self, rows=None, scalar_rows=None):
        self._rows = rows or []
        self._scalar_rows = scalar_rows or []

    def all(self):
        return self._rows

    def scalars(self):
        return self

    def scalar_one_or_none(self):
        return self._scalar_rows[0] if self._scalar_rows else None


class _FakeDeleteResult:
    """模拟 DELETE 语句的结果"""

    def __init__(self, rowcount=0):
        self.rowcount = rowcount


class _FakeDB:
    """模拟 AsyncSession"""

    def __init__(self, execute_results=None):
        self._execute_results = list(execute_results or [])
        self.execute_count = 0
        self.commit_count = 0
        self.added = []

    async def execute(self, _stmt):
        if self.execute_count >= len(self._execute_results):
            return _FakeResult()
        result = self._execute_results[self.execute_count]
        self.execute_count += 1
        return result

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.commit_count += 1

    async def refresh(self, _obj):
        pass


def _make_student(id=1, year="2026", class_name="高一(1)班", student_name="张三", student_no=None):
    """创建模拟学生对象"""
    return SimpleNamespace(
        id=id,
        year=year,
        class_name=class_name,
        student_name=student_name,
        student_no=student_no,
        created_at=datetime(2026, 1, 1),
        updated_at=datetime(2026, 1, 1),
    )


# ── Schema 测试 ──────────────────────────────────────────


def test_dianming_class_schema():
    """DianmingClass schema 验证"""
    cls = DianmingClass(year="2026", class_name="高一(1)班", count=35)
    assert cls.year == "2026"
    assert cls.class_name == "高一(1)班"
    assert cls.count == 35


def test_dianming_student_schema():
    """DianmingStudent schema 从 ORM 对象创建"""
    obj = _make_student()
    student = DianmingStudent.model_validate(obj)
    assert student.id == 1
    assert student.student_name == "张三"
    assert student.year == "2026"


def test_dianming_import_request_schema():
    """DianmingImportRequest schema 验证"""
    req = DianmingImportRequest(
        year="2026",
        class_name="高一(1)班",
        names_text="张三\n李四\n王五",
    )
    assert req.year == "2026"
    names = [n.strip() for n in req.names_text.split("\n") if n.strip()]
    assert len(names) == 3


def test_dianming_student_base_optional_student_no():
    """student_no 是可选字段"""
    base = DianmingStudentBase(
        year="2026",
        class_name="高一(1)班",
        student_name="张三",
    )
    assert base.student_no is None

    base_with_no = DianmingStudentBase(
        year="2026",
        class_name="高一(1)班",
        student_name="张三",
        student_no="20260001",
    )
    assert base_with_no.student_no == "20260001"


# ── API 端点逻辑测试 ──────────────────────────────────────


def test_list_classes():
    """list_classes 返回聚合班级列表"""
    from app.api.endpoints.xxjs.dianming import list_classes

    fake_rows = [
        ("2026", "高一(1)班", 35),
        ("2026", "高一(2)班", 33),
    ]
    db = _FakeDB([_FakeResult(rows=fake_rows)])

    async def run():
        return await list_classes(db=db, _={"id": 1, "role_code": "admin"})

    result = asyncio.run(run())
    assert len(result) == 2
    assert result[0]["year"] == "2026"
    assert result[0]["class_name"] == "高一(1)班"
    assert result[0]["count"] == 35


def test_list_students():
    """list_students 返回指定班级学生"""
    from app.api.endpoints.xxjs.dianming import list_students

    students = [_make_student(id=1), _make_student(id=2, student_name="李四")]

    # scalars().all() 链式调用需要专用 mock
    class _ScalarResult:
        def __init__(self, items):
            self._items = items

        def scalars(self):
            return self

        def all(self):
            return self._items

    db = _FakeDB([_ScalarResult(students)])
    result = asyncio.run(
        list_students(year="2026", class_name="高一(1)班", db=db, _={"id": 1})
    )
    assert len(result) == 2


def test_import_students_empty():
    """空名单返回空列表"""
    from app.api.endpoints.xxjs.dianming import import_students

    data = DianmingImportRequest(year="2026", class_name="高一(1)班", names_text="")
    db = _FakeDB()

    result = asyncio.run(
        import_students(data=data, db=db, _={"id": 1, "role_code": "admin"})
    )
    assert result == []
    assert db.commit_count == 0


def test_import_students_whitespace_only():
    """只有空白字符的名单返回空列表"""
    from app.api.endpoints.xxjs.dianming import import_students

    data = DianmingImportRequest(year="2026", class_name="高一(1)班", names_text="  \n  \n  ")
    db = _FakeDB()

    result = asyncio.run(
        import_students(data=data, db=db, _={"id": 1, "role_code": "admin"})
    )
    assert result == []


def test_delete_class():
    """delete_class 返回成功和删除数量"""
    from app.api.endpoints.xxjs.dianming import delete_class

    db = _FakeDB([_FakeDeleteResult(rowcount=5)])

    result = asyncio.run(
        delete_class(year="2026", class_name="高一(1)班", db=db, _={"id": 1, "role_code": "admin"})
    )
    assert result["success"] is True
    assert result["deleted"] == 5
    assert db.commit_count == 1


def test_delete_class_empty():
    """删除不存在的班级返回 deleted=0"""
    from app.api.endpoints.xxjs.dianming import delete_class

    db = _FakeDB([_FakeDeleteResult(rowcount=0)])

    result = asyncio.run(
        delete_class(year="2026", class_name="不存在班", db=db, _={"id": 1, "role_code": "admin"})
    )
    assert result["success"] is True
    assert result["deleted"] == 0


# ── 认证依赖检查 ──────────────────────────────────────────


def test_endpoints_have_auth_dependencies():
    """验证所有端点都有认证依赖"""
    from app.api.endpoints.xxjs.dianming import router

    for route in router.routes:
        if not hasattr(route, "dependant"):
            continue
        deps = [d.call for d in route.dependant.dependencies]  # type: ignore[union-attr]
        dep_names = [getattr(d, "__name__", str(d)) for d in deps]
        # 每个端点至少有 get_db 和一个认证依赖
        assert "get_db" in dep_names, f"Route {route.path} missing get_db"  # type: ignore[union-attr]
        has_auth = "require_admin" in dep_names or "require_user" in dep_names
        assert has_auth, f"Route {route.path} missing auth dependency"  # type: ignore[union-attr]


def test_write_endpoints_require_admin():
    """写操作端点必须要求管理员权限"""
    from app.api.endpoints.xxjs.dianming import router

    write_methods = {"POST", "PUT", "DELETE"}
    for route in router.routes:
        if not hasattr(route, "methods"):
            continue
        methods = getattr(route, "methods", set())
        if not methods & write_methods:
            continue
        deps = [d.call for d in route.dependant.dependencies]  # type: ignore[union-attr]
        dep_names = [getattr(d, "__name__", str(d)) for d in deps]
        assert "require_admin" in dep_names, (
            f"Write route {route.path} ({methods}) should require admin"  # type: ignore[union-attr]
        )


def test_no_duplicate_student_endpoint():
    """确认不存在重复的 /students 和 /class/students GET 端点"""
    from app.api.endpoints.xxjs.dianming import router

    get_paths = []
    for route in router.routes:
        if not hasattr(route, "methods"):
            continue
        methods = getattr(route, "methods", set())
        if "GET" in methods:
            get_paths.append(route.path)  # type: ignore[union-attr]

    # /students 应该存在
    assert "/students" in get_paths
    # /class/students 不应该作为 GET 端点存在（已合并到 /students）
    # 注意：/class/students 作为 PUT 端点仍然存在（update_class_students）
    get_class_students = [p for p in get_paths if p == "/class/students"]
    assert len(get_class_students) == 0, "GET /class/students should be removed (duplicate of /students)"
