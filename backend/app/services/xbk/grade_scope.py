"""XBK 年级范围规则：课程只面向其开设年级。

`XbkCourse.grade` 为空表示全年级可选；非空时只有同年级学生可选。此前该字段
只参与列表筛选，容量校验从不读取它，导致高一学生能选上“仅面向高二”的课程，
随后又无法在按年级筛选时查到。选课写入与学生改年级都必须经过这里，使字段语义
与筛选口径一致。
"""
from typing import Iterable, Mapping, Optional

from fastapi import HTTPException

from app.models.xbk.course import XbkCourse


def normalize_grade(value: object) -> Optional[str]:
    """年级比较前的规范化：去首尾空白，空值视为未设置。"""
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def validate_course_grade_scope(
    affected: Iterable[tuple[str, str, str, Optional[str], str]],
    courses: Mapping[tuple[str, str, str], XbkCourse],
) -> None:
    """选课写入前校验课程开设年级，跨年级整份拒绝。"""
    for year, term, code, student_grade, class_name in affected:
        course = courses.get((year, term, code))
        if course is None:
            continue
        scope = normalize_grade(course.grade)
        if scope is None or normalize_grade(student_grade) == scope:
            continue
        raise HTTPException(
            status_code=409,
            detail=(
                f"课程 {code} 仅面向 {scope} 开设，"
                f"{student_grade or '未分年级'} {class_name} 的学生不能选择"
            ),
        )


def validate_student_grade_scope(
    selections, target_grade: Optional[str], courses: Mapping[tuple[str, str, str], XbkCourse],
) -> None:
    """学生改年级后，原有选课必须仍符合课程开设年级。"""
    for selection in selections:
        course = courses.get((selection.year, selection.term, selection.course_code))
        if not course:
            continue
        scope = normalize_grade(course.grade)
        if scope is not None and scope != normalize_grade(target_grade):
            raise HTTPException(
                status_code=409,
                detail=(
                    f"该学生已选课程 {selection.course_code}，"
                    f"该课程仅面向 {scope} 开设，不能把学生改到 "
                    f"{target_grade or '未分年级'}"
                ),
            )
