"""测评数据导出 XLSX"""

from __future__ import annotations

import json
from io import BytesIO
from typing import Optional, Sequence

from openpyxl import Workbook
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.assessment import (
    AssessmentSession,
    AssessmentAnswer,
    AssessmentBasicProfile,
)
from app.services.assessment.session_service import get_config_sessions
from app.services.xbk.exports.common import apply_table_style, auto_adjust_column_width

STATUS_TEXT = {
    "in_progress": "答题中",
    "submitted": "已提交",
    "graded": "已评分",
    "archived": "已重测",
}


def _answer_details(session: AssessmentSession) -> list[dict]:
    details = []
    for a in session.answers:
        q = a.question
        details.append({
            "content": q.content if q else "",
            "student_answer": a.student_answer or "",
            "correct_answer": q.correct_answer if q else "",
            "is_correct": "正确" if a.is_correct else ("错误" if a.is_correct is False else "-"),
            "earned_score": a.ai_score if a.ai_score is not None else "-",
            "max_score": a.max_score,
        })
    return details


async def _load_session_answers(db: AsyncSession, session_id: int) -> list[dict]:
    """加载单个 session 的答题详情"""
    result = await db.execute(
        select(AssessmentSession)
        .options(selectinload(AssessmentSession.answers).selectinload(AssessmentAnswer.question))
        .where(AssessmentSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    return _answer_details(session) if session else []


async def _load_answers_for_sessions(
    db: AsyncSession, session_ids: Sequence[int]
) -> dict[int, list[dict]]:
    """批量加载多个 session 的答题详情（一条 IN 查询 + selectinload）。

    逐 session 调用 _load_session_answers 时，每次的 selectinload 会额外发出
    2 条 SQL（answers 一条、question 一条），加主查询共 3 次往返/学生；
    3000 名学生导出即约 9000 次往返。改为一次 IN 查询后往返数固定为 3。
    """
    if not session_ids:
        return {}
    result = await db.execute(
        select(AssessmentSession)
        .options(selectinload(AssessmentSession.answers).selectinload(AssessmentAnswer.question))
        .where(AssessmentSession.id.in_(session_ids))
    )
    return {session.id: _answer_details(session) for session in result.scalars().all()}


async def _load_profiles_for_sessions(
    db: AsyncSession, session_ids: Sequence[int]
) -> dict[int, AssessmentBasicProfile]:
    """批量加载多个 session 的基础画像（一条 IN 查询）。"""
    if not session_ids:
        return {}
    result = await db.execute(
        select(AssessmentBasicProfile).where(AssessmentBasicProfile.session_id.in_(session_ids))
    )
    return {profile.session_id: profile for profile in result.scalars().all()}


def _build_detail_sheet(wb: Workbook, items: list, all_answers: list[list[dict]], max_q: int) -> None:
    """Sheet 1：答题明细（每学生一行，含每题详情）。"""
    ws1 = wb.active
    ws1.title = "答题明细"
    base_headers = ["序号", "学生姓名", "班级", "状态", "得分", "满分", "得分率", "提交时间"]
    q_headers: list[str] = []
    for i in range(1, max_q + 1):
        q_headers.extend([f"第{i}题-题目", f"第{i}题-学生答案", f"第{i}题-正确答案", f"第{i}题-判定", f"第{i}题-得分"])
    headers1 = base_headers + q_headers
    ws1.append(headers1)

    for idx, (item, answers) in enumerate(zip(items, all_answers), 1):
        earned = item.get("earned_score")
        total_s = item.get("total_score", 0)
        rate = f"{round(earned / total_s * 100, 1)}%" if earned is not None and total_s else ""
        submitted = item.get("submitted_at")
        sub_str = ""
        if submitted:
            sub_str = str(submitted)[:19].replace("T", " ") if isinstance(submitted, str) else submitted.strftime("%Y-%m-%d %H:%M:%S")
        row = [
            idx,
            item.get("user_name") or "-",
            item.get("class_name") or "-",
            STATUS_TEXT.get(item.get("status", ""), item.get("status", "")),
            earned if earned is not None else "-",
            total_s,
            rate,
            sub_str,
        ]
        for a in answers:
            row.extend([a["content"], a["student_answer"], a["correct_answer"], a["is_correct"], a["earned_score"]])
        # 补齐空列（题目数不足 max_q 时）
        row.extend([""] * (5 * (max_q - len(answers))))
        ws1.append(row)

    if len(items) > 0:
        apply_table_style(ws1, 1, 2, len(items) + 1, 1, len(headers1))
    auto_adjust_column_width(ws1)


def _collect_knowledge_scores(items: list, profiles_by_session: dict) -> tuple[list, list[str]]:
    """把每个学生的知识点得分解析成 (kp_data, all_kp_keys)。

    解析失败的单个 session 记为空知识点，不影响整体导出。
    """
    kp_data: list[tuple[dict, dict[str, float]]] = []
    all_kp_keys: list[str] = []
    kp_key_set: set[str] = set()
    for item in items:
        sid = item.get("id")
        if not sid or item.get("status") not in ("graded", "submitted"):
            kp_data.append((item, {}))
            continue
        try:
            profile = profiles_by_session.get(sid)
            if profile and profile.knowledge_scores:
                raw = json.loads(profile.knowledge_scores)
                kp: dict[str, float] = {}
                for k, v in raw.items():
                    d = v if isinstance(v, dict) else {}
                    t = d.get("total", 0)
                    kp[k] = round(d.get("earned", 0) / t * 100, 1) if t else 0
                    if k not in kp_key_set:
                        kp_key_set.add(k)
                        all_kp_keys.append(k)
                kp_data.append((item, kp))
            else:
                kp_data.append((item, {}))
        except Exception:
            kp_data.append((item, {}))
    return kp_data, all_kp_keys


def _build_knowledge_sheet(wb: Workbook, kp_data: list, all_kp_keys: list[str]) -> None:
    """Sheet 2：知识点分析（每个知识点一列，值为百分比）。"""
    if not all_kp_keys:
        return
    ws2 = wb.create_sheet("知识点分析")
    headers2 = ["学生姓名", "班级"] + [f"{k}(%)" for k in all_kp_keys]
    ws2.append(headers2)
    for item, kp in kp_data:
        row = [item.get("user_name") or "-", item.get("class_name") or "-"]
        row.extend([kp.get(k, "") for k in all_kp_keys])
        ws2.append(row)
    if len(kp_data) > 0:
        apply_table_style(ws2, 1, 2, len(kp_data) + 1, 1, len(headers2))
    auto_adjust_column_width(ws2)


async def build_assessment_export_xlsx(
    db: AsyncSession,
    config_id: int,
    class_name: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    time_field: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> BytesIO:
    items, total = await get_config_sessions(
        db, config_id, skip=0, limit=None,
        class_name=class_name, status=status, search=search,
        time_field=time_field, start_date=start_date, end_date=end_date,
    )

    # 先批量加载所有 session 的答题详情，确定最大题目数（避免每学生 3 次往返）
    session_ids = [item["id"] for item in items if item.get("id")]
    answers_by_session = await _load_answers_for_sessions(db, session_ids)
    all_answers: list[list[dict]] = []
    max_q = 0
    for item in items:
        answers = answers_by_session.get(item.get("id"), [])
        all_answers.append(answers)
        max_q = max(max_q, len(answers))

    wb = Workbook()

    # ── Sheet 1: 答题明细（每学生一行，含每题详情） ──
    _build_detail_sheet(wb, items, all_answers, max_q)

    # ── Sheet 2: 知识点分析 ──
    graded_session_ids = [
        item["id"] for item in items
        if item.get("id") and item.get("status") in ("graded", "submitted")
    ]
    profiles_by_session = await _load_profiles_for_sessions(db, graded_session_ids)
    kp_data, all_kp_keys = _collect_knowledge_scores(items, profiles_by_session)
    _build_knowledge_sheet(wb, kp_data, all_kp_keys)

    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return output