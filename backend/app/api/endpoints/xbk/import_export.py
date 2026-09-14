import asyncio
import io
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Annotated, Any, Dict, List, Optional, Tuple

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from sqlalchemy import Numeric, and_, case, cast, func, or_, select, tuple_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError
from starlette.concurrency import run_in_threadpool

from app.api.endpoints.xbk._common import (
    UNSELECTED_COURSE_CODES, apply_common_filters, apply_search_filter, selection_reference_errors,
)
from app.services.xbk.locking import lock_key_rows
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


# Bound both upload size and the expanded workbook before pandas allocates cells.
MAX_IMPORT_BYTES = 10 * 1024 * 1024
MAX_IMPORT_EXPANDED_BYTES = 50 * 1024 * 1024
MAX_IMPORT_ROWS = 50_000
MAX_IMPORT_COLUMNS = 100
_PG_INT_MIN = -(2 ** 31)
_PG_INT_MAX = 2 ** 31 - 1


# Characters stripped by Python str.strip; use the same bound set in SQL for
# legacy rows. Plain SQL trim() only removes spaces and would reject safe imports.
_IDENTITY_WHITESPACE = (
    "\t\n\v\f\r\x1c\x1d\x1e\x1f \x85\xa0\u1680"
    "\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a"
    "\u2028\u2029\u202f\u205f\u3000"
)
_STUDENT_IDENTITY_CONFLICT = (
    "导入学号与数据库中另一姓名或年级的学生冲突，已阻止整份文件导入。"
    "请核对跨班级、跨年级的唯一学号；如需更正姓名或年级，请明确编辑原记录。"
)


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


from .import_templates import build_template_response, style_worksheet as _style_worksheet, template_columns as _template_columns

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


def _row_errors(idx: int, messages: List[str]) -> Dict[str, Any]:
    return {"row": idx, "errors": messages}


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
    accepted = []
    for item, row_number, messages in zip(valid, row_numbers, reference_errors):
        if messages:
            errors.append(_row_errors(row_number, messages))
        else:
            accepted.append(item)
    errors.sort(key=lambda error: error["row"])
    return accepted


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


def _prepare_import_row(row, scope, defaults, fields, required):
    """Normalize one physical row without deciding whole-file or parent validity."""
    year, term, grade = defaults
    messages = []
    preview = {k: _normalize_str(row.get(k)) for k in row.index}
    values = {}
    period = None
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
    if scope == "courses":
        values["quota"] = _normalize_str(row.get("各班限报人数"))
    if not messages:
        values, messages = _validate_import_values(scope, values, fields)
    return values, preview, messages, period


def _record_import_identity(scope, values, key_fields, row_number, seen_keys):
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
    for index, row in df.iterrows():
        row_number = int(index) + 2
        values, preview, messages, period = _prepare_import_row(
            row, scope, (year, term, grade), fields, required,
        )
        if period is not None:
            periods.add(period)
        _record_import_identity(scope, values, key_fields, row_number, seen_keys)
        if messages:
            errors.append(_row_errors(row_number, messages))
        else:
            valid.append((values, preview))
            valid_row_numbers.append(row_number)
    if len(periods) > 1:
        raise HTTPException(status_code=422, detail=(
            f"文件包含{len(periods)}个不同的学年/学期组合，已阻止整份文件导入。"
            "请检查学年列是否被 Excel 自动递增，并按同一学期拆分文件。"
        ))
    if scope == "selections" and valid:
        valid = await _filter_selection_references(db, valid, valid_row_numbers, errors, lock=lock_references)
    return int(df.shape[0]), list(df.columns), valid, errors


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
    total, columns, valid, errors = await _prepare_import(scope, year, term, grade, file, db)
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
        # Recheck identity after PostgreSQL acquires the conflicting row lock;
        # a preflight read cannot protect concurrent inserts.
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
        total, _, valid, errors = await _prepare_import(scope, year, term, grade, file, db, lock_references=True)
        # Strict failure and all-invalid input must release preflight SHARE locks
        # even when a caller keeps the session open after this function returns.
        if errors and not skip_invalid:
            raise HTTPException(status_code=422, detail=errors[0])
    except asyncio.CancelledError:
        # Cancellation is a BaseException; release preflight locks and reset an
        # asyncpg-invalidated transaction before a retained caller can retry.
        await db.rollback()
        raise
    except SQLAlchemyError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="导入失败，数据库操作已回滚，请刷新数据后重试") from None
    except Exception:
        if scope == "selections":
            await db.rollback()
        raise
    if not valid and scope == "selections":
        await db.rollback()
    model, _, _, _, key_fields = _import_spec(scope)
    processed = inserted = updated = 0
    if valid:
        try:
            # Parent imports/restores use the same ID order as deletion. New keys
            # remain protected by the existing atomic ON CONFLICT identity rule.
            # For selections, parent SHARE locks were taken during preparation;
            # existing children now follow in the same immutable-ID order.
            await lock_key_rows(db, model, key_fields, [
                tuple(values[field] for field in key_fields) for values, _ in valid
            ])
            await _validate_student_identities(scope, valid, db)
            keys = list({tuple(values[field] for field in key_fields) for values, _ in valid})
            existing = set()
            # Include soft-deleted rows: restoring a unique key is an UPDATE, not INSERT.
            # Chunk keys to keep PostgreSQL bind parameters bounded on large imports.
            for offset in range(0, len(keys), 500):
                key_columns = [getattr(model, field) for field in key_fields]
                statement = select(*key_columns).where(tuple_(*key_columns).in_(keys[offset:offset + 500]))
                existing.update(tuple(row) for row in (await db.execute(statement)).all())
            now = datetime.now(timezone.utc)
            for values, _ in sorted(valid, key=lambda item: tuple(item[0][field] for field in key_fields)):
                key = tuple(values[field] for field in key_fields)
                updates = {field: value for field, value in values.items() if field not in key_fields}
                updates.update(is_deleted=False, updated_at=now)
                statement = insert(model).values(
                    **values, is_deleted=False, created_at=now, updated_at=now,
                )
                await _execute_import_upsert(db, scope, model, statement, key_fields, updates, values)
                processed += 1
                if key in existing:
                    updated += 1
                else:
                    inserted += 1
                # File-level duplicate keys have already been rejected.
                existing.add(key)
            await db.commit()
        except asyncio.CancelledError:
            # Preserve cancellation (never turn it into an HTTP success/error),
            # while giving direct callers the same cleanup as get_db exit.
            await db.rollback()
            raise
        except SQLAlchemyError:
            await db.rollback()
            raise HTTPException(status_code=409, detail="导入失败，数据库操作已回滚，请刷新数据后重试") from None
        except Exception:
            await db.rollback()
            raise
    return {
        "total_rows": total,
        "processed": processed,
        "inserted": inserted,
        "updated": updated,
        "skipped": len(errors),
        "invalid": len(errors),
        "errors": errors[:50],
    }


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

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="data")
        if diagnostics_df is not None:
            diagnostics_df.to_excel(writer, index=False, sheet_name="diagnostics")
        for ws in writer.book.worksheets:
            _style_worksheet(ws)
            force_text_cells(ws)
    output.seek(0)

    filename = f"xbk_{scope}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{format}"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )
