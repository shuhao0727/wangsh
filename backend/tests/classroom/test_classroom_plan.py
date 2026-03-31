"""课堂计划 Service 层单元测试"""

import asyncio
from types import SimpleNamespace

import pytest

import app.services.classroom_plan as plan_svc


# ── Fake 基础设施 ──

class _FakeResult:
    def __init__(self, value=None, values=None):
        self._value = value
        self._values = values or []

    def scalar_one_or_none(self):
        return self._value

    def scalar(self):
        return self._value

    def scalars(self):
        return self

    def all(self):
        return self._values


class _FakeDB:
    def __init__(self, execute_results=None):
        self._execute_results = list(execute_results or [])
        self.execute_count = 0
        self.commit_count = 0
        self.added = []
        self.deleted = []
        self.flushed = 0

    async def execute(self, _stmt):
        if self.execute_count >= len(self._execute_results):
            return _FakeResult()
        result = self._execute_results[self.execute_count]
        self.execute_count += 1
        return result

    def add(self, obj):
        self.added.append(obj)

    async def delete(self, obj):
        self.deleted.append(obj)

    async def commit(self):
        self.commit_count += 1

    async def flush(self):
        self.flushed += 1

    async def refresh(self, _obj):
        pass


def _make_plan(status="draft", items=None, plan_id=1):
    plan = SimpleNamespace(
        id=plan_id,
        title="测试计划",
        status=status,
        current_item_id=None,
        items=items or [],
    )
    return plan


def _make_item(item_id, order_index, status="pending", activity_status="draft"):
    activity = SimpleNamespace(
        id=item_id * 10,
        status=activity_status,
        analysis_agent_id=None,
        analysis_prompt=None,
    )
    return SimpleNamespace(
        id=item_id,
        plan_id=1,
        activity_id=item_id * 10,
        order_index=order_index,
        status=status,
        activity=activity,
    )


# ── 测试：启动计划 ──

def test_start_plan_requires_draft(monkeypatch):
    """只有草稿状态的计划可以启动"""
    plan = _make_plan(status="active")

    async def fake_get(_db, _pid):
        return plan

    monkeypatch.setattr(plan_svc, "_get_plan", fake_get)
    db = _FakeDB()

    with pytest.raises(ValueError, match="只有草稿状态的计划可以启动"):
        asyncio.run(plan_svc.start_plan(db, plan_id=1))


def test_start_plan_sets_active(monkeypatch):
    """启动计划后状态变为 active"""
    plan = _make_plan(status="draft")

    async def fake_get(_db, _pid):
        return plan

    monkeypatch.setattr(plan_svc, "_get_plan", fake_get)
    db = _FakeDB()

    result = asyncio.run(plan_svc.start_plan(db, plan_id=1))
    assert result.status == "active"
    assert db.commit_count == 1


# ── 测试：编辑计划 ──

def test_update_plan_rejects_active(monkeypatch):
    """进行中的计划不可编辑"""
    plan = _make_plan(status="active")

    async def fake_get(_db, _pid):
        return plan

    monkeypatch.setattr(plan_svc, "_get_plan", fake_get)
    db = _FakeDB()

    with pytest.raises(ValueError, match="进行中的计划不可编辑"):
        asyncio.run(plan_svc.update_plan(db, plan_id=1, title="新标题", activity_ids=None))


# ── 测试：删除计划 ──

def test_delete_plan_rejects_active(monkeypatch):
    """进行中的计划不可删除"""
    plan = _make_plan(status="active")

    async def fake_get(_db, _pid):
        return plan

    monkeypatch.setattr(plan_svc, "_get_plan", fake_get)
    db = _FakeDB()

    with pytest.raises(ValueError, match="进行中的计划不可删除"):
        asyncio.run(plan_svc.delete_plan(db, plan_id=1))


def test_delete_plan_ok_for_draft(monkeypatch):
    """草稿状态的计划可以删除"""
    plan = _make_plan(status="draft")

    async def fake_get(_db, _pid):
        return plan

    monkeypatch.setattr(plan_svc, "_get_plan", fake_get)
    db = _FakeDB()

    asyncio.run(plan_svc.delete_plan(db, plan_id=1))
    assert db.commit_count == 1


