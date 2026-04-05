"""XBK 模块结构与路由完整性测试"""
import asyncio
from types import SimpleNamespace

from pydantic import ValidationError

from app.schemas.xbk import (
    XbkCourseOut,
    XbkCourseUpsert,
    XbkListResponse,
    XbkSelectionOut,
    XbkSelectionUpsert,
    XbkStudentOut,
    XbkStudentUpsert,
)


# ---------------------------------------------------------------------------
# Schema 验证测试
# ---------------------------------------------------------------------------

def test_student_out_schema():
    """XbkStudentOut 正确序列化"""
    data = XbkStudentOut(
        id=1, year=2025, term="上", grade="高一",
        class_name="1班", student_no="2025001", name="张三", gender="男",
    )
    d = data.model_dump()
    assert d["id"] == 1
    assert d["student_no"] == "2025001"
    assert d["gender"] == "男"


def test_student_out_optional_fields():
    """XbkStudentOut 可选字段默认 None"""
    data = XbkStudentOut(
        id=1, year=2025, term="上",
        class_name="1班", student_no="2025001", name="张三",
    )
    assert data.grade is None
    assert data.gender is None


def test_student_upsert_schema():
    """XbkStudentUpsert 必填字段校验"""
    data = XbkStudentUpsert(
        year=2025, term="上", class_name="1班",
        student_no="2025001", name="张三",
    )
    assert data.year == 2025
    assert data.grade is None


def test_student_upsert_missing_required():
    """XbkStudentUpsert 缺少必填字段应报错"""
    try:
        XbkStudentUpsert(year=2025, term="上")  # type: ignore[call-arg]
        assert False, "Should raise ValidationError"
    except ValidationError:
        pass


def test_course_out_schema():
    """XbkCourseOut 正确序列化"""
    data = XbkCourseOut(
        id=1, year=2025, term="上", grade="高一",
        course_code="CS101", course_name="计算机基础",
        teacher="王老师", quota=30, location="A101",
    )
    d = data.model_dump()
    assert d["course_code"] == "CS101"
    assert d["quota"] == 30


def test_course_upsert_default_quota():
    """XbkCourseUpsert quota 默认值为 0"""
    data = XbkCourseUpsert(
        year=2025, term="上", course_code="CS101", course_name="计算机基础",
    )
    assert data.quota == 0


def test_selection_out_schema():
    """XbkSelectionOut 正确序列化"""
    data = XbkSelectionOut(
        id=1, year=2025, term="上", grade="高一",
        student_no="2025001", name="张三", course_code="CS101",
    )
    assert data.student_no == "2025001"
    assert data.course_code == "CS101"


def test_list_response_schema():
    """XbkListResponse 结构正确"""
    data = XbkListResponse(total=10, items=[{"id": 1}])
    assert data.total == 10
    assert len(data.items) == 1


# ---------------------------------------------------------------------------
# 路由完整性测试
# ---------------------------------------------------------------------------

def test_students_router_has_all_endpoints():
    """students 路由包含完整 CRUD 端点"""
    from app.api.endpoints.xbk.students import router

    paths = [r.path for r in router.routes if hasattr(r, "path")]
    methods_map = {}
    for route in router.routes:
        if hasattr(route, "methods") and hasattr(route, "path"):
            for m in route.methods:
                methods_map[f"{m} {route.path}"] = True

    assert "GET /students" in methods_map
    assert "POST /students" in methods_map
    assert "PUT /students/{student_id}" in methods_map
    assert "DELETE /students/{student_id}" in methods_map


def test_courses_router_has_all_endpoints():
    """courses 路由包含完整 CRUD 端点"""
    from app.api.endpoints.xbk.courses import router

    methods_map = {}
    for route in router.routes:
        if hasattr(route, "methods") and hasattr(route, "path"):
            for m in route.methods:
                methods_map[f"{m} {route.path}"] = True

    assert "GET /courses" in methods_map
    assert "POST /courses" in methods_map
    assert "PUT /courses/{course_id}" in methods_map
    assert "DELETE /courses/{course_id}" in methods_map


def test_selections_router_has_all_endpoints():
    """selections 路由包含完整 CRUD + 查询端点"""
    from app.api.endpoints.xbk.selections import router

    methods_map = {}
    for route in router.routes:
        if hasattr(route, "methods") and hasattr(route, "path"):
            for m in route.methods:
                methods_map[f"{m} {route.path}"] = True

    assert "GET /selections" in methods_map
    assert "POST /selections" in methods_map
    assert "PUT /selections/{selection_id}" in methods_map
    assert "DELETE /selections/{selection_id}" in methods_map
    assert "GET /course-results" in methods_map


def test_bulk_ops_router_has_endpoints():
    """bulk_ops 路由包含批量删除和元数据端点"""
    from app.api.endpoints.xbk.bulk_ops import router

    methods_map = {}
    for route in router.routes:
        if hasattr(route, "methods") and hasattr(route, "path"):
            for m in route.methods:
                methods_map[f"{m} {route.path}"] = True

    assert "DELETE " in methods_map
    assert "GET /meta" in methods_map


