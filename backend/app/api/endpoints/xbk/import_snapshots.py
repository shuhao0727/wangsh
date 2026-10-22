"""XBK 导入的年级与限额快照校验。

导入预览与执行共用同一套裁决：新增课程必须带各班限报人数，文件年级与库中
快照不一致时整份拒绝，页面选择年级必须与文件一致。与行级校验分开，避免
import_export 继续膨胀。
"""
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy import select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.xbk.course import XbkCourse
from app.models.xbk.selection import XbkSelection

# 课程限额缺失不等于 0：旧实现把 None 写成 0，课程会静默变成“任何人都选不上”。
_COURSE_QUOTA_REQUIRED = (
    "各班限报人数不能为空：新增课程必须填写各班限报人数，系统无法把空值推断为 0 或不限。"
    "已存在的课程未提供该列或单元格为空时保留库中原值。")
_COURSE_GRADE_CONFLICT = (
    "课程 {code} 的年级与已有记录不一致（{location}：文件为 {incoming}，库中为 {stored}）。"
    "已阻止整份文件导入；如需调整年级，请先在课程目录中编辑原记录。")
_SELECTION_GRADE_CONFLICT = (
    "学生 {student_no} 的年级与已有选课快照不一致（{location}：文件为 {incoming}，库中为 {stored}）。"
    "已阻止整份文件导入；如需更正年级，请先在选课记录中编辑原记录。")


def require_xlsx_format(format: str) -> None:
    """导出统一使用 xlsx；旧参数 xls 只改扩展名不改字节，Excel 会报格式不符。"""
    if format != "xlsx":
        raise HTTPException(status_code=400, detail="不支持 .xls 导出，请使用 xlsx")


def apply_course_quota(values: Dict[str, Any], row: Dict[str, Any]) -> bool:
    """写入课程限额并返回是否缺失。

    缺列或空单元格都记为“未提供”，不能静默折成 0，否则新课限额为 0 且无提示。
    """
    quota_text = _normalize_str(row.get("各班限报人数"))
    if quota_text is not None:
        values["quota"] = quota_text
    return quota_text is None


def restore_course_quota_on_missing(values: Dict[str, Any], quota_missing: bool) -> None:
    """更新时保留库中原值；是否允许缺省由预检按“新增/已存在”裁决。"""
    if quota_missing:
        values.pop("quota", None)


def _normalize_str(value: Any) -> Optional[str]:
    """去首尾空白，空串视为未设置。"""
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _require_selected_grade_matches(
    valid: list, row_numbers: List[int], grade_flags: List[bool], selected_grade: Optional[str],
) -> None:
    """页面选择的年级必须与文件中的年级一致，避免用户选择被静默丢弃。"""
    if not selected_grade:
        return
    for (values, _), row_number, grade_from_file in zip(valid, row_numbers, grade_flags):
        file_grade = values.get("grade") if grade_from_file else None
        if file_grade is not None and file_grade != selected_grade:
            raise HTTPException(status_code=422, detail=(
                f"第{row_number}行的年级为 {file_grade}，与本次导入选择的年级 "
                f"{selected_grade} 不一致。请在页面上选择 {file_grade} 后重试，"
                "或修改文件中该行的年级。"
            ))


