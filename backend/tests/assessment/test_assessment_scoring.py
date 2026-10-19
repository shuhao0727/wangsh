"""纯计分边界；直接加载纯模块，避免包级服务导入触发 settings/ORM。"""

import importlib.util
from pathlib import Path
from types import SimpleNamespace

import pytest


_SPEC = importlib.util.spec_from_file_location(
    "assessment_scoring_under_test",
    Path(__file__).resolve().parents[2] / "app/services/assessment/scoring.py",
)
_scoring = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_scoring)


def _answer(id=1, session_id=10, knowledge_point="循环", **changes):
    values = {
        "id": id,
        "session_id": session_id,
        "knowledge_point": knowledge_point,
        "attempt_seq": 1,
        "is_adaptive": False,
        "ai_score": 6,
        "max_score": 10,
        "question": SimpleNamespace(knowledge_point=knowledge_point),
    }
    values.update(changes)
    return SimpleNamespace(**values)


def test_first_attempt_is_stable_within_each_session_without_mutating_input():
    retry = _answer(4, attempt_seq=2, is_adaptive=True)
    later_id = _answer(3)
    first = _answer(2)
    other_session = _answer(1, session_id=20)
    answers = [retry, other_session, later_id, first]

    assert _scoring._first_attempt_per_kp(answers) == [first, other_session]
    assert answers == [retry, other_session, later_id, first]


def test_adaptive_practice_without_first_attempt_is_not_counted():
    assert _scoring._first_attempt_per_kp([
        _answer(1, attempt_seq=2, is_adaptive=True),
        _answer(2, attempt_seq=3, is_adaptive=True),
    ]) == []


def test_fixed_question_with_later_sequence_keeps_existing_scoring_contract():
    answer = _answer(1, attempt_seq=2, is_adaptive=False)
    assert _scoring._first_attempt_per_kp([answer]) == [answer]


def test_answers_without_knowledge_point_are_all_kept_even_when_adaptive():
    one = _answer(1, knowledge_point=None, attempt_seq=2, is_adaptive=True)
    two = _answer(2, knowledge_point="")
    legacy = SimpleNamespace()
    assert _scoring._first_attempt_per_kp([two, one, legacy]) == [legacy, two, one]


def test_missing_legacy_attributes_use_original_defaults():
    one = SimpleNamespace(knowledge_point="循环")
    two = SimpleNamespace(knowledge_point="循环")
    no_knowledge_point = SimpleNamespace()
    assert _scoring._first_attempt_per_kp([one, two, no_knowledge_point]) == [
        no_knowledge_point,
        one,
    ]


def test_knowledge_rates_weight_by_available_points_and_keep_question_source():
    answers = [
        _answer(1, ai_score=1, max_score=3),
        _answer(2, ai_score=2, max_score=4),
        _answer(3, knowledge_point="答案快照", ai_score=None,
                question=SimpleNamespace(knowledge_point="关联题目")),
        _answer(4, knowledge_point="缺失关联", question=None),
        _answer(5, knowledge_point="空知识点", question=SimpleNamespace(knowledge_point="")),
        _answer(6, knowledge_point="零分题", max_score=0, ai_score=0),
    ]
    assert _scoring._aggregate_knowledge_rates(answers) == {
        "循环": 42.9,
        "关联题目": 0.0,
    }


def test_knowledge_rates_do_not_mix_adaptive_retries_into_first_score():
    first = _answer(1, ai_score=2)
    practice = _answer(2, ai_score=10, attempt_seq=2, is_adaptive=True)
    other_session = _answer(3, session_id=20, ai_score=8)
    retained = _scoring._first_attempt_per_kp([practice, other_session, first])
    assert _scoring._aggregate_knowledge_rates(retained) == {"循环": 50.0}


@pytest.mark.parametrize("scores,total", [([], 100), ([0], 0), ([0], -1)])
def test_distribution_has_no_buckets_without_scores_or_positive_total(scores, total):
    assert _scoring._calc_score_distribution(scores, total) == []


def test_distribution_preserves_inclusive_lower_bucket_boundaries():
    distribution = _scoring._calc_score_distribution([0, 10, 11, 20, 90, 100], 100)
    assert distribution == [
        {"range": "0-10", "count": 2},
        {"range": "10-20", "count": 2},
        {"range": "20-30", "count": 0},
        {"range": "30-40", "count": 0},
        {"range": "40-50", "count": 0},
        {"range": "50-60", "count": 0},
        {"range": "60-70", "count": 0},
        {"range": "70-80", "count": 0},
        {"range": "80-90", "count": 1},
        {"range": "90-100", "count": 1},
    ]


def test_distribution_preserves_remainder_and_out_of_range_fallback():
    distribution = _scoring._calc_score_distribution([0, 2, 4, 24, 25, -1, 26], 25)
    counts = {item["range"]: item["count"] for item in distribution}
    assert len(distribution) == 13
    assert counts["0-2"] == 2
    assert counts["2-4"] == 1
    assert counts["22-24"] == 1
    assert counts["24-25"] == 3
    assert sum(counts.values()) == 7


def test_distribution_with_small_total_keeps_nonempty_unit_intervals():
    assert _scoring._calc_score_distribution([0, 1, 2, 3], 3) == [
        {"range": "0-1", "count": 2},
        {"range": "1-2", "count": 1},
        {"range": "2-3", "count": 1},
    ]