def test_xbk_main_router_includes_all_subrouters():
    """XBK 主路由注册了所有子路由"""
    from app.api.endpoints.xbk import router

    paths = set()
    for route in router.routes:
        if hasattr(route, "path"):
            paths.add(route.path)  # type: ignore[union-attr]

    # 验证关键路径存在
    assert "/data/students" in paths or any("/data/students" in str(p) for p in paths)
    assert "/data/courses" in paths or any("/data/courses" in str(p) for p in paths)
    assert "/data/selections" in paths or any("/data/selections" in str(p) for p in paths)
    assert "/data/meta" in paths or any("/data/meta" in str(p) for p in paths)


# ---------------------------------------------------------------------------
# 认证依赖检查
# ---------------------------------------------------------------------------

def test_write_endpoints_require_admin():
    """所有写操作端点必须依赖 require_admin"""
    from app.api.endpoints.xbk.students import router as s_router
    from app.api.endpoints.xbk.courses import router as c_router
    from app.api.endpoints.xbk.selections import router as sel_router
    from app.api.endpoints.xbk.bulk_ops import router as b_router

    write_methods = {"POST", "PUT", "DELETE"}

    for router_obj, name in [
        (s_router, "students"),
        (c_router, "courses"),
        (sel_router, "selections"),
        (b_router, "bulk_ops"),
    ]:
        for route in router_obj.routes:
            if not hasattr(route, "methods"):
                continue
            methods = getattr(route, "methods", set())
            if not methods & write_methods:
                continue
            deps = [d.call for d in route.dependant.dependencies]  # type: ignore[union-attr]
            dep_names = [getattr(d, "__name__", str(d)) for d in deps]
            assert "require_admin" in dep_names, (
                f"{name} {methods} {route.path} 缺少 require_admin 依赖"  # type: ignore[union-attr]
            )


def test_read_endpoints_use_require_xbk_access():
    """GET 端点使用 require_xbk_access（公开/管理员双模式）"""
    from app.api.endpoints.xbk.students import router as s_router
    from app.api.endpoints.xbk.courses import router as c_router
    from app.api.endpoints.xbk.selections import router as sel_router
    from app.api.endpoints.xbk.bulk_ops import router as b_router

    for router_obj, name in [
        (s_router, "students"),
        (c_router, "courses"),
        (sel_router, "selections"),
        (b_router, "bulk_ops"),
    ]:
        for route in router_obj.routes:
            if not hasattr(route, "methods"):
                continue
            methods = getattr(route, "methods", set())
            if "GET" not in methods:
                continue
            deps = [d.call for d in route.dependant.dependencies]  # type: ignore[union-attr]
            dep_names = [getattr(d, "__name__", str(d)) for d in deps]
            assert "require_xbk_access" in dep_names, (
                f"{name} GET {route.path} 缺少 require_xbk_access 依赖"  # type: ignore[union-attr]
            )


# ---------------------------------------------------------------------------
# 公共过滤函数测试
# ---------------------------------------------------------------------------

def test_apply_common_filters_no_conditions():
    """无条件时返回原始语句"""
    from app.api.endpoints.xbk._common import apply_common_filters
    from app.models import XbkStudent
    from sqlalchemy import select

    stmt = select(XbkStudent)
    result = apply_common_filters(stmt, XbkStudent, None, None, None, None)
    # 无条件时应返回相同语句（无 WHERE 子句添加）
    assert result is stmt


def test_apply_common_filters_with_year():
    """年份过滤生成正确 WHERE 子句"""
    from app.api.endpoints.xbk._common import apply_common_filters
    from app.models import XbkStudent
    from sqlalchemy import select

    stmt = select(XbkStudent)
    result = apply_common_filters(stmt, XbkStudent, 2025, None, None, None)
    # 应返回不同的语句对象（添加了 WHERE）
    assert result is not stmt
    compiled = str(result.compile(compile_kwargs={"literal_binds": True}))
    assert "2025" in compiled


def test_apply_common_filters_with_search():
    """关键词搜索生成 ILIKE 条件"""
    from app.api.endpoints.xbk._common import apply_common_filters
    from app.models import XbkStudent
    from sqlalchemy import select

    stmt = select(XbkStudent)
    result = apply_common_filters(stmt, XbkStudent, None, None, None, "张三")
    compiled = str(result.compile(compile_kwargs={"literal_binds": True}))
    assert "LIKE" in compiled.upper()


def test_apply_common_filters_whitespace_search_ignored():
    """空白搜索词不添加条件"""
    from app.api.endpoints.xbk._common import apply_common_filters
    from app.models import XbkStudent
    from sqlalchemy import select

    stmt = select(XbkStudent)
    result = apply_common_filters(stmt, XbkStudent, None, None, None, "   ")
    assert result is stmt


def test_apply_common_filters_course_model():
    """过滤函数适用于 XbkCourse 模型"""
    from app.api.endpoints.xbk._common import apply_common_filters
    from app.models import XbkCourse
    from sqlalchemy import select

    stmt = select(XbkCourse)
    result = apply_common_filters(stmt, XbkCourse, 2025, "上", "高一", "数学")
    compiled = str(result.compile(compile_kwargs={"literal_binds": True}))
    assert "2025" in compiled
    assert "LIKE" in compiled.upper()


# ---------------------------------------------------------------------------
# data.py 兼容性桥接测试
# ---------------------------------------------------------------------------

def test_data_py_backward_compat():
    """旧 data.py 导入路径仍然可用"""
    from app.api.endpoints.xbk.data import require_xbk_access, apply_common_filters
    assert callable(require_xbk_access)
    assert callable(apply_common_filters)
