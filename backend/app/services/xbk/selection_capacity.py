"""XBK 选课的容量校验。

从 selection_rules.py 抽出：只负责「按 (学年,学期,课程,年级,班级) 桶统计已用名额并比对限额」，
不参与选课变更的解析与写入。拆开的动机是让 selection_rules.py 的文件规模落在治理阈值内。

性能要点见 capacity_used_batch 的文档串：逐桶 COUNT 的往返次数等于桶数，
合并成一条 GROUP BY 后固定为 1 次。
"""

from __future__ import annotations

from typing import Any, Iterable, Mapping, Optional, Sequence

from fastapi import HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import XbkCourse, XbkSelection, XbkStudent

UNSELECTED_CODES = ("", "未选")
CapacityKey = tuple[str, str, str, Optional[str], str]


def _student_key(values: Mapping[str, Any]) -> tuple[str, str, str]:
    return (str(values["year"]), str(values["term"]), str(values["student_no"]))


def _roster_sort_key(values: Iterable[Any]) -> tuple[str, ...]:
    return tuple("" if value is None else str(value) for value in values)


def capacity_key(values: Mapping[str, Any], student: XbkStudent) -> Optional[CapacityKey]:
    """把一条选课记录映射到容量桶；未选状态不占名额，返回 None。"""
    code = str(values["course_code"])
    if code in UNSELECTED_CODES:
        return None
    year, term, _student_no = _student_key(values)
    return (year, term, code, student.grade, student.class_name)


async def capacity_used_batch(
    db: AsyncSession,
    keys: Sequence[CapacityKey],
) -> dict[CapacityKey, int]:
    """一次 GROUP BY 查出全部 (学年,学期,课程,年级,班级) 桶的已用名额。

    逐桶调用 COUNT 时往返次数等于受影响桶数（最坏 = 课程数 × 班级数，
    26 班 × 20 课 = 520 次），每次都是带 JOIN 的计数查询。
    合并成一条按 (year, term, course_code, grade, class_name) 分组的聚合查询后，
    往返次数固定为 1，返回行数不超过桶数。
    """
    if not keys:
        return {}
    years = {key[0] for key in keys}
    terms = {key[1] for key in keys}
    codes = {key[2] for key in keys}
    statement = (
        select(
            XbkSelection.year,
            XbkSelection.term,
            XbkSelection.course_code,
            XbkStudent.grade,
            XbkStudent.class_name,
            func.count(XbkSelection.id),
        )
        .select_from(XbkSelection)
        .join(
            XbkStudent,
            and_(
                XbkStudent.year == XbkSelection.year,
                XbkStudent.term == XbkSelection.term,
                XbkStudent.student_no == XbkSelection.student_no,
            ),
        )
        .where(
            XbkSelection.is_deleted.is_(False),
            XbkSelection.year.in_(years),
            XbkSelection.term.in_(terms),
            XbkSelection.course_code.in_(codes),
            XbkStudent.is_deleted.is_(False),
        )
        .group_by(
            XbkSelection.year,
            XbkSelection.term,
            XbkSelection.course_code,
            XbkStudent.grade,
            XbkStudent.class_name,
        )
    )
    rows = (await db.execute(statement)).all()
    counts: dict[CapacityKey, int] = {}
    for year, term, code, grade, class_name, used in rows:
        counts[(year, term, code, grade, class_name)] = int(used or 0)
    return counts


async def validate_capacities(
    db: AsyncSession,
    affected: Iterable[CapacityKey],
    courses: Mapping[tuple[str, str, str], XbkCourse],
) -> None:
    """任一桶的已用名额超过课程限额即抛 409。"""
    ordered = sorted(affected, key=_roster_sort_key)
    if not ordered:
        return
    used_by_key = await capacity_used_batch(db, ordered)
    for year, term, code, grade, class_name in ordered:
        quota = int(courses[(year, term, code)].quota or 0)
        used = used_by_key.get((year, term, code, grade, class_name), 0)
        if used > quota:
            raise HTTPException(
                status_code=409,
                detail=f"课程已满（{grade or '未分年级'} {class_name}，限额 {quota} 人）",
            )
