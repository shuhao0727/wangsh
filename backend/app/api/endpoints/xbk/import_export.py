import asyncio
import io
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Annotated, Any, Dict, List, Optional, Tuple

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import Numeric, and_, case, cast, func, or_, select, tuple_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.concurrency import run_in_threadpool

from app.api.endpoints.xbk.import_errors import (is_constraint_violation, record_import_identity,
                                               row_attributed_error, row_errors)
from app.api.endpoints.xbk.import_snapshots import (
    prepare_import_row, require_xlsx_format, validate_import_parent_snapshots,
)
from app.api.endpoints.xbk._common import (UNSELECTED_COURSE_CODES, apply_common_filters,
                                           apply_search_filter, selection_reference_errors)
from app.services.xbk.locking import lock_key_rows
from app.services.xbk.selection_rules import (SelectionMutation, apply_selection_mutations,
                                              guard_course_change, guard_student_change,
                                              is_active_selection_unique_violation,
                                              prefetch_student_references)
from app.core.deps import require_admin
from app.db.database import get_db
from app.models import XbkCourse, XbkSelection, XbkStudent
from app.schemas.xbk.academic_year import AcademicYear, normalize_academic_year
from app.services.xbk.exports.common import force_text_cells
from app.schemas.xbk.data import XbkCourseUpsert, XbkSelectionUpsert, XbkStudentUpsert
from pydantic import ValidationError

from ._import_parsing import (
    normalize_col_name as _normalize_col_name,
    normalize_str as _normalize_str,
    read_csv_rows,
    read_excel_rows,
    validate_import_header,
)

router = APIRouter()


MAX_IMPORT_BYTES = 10 * 1024 * 1024
MAX_IMPORT_EXPANDED_BYTES = 50 * 1024 * 1024
MAX_IMPORT_ROWS = 50_000
MAX_IMPORT_COLUMNS = 100
_PG_INT_MIN = -(2 ** 31)
_PG_INT_MAX = 2 ** 31 - 1


# Match Python str.strip in SQL; plain trim() only removes spaces.
_IDENTITY_WHITESPACE = (
    "\t\n\v\f\r\x1c\x1d\x1e\x1f \x85\xa0\u1680\u2000\u2001\u2002\u2003\u2004"
    "\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000"
)
_STUDENT_IDENTITY_CONFLICT = (
    "导入学号与数据库中另一姓名或年级的学生冲突，已阻止整份文件导入。请核对跨班级、跨年级的唯一学号；如需更正姓名或年级，请明确编辑原记录。")


def _student_identity_condition(values: Dict[str, Any]):
    name = func.trim(XbkStudent.name, _IDENTITY_WHITESPACE)
    grade = func.nullif(func.trim(XbkStudent.grade, _IDENTITY_WHITESPACE), "")
    return and_(
        name == values["name"],
        or_(grade.is_(None), values["grade"] is None, grade == values["grade"]),
    )


def _parse_integer(value: Any) -> Optional[int]:
    text = _normalize_str(value)
    if text is None:
        return None
    try:
        number = Decimal(text)
        if not number.is_finite() or number != number.to_integral_value():
            return None
        if not _PG_INT_MIN <= number <= _PG_INT_MAX:
            return None
        return int(number)
    except (InvalidOperation, ValueError, OverflowError):
        return None


def _parse_quota_int(value: Any) -> Optional[int]:
    quota = _parse_integer(value)
    return quota if quota is not None and quota >= 0 else None


def _parse_import_file(content: bytes, extension: str) -> pd.DataFrame:
    try:
        if extension == ".csv":
            raw = read_csv_rows(content, MAX_IMPORT_ROWS, MAX_IMPORT_COLUMNS)
        else:
            raw = read_excel_rows(content, extension, MAX_IMPORT_ROWS, MAX_IMPORT_EXPANDED_BYTES)
        return validate_import_header(raw, MAX_IMPORT_ROWS, MAX_IMPORT_COLUMNS)
    except HTTPException:
        raise
    except ImportError:
        raise HTTPException(status_code=400, detail="当前环境不支持旧版 .xls，请另存为 .xlsx 或 CSV 后导入") from None
    except Exception:
        raise HTTPException(status_code=400, detail="读取文件失败，请确认文件未损坏、未加密且格式为 Excel 或 CSV") from None


