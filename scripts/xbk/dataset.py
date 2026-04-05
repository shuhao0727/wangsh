from __future__ import annotations

from typing import Any, Dict, List

from .common import Settings


GRADE_CLASSES: Dict[str, List[str]] = {
    "高一": ["高一(1)班", "高一(2)班", "高一(3)班", "高一(4)班"],
    "高二": ["高二(1)班", "高二(2)班", "高二(3)班", "高二(4)班"],
}

GRADE_COURSES: Dict[str, List[Dict[str, Any]]] = {
    "高一": [
        {"course_code": "H1-PY-01", "course_name": "Python 基础实战", "teacher": "王老师", "quota": 24, "location": "信息楼 A201"},
        {"course_code": "H1-AI-02", "course_name": "AI 启蒙与应用", "teacher": "李老师", "quota": 24, "location": "信息楼 A202"},
        {"course_code": "H1-WEB-03", "course_name": "Web 前端创意", "teacher": "周老师", "quota": 20, "location": "信息楼 A203"},
        {"course_code": "H1-ROB-04", "course_name": "机器人入门", "teacher": "赵老师", "quota": 20, "location": "创客工坊 M101"},
        {"course_code": "H1-DES-05", "course_name": "数字设计基础", "teacher": "钱老师", "quota": 18, "location": "艺术楼 B301"},
        {"course_code": "H1-DAT-06", "course_name": "数据思维训练", "teacher": "孙老师", "quota": 22, "location": "信息楼 A204"},
    ],
    "高二": [
        {"course_code": "H2-ALG-11", "course_name": "算法专题", "teacher": "吴老师", "quota": 24, "location": "信息楼 C301"},
        {"course_code": "H2-DB-12", "course_name": "数据库项目", "teacher": "郑老师", "quota": 20, "location": "信息楼 C302"},
        {"course_code": "H2-NET-13", "course_name": "网络与安全", "teacher": "冯老师", "quota": 20, "location": "信息楼 C303"},
        {"course_code": "H2-APP-14", "course_name": "应用开发实践", "teacher": "陈老师", "quota": 20, "location": "信息楼 C304"},
        {"course_code": "H2-ML-15", "course_name": "机器学习入门", "teacher": "褚老师", "quota": 18, "location": "信息楼 C305"},
        {"course_code": "H2-IOT-16", "course_name": "物联网创客", "teacher": "卫老师", "quota": 18, "location": "创客工坊 M201"},
    ],
}


def build_seed_dataset(settings: Settings) -> Dict[str, List[Dict[str, Any]]]:
    students: List[Dict[str, Any]] = []
    courses: List[Dict[str, Any]] = []

    for grade in ["高一", "高二"]:
        for class_index, class_name in enumerate(GRADE_CLASSES[grade], start=1):
            for student_index in range(1, 6):
                gender = "男" if (class_index + student_index) % 2 == 0 else "女"
                student_no = f"{settings.year}{1 if grade == '高一' else 2}{class_index:02d}{student_index:02d}"
                students.append(
                    {
                        "year": settings.year,
                        "term": settings.term,
                        "grade": grade,
                        "class_name": class_name,
                        "student_no": student_no,
                        "name": f"{grade}第{class_index}班学生{student_index:02d}",
                        "gender": gender,
                    }
                )

        for course in GRADE_COURSES[grade]:
            courses.append(
                {
                    "year": settings.year,
                    "term": settings.term,
                    "grade": grade,
                    **course,
                }
            )

    grade_course_codes = {
        "高一": [it["course_code"] for it in GRADE_COURSES["高一"]],
        "高二": [it["course_code"] for it in GRADE_COURSES["高二"]],
    }

    selections: List[Dict[str, Any]] = []
    for idx, student in enumerate(students, start=1):
        if idx % 10 == 0:
            # Suspended/other: student has no selection row.
            continue

        if idx % 7 == 0:
            # Explicit unselected marker.
            course_code = ""
        else:
            candidates = grade_course_codes[student["grade"]]
            course_code = candidates[idx % len(candidates)]

        selections.append(
            {
                "year": student["year"],
                "term": student["term"],
                "grade": student["grade"],
                "student_no": student["student_no"],
                "name": student["name"],
                "course_code": course_code,
            }
        )

    return {
        "students": students,
        "courses": courses,
        "selections": selections,
    }