# ── 测试：重置计划 ──

def test_reset_plan_requires_ended(monkeypatch):
    """只能重置已结束的计划"""
    plan = _make_plan(status="active")

    async def fake_get(_db, _pid):
        return plan

    monkeypatch.setattr(plan_svc, "_get_plan", fake_get)
    db = _FakeDB()

    with pytest.raises(ValueError, match="只能重置已结束的计划"):
        asyncio.run(plan_svc.reset_plan(db, plan_id=1))


def test_reset_plan_resets_items(monkeypatch):
    """重置计划后所有 items 回到 pending"""
    items = [
        _make_item(1, 0, status="ended"),
        _make_item(2, 1, status="ended"),
    ]
    plan = _make_plan(status="ended", items=items)

    async def fake_get(_db, _pid):
        return plan

    monkeypatch.setattr(plan_svc, "_get_plan", fake_get)
    db = _FakeDB()

    result = asyncio.run(plan_svc.reset_plan(db, plan_id=1))
    assert result.status == "draft"
    assert result.current_item_id is None
    assert all(it.status == "pending" for it in result.items)
    assert db.commit_count == 1


# ── 测试：下一题 ──

def test_next_item_requires_active_plan(monkeypatch):
    """计划未在进行中时不能推进"""
    plan = _make_plan(status="draft")

    async def fake_get(_db, _pid):
        return plan

    monkeypatch.setattr(plan_svc, "_get_plan", fake_get)
    db = _FakeDB()

    with pytest.raises(ValueError, match="计划未在进行中"):
        asyncio.run(plan_svc.next_item(db, plan_id=1))


def test_next_item_empty_plan(monkeypatch):
    """空计划推进时报错"""
    plan = _make_plan(status="active", items=[])

    async def fake_get(_db, _pid):
        return plan

    monkeypatch.setattr(plan_svc, "_get_plan", fake_get)
    db = _FakeDB()

    with pytest.raises(ValueError, match="计划中没有题目"):
        asyncio.run(plan_svc.next_item(db, plan_id=1))


# ── 测试：结束计划 ──

def test_end_plan_rejects_already_ended(monkeypatch):
    """已结束的计划不能再次结束"""
    plan = _make_plan(status="ended")

    async def fake_get(_db, _pid):
        return plan

    monkeypatch.setattr(plan_svc, "_get_plan", fake_get)
    db = _FakeDB()

    with pytest.raises(ValueError, match="计划已结束"):
        asyncio.run(plan_svc.end_plan(db, plan_id=1))


def test_end_plan_ends_active_items(monkeypatch):
    """结束计划时，进行中的 items 也被结束"""
    items = [
        _make_item(1, 0, status="ended"),
        _make_item(2, 1, status="active"),
        _make_item(3, 2, status="pending"),
    ]
    plan = _make_plan(status="active", items=items)

    async def fake_get(_db, _pid):
        return plan

    # mock activity_svc.end_activity
    import app.services.classroom as activity_svc

    async def fake_end_activity(_db, _aid, **kwargs):
        pass

    monkeypatch.setattr(activity_svc, "end_activity", fake_end_activity)
    monkeypatch.setattr(plan_svc, "_get_plan", fake_get)
    db = _FakeDB()

    result = asyncio.run(plan_svc.end_plan(db, plan_id=1))
    assert result.status == "ended"
    assert result.current_item_id is None
    # item 2 应该从 active 变为 ended
    assert items[1].status == "ended"
    assert db.commit_count == 1


# ── 测试：获取活动计划（学生端）──

def test_get_active_plan_returns_none_when_no_active(monkeypatch):
    """没有进行中的计划时返回 None"""
    db = _FakeDB(execute_results=[_FakeResult(value=None)])

    result = asyncio.run(plan_svc.get_active_plan(db))
    assert result is None