async def _read_excel(file: UploadFile) -> pd.DataFrame:
    extension = Path(file.filename or "").suffix.lower()
    if extension not in {".xlsx", ".xls", ".csv"}:
        raise HTTPException(status_code=400, detail="仅支持 .xlsx、.xls 或 .csv 文件")
    content = await file.read(MAX_IMPORT_BYTES + 1)
    if len(content) > MAX_IMPORT_BYTES:
        raise HTTPException(status_code=413, detail="导入文件不能超过 10 MiB，请拆分文件")
    if not content:
        raise HTTPException(status_code=400, detail="文件为空")
    return await run_in_threadpool(_parse_import_file, content, extension)


def _get_year_term(
    row: pd.Series,
    default_year: Optional[AcademicYear] = None,
    default_term: Optional[str] = None,
) -> Tuple[str, str]:
    final_year = _normalize_str(row.get("学年")) or _normalize_str(default_year)
    final_term = _normalize_str(row.get("学期")) or _normalize_str(default_term)
    if final_year is None or not final_term:
        raise HTTPException(status_code=422, detail="缺少学年/学期")
    try:
        normalized_year = normalize_academic_year(final_year)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if len(final_term) > 20 or "\x00" in final_term:
        raise HTTPException(status_code=422, detail="学期不能超过20个字符或包含空字符")
    return normalized_year, final_term


def _normalize_selection_course_code(value: Any) -> str:
    code = _normalize_str(value)
    return code if code else "未选"


def _remap_columns(df: pd.DataFrame, mapping: Dict[str, List[str]]) -> pd.DataFrame:
    aliases = {
        _normalize_col_name(name): canonical
        for canonical, names in mapping.items()
        for name in [canonical, *names]
    }
    renamed = [aliases.get(_normalize_col_name(c), _normalize_col_name(c)) for c in df.columns]
    nonempty = [name for name in renamed if name]
    if len(nonempty) != len(set(nonempty)):
        raise HTTPException(status_code=422, detail="表头包含重复列或同一字段的多个别名，请保留其中一列")
    result = df.copy()
    result.columns = renamed
    # Ignore empty unused columns; nonempty data without a header is ambiguous.
    for index, name in enumerate(renamed):
        if not name and any(_normalize_str(v) for v in result.iloc[:, index]):
            raise HTTPException(status_code=422, detail="存在无表头的数据列，请补充表头")
    return result.loc[:, [bool(name) for name in renamed]]


def _preview_rows(rows: List[Dict[str, Any]], limit: int = 10) -> List[Dict[str, Any]]:
    return rows[: max(0, min(limit, 50))]


from .import_templates import build_template_response, style_worksheet as _style_worksheet, template_columns as _template_columns  # noqa: F401  有意回导，测试用例按旧路径导入

def _students_mapping() -> Dict[str, List[str]]:
    return {
        "学年": ["年份", "year"],
        "学期": ["term"],
        "年级": ["grade"],
        "班级": ["班别", "班级名称", "class", "class_name"],
        "学号": ["学生学号", "student_no", "studentId", "student_id"],
        "姓名": ["学生姓名", "name", "student_name"],
        "性别": ["gender", "sex"],
    }


def _courses_mapping() -> Dict[str, List[str]]:
    return {
        "学年": ["年份", "year"],
        "学期": ["term"],
        "年级": ["grade"],
        "课程代码": ["代码", "course_code", "courseId", "course_id"],
        "课程名称": ["名称", "course_name"],
        "课程负责人": ["教师", "任课老师", "teacher"],
        "各班限报人数": ["限报人数", "课程人数", "quota_by_class", "quota"],
        "上课地点": ["地点", "location", "classroom"],
    }


def _selections_mapping() -> Dict[str, List[str]]:
    return {
        "学年": ["年份", "year"],
        "学期": ["term"],
        "年级": ["grade"],
        "学号": ["学生学号", "student_no", "studentId", "student_id"],
        "姓名": ["学生姓名", "name", "student_name"],
        "课程代码": ["代码", "course_code", "courseId", "course_id"],
    }


def _validate_required_columns(df: pd.DataFrame, required: List[str]) -> None:
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise HTTPException(status_code=422, detail=f"缺少必要列: {', '.join(missing)}")


