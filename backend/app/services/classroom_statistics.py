"""课堂答题判分与统计汇总。"""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable, Sequence
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.classroom import ClassroomActivity, ClassroomResponse


GetActivity = Callable[[AsyncSession, int], Awaitable[ClassroomActivity]]


async def collect_statistics(
    db: AsyncSession,
    activity_id: int,
    *,
    include_correct_answers: bool,
    get_activity: GetActivity,
) -> dict:
    activity = await get_activity(db, activity_id)
    responses = (
        await db.execute(
            select(ClassroomResponse).where(
                ClassroomResponse.activity_id == activity_id
            )
        )
    ).scalars().all()
    total = len(responses)
    correct_count = sum(1 for response in responses if response.is_correct is True)

    option_counts: Optional[dict] = None
    blank_slot_stats: Optional[list] = None
    top_wrong_answers: Optional[list] = None
    if activity.activity_type == "vote" and activity.options:
        option_counts = _build_vote_option_counts(activity.options, responses)
    elif activity.activity_type == "fill_blank" and activity.correct_answer:
        blank_slot_stats, top_wrong_answers = _build_fill_blank_statistics(
            responses,
            activity.correct_answer,
            include_correct_answers=include_correct_answers,
        )

    return {
        "activity_id": activity_id,
        "total_responses": total,
        "option_counts": option_counts,
        "correct_count": correct_count,
        "correct_rate": round(correct_count / total * 100, 1) if total > 0 else None,
        "blank_slot_stats": blank_slot_stats,
        "top_wrong_answers": top_wrong_answers,
    }


def check_correct(
    student_answer: str,
    correct_answer: str,
    allow_multiple: bool,
) -> bool:
    parsed_correct = parse_blank_answers(correct_answer)
    if parsed_correct is not None:
        parsed_student = parse_blank_answers(student_answer)
        if parsed_student is None:
            parsed_student = [student_answer.strip()]
        if len(parsed_student) != len(parsed_correct):
            return False
        return all(
            student.strip().upper() == correct.strip().upper()
            for student, correct in zip(parsed_student, parsed_correct)
        )
    if allow_multiple:
        student_set = {
            item.strip().upper()
            for item in student_answer.split(",")
            if item.strip()
        }
        correct_set = {
            item.strip().upper()
            for item in correct_answer.split(",")
            if item.strip()
        }
        return student_set == correct_set
    return student_answer.strip().upper() == correct_answer.strip().upper()


def parse_blank_answers(value: str) -> Optional[list[str]]:
    raw = (value or "").strip()
    if not raw:
        return []
    if not raw.startswith("[") and not raw.startswith("{"):
        return None
    try:
        parsed = json.loads(raw)
    except Exception:
        return None
    if isinstance(parsed, list):
        return [str(item).strip() for item in parsed]
    if isinstance(parsed, dict):
        keys = sorted(
            parsed,
            key=lambda key: int(key) if str(key).isdigit() else str(key),
        )
        return [str(parsed[key]).strip() for key in keys]
    return None


def _build_vote_option_counts(
    options: Sequence[object],
    responses: Sequence[ClassroomResponse],
) -> dict[str, int]:
    counts: dict[str, int] = {}
    for option in options:
        key = option["key"] if isinstance(option, dict) else option.key
        counts[key] = sum(
            1
            for response in responses
            if key in (response.answer or "").split(",")
        )
    return counts


def _build_fill_blank_statistics(
    responses: Sequence[ClassroomResponse],
    correct_answer: str,
    *,
    include_correct_answers: bool,
) -> tuple[list[dict], list[dict]]:
    correct_parts = parse_blank_answers(correct_answer)
    if correct_parts is None:
        correct_parts = [correct_answer.strip()]

    slot_wrong_maps: list[dict[str, int]] = [
        {} for _ in range(len(correct_parts))
    ]
    slot_correct_counts = [0 for _ in range(len(correct_parts))]
    overall_wrong_map: dict[str, int] = {}
    for response in responses:
        student_parts = parse_blank_answers(response.answer or "")
        if student_parts is None:
            student_parts = [(response.answer or "").strip()]
        _accumulate_slot_counts(
            correct_parts,
            student_parts,
            slot_correct_counts,
            slot_wrong_maps,
        )
        combined_wrong = " | ".join(student_parts).strip()
        if not response.is_correct and combined_wrong:
            overall_wrong_map[combined_wrong] = (
                overall_wrong_map.get(combined_wrong, 0) + 1
            )

    slot_stats = _build_slot_stats(
        correct_parts,
        slot_correct_counts,
        slot_wrong_maps,
        total=len(responses),
        include_correct_answers=include_correct_answers,
    )
    top_wrong_answers = [
        {"answer": answer, "count": count}
        for answer, count in sorted(
            overall_wrong_map.items(),
            key=lambda item: item[1],
            reverse=True,
        )[:10]
    ]
    return slot_stats, top_wrong_answers


def _accumulate_slot_counts(
    correct_parts: Sequence[str],
    student_parts: Sequence[str],
    slot_correct_counts: list[int],
    slot_wrong_maps: list[dict[str, int]],
) -> None:
    for index, correct in enumerate(correct_parts):
        student = student_parts[index].strip() if index < len(student_parts) else ""
        if student.upper() == correct.strip().upper():
            slot_correct_counts[index] += 1
        elif student:
            slot_wrong_maps[index][student] = (
                slot_wrong_maps[index].get(student, 0) + 1
            )


def _build_slot_stats(
    correct_parts: Sequence[str],
    slot_correct_counts: Sequence[int],
    slot_wrong_maps: Sequence[dict[str, int]],
    *,
    total: int,
    include_correct_answers: bool,
) -> list[dict]:
    slot_stats: list[dict] = []
    for index, correct in enumerate(correct_parts):
        wrong_top = sorted(
            slot_wrong_maps[index].items(),
            key=lambda item: item[1],
            reverse=True,
        )[:5]
        item = {
            "slot_index": index + 1,
            "total_count": total,
            "correct_count": slot_correct_counts[index],
            "correct_rate": (
                round(slot_correct_counts[index] / total * 100, 1)
                if total > 0
                else None
            ),
            "top_wrong_answers": [
                {"answer": answer, "count": count}
                for answer, count in wrong_top
            ],
        }
        if include_correct_answers:
            item["correct_answer"] = correct
        slot_stats.append(item)
    return slot_stats
