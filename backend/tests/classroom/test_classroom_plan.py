"""课堂计划 Service 层单元测试"""

import asyncio
import importlib
import importlib.util
from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.db.database import Base
from app.models import User
from app.models.classroom import ClassroomActivity, ClassroomPlan, ClassroomPlanItem
import app.services.classroom_plan as plan_svc


# ── Fake 基础设施 ──


def test_classroom_plan_rules_are_extracted_to_a_dedicated_module():
    module_name = "app.services.classroom_plan_rules"
    assert importlib.util.find_spec(module_name) is not None

    rules = importlib.import_module(module_name)
    assert plan_svc._validate_activity_class_scope is rules.validate_activity_class_scope
    assert plan_svc._validate_plan_class_scope is rules.validate_plan_class_scope
    assert plan_svc._assert_plan_manageable is rules.assert_plan_manageable


def test_locked_plan_keeps_items_and_activities_eagerly_loaded():
    """刷新行锁对象后，异步调用链不能退回到隐式 relationship IO。"""

    async def run():
        engine = create_async_engine(settings.DATABASE_URL)
        Session = async_sessionmaker(engine, expire_on_commit=False)
        async with Session() as db:
            schema = f"test_classroom_plan_{uuid4().hex}"
            await db.execute(text(f'CREATE SCHEMA "{schema}"'))
            await db.execute(text(f'SET LOCAL search_path TO "{schema}", public'))
            connection = await db.connection()
            await connection.run_sync(
                lambda sync_connection: Base.metadata.create_all(
                    sync_connection,
                    tables=[
                        User.__table__,
                        ClassroomActivity.__table__,
                        ClassroomPlan.__table__,
                        ClassroomPlanItem.__table__,
                    ],
                    checkfirst=False,
                )
            )
            owner = User(
                full_name="Locked Plan Owner",
                role_code="teacher",
                is_active=True,
                is_deleted=False,
            )
            db.add(owner)
            await db.flush()
            activity = ClassroomActivity(
                activity_type="vote",
                title="locked-plan-regression",
                class_name="integration-test",
                options=[{"key": "A", "text": "A"}],
                correct_answer="A",
                created_by=owner.id,
            )
            plan = ClassroomPlan(
                title="locked-plan-regression",
                status="draft",
                created_by=owner.id,
            )
            db.add_all([activity, plan])
            await db.flush()
            item = ClassroomPlanItem(
                plan_id=plan.id,
                activity_id=activity.id,
                order_index=0,
                status="pending",
            )
            db.add(item)
            await db.flush()
            plan_id = plan.id
            activity_id = activity.id
            db.sync_session.expunge_all()

            try:
                locked = await plan_svc._get_locked_plan(db, plan_id)
                assert [entry.activity_id for entry in locked.items] == [activity_id]
                assert locked.items[0].activity.id == activity_id
            finally:
                await db.rollback()
        await engine.dispose()

    asyncio.run(run())


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
        self.rollback_count = 0

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

    async def rollback(self):
        self.rollback_count += 1


def test_activity_loader_uses_compatibility_validation_entrypoint(monkeypatch):
    activity = SimpleNamespace(id=10, class_name="高一(1)班", created_by=7)
    db = _FakeDB(execute_results=[_FakeResult(values=[activity])])
    calls = []

    def fake_validate(activities):
        calls.append(list(activities))
        return "高一(1)班"

    monkeypatch.setattr(plan_svc, "_validate_activity_class_scope", fake_validate)

    result = asyncio.run(
        plan_svc._load_and_validate_activities(
            db,
            [activity.id],
            owner_id=7,
            is_global_manager=False,
        )
    )

    assert result == [activity]
    assert calls == [[activity]]


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
        asyncio.run(
            plan_svc.start_plan(
                db, plan_id=1, owner_id=None, is_global_manager=True
            )
        )


def test_start_plan_sets_active(monkeypatch):
    """启动计划后状态变为 active"""
    item = _make_item(1, 0)
    item.activity.class_name = "高一(1)班"
    plan = _make_plan(status="draft", items=[item])

    async def fake_get(_db, _pid):
        return plan

    monkeypatch.setattr(plan_svc, "_get_plan", fake_get)
    db = _FakeDB()

    result = asyncio.run(
        plan_svc.start_plan(db, plan_id=1, owner_id=None, is_global_manager=True)
    )
    assert result.status == "active"
    assert db.commit_count == 1


