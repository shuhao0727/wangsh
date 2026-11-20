"""Resolve the question attached to a student's answer."""

import json
from string import ascii_letters

from app.models.assessment import AssessmentAnswer


def answer_question_fields(answer: AssessmentAnswer) -> dict:
    """Use the generated question when saved, otherwise use the legacy bank row."""
    if answer.question_snapshot:
        try:
            snapshot = json.loads(answer.question_snapshot)
        except json.JSONDecodeError:
            snapshot = {}
        if not isinstance(snapshot, dict):
            snapshot = {}
        return {
            "content": snapshot.get("content", ""),
            "options": snapshot.get("options"),
            "correct_answer": snapshot.get("correct_answer", ""),
            "explanation": snapshot.get("explanation"),
        }
    question = answer.question
    return {
        "content": question.content if question else "",
        "options": question.options if question else None,
        "correct_answer": question.correct_answer if question else "",
        "explanation": question.explanation if question else None,
    }


def student_question_options(options: str | list | dict | None) -> str | None:
    """Project choice labels and text, omitting other fields from generated options."""
    try:
        parsed = json.loads(options) if isinstance(options, str) else options
    except json.JSONDecodeError:
        return None
    if isinstance(parsed, dict):
        choices = {
            key: value for key, value in parsed.items()
            if len(key) == 1 and key in ascii_letters and isinstance(value, str)
        }
    elif isinstance(parsed, list):
        choices = [value for value in parsed if isinstance(value, str)]
    else:
        return None
    return json.dumps(choices, ensure_ascii=False)


def answer_review(answer: AssessmentAnswer) -> dict:
    return {
        "id": answer.id,
        "question_type": answer.question_type,
        **answer_question_fields(answer),
        "student_answer": answer.student_answer,
        "is_correct": answer.is_correct,
        "earned_score": answer.ai_score,
        "max_score": answer.max_score,
        "ai_feedback": answer.ai_feedback,
    }
