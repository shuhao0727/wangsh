"""
自主检测 session_service 测试
覆盖：_parse_grading_json、_draw_questions、get_available_configs、
      start_session、submit_answer、submit_session、get_config_statistics
"""
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock
from types import SimpleNamespace

from app.services.assessment.session_service import (
    _parse_grading_json,
    get_available_configs,
    start_session,
    submit_answer,
    submit_session,
    get_session_questions,
    get_session_result,
    get_config_sessions,
    get_config_statistics,
    _draw_questions,
    _load_session,
)


# ─── _parse_grading_json 纯函数测试 ───


def test_parse_grading_json_valid():
    raw = '{"score": 8, "is_correct": true, "feedback": "回答正确"}'
    result = _parse_grading_json(raw, max_score=10)
    assert result["score"] == 8
    assert result["is_correct"] is True
    assert result["feedback"] == "回答正确"


def test_parse_grading_json_with_surrounding_text():
    raw = '好的，以下是评分结果：\n{"score": 5, "is_correct": false, "feedback": "部分正确"}\n以上。'
    result = _parse_grading_json(raw, max_score=10)
    assert result["score"] == 5
    assert result["is_correct"] is False


def test_parse_grading_json_markdown_code_block():
    raw = '```json\n{"score": 10, "is_correct": true, "feedback": "完美"}\n```'
    result = _parse_grading_json(raw, max_score=10)
    assert result["score"] == 10
    assert result["is_correct"] is True


def test_parse_grading_json_score_clamped():
    raw = '{"score": 999, "is_correct": true, "feedback": "ok"}'
    result = _parse_grading_json(raw, max_score=5)
    assert result["score"] == 5  # clamped to max


def test_parse_grading_json_negative_score():
    raw = '{"score": -3, "is_correct": false, "feedback": "bad"}'
    result = _parse_grading_json(raw, max_score=10)
    assert result["score"] == 0  # clamped to 0


def test_parse_grading_json_invalid():
    raw = "这不是 JSON"
    result = _parse_grading_json(raw, max_score=10)
    assert result["score"] == 0
    assert result["is_correct"] is False
    assert "解析失败" in result["feedback"]


def test_parse_grading_json_empty():
    result = _parse_grading_json("", max_score=10)
    assert result["score"] == 0


# ─── Mock 工具 ───

def _make_config(id=1, enabled=True, subject="信息技术", title="测试检测",
                  total_score=100, time_limit_minutes=60, agent_id=1,
                  question_config=None):
    c = SimpleNamespace(
        id=id, enabled=enabled, subject=subject, title=title,
        total_score=total_score, time_limit_minutes=time_limit_minutes,
        agent_id=agent_id, created_at="2025-01-01T00:00:00",
        question_config=question_config or '{"choice": {"count": 2}, "fill": {"count": 1}}',
    )
    return c


def _make_question(id=1, config_id=1, question_type="choice", score=10,
                   content="题目内容", options="A.x B.y C.z D.w",
                   correct_answer="A", explanation="解析", knowledge_point="变量"):
    return SimpleNamespace(
        id=id, config_id=config_id, question_type=question_type, score=score,
        content=content, options=options, correct_answer=correct_answer,
        explanation=explanation, knowledge_point=knowledge_point,
    )


def _make_session(id=1, config_id=1, user_id=100, status="in_progress",
                  total_score=100, earned_score=None, started_at="2025-01-01T00:00:00",
                  submitted_at=None, answers=None, config=None, user=None, created_at="2025-01-01"):
    s = SimpleNamespace(
        id=id, config_id=config_id, user_id=user_id, status=status,
        total_score=total_score, earned_score=earned_score,
        started_at=started_at, submitted_at=submitted_at,
        answers=answers or [], config=config, user=user,
        created_at=created_at,
    )
    return s


def _make_answer(id=1, session_id=1, question_id=1, question_type="choice",
                 max_score=10, student_answer=None, ai_score=None,
                 is_correct=None, ai_feedback=None, answered_at=None, question=None):
    return SimpleNamespace(
        id=id, session_id=session_id, question_id=question_id,
        question_type=question_type, max_score=max_score,
        student_answer=student_answer, ai_score=ai_score,
        is_correct=is_correct, ai_feedback=ai_feedback,
        answered_at=answered_at, question=question,
    )


