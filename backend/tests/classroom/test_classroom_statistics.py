"""课堂统计职责拆分后的行为兼容测试。"""

import asyncio
from types import SimpleNamespace

from app.services import classroom as classroom_svc


class _Result:
    def __init__(self, values):
        self._values = values

    def scalars(self):
        return self

    def all(self):
        return self._values


class _DB:
    def __init__(self, responses):
        self.responses = responses

    async def execute(self, _statement):
        return _Result(self.responses)


def test_vote_statistics_preserve_option_counts(monkeypatch):
    activity = SimpleNamespace(
        activity_type="vote",
        options=[
            {"key": "A", "text": "A"},
            {"key": "B", "text": "B"},
        ],
        correct_answer="A",
    )
    responses = [
        SimpleNamespace(answer="A", is_correct=True),
        SimpleNamespace(answer="A,B", is_correct=False),
    ]

    async def fake_get_activity(_db, _activity_id):
        return activity

    monkeypatch.setattr(classroom_svc, "_get_activity", fake_get_activity)

    result = asyncio.run(classroom_svc.get_statistics(_DB(responses), 7))

    assert result == {
        "activity_id": 7,
        "total_responses": 2,
        "option_counts": {"A": 2, "B": 1},
        "correct_count": 1,
        "correct_rate": 50.0,
        "blank_slot_stats": None,
        "top_wrong_answers": None,
    }


def test_fill_blank_statistics_hide_answers_for_student_view(monkeypatch):
    activity = SimpleNamespace(
        activity_type="fill_blank",
        options=None,
        correct_answer='["TCP", "IP"]',
    )
    responses = [
        SimpleNamespace(answer='["TCP", "IP"]', is_correct=True),
        SimpleNamespace(answer='["UDP", "IP"]', is_correct=False),
    ]

    async def fake_get_activity(_db, _activity_id):
        return activity

    monkeypatch.setattr(classroom_svc, "_get_activity", fake_get_activity)

    result = asyncio.run(
        classroom_svc.get_statistics(
            _DB(responses),
            8,
            include_correct_answers=False,
        )
    )

    assert result["correct_rate"] == 50.0
    assert result["blank_slot_stats"][0] == {
        "slot_index": 1,
        "total_count": 2,
        "correct_count": 1,
        "correct_rate": 50.0,
        "top_wrong_answers": [{"answer": "UDP", "count": 1}],
    }
    assert result["blank_slot_stats"][1]["correct_rate"] == 100.0
    assert all(
        "correct_answer" not in slot
        for slot in result["blank_slot_stats"]
    )
    assert result["top_wrong_answers"] == [
        {"answer": "UDP | IP", "count": 1}
    ]


def test_answer_checking_preserves_json_and_multi_select_contracts():
    assert classroom_svc._check_correct(
        '["tcp", "ip"]',
        '["TCP", "IP"]',
        False,
    )
    assert classroom_svc._check_correct(
        '{"1": "tcp", "2": "ip"}',
        '{"1": "TCP", "2": "IP"}',
        False,
    )
    assert classroom_svc._check_correct("B,A", "A,B", True)
    assert not classroom_svc._check_correct("A", "A,B", True)
