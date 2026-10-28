"""课程选择工作簿的数据类型与常量。

从 course_selection_workbook.py 抽出：这里只有纯数据类、常量与一个纯函数
normalize_cell，不依赖解析或校验逻辑，因此可以被两边安全共享。

拆开的动机是让 course_selection_workbook.py 的文件规模落在治理阈值内，
同时不引入循环导入。
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Optional, Sequence

WORKBOOK_FORMAT = 'xbk-course-selection'
WORKBOOK_VERSION = '1'
METADATA_SHEET = '__XBK工作簿信息'
CATALOG_SHEET = '校本课程目录'
INSTRUCTION = '只填写本班课程代码；剩余名额仅反映本文件，提交以服务器校验为准。'
UNSELECTED_CODE = '未选'
MAX_XLSX_ARCHIVE_ENTRIES = 1024
MAX_XLSX_WORKSHEETS = 256
MAX_XLSX_TOTAL_UNCOMPRESSED_BYTES = 64 * 1024 * 1024
MAX_XLSX_MEMBER_UNCOMPRESSED_BYTES = 32 * 1024 * 1024
MAX_XLSX_COMPRESSION_RATIO = 250


@dataclass(frozen=True)
class WorkbookCourse:
    course_code: str
    course_name: str
    quota: int


@dataclass(frozen=True)
class WorkbookStudent:
    sheet: str
    grade: str
    class_name: str
    student_no: str
    name: str
    baseline_course: Optional[str]


@dataclass(frozen=True)
class WorkbookExpectation:
    """Server-held export baseline used to reject stale or substituted files."""
    year: str
    term: str
    baseline_id: str
    students: Sequence[WorkbookStudent]
    courses: Sequence[WorkbookCourse]


@dataclass(frozen=True)
class WorkbookSelectionInput:
    """One complete-roster row for the future R1 transactional execute service."""
    sheet: str
    row: int
    year: str
    term: str
    grade: str
    class_name: str
    student_no: str
    name: str
    baseline_course: Optional[str]
    submitted_course: Optional[str]
    action: str


@dataclass(frozen=True)
class WorkbookSuggestion:
    course_code: str
    course_name: str
    remaining: int


@dataclass(frozen=True)
class WorkbookIssue:
    sheet: str
    row: Optional[int]
    student_no: Optional[str]
    course_code: Optional[str]
    reason: str
    suggestions: Sequence[WorkbookSuggestion] = field(default_factory=tuple)

    def to_dict(self) -> dict:
        return asdict(self)


class WorkbookValidationError(ValueError):

    def __init__(self, issues: Sequence[WorkbookIssue]):
        self.issues = tuple(issues)
        super().__init__(f'选课工作簿包含 {len(self.issues)} 个冲突')

    def to_dict(self) -> dict:
        return {'code': 'XBK_WORKBOOK_INVALID', 'issues': [issue.to_dict() for issue in self.issues]}


@dataclass(frozen=True)
class ParsedCourseSelectionWorkbook:
    format: str
    version: str
    year: str
    term: str
    baseline_id: str
    rows: Sequence[WorkbookSelectionInput]


def normalize_cell(value: object) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
