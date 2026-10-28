"""导入模板的列映射与表头规整。

从 ``import_export.py`` 抽出：这些函数只处理 DataFrame 形状与中文别名，
既不碰数据库也不依赖请求上下文，是导入流程里最容易单独测试的一层。

命名沿用导入侧既有约定：函数名保留前导下划线，由 ``import_export`` 以
``_xxx = ...`` 形式回导，避免测试与历史引用路径失效。
"""

from typing import Any, Dict, List, Tuple

import pandas as pd
from fastapi import HTTPException

from app.models import XbkCourse, XbkSelection, XbkStudent

from ._import_parsing import normalize_col_name, normalize_str


def remap_columns(df: pd.DataFrame, mapping: Dict[str, List[str]]) -> pd.DataFrame:
    """按中文别名表把表头改写成规范字段名。

    两类错误必须在这里拦住，否则会变成难以归因的行级错误：
    1. 同一字段被多个别名同时命中（表头重复声明）；
    2. 有无表头的数据列（内容无法归属）。
    """
    aliases = {
        normalize_col_name(name): canonical
        for canonical, names in mapping.items()
        for name in [canonical, *names]
    }
    renamed = [aliases.get(normalize_col_name(c), normalize_col_name(c)) for c in df.columns]
    nonempty = [name for name in renamed if name]
    if len(nonempty) != len(set(nonempty)):
        raise HTTPException(status_code=422, detail="表头包含重复列或同一字段的多个别名，请保留其中一列")
    result = df.copy()
    result.columns = renamed
    # Ignore empty unused columns; nonempty data without a header is ambiguous.
    for index, name in enumerate(renamed):
        if not name and any(normalize_str(v) for v in result.iloc[:, index]):
            raise HTTPException(status_code=422, detail="存在无表头的数据列，请补充表头")
    return result.loc[:, [bool(name) for name in renamed]]


def students_mapping() -> Dict[str, List[str]]:
    return {
        "学年": ["年份", "year"],
        "学期": ["term"],
        "年级": ["grade"],
        "班级": ["班别", "班级名称", "class", "class_name"],
        "学号": ["学生学号", "student_no", "studentId", "student_id"],
        "姓名": ["学生姓名", "name", "student_name"],
        "性别": ["gender", "sex"],
    }


def courses_mapping() -> Dict[str, List[str]]:
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


def selections_mapping() -> Dict[str, List[str]]:
    return {
        "学年": ["年份", "year"],
        "学期": ["term"],
        "年级": ["grade"],
        "学号": ["学生学号", "student_no", "studentId", "student_id"],
        "姓名": ["学生姓名", "name", "student_name"],
        "课程代码": ["代码", "course_code", "courseId", "course_id"],
    }


def validate_required_columns(df: pd.DataFrame, required: List[str]) -> None:
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise HTTPException(status_code=422, detail=f"缺少必要列: {', '.join(missing)}")


def drop_empty_rows(df: pd.DataFrame) -> pd.DataFrame:
    """剔除全空白行——Excel 常在末尾留大量空行。"""
    if df.empty:
        return df
    mask = df.apply(
        lambda row: any(normalize_str(v) for v in row.values),
        axis=1,
    )
    return df[mask].copy()


def import_spec(scope: str) -> Tuple[Any, Dict[str, List[str]], List[str], Dict[str, str], List[str]]:
    """返回该 scope 的（模型, 列映射, 必填列, 字段标签, 冲突键）。

    冲突键按自然键顺序排列，调用方据此做 on_conflict_do_update。
    """
    if scope == "students":
        return XbkStudent, students_mapping(), ["班级", "学号", "姓名"], {
            "班级": "class_name", "学号": "student_no", "姓名": "name", "性别": "gender",
        }, ["year", "term", "student_no"]
    if scope == "courses":
        return XbkCourse, courses_mapping(), ["课程代码", "课程名称"], {
            "课程代码": "course_code", "课程名称": "course_name", "课程负责人": "teacher",
            "上课地点": "location",
        }, ["year", "term", "course_code"]
    if scope == "selections":
        return XbkSelection, selections_mapping(), ["学号", "课程代码"], {
            "学号": "student_no", "姓名": "name", "课程代码": "course_code",
        }, ["year", "term", "student_no", "course_code"]
    raise HTTPException(status_code=422, detail=f"不支持的导入范围: {scope}")