class MockScalarResult:
    """模拟 db.execute() 返回的 result"""
    def __init__(self, value=None, values=None):
        self._value = value
        self._values = values or []

    def scalar_one_or_none(self):
        return self._value

    def scalar_one(self):
        if self._value is None:
            raise Exception("No result")
        return self._value

    def scalar(self):
        return self._value

    def scalars(self):
        return self

    def all(self):
        return self._values


def _make_db(execute_side_effects=None):
    """构造 AsyncMock db，可以按顺序返回不同结果"""
    db = AsyncMock()
    if execute_side_effects:
        db.execute.side_effect = execute_side_effects
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    return db


# ─── _load_session 测试 ───


def test_load_session_not_found():
    db = _make_db([MockScalarResult(None)])
    try:
        asyncio.run(_load_session(db, session_id=999, user_id=100))
        assert False, "应该抛出 ValueError"
    except ValueError as e:
        assert "不存在" in str(e)


def test_load_session_wrong_user():
    session = _make_session(user_id=200)
    db = _make_db([MockScalarResult(session)])
    try:
        asyncio.run(_load_session(db, session_id=1, user_id=100))
        assert False, "应该抛出 ValueError"
    except ValueError as e:
        assert "无权" in str(e)


def test_load_session_success():
    session = _make_session(user_id=100)
    db = _make_db([MockScalarResult(session)])
    result = asyncio.run(_load_session(db, session_id=1, user_id=100))
    assert result.id == 1


# ─── _draw_questions 测试 ───


def test_draw_questions_by_type():
    config = _make_config(question_config='{"choice": {"count": 2}}')
    q1 = _make_question(id=1, question_type="choice")
    q2 = _make_question(id=2, question_type="choice")
    q3 = _make_question(id=3, question_type="choice")

    db = _make_db([MockScalarResult(values=[q1, q2, q3])])
    drawn = asyncio.run(_draw_questions(db, config))
    assert len(drawn) == 2  # 抽2道


def test_draw_questions_fallback_all():
    """question_config 为空时取全部题目"""
    config = _make_config(question_config='{}')
    q1 = _make_question(id=1)
    q2 = _make_question(id=2)

    db = _make_db([MockScalarResult(values=[q1, q2])])
    drawn = asyncio.run(_draw_questions(db, config))
    assert len(drawn) == 2


# ─── start_session 测试 ───


def test_start_session_config_not_found():
    db = _make_db([MockScalarResult(None)])
    try:
        asyncio.run(start_session(db, config_id=999, user_id=100))
        assert False
    except ValueError as e:
        assert "不存在" in str(e)


def test_start_session_config_disabled():
    config = _make_config(enabled=False)
    db = _make_db([MockScalarResult(config)])
    try:
        asyncio.run(start_session(db, config_id=1, user_id=100))
        assert False
    except ValueError as e:
        assert "未开放" in str(e)


def test_start_session_returns_existing_in_progress():
    """已有 in_progress 会话时应返回该会话（幂等）"""
    config = _make_config()
    existing_session = _make_session(id=42, config_id=1, user_id=100)

    db = _make_db([
        MockScalarResult(config),          # select config
        MockScalarResult(existing_session), # select existing session
        MockScalarResult(value=5),          # count answers
    ])

    result = asyncio.run(start_session(db, config_id=1, user_id=100))
    assert result["session_id"] == 42
    assert result["total_questions"] == 5


def test_start_session_empty_question_pool():
    """题库为空时应报错"""
    config = _make_config(question_config='{"choice": {"count": 5}}')

    db = _make_db([
        MockScalarResult(config),   # select config
        MockScalarResult(None),     # no existing session
        MockScalarResult(values=[]),  # empty question pool for choice
        MockScalarResult(values=[]),  # fallback: all questions also empty
    ])

    try:
        asyncio.run(start_session(db, config_id=1, user_id=100))
        assert False
    except ValueError as e:
        assert "题库为空" in str(e)


# ─── submit_answer 测试 ───


def test_submit_answer_choice_correct():
    """选择题正确答案"""
    q = _make_question(correct_answer="B")
    answer = _make_answer(id=10, question_type="choice", max_score=10, question=q)
    session = _make_session(user_id=100, status="in_progress")

    db = _make_db([
        MockScalarResult(session),  # _load_session
        MockScalarResult(answer),   # select answer
    ])

    result = asyncio.run(submit_answer(db, session_id=1, user_id=100, answer_id=10, student_answer="B"))
    assert result["is_correct"] is True
    assert result["earned_score"] == 10
    assert answer.ai_score == 10


def test_submit_answer_choice_wrong():
    """选择题错误答案"""
    q = _make_question(correct_answer="A")
    answer = _make_answer(id=10, question_type="choice", max_score=10, question=q)
    session = _make_session(user_id=100, status="in_progress")

    db = _make_db([
        MockScalarResult(session),
        MockScalarResult(answer),
    ])

    result = asyncio.run(submit_answer(db, session_id=1, user_id=100, answer_id=10, student_answer="C"))
    assert result["is_correct"] is False
    assert result["earned_score"] == 0


def test_submit_answer_session_already_submitted():
    """已提交的会话不能继续答题"""
    session = _make_session(user_id=100, status="graded")
    db = _make_db([MockScalarResult(session)])

    try:
        asyncio.run(submit_answer(db, session_id=1, user_id=100, answer_id=10, student_answer="A"))
        assert False
    except ValueError as e:
        assert "已提交" in str(e)


def test_submit_answer_short_answer_only_saves():
    """简答题仅保存，不即时评分"""
    q = _make_question(question_type="short_answer", correct_answer="参考答案")
    answer = _make_answer(id=10, question_type="short_answer", max_score=20, question=q)
    session = _make_session(user_id=100, status="in_progress")

    db = _make_db([
        MockScalarResult(session),
        MockScalarResult(answer),
    ])

    result = asyncio.run(submit_answer(db, session_id=1, user_id=100, answer_id=10, student_answer="我的答案"))
    assert result["is_correct"] is None  # 未评分
    assert result["earned_score"] is None
    assert answer.student_answer == "我的答案"


# ─── get_config_statistics 测试 ───


def test_get_config_statistics_no_graded():
    """没有已评分会话时返回 None 统计"""
    config = _make_config()

    db = _make_db([
        MockScalarResult(config),       # select config
        MockScalarResult(values=[]),     # graded sessions = empty
        MockScalarResult(value=3),       # all_count = 3
    ])

    result = asyncio.run(get_config_statistics(db, config_id=1))
    assert result["submitted_count"] == 0
    assert result["avg_score"] is None
    assert result["total_students"] == 3


def test_get_config_statistics_with_data():
    """有评分数据时计算统计"""
    config = _make_config(total_score=100)
    s1 = _make_session(id=1, earned_score=80, status="graded")
    s2 = _make_session(id=2, earned_score=60, status="graded")
    s3 = _make_session(id=3, earned_score=90, status="graded")

    # 知识点掌握率查询
    a1 = _make_answer(ai_score=8, max_score=10, question=_make_question(knowledge_point="变量"))
    a2 = _make_answer(ai_score=5, max_score=10, question=_make_question(knowledge_point="循环"))

    db = _make_db([
        MockScalarResult(config),                # select config
        MockScalarResult(values=[s1, s2, s3]),   # graded sessions
        MockScalarResult(value=4),               # all_count
        MockScalarResult(values=[a1, a2]),        # answers for knowledge rates
    ])

    result = asyncio.run(get_config_statistics(db, config_id=1))
    assert result["submitted_count"] == 3
    assert result["avg_score"] == 76.7  # (80+60+90)/3
    assert result["max_score"] == 90
    assert result["min_score"] == 60
    # pass_rate: threshold=60, all 3 pass → 100.0
    assert result["pass_rate"] == 100.0


def test_get_config_statistics_config_not_found():
    db = _make_db([MockScalarResult(None)])
    try:
        asyncio.run(get_config_statistics(db, config_id=999))
        assert False
    except ValueError as e:
        assert "不存在" in str(e)

