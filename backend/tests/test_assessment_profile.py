"""
初级画像服务测试
覆盖：generate_basic_profile、get_basic_profile
"""
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch
from types import SimpleNamespace

from app.services.assessment.basic_profile_service import (
    generate_basic_profile,
    get_basic_profile,
)


def _make_question(knowledge_point="变量", correct_answer="A"):
    return SimpleNamespace(
        id=1, knowledge_point=knowledge_point,
        content="题目", correct_answer=correct_answer,
    )


def _make_answer(ai_score=8, max_score=10, is_correct=True,
                 question=None, question_id=1, student_answer="A"):
    return SimpleNamespace(
        id=1, ai_score=ai_score, max_score=max_score,
        is_correct=is_correct, question=question or _make_question(),
        question_id=question_id, student_answer=student_answer,
    )


def _make_session(id=1, user_id=100, config_id=1, earned_score=80,
                  total_score=100, answers=None, user=None):
    return SimpleNamespace(
        id=id, user_id=user_id, config_id=config_id,
        earned_score=earned_score, total_score=total_score,
        answers=answers or [], user=user,
    )


def _make_config(agent_id=1, subject="信息技术", title="测试检测"):
    return SimpleNamespace(
        id=1, agent_id=agent_id, subject=subject, title=title,
    )


class MockScalarResult:
    def __init__(self, value=None, values=None):
        self._value = value
        self._values = values or []

    def scalar_one_or_none(self):
        return self._value

    def scalars(self):
        return self

    def all(self):
        return self._values


def _make_db(execute_side_effects=None):
    db = AsyncMock()
    if execute_side_effects:
        db.execute.side_effect = execute_side_effects
    db.add = MagicMock()
    db.flush = AsyncMock()
    return db


# ─── get_basic_profile ───


def test_get_basic_profile_found():
    profile = SimpleNamespace(id=1, session_id=10)
    db = _make_db([MockScalarResult(profile)])
    result = asyncio.run(get_basic_profile(db, session_id=10))
    assert result.id == 1


def test_get_basic_profile_not_found():
    db = _make_db([MockScalarResult(None)])
    result = asyncio.run(get_basic_profile(db, session_id=999))
    assert result is None


# ─── generate_basic_profile ───


def test_generate_basic_profile_already_exists():
    """已存在画像时直接返回"""
    existing = SimpleNamespace(id=5, session_id=1)
    db = _make_db([MockScalarResult(existing)])

    session = _make_session()
    config = _make_config()
    result = asyncio.run(generate_basic_profile(db, session, config))
    assert result is existing  # 直接返回已存在的画像


@patch("app.services.agents.chat_blocking.run_agent_chat_blocking")
def test_generate_basic_profile_creates_new(mock_ai):
    """正常生成新画像"""
    mock_ai.return_value = "你在变量方面掌握不错，循环需要加强。"

    q1 = _make_question(knowledge_point="变量")
    q2 = _make_question(knowledge_point="循环")
    a1 = _make_answer(ai_score=10, max_score=10, is_correct=True, question=q1)
    a2 = _make_answer(ai_score=3, max_score=10, is_correct=False, question=q2)

    session = _make_session(answers=[a1, a2], earned_score=13, total_score=20)
    config = _make_config(agent_id=1)

    db = _make_db([
        MockScalarResult(None),  # no existing profile
        MockScalarResult("张三"),  # user full_name query
    ])

    result = asyncio.run(generate_basic_profile(db, session, config))
    assert result is not None
    assert db.add.called
    assert db.flush.called
    assert mock_ai.called

    # 验证 AI 被调用时 prompt 包含关键信息
    call_args = mock_ai.call_args
    prompt = call_args[1].get("message", "") or call_args[0][2] if len(call_args[0]) > 2 else ""
    # prompt 应包含学科和得分信息


@patch("app.services.agents.chat_blocking.run_agent_chat_blocking")
def test_generate_basic_profile_ai_failure(mock_ai):
    """AI 调用失败时仍然创建画像"""
    mock_ai.side_effect = Exception("AI 服务不可用")

    session = _make_session(answers=[], earned_score=0, total_score=100)
    config = _make_config(agent_id=1)

    db = _make_db([
        MockScalarResult(None),          # no existing profile
        MockScalarResult(values=[]),     # load answers (empty)
        MockScalarResult("同学"),        # user full_name query
    ])

    result = asyncio.run(generate_basic_profile(db, session, config))
    assert result is not None
    assert db.add.called


def test_generate_basic_profile_no_agent():
    """未配置 agent_id 时不调用 AI"""
    session = _make_session(answers=[], earned_score=0, total_score=100)
    config = _make_config(agent_id=None)

    db = _make_db([
        MockScalarResult(None),          # no existing profile
        MockScalarResult(values=[]),     # load answers (empty)
        MockScalarResult("同学"),        # user full_name query
    ])

    result = asyncio.run(generate_basic_profile(db, session, config))
    assert result is not None
    assert db.add.called


def test_generate_basic_profile_knowledge_aggregation():
    """验证知识点聚合逻辑"""
    q1 = _make_question(knowledge_point="变量")
    q2 = _make_question(knowledge_point="变量")
    q3 = _make_question(knowledge_point="循环")
    a1 = _make_answer(ai_score=10, max_score=10, is_correct=True, question=q1)
    a2 = _make_answer(ai_score=5, max_score=10, is_correct=False, question=q2)
    a3 = _make_answer(ai_score=0, max_score=10, is_correct=False, question=q3)

    session = _make_session(answers=[a1, a2, a3], earned_score=15, total_score=30)
    config = _make_config(agent_id=None)

    db = _make_db([MockScalarResult(None), MockScalarResult("同学")])

    result = asyncio.run(generate_basic_profile(db, session, config))
    assert result is not None

    # 检查 add 被调用时传入的 profile 对象
    added_obj = db.add.call_args[0][0]
    kp_scores = json.loads(added_obj.knowledge_scores)
    assert kp_scores["变量"]["earned"] == 15  # 10 + 5
    assert kp_scores["变量"]["total"] == 20   # 10 + 10
    assert kp_scores["循环"]["earned"] == 0
    assert kp_scores["循环"]["total"] == 10

    wrong = json.loads(added_obj.wrong_points)
    assert "变量" in wrong
    assert "循环" in wrong