def test_start_plan_rejects_empty_plan(monkeypatch):
    """空计划不能进入 active 状态。"""
    plan = _make_plan(status="draft")

    async def fake_get(_db, _pid):
        return plan

    monkeypatch.setattr(plan_svc, "_get_plan", fake_get)
    db = _FakeDB()

    with pytest.raises(ValueError, match="计划中没有题目"):
        asyncio.run(
            plan_svc.start_plan(
                db, plan_id=1, owner_id=None, is_global_manager=True
            )
        )


@pytest.mark.parametrize("operation", ["start_plan", "next_item", "start_item"])
def test_plan_operations_reject_mixed_classes_in_service(monkeypatch, operation):
    """计划推进不能只依赖 API 层检查，service 也必须重新校验班级范围。"""
    items = [
        _make_item(1, 0, status="pending"),
        _make_item(2, 1, status="pending"),
    ]
    items[0].activity.class_name = "高一(1)班"
    items[1].activity.class_name = "高一(2)班"
    plan = _make_plan(status="draft" if operation == "start_plan" else "active", items=items)

    async def fake_get(_db, _pid):
        return plan

    monkeypatch.setattr(plan_svc, "_get_plan", fake_get)
    db = _FakeDB()

    kwargs = {"plan_id": 1, "owner_id": None, "is_global_manager": True}
    if operation == "start_item":
        kwargs["item_id"] = items[0].id
    with pytest.raises(ValueError, match="同一班级"):
        asyncio.run(getattr(plan_svc, operation)(db, **kwargs))


# ── 测试：编辑计划 ──

def test_update_plan_rejects_active(monkeypatch):
    """进行中的计划不可编辑"""
    plan = _make_plan(status="active")

    async def fake_get(_db, _pid):
        return plan

    monkeypatch.setattr(plan_svc, "_get_plan", fake_get)
    db = _FakeDB()

    with pytest.raises(ValueError, match="进行中的计划不可编辑"):
        asyncio.run(
            plan_svc.update_plan(
                db,
                plan_id=1,
                title="新标题",
                activity_ids=None,
                owner_id=None,
                is_global_manager=True,
            )
        )


# ── 测试：删除计划 ──

def test_delete_plan_rejects_active(monkeypatch):
    """进行中的计划不可删除"""
    plan = _make_plan(status="active")

    async def fake_get(_db, _pid):
        return plan

    monkeypatch.setattr(plan_svc, "_get_plan", fake_get)
    db = _FakeDB()

    with pytest.raises(ValueError, match="进行中的计划不可删除"):
        asyncio.run(
            plan_svc.delete_plan(
                db, plan_id=1, owner_id=None, is_global_manager=True
            )
        )


def test_delete_plan_ok_for_draft(monkeypatch):
    """草稿状态的计划可以删除"""
    plan = _make_plan(status="draft")

    async def fake_get(_db, _pid):
        return plan

    monkeypatch.setattr(plan_svc, "_get_plan", fake_get)
    db = _FakeDB()

    asyncio.run(
        plan_svc.delete_plan(
            db, plan_id=1, owner_id=None, is_global_manager=True
        )
    )
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
        asyncio.run(
            plan_svc.reset_plan(
                db, plan_id=1, owner_id=None, is_global_manager=True
            )
        )


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

    result = asyncio.run(
        plan_svc.reset_plan(
            db, plan_id=1, owner_id=None, is_global_manager=True
        )
    )
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
        asyncio.run(
            plan_svc.next_item(
                db, plan_id=1, owner_id=None, is_global_manager=True
            )
        )


def test_next_item_empty_plan(monkeypatch):
    """空计划推进时报错"""
    plan = _make_plan(status="active", items=[])

    async def fake_get(_db, _pid):
        return plan

    monkeypatch.setattr(plan_svc, "_get_plan", fake_get)
    db = _FakeDB()

    with pytest.raises(ValueError, match="计划中没有题目"):
        asyncio.run(
            plan_svc.next_item(
                db, plan_id=1, owner_id=None, is_global_manager=True
            )
        )


# ── 测试：结束计划 ──

def test_end_plan_rejects_already_ended(monkeypatch):
    """已结束的计划不能再次结束"""
    plan = _make_plan(status="ended")

    async def fake_get(_db, _pid):
        return plan

    monkeypatch.setattr(plan_svc, "_get_plan", fake_get)
    db = _FakeDB()

    with pytest.raises(ValueError, match="计划已结束"):
        asyncio.run(
            plan_svc.end_plan(
                db, plan_id=1, owner_id=None, is_global_manager=True
            )
        )


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

    result = asyncio.run(
        plan_svc.end_plan(
            db, plan_id=1, owner_id=None, is_global_manager=True
        )
    )
    assert result.status == "ended"
    assert result.current_item_id is None
    # item 2 应该从 active 变为 ended
    assert items[1].status == "ended"
    assert db.commit_count == 1