def _drop_empty_rows(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    mask = df.apply(
        lambda row: any(_normalize_str(v) for v in row.values),
        axis=1,
    )
    return df[mask].copy()


@router.get("/import/template")
async def download_template(
    scope: str = Query(..., pattern="^(students|courses|selections)$"),
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> StreamingResponse:
    return build_template_response(scope)


def _import_spec(scope: str) -> Tuple[Any, Dict[str, List[str]], List[str], Dict[str, str], List[str]]:
    if scope == "students":
        return XbkStudent, _students_mapping(), ["班级", "学号", "姓名"], {
            "班级": "class_name", "学号": "student_no", "姓名": "name", "性别": "gender",
        }, ["year", "term", "student_no"]
    if scope == "courses":
        return XbkCourse, _courses_mapping(), ["课程代码", "课程名称"], {
            "课程代码": "course_code", "课程名称": "course_name", "课程负责人": "teacher",
            "上课地点": "location",
        }, ["year", "term", "course_code"]
    if scope == "selections":
        return XbkSelection, _selections_mapping(), ["学号", "课程代码"], {
            "学号": "student_no", "姓名": "name", "课程代码": "course_code",
        }, ["year", "term", "student_no", "course_code"]
    raise HTTPException(status_code=422, detail=f"不支持的导入范围: {scope}")


async def _filter_selection_references(db, valid, row_numbers, errors, *, lock=False):
    """Keep file row attribution while excluding invalid natural-key parents."""
    reference_errors = await selection_reference_errors(db, [values for values, _ in valid], lock=lock)
    accepted, accepted_rows, accepted_kept = [], [], []
    for index, (item, row_number, messages) in enumerate(zip(valid, row_numbers, reference_errors)):
        if messages:
            errors.append(row_errors(row_number, messages))
        else:
            accepted.append(item)
            accepted_rows.append(row_number)
            accepted_kept.append(index)
    errors.sort(key=lambda error: error["row"])
    return accepted, accepted_rows, accepted_kept


def _validate_import_values(scope, values, fields):
    schema = {"students": XbkStudentUpsert, "courses": XbkCourseUpsert, "selections": XbkSelectionUpsert}[scope]
    messages = []
    # Request schemas are the single text/quota contract. File-specific
    # defaults, row numbers and identity protection remain import concerns.
    try:
        values = schema.model_validate(values).model_dump()
    except ValidationError as exc:
        labels = {field: label for label, field in fields.items()}
        labels.update(year="学年", term="学期", grade="年级", quota="限报人数")
        for error in exc.errors():
            label = labels.get(error["loc"][0], str(error["loc"][0]))
            messages.append(f"{label}: {error['msg']}")
    return values, messages


async def _prepare_import(
    scope: str,
    year: Optional[AcademicYear],
    term: Optional[str],
    grade: Optional[str],
    file: UploadFile,
    db: AsyncSession,
    *, lock_references: bool = False,
) -> Tuple[int, List[str], List[Tuple[Dict[str, Any], Dict[str, Any]]], List[Dict[str, Any]]]:
    """One validation path for preview and execute; no database writes here.

    Preserve optional snapshots and blank selection code -> 未选. Reject file-wide
    identity collisions and mixed periods before applying row-level skip policy.
    """
    model, mapping, required, fields, key_fields = _import_spec(scope)
    df = _remap_columns(await _read_excel(file), mapping)
    _validate_required_columns(df, required)
    df = _drop_empty_rows(df)
    errors = []
    valid = []
    seen_keys = {}
    valid_row_numbers = []
    periods = set()
    grade_flags = []
    for index, row in df.iterrows():
        row_number = int(index) + 2
        grade_flags.append(_normalize_str(row.get("年级")) is not None)
        values, preview, messages, period, _quota_missing = prepare_import_row(
            row, scope, (year, term, grade), fields, required,
        )
        if period is not None:
            periods.add(period)
        record_import_identity(scope, values, key_fields, row_number, seen_keys)
        if messages:
            errors.append(row_errors(row_number, messages))
        else:
            valid.append((values, preview))
            valid_row_numbers.append(row_number)
    if len(periods) > 1:
        raise HTTPException(status_code=422, detail=(
            f"文件包含{len(periods)}个不同的学年/学期组合，已阻止整份文件导入。"
            "请检查学年列是否被 Excel 自动递增，并按同一学期拆分文件。"
        ))
    if scope == "selections" and valid:
        valid, valid_row_numbers, kept = await _filter_selection_references(
            db, valid, valid_row_numbers, errors, lock=lock_references,
        )
        grade_flags = [grade_flags[index] for index in kept]
    await validate_import_parent_snapshots(
        scope, valid, valid_row_numbers, db, grade_flags,
        selected_grade=_normalize_str(grade),
    )
    return int(df.shape[0]), list(df.columns), valid, errors, valid_row_numbers


async def _validate_student_identities(scope: str, valid: list, db: AsyncSession) -> None:
    """Do not overwrite another person (including a deleted record) via import.

    Stable identities can still be reimported to update class/gender. Correcting
    a student's name/grade requires explicit record editing rather than a bulk
    upload silently taking over their identifier.
    """
    if scope != "students" or not valid or db is None:
        return
    incoming = {(v["year"], v["term"], v["student_no"]): v for v, _ in valid}
    keys = list(incoming)
    for offset in range(0, len(keys), 500):
        statement = select(
            XbkStudent.year, XbkStudent.term, XbkStudent.student_no,
            XbkStudent.name, XbkStudent.grade,
        ).where(tuple_(XbkStudent.year, XbkStudent.term, XbkStudent.student_no).in_(keys[offset:offset + 500]))
        for y, t, no, name, grade in (await db.execute(statement)).all():
            row = incoming[(y, t, no)]
            if (_normalize_str(name) != row["name"] or (
                _normalize_str(grade) and row["grade"] and _normalize_str(grade) != row["grade"]
            )):
                raise HTTPException(status_code=422, detail=_STUDENT_IDENTITY_CONFLICT)


@router.post("/import/preview")
async def preview_import(
    scope: str = Query(..., pattern="^(students|courses|selections)$"),
    year: Annotated[Optional[AcademicYear], Query()] = None,
    term: Annotated[Optional[str], Query()] = None,
    grade: Annotated[Optional[str], Query()] = None,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    total, columns, valid, errors, _row_numbers = await _prepare_import(scope, year, term, grade, file, db)
    await _validate_student_identities(scope, valid, db)
    return {
        "total_rows": total,
        "valid_rows": len(valid),
        "invalid_rows": len(errors),
        "errors": errors[:50],
        "preview": _preview_rows([preview for _, preview in valid], 10),
        "columns": columns,
    }


async def _execute_import_upsert(db, scope, model, statement, key_fields, updates, values):
    if scope == "students":
        statement = statement.on_conflict_do_update(
            index_elements=key_fields, set_=updates,
            where=_student_identity_condition(values),
        ).returning(model.id)
        result = await db.execute(statement)
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=422, detail=_STUDENT_IDENTITY_CONFLICT)
    else:
        statement = statement.on_conflict_do_update(index_elements=key_fields, set_=updates)
        await db.execute(statement)


async def _guard_import_parent(db, scope, current, values, references=None):
    if current is None:
        return
    if scope == "students":
        await guard_student_change(db, current, values, references=references)
        return
    if "quota" not in values:
        # 未提供限额时保留原值，守卫按库中原限额比较，不能当成 0 误判下调。
        values = {**values, "quota": current.quota}
    await guard_course_change(db, current, values)


async def _apply_selection_rows(db, valid, row_numbers):
    """写入选课行；父记录在执行途中消失时转成带行号的 422。"""
    mutations = [SelectionMutation(values, replace_existing=True) for values, _ in valid]
    try:
        decision = await apply_selection_mutations(db, mutations)
    except HTTPException as exc:
        # 预检之后、写入之前父记录被并发删除：手工写入保持 404，
        # 导入按文档约定转成带行号的无效行（严格模式 422），
        # 否则整份文件会以 404 结束，用户拿不到是哪一行的问题。
        raise row_attributed_error(exc, valid, row_numbers) from exc
    return len(valid), decision.inserted, decision.updated


async def _prepare_import_context(db, scope, model, key_fields, valid, keys):
    """加锁、预取父行与学生选课关联，返回逐行写入所需的上下文。

    拆出来单独承担「准备阶段」，让 _apply_valid_import_rows 的主循环
    只剩写入一件事，两段各自的复杂度都在治理阈值内。
    """
    locked = await lock_key_rows(db, model, key_fields, keys)
    parent_by_key = {tuple(getattr(row, field) for field in key_fields): row for row in locked}
    await _validate_student_identities(scope, valid, db)
    existing = set(parent_by_key)
    key_columns = [getattr(model, field) for field in key_fields]
    for offset in range(0, len(keys), 500):
        statement = select(*key_columns).where(tuple_(*key_columns).in_(keys[offset:offset + 500]))
        existing.update(tuple(row) for row in (await db.execute(statement)).all())
    # 一次性预取所有将被校验学生的选课关联，避免逐行 guard 各发一次查询。
    if scope == "students":
        existing_rows = [row for key, row in parent_by_key.items() if key in existing]
        references_by_key = await prefetch_student_references(db, existing_rows)
    else:
        references_by_key = {}
    return parent_by_key, existing, references_by_key


async def _apply_valid_import_rows(db, scope, model, key_fields, valid, row_numbers=None):
    keys = list({tuple(values[field] for field in key_fields) for values, _ in valid})
    if scope == "selections":
        return await _apply_selection_rows(db, valid, row_numbers)
    parent_by_key, existing, references_by_key = await _prepare_import_context(
        db, scope, model, key_fields, valid, keys
    )
    now = datetime.now(timezone.utc)
    inserted = updated = 0
    ordered_valid = sorted(valid, key=lambda item: tuple(item[0][field] for field in key_fields))
    for values, _ in ordered_valid:
        key = tuple(values[field] for field in key_fields)
        await _guard_import_parent(
            db, scope, parent_by_key.get(key), values, references_by_key.get(key)
        )
        updates = {field: value for field, value in values.items() if field not in key_fields}
        updates.update(is_deleted=False, updated_at=now)
        statement = insert(model).values(**values, is_deleted=False, created_at=now, updated_at=now)
        await _execute_import_upsert(db, scope, model, statement, key_fields, updates, values)
        updated += int(key in existing)
        inserted += int(key not in existing)
        existing.add(key)
    return len(valid), inserted, updated


async def _commit_import_rows(db, scope, model, key_fields, valid, row_numbers=None):
    try:
        result = await _apply_valid_import_rows(db, scope, model, key_fields, valid, row_numbers)
        await db.commit()
        return result
    except asyncio.CancelledError:
        await db.rollback()
        raise
    except IntegrityError as exc:
        await db.rollback()
        # 只有可预期的完整性约束冲突才回 409（用户刷新即可重试）；
        # 触发器、连接中断等未知故障继续抛给全局处理返回 500，
        # 避免把内部诊断信息带进响应，也不让真正的服务故障伪装成“数据冲突”。
        if not is_constraint_violation(exc):
            raise
        if is_active_selection_unique_violation(exc):
            raise HTTPException(status_code=409,
                                detail="导入失败：学生在本学期已有有效选课，请刷新后重试") from exc
        raise HTTPException(
            status_code=409,
            detail="导入失败：数据与库中现有记录冲突（唯一、外键或检查约束），已回滚，请刷新后重试",
        ) from exc
    except SQLAlchemyError:
        await db.rollback()
        raise
    except Exception:
        await db.rollback()
        raise


@router.post("/import", status_code=200)
async def import_data(
    scope: str = Query(..., pattern="^(students|courses|selections)$"),
    year: Annotated[Optional[AcademicYear], Query()] = None,
    term: Annotated[Optional[str], Query()] = None,
    grade: Annotated[Optional[str], Query()] = None,
    skip_invalid: Annotated[bool, Query()] = True,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> Dict[str, Any]:
    try:
        total, _, valid, errors, row_numbers = await _prepare_import(scope, year, term, grade, file, db)
        if errors and not skip_invalid:
            raise HTTPException(status_code=422, detail=errors[0])
    except asyncio.CancelledError:
        await db.rollback()
        raise
    except SQLAlchemyError:
        await db.rollback()
        raise
    except Exception:
        if scope == "selections":
            await db.rollback()
        raise
    model, _, _, _, key_fields = _import_spec(scope)
    if valid:
        processed, inserted, updated = await _commit_import_rows(
            db, scope, model, key_fields, valid, row_numbers,
        )
    else:
        processed = inserted = updated = 0
        if scope == "selections":
            await db.rollback()
    return {"total_rows": total, "processed": processed, "inserted": inserted,
            "updated": updated, "skipped": len(errors), "invalid": len(errors),
            "errors": errors[:50]}


def _write_export_workbook(
    df: pd.DataFrame,
    diagnostics_df: Optional[pd.DataFrame],
) -> io.BytesIO:
    """同步生成导出工作簿（openpyxl 写盘 + 逐 sheet 样式）。

    openpyxl 的写入与样式全为 CPU 密集的同步调用（3000 行实测约 0.18s，
    更大的表线性增长），直接放在 async 路由里会阻塞事件循环，因此由调用方
    放进线程池执行。
    """
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="data")
        if diagnostics_df is not None:
            diagnostics_df.to_excel(writer, index=False, sheet_name="diagnostics")
        for ws in writer.book.worksheets:
            _style_worksheet(ws)
            force_text_cells(ws)
    output.seek(0)
    return output


@router.get("/export")
async def export_data(
    scope: str = Query(..., pattern="^(students|courses|selections|course_results|unselected|suspended)$"),
    year: Optional[AcademicYear] = Query(None),
    term: Optional[str] = Query(None),
    grade: Optional[str] = Query(None),
    class_name: Optional[str] = Query(None),
    search_text: Optional[str] = Query(None),
    format: str = Query("xlsx", pattern="^(xlsx|xls)$"),
    db: AsyncSession = Depends(get_db),
    _: Dict[str, Any] = Depends(require_admin),
) -> StreamingResponse:
    require_xlsx_format(format)
    diagnostics_df = None
    if scope == "students":
        stmt = select(XbkStudent).where(XbkStudent.is_deleted.is_(False))
        if year is not None:
            stmt = stmt.where(XbkStudent.year == year)
        if term:
            stmt = stmt.where(XbkStudent.term == term)
        if grade:
            stmt = stmt.where(XbkStudent.grade == grade)
        if class_name:
            stmt = stmt.where(XbkStudent.class_name == class_name)
        if search_text and search_text.strip():
            keyword = f"%{search_text.strip()}%"
            stmt = stmt.where(
                or_(
                    XbkStudent.student_no.ilike(keyword),
                    XbkStudent.name.ilike(keyword),
                    XbkStudent.class_name.ilike(keyword),
                )
            )
        rows = (await db.execute(stmt.order_by(XbkStudent.class_name.asc(), XbkStudent.student_no.asc()))).scalars().all()
        df = pd.DataFrame(
            [
                {
                    "学年": r.year,
                    "学期": r.term,
                    "年级": r.grade,
                    "班级": r.class_name,
                    "学号": r.student_no,
                    "姓名": r.name,
                    "性别": r.gender,
                }
                for r in rows
            ]
        )
    elif scope == "courses":
        stmt = select(XbkCourse).where(XbkCourse.is_deleted.is_(False))
        if year is not None:
            stmt = stmt.where(XbkCourse.year == year)
        if term:
            stmt = stmt.where(XbkCourse.term == term)
        if grade:
            stmt = stmt.where(XbkCourse.grade == grade)
        if search_text and search_text.strip():
            keyword = f"%{search_text.strip()}%"
            stmt = stmt.where(
                or_(
                    XbkCourse.course_code.ilike(keyword),
                    XbkCourse.course_name.ilike(keyword),
                    XbkCourse.teacher.ilike(keyword),
                    XbkCourse.location.ilike(keyword),
                )
            )
        rows = (await db.execute(stmt.order_by(XbkCourse.course_code.asc()))).scalars().all()
        df = pd.DataFrame(
            [
                {
                    "学年": r.year,
                    "学期": r.term,
                    "年级": r.grade,
                    "课程代码": r.course_code,
                    "课程名称": r.course_name,
                    "课程负责人": r.teacher,
                    "各班限报人数": r.quota,
                    "上课地点": r.location,
                }
                for r in rows
            ]
        )
    elif scope in {"selections", "course_results"}:
        student_join = and_(
            XbkStudent.is_deleted.is_(False),
            XbkStudent.year == XbkSelection.year,
            XbkStudent.term == XbkSelection.term,
            XbkStudent.student_no == XbkSelection.student_no,
        )
        selection_join = and_(
            XbkSelection.is_deleted.is_(False),
            XbkSelection.year == XbkStudent.year,
            XbkSelection.term == XbkStudent.term,
            XbkSelection.student_no == XbkStudent.student_no,
        )
        course_join = and_(
            XbkCourse.is_deleted.is_(False),
            XbkCourse.year == XbkSelection.year,
            XbkCourse.term == XbkSelection.term,
            XbkCourse.course_code == XbkSelection.course_code,
        )
        missing_label = case((XbkSelection.id.is_(None), "休学或其他"), else_="未选")
        student_name = (
            XbkStudent.name if scope == "course_results" else
            case((XbkSelection.id.is_not(None), XbkSelection.name), else_=XbkStudent.name)
        )
        columns = [
            XbkStudent.year.label("year"), XbkStudent.term.label("term"),
            XbkStudent.grade.label("grade"), XbkStudent.student_no.label("student_no"),
            student_name.label("student_name"),
            func.coalesce(func.nullif(XbkSelection.course_code, ""), missing_label).label("course_code"),
        ]
        if scope == "course_results":
            columns.extend([
                XbkStudent.class_name.label("class_name"),
                func.coalesce(func.nullif(XbkCourse.course_name, ""), missing_label).label("course_name"),
                XbkCourse.teacher.label("teacher"), XbkCourse.location.label("location"),
            ])
        # Match the list's active-roster row set, including virtual unselected rows.
        # Grade remains live-roster grade, not the historical selection snapshot.
        stmt = (
            select(*columns)
            .select_from(XbkStudent)
            .outerjoin(XbkSelection, selection_join)
            .outerjoin(XbkCourse, course_join)
        )
        stmt = apply_common_filters(
            stmt.where(XbkStudent.is_deleted.is_(False)), XbkStudent, year, term, grade, None,
        )
        search_columns = [
            XbkStudent.student_no, XbkStudent.name, XbkStudent.class_name,
            XbkSelection.course_code,
        ]
        if scope == "course_results":
            search_columns.extend([
                XbkCourse.course_name, XbkCourse.teacher, XbkCourse.location,
            ])
        stmt = apply_search_filter(stmt, search_text, search_columns)
        if class_name:
            stmt = stmt.where(XbkStudent.class_name == class_name)
        order = [XbkStudent.class_name.asc()]
        if scope == "course_results":
            numeric_student_no = cast(
                func.nullif(func.regexp_replace(XbkStudent.student_no, r"\D", "", "g"), ""),
                Numeric(50, 0),
            )
            order.append(numeric_student_no.asc().nulls_last())
        order.extend([XbkStudent.student_no.asc(), XbkSelection.course_code.asc()])
        rows = (await db.execute(stmt.order_by(*order))).all()

        # Retain the previous orphan diagnostics, but not as fictitious list rows.
        # A soft-deleted parent is deliberately equivalent to a missing active one.
        diagnostic_columns = [
            XbkSelection.year.label("year"), XbkSelection.term.label("term"),
            XbkSelection.grade.label("grade"), XbkSelection.student_no.label("student_no"),
            XbkSelection.name.label("student_name"), XbkSelection.course_code.label("course_code"),
        ]
        if scope == "course_results":
            diagnostic_columns.extend([
                XbkStudent.class_name.label("class_name"), XbkCourse.course_name.label("course_name"),
                XbkCourse.teacher.label("teacher"), XbkCourse.location.label("location"),
            ])
        diagnostic_stmt = (
            select(*diagnostic_columns).select_from(XbkSelection)
            .outerjoin(XbkStudent, student_join)
            .where(XbkSelection.is_deleted.is_(False), XbkStudent.id.is_(None))
        )
        if scope == "course_results":
            diagnostic_stmt = diagnostic_stmt.outerjoin(XbkCourse, course_join)
        if year is not None:
            diagnostic_stmt = diagnostic_stmt.where(XbkSelection.year == year)
        if term:
            diagnostic_stmt = diagnostic_stmt.where(XbkSelection.term == term)
        if grade:
            diagnostic_stmt = diagnostic_stmt.where(XbkSelection.grade == grade)
        if class_name:
            # No active roster means no class membership, as before this change.
            diagnostic_stmt = diagnostic_stmt.where(XbkStudent.class_name == class_name)
        if search_text and search_text.strip():
            keyword = f"%{search_text.strip()}%"
            search_columns = [XbkSelection.student_no, XbkSelection.course_code, XbkSelection.name]
            if scope == "course_results":
                search_columns.extend([
                    XbkStudent.class_name, XbkCourse.course_name, XbkCourse.teacher, XbkCourse.location,
                ])
            diagnostic_stmt = diagnostic_stmt.where(or_(*(col.ilike(keyword) for col in search_columns)))
        diagnostic_rows = (await db.execute(diagnostic_stmt.order_by(
            XbkSelection.student_no.asc(), XbkSelection.course_code.asc(),
        ))).all()

        headers = ["学年", "学期", "年级", "学号", "姓名", "课程代码"]
        if scope == "course_results":
            headers = ["学年", "学期", "年级", "班级", "学号", "姓名", "课程代码", "课程名称", "负责人", "地点"]

        def export_row(row):
            result = {
                "学年": row.year, "学期": row.term, "年级": row.grade,
                "学号": row.student_no, "姓名": row.student_name, "课程代码": row.course_code,
            }
            if scope == "course_results":
                result.update({
                    "年级": row.grade or None, "姓名": row.student_name or None,
                    "班级": row.class_name or None, "课程名称": row.course_name or None,
                    "负责人": row.teacher or None, "地点": row.location or None,
                })
            return result

        # Explicit columns retain an intelligible sheet even when there are no rows.
        df = pd.DataFrame([export_row(row) for row in rows], columns=headers)
        diagnostics_df = pd.DataFrame([export_row(row) for row in diagnostic_rows], columns=headers)
    elif scope == "unselected":
        stmt = (
            select(XbkStudent)
            .select_from(XbkSelection)
            .join(
                XbkStudent,
                and_(
                    XbkStudent.is_deleted.is_(False),
                    XbkStudent.year == XbkSelection.year,
                    XbkStudent.term == XbkSelection.term,
                    XbkStudent.student_no == XbkSelection.student_no,
                ),
            )
            .where(
                XbkSelection.is_deleted.is_(False),
                XbkSelection.course_code.in_(UNSELECTED_COURSE_CODES)
            )
        )
        if year is not None:
            stmt = stmt.where(XbkSelection.year == year)
        if term:
            stmt = stmt.where(XbkSelection.term == term)
        if grade:
            stmt = stmt.where(XbkStudent.grade == grade)
        if class_name:
            stmt = stmt.where(XbkStudent.class_name == class_name)
        stmt = apply_search_filter(stmt, search_text, [
            XbkStudent.student_no, XbkStudent.name, XbkStudent.class_name,
        ])

        rows = (await db.execute(stmt.order_by(XbkStudent.class_name.asc(), XbkStudent.student_no.asc()))).scalars().all()
        df = pd.DataFrame(
            [
                {
                    "学年": r.year,
                    "学期": r.term,
                    "年级": r.grade,
                    "班级": r.class_name,
                    "学号": r.student_no,
                    "姓名": r.name,
                    "性别": r.gender,
                }
                for r in rows
            ]
        )
    elif scope == "suspended":
        students_stmt = select(XbkStudent).where(XbkStudent.is_deleted.is_(False))
        selections_stmt = (
            select(XbkSelection.id)
            .where(
                XbkSelection.is_deleted.is_(False),
                XbkSelection.year == XbkStudent.year,
                XbkSelection.term == XbkStudent.term,
                XbkSelection.student_no == XbkStudent.student_no,
            )
        )
        if year is not None:
            students_stmt = students_stmt.where(XbkStudent.year == year)
        if term:
            students_stmt = students_stmt.where(XbkStudent.term == term)
        if grade:
            students_stmt = students_stmt.where(XbkStudent.grade == grade)
        if class_name:
            students_stmt = students_stmt.where(XbkStudent.class_name == class_name)
        if search_text and search_text.strip():
            keyword = f"%{search_text.strip()}%"
            students_stmt = students_stmt.where(
                or_(
                    XbkStudent.student_no.ilike(keyword),
                    XbkStudent.name.ilike(keyword),
                    XbkStudent.class_name.ilike(keyword),
                )
            )
        students_stmt = students_stmt.where(~selections_stmt.exists())
        students = (await db.execute(students_stmt.order_by(XbkStudent.class_name.asc(), XbkStudent.student_no.asc()))).scalars().all()
        df = pd.DataFrame(
            [
                {
                    "学年": r.year,
                    "学期": r.term,
                    "年级": r.grade,
                    "班级": r.class_name,
                    "学号": r.student_no,
                    "姓名": r.name,
                    "性别": r.gender,
                }
                for r in students
            ]
        )
    else:
        raise HTTPException(status_code=422, detail=f"不支持的导出范围: {scope}")

    # Excel 生成是同步 CPU 操作，放进线程池，避免单 worker 下阻塞事件循环
    output = await run_in_threadpool(_write_export_workbook, df, diagnostics_df)

    filename = f"xbk_{scope}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )
