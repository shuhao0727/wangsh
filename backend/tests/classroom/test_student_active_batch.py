"""学生端 /classroom/active 批量作答查询回归测试。

原本该端点对每个进行中的活动各发一次 get_user_response，活动越多数据库
往返越多（N+1）。现改为一次 IN 查询，本文件固定住“只查一次”和“归属正确”。
"""

import asyncio
from types import SimpleNamespace

import pytest

from app.api.endpoints.classroom import student as student_api
from app.services import classroom as classroom_svc


class _ScalarResult:
    def __init__(self, values=None):
        self._values = values or []

    def scalars(self):
        return self

    def all(self):
        return self._values

    def scalar_one_or_none(self):
        return self._values[0] if self._values else None


class _RecordingDB:
    """记录每次 execute 的语句与参数，用于断言查询次数。"""

    def __init__(self, responses):
        self._responses = list(responses)
        self.statements = []

    async def execute(self, stmt):
        self.statements.append(stmt)
        return _ScalarResult(self._responses.pop(0) if self._responses else [])


def _response(activity_id, user_id=100):
    return SimpleNamespace(
        id=activity_id * 10,
        activity_id=activity_id,
        user_id=user_id,
        answer="A",
        is_correct=True,
    )


def test_get_user_responses_returns_map_keyed_by_activity_id():
    db = _RecordingDB([[ _response(1), _response(2) ]])

    result = asyncio.run(classroom_svc.get_user_responses(db, [1, 2], 100))

    assert set(result) == {1, 2}
    assert result[1].answer == "A"
    assert len(db.statements) == 1


def test_get_user_responses_skips_query_when_no_activities():
    db = _RecordingDB([])

    result = asyncio.run(classroom_svc.get_user_responses(db, [], 100))

    assert result == {}
    assert db.statements == []


def test_get_user_responses_uses_single_in_query():
    db = _RecordingDB([[]])

    asyncio.run(classroom_svc.get_user_responses(db, [1, 2, 3], 100))

    # 只发一条 SQL，且带 IN（批量）而非常量等值比较
    assert len(db.statements) == 1
    compiled = str(db.statements[0])
    assert " IN " in compiled.upper()
    assert "znt_classroom_responses" in compiled


def test_active_activities_fetches_responses_once_for_all_activities(monkeypatch):
    """/active 端点在 N 个活动中只取一次作答。"""
    activities = [
        SimpleNamespace(id=1, title="活动1", class_name="高一(1)班", status="active",
                        activity_type="vote", description=None, time_limit=60,
                        started_at=None, options=[], correct_answer=None,
                        allow_multiple=False, created_by=10),
        SimpleNamespace(id=2, title="活动2", class_name="高一(1)班", status="active",
                        activity_type="vote", description=None, time_limit=60,
                        started_at=None, options=[], correct_answer=None,
                        allow_multiple=False, created_by=10),
        SimpleNamespace(id=3, title="活动3", class_name="高一(1)班", status="active",
                        activity_type="vote", description=None, time_limit=60,
                        started_at=None, options=[], correct_answer=None,
                        allow_multiple=False, created_by=10),
    ]
    db = _RecordingDB([[ _response(2) ]])
    calls = {"get_active_activities": 0, "get_user_response": 0, "get_user_responses": 0}

    async def fake_get_active_activities(_db, class_name=None):
        calls["get_active_activities"] += 1
        return activities

    async def failing_single_fetch(*_args, **_kwargs):
        calls["get_user_response"] += 1
        raise AssertionError("不应再对每个活动单独查询作答")

    async def fake_get_user_responses(_db, activity_ids, user_id):
        calls["get_user_responses"] += 1
        assert activity_ids == [1, 2, 3]
        return {2: _response(2)}

    monkeypatch.setattr(student_api.svc, "get_active_activities", fake_get_active_activities)
    monkeypatch.setattr(student_api.svc, "get_user_response", failing_single_fetch)
    monkeypatch.setattr(student_api.svc, "get_user_responses", fake_get_user_responses)

    views = asyncio.run(student_api.get_active_activities(
        db=db,
        current_user={"id": 100, "role_code": "student", "class_name": "高一(1)班"},
    ))

    assert len(views) == 3
    assert calls == {"get_active_activities": 1, "get_user_response": 0, "get_user_responses": 1}
    # 第二条活动带回了本人作答，其余没有
    assert views[1]["my_answer"] == "A"
    assert views[0]["my_answer"] is None