def test_next_item_does_not_advance_when_activity_start_fails(monkeypatch):
    item = _make_item(1, 0, status="pending")
    item.activity.class_name = "高一(1)班"
    plan = _make_plan(status="active", items=[item])

    async def fake_get(_db, _pid):
        return plan

    async def fail_start(_db, _activity_id, **_kwargs):
        raise RuntimeError("activity start failed")

    monkeypatch.setattr(plan_svc, "_get_plan", fake_get)
    monkeypatch.setattr(plan_svc.activity_svc, "start_activity", fail_start)
    db = _FakeDB()

    with pytest.raises(RuntimeError, match="activity start failed"):
        asyncio.run(
            plan_svc.next_item(
                db, plan_id=1, owner_id=None, is_global_manager=True
            )
        )

    assert item.status == "pending"
    assert plan.current_item_id is None
    assert db.commit_count == 0
    assert db.rollback_count == 1


def test_next_item_does_not_dispatch_ended_event_when_next_start_fails(monkeypatch):
    current = _make_item(1, 0, status="active", activity_status="active")
    pending = _make_item(2, 1, status="pending", activity_status="draft")
    current.activity.class_name = "高一(1)班"
    pending.activity.class_name = "高一(1)班"
    plan = _make_plan(status="active", items=[current, pending])
    dispatched = []

    async def fake_get(_db, _pid):
        return plan

    async def fake_end(_db, _activity_id, **kwargs):
        kwargs["deferred_events"].append(
            {
                "type": "activity_ended",
                "activity_id": current.activity_id,
                "created_by": 10,
                "class_name": "高一(1)班",
            }
        )

    async def fail_start(_db, _activity_id, **_kwargs):
        raise RuntimeError("activity start failed")

    async def record_dispatch(_db, events):
        dispatched.extend(events)

    monkeypatch.setattr(plan_svc, "_get_plan", fake_get)
    monkeypatch.setattr(plan_svc.activity_svc, "end_activity", fake_end)
    monkeypatch.setattr(plan_svc.activity_svc, "start_activity", fail_start)
    monkeypatch.setattr(plan_svc.activity_svc, "dispatch_activity_events", record_dispatch)
    db = _FakeDB()

    with pytest.raises(RuntimeError, match="activity start failed"):
        asyncio.run(
            plan_svc.next_item(
                db, plan_id=1, owner_id=None, is_global_manager=True
            )
        )

    assert db.commit_count == 0
    assert db.rollback_count == 1
    assert dispatched == []


def test_end_plan_does_not_finish_when_activity_end_fails(monkeypatch):
    item = _make_item(1, 0, status="active", activity_status="active")
    item.activity.class_name = "高一(1)班"
    plan = _make_plan(status="active", items=[item])

    async def fake_get(_db, _pid):
        return plan

    async def fail_end(_db, _activity_id, **_kwargs):
        raise RuntimeError("activity end failed")

    monkeypatch.setattr(plan_svc, "_get_plan", fake_get)
    monkeypatch.setattr(plan_svc.activity_svc, "end_activity", fail_end)
    db = _FakeDB()

    with pytest.raises(RuntimeError, match="activity end failed"):
        asyncio.run(
            plan_svc.end_plan(
                db, plan_id=1, owner_id=None, is_global_manager=True
            )
        )

    assert item.status == "active"
    assert plan.status == "active"
    assert db.commit_count == 0
    assert db.rollback_count == 1


# ── 测试：获取活动计划（学生端）──

def test_get_active_plan_returns_none_when_no_active(monkeypatch):
    """没有进行中的计划时返回 None"""
    db = _FakeDB(execute_results=[_FakeResult(value=None)])

    result = asyncio.run(plan_svc.get_active_plan(db))
    assert result is None


def test_create_plan_service_rechecks_activity_class_scope():
    """绕过 API 直接调用 service 时，创建计划也不能接受混班活动。"""
    plan = _make_plan(status="draft")
    activities = [
        SimpleNamespace(id=10, class_name="高一(1)班", created_by=10),
        SimpleNamespace(id=20, class_name="高一(2)班", created_by=10),
    ]

    class _ResultWithPlanAndActivities(_FakeResult):
        def scalar_one_or_none(self):
            return plan

    db = _FakeDB(
        execute_results=[
            _ResultWithPlanAndActivities(values=activities),
            _ResultWithPlanAndActivities(values=activities),
        ]
    )

    with pytest.raises(ValueError, match="同一班级"):
        asyncio.run(plan_svc.create_plan(db, "测试计划", [10, 20], user_id=10))
