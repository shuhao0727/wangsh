"""导入执行阶段的异常映射。

把数据库层和执行层抛出的异常翻译成用户可理解的接口错误：
可预期的完整性约束冲突回 409（刷新即可重试），父记录在执行途中被删除时
按文档约定给带行号的 422（手工写入仍为 404）；其余未知故障原样抛出，
由全局处理器返回 500，避免内部诊断信息泄露到响应。
"""
from typing import Any, Dict, List

from fastapi import HTTPException

# 可预期的完整性约束冲突：唯一、外键、非空、检查约束。其余 IntegrityError 视为未知故障。
_CONSTRAINT_SQLSTATES = frozenset({"23505", "23503", "23502", "23514"})
_CONSTRAINT_KEYWORDS = ("unique", "foreign key", "not null", "check constraint", "constraint failed")


def is_constraint_violation(exc: BaseException) -> bool:
    """判断 IntegrityError 是否为数据库完整性约束冲突。

    依 SQLSTATE 判断，兼容 asyncpg（sqlstate）与 SQLite（经适配后按消息关键字）。
    """
    current: BaseException | None = exc
    seen: set[int] = set()
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        for attr in ("sqlstate", "pgcode"):
            if getattr(current, attr, None) in _CONSTRAINT_SQLSTATES:
                return True
        current = current.__cause__ or current.__context__
    text = str(exc).lower()
    return any(word in text for word in _CONSTRAINT_KEYWORDS)


def row_attributed_error(exc: HTTPException, valid, row_numbers) -> HTTPException:
    """把执行阶段的父记录缺失转成带行号的 422；其他状态码原样返回。"""
    if exc.status_code != 404:
        return exc
    detail = str(exc.detail)
    row_number = None
    if row_numbers and "学生不存在" in detail:
        # 定位到文件中第一个该父记录已失效的行，便于用户修改
        for (values, _), number in zip(valid, row_numbers):
            if values.get("student_no"):
                row_number = number
                break
    if row_number is None and row_numbers:
        row_number = row_numbers[0]
    return HTTPException(status_code=422, detail={"row": row_number, "errors": [detail]})


def record_import_identity(scope, values, key_fields, row_number, seen_keys):
    # Identity collisions are fatal even in skip-invalid mode: selecting the
    # first or last row would silently lose a different student/course.
    if all(values.get(field) is not None for field in key_fields):
        key = tuple(values[field] for field in key_fields)
        if key in seen_keys:
            identity = "学号" if scope == "students" else "业务编号"
            advice = (
                "学生学号必须在同一学期跨班级、跨年级唯一，不能使用班内序号。"
                if scope == "students" else "请核对并去除重复业务记录后重试。"
            )
            raise HTTPException(status_code=422, detail=(
                f"第{row_number}行与第{seen_keys[key]}行的{identity}重复（同学年、学期）。"
                "已阻止整份文件导入，避免后面的记录覆盖前面的记录；"
                f"{advice}"
            ))
        seen_keys[key] = row_number


def row_errors(idx: int, messages: List[str]) -> Dict[str, Any]:
    """构造带行号的导入错误项。"""
    return {"row": idx, "errors": messages}