async def validate_import_parent_snapshots(
    scope: str, valid: list, row_numbers: List[int], db: AsyncSession,
    grade_flags: List[bool], selected_grade: Optional[str] = None,
) -> None:
    """Reject silent grade/quota overwrites before any write (preview and execute).

    - 新增课程缺少“各班限报人数”：整份文件 422（行号 + 字段名），不再静默写 0。
    - 已存在课程/选课：**文件显式给出**的年级与库中快照不一致时整份 422；
      文件未给出年级时（例如整列缺失、沿用页面筛选默认值）保留库中原值。
    - 导入页面选择的年级与文件中的年级不一致：整份 422。否则用户选择的年级
      会被文件值静默丢弃（新增路径）或只在库中已有记录时才被拒绝（更新路径），
      同一份文件按记录是否已存在得到两种结果。
    """
    if scope not in {"courses", "selections"} or not valid or db is None:
        return
    # grade_flags 由调用方按“文件是否显式给出年级”计算，页面默认值不参与比对。
    _require_selected_grade_matches(valid, row_numbers, grade_flags, selected_grade)
    if scope == "courses":
        model, key_fields = XbkCourse, ("year", "term", "course_code")
        columns = (XbkCourse.year, XbkCourse.term, XbkCourse.course_code, XbkCourse.grade)
    else:
        model, key_fields = XbkSelection, ("year", "term", "student_no")
        columns = (XbkSelection.year, XbkSelection.term, XbkSelection.student_no, XbkSelection.grade)
    keys = list({tuple(values[field] for field in key_fields) for values, _ in valid})
    # 自然键唯一性包含软删除记录（课程按 (year, term, course_code) 唯一，
    # 选课恢复也会命中旧行），因此这里不按 is_deleted 过滤，避免恢复时静默改快照。
    stored: Dict[tuple[str, ...], List[Optional[str]]] = {}
    key_columns = [getattr(model, field) for field in key_fields]
    for offset in range(0, len(keys), 500):
        statement = select(*columns).where(
            tuple_(*key_columns).in_(keys[offset:offset + 500]),
        )
        for *key, grade in (await db.execute(statement)).all():
            stored.setdefault(tuple(key), []).append(_normalize_str(grade))
    for (values, _), row_number, grade_from_file in zip(valid, row_numbers, grade_flags):
        _check_snapshot_grade(
            scope, key_fields, stored, values, row_number, grade_from_file,
        )


def _check_snapshot_grade(
    scope: str,
    key_fields: tuple,
    stored: Dict[tuple[str, ...], List[Optional[str]]],
    values: Dict[str, Any],
    row_number: int,
    grade_from_file: bool,
) -> None:
    """新增课程必须带限额；年级快照冲突整份拒绝，文件未给年级时保留库中原值。"""
    key = tuple(values[field] for field in key_fields)
    if key not in stored:
        if scope == "courses" and "quota" not in values:
            raise HTTPException(status_code=422, detail=f"第{row_number}行 {_COURSE_QUOTA_REQUIRED}")
        return
    stored_grades = [grade for grade in stored[key] if grade is not None]
    if not grade_from_file:
        # 文件没有提供年级时保留库中快照，不用筛选默认值或 NULL 覆盖历史值。
        values.pop("grade", None)
        return
    incoming_grade = values.get("grade")
    if incoming_grade is None or all(grade == incoming_grade for grade in stored_grades):
        return
    template = _COURSE_GRADE_CONFLICT if scope == "courses" else _SELECTION_GRADE_CONFLICT
    raise HTTPException(status_code=422, detail=template.format(
        code=values.get("course_code"),
        student_no=values.get("student_no"),
        location=f"第{row_number}行",
        incoming=incoming_grade,
        stored=stored_grades[0],
    ))


def prepare_import_row(row, scope, defaults, fields, required):
    """Normalize one physical row without deciding whole-file or parent validity."""
    # 延迟导入：这三个辅助函数仍在 import_export 中，模块级导入会形成循环。
    from app.api.endpoints.xbk.import_export import (
        _get_year_term, _normalize_selection_course_code, _validate_import_values,
    )
    year, term, grade = defaults
    messages = []
    preview = {k: _normalize_str(row.get(k)) for k in row.index}
    values = {}
    period = None
    quota_missing = False
    try:
        values["year"], values["term"] = _get_year_term(row, year, term)
        preview["学年"], preview["学期"] = str(values["year"]), values["term"]
        period = (values["year"], values["term"])
    except HTTPException as exc:
        messages.append(str(exc.detail))
    values["grade"] = _normalize_str(row.get("年级")) or _normalize_str(grade)
    if values["grade"] is not None:
        preview["年级"] = values["grade"]
    for label, field in fields.items():
        value = _normalize_str(row.get(label))
        if scope == "selections" and label == "课程代码":
            value = _normalize_selection_course_code(value)
            preview[label] = value
        if label in required and value is None:
            messages.append(f"{label}不能为空")
        values[field] = value
    quota_missing = apply_course_quota(values, row) if scope == "courses" else False
    if not messages:
        values, messages = _validate_import_values(scope, values, fields)
        restore_course_quota_on_missing(values, quota_missing) if scope == "courses" else None
    return values, preview, messages, period, quota_missing
