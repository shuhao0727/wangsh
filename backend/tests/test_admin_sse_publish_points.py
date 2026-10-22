"""管理端 SSE 发布点合同测试。

分类、信息学笔记和课堂活动三个页面的前端通过 useAdminSSE 监听
category_changed / informatics_changed / classroom_interaction_changed。
本测试固定这些写操作确实向 admin_global 频道发布事件，避免再次出现
“前端监听但后端从不发布”的静默失效。
"""

import asyncio
from types import SimpleNamespace

import pytest

from app.api.endpoints.classroom import admin as classroom_admin
from app.api.endpoints.content.categories import categories as categories_api
from app.api.endpoints.informatics import typst_notes as typst_notes_api


class _PublishRecorder:
    def __init__(self):
        self.events = []

    async def __call__(self, channel, payload):
        self.events.append((channel, payload))


@pytest.fixture
def recorder(monkeypatch):
    rec = _PublishRecorder()
    monkeypatch.setattr(categories_api, "publish", rec)
    monkeypatch.setattr(typst_notes_api, "publish", rec)
    monkeypatch.setattr(classroom_admin.svc, "publish", rec)
    return rec


def test_category_writes_publish_admin_events(recorder, monkeypatch):
    async def fake_create(db, category_data):
        return SimpleNamespace(id=11)

    async def fake_update(db, category_id, category_data):
        return SimpleNamespace(id=category_id)

    async def fake_delete(db, category_id):
        return True

    monkeypatch.setattr(categories_api.CategoryService, "create_category", fake_create)
    monkeypatch.setattr(categories_api.CategoryService, "update_category", fake_update)
    monkeypatch.setattr(categories_api.CategoryService, "delete_category", fake_delete)

    asyncio.run(categories_api.create_category(SimpleNamespace(), db=object(), _={}))
    asyncio.run(categories_api.update_category(11, SimpleNamespace(), db=object(), _={}))
    asyncio.run(categories_api.delete_category(11, db=object(), _={}))

    assert [(ch, p["type"], p["action"], p["id"]) for ch, p in recorder.events] == [
        ("admin_global", "category_changed", "create", 11),
        ("admin_global", "category_changed", "update", 11),
        ("admin_global", "category_changed", "delete", 11),
    ]


def test_typst_note_writes_publish_admin_events(recorder, monkeypatch):
    note = SimpleNamespace(id=7)

    async def fake_create_note(**kwargs):
        return note

    async def fake_update_note(**kwargs):
        return note

    async def fake_get_note(**kwargs):
        return note

    async def fake_delete_note(**kwargs):
        return None

    monkeypatch.setattr(typst_notes_api, "create_note", fake_create_note)
    monkeypatch.setattr(typst_notes_api, "update_note", fake_update_note)
    monkeypatch.setattr(typst_notes_api, "get_note", fake_get_note)
    monkeypatch.setattr(typst_notes_api, "delete_note", fake_delete_note)
    monkeypatch.setattr(typst_notes_api, "_to_response", lambda n: {"id": n.id})

    payload = SimpleNamespace(
        title="t", content_typst="", summary=None, category_path=None,
        published=False, style_key=None, entry_path=None, files=None, toc=None,
    )

    asyncio.run(typst_notes_api.api_create_note(payload, db=object(), user={"id": 1}))
    asyncio.run(typst_notes_api.api_update_note(7, payload, db=object(), _={}))
    asyncio.run(typst_notes_api.api_delete_note(7, db=object(), _={}))

    assert [(ch, p["type"], p["action"], p["id"]) for ch, p in recorder.events] == [
        ("admin_global", "informatics_changed", "create", 7),
        ("admin_global", "informatics_changed", "update", 7),
        ("admin_global", "informatics_changed", "delete", 7),
    ]


def test_classroom_activity_writes_publish_admin_events(recorder, monkeypatch):
    activity = SimpleNamespace(id=5, created_by=1)

    async def fake_create(db, data, user_id):
        return activity

    async def fake_update(db, activity_id, data):
        return activity

    async def fake_duplicate(db, activity_id, user_id):
        return activity

    async def fake_start(db, activity_id):
        return activity

    async def fake_end(db, activity_id, **kwargs):
        return activity

    async def fake_restart(db, activity_id):
        return activity

    async def fake_delete(db, activity_id):
        return None

    async def fake_assert(db, activity_id, user):
        return None

    for name, fn in (
        ("create_activity", fake_create),
        ("update_activity", fake_update),
        ("duplicate_activity", fake_duplicate),
        ("start_activity", fake_start),
        ("end_activity", fake_end),
        ("restart_activity", fake_restart),
        ("delete_activity", fake_delete),
    ):
        monkeypatch.setattr(classroom_admin.svc, name, fn)

    monkeypatch.setattr(classroom_admin, "_assert_can_manage_activity", fake_assert)
    monkeypatch.setattr(classroom_admin, "_to_response", lambda a, **kw: {"id": a.id})

    user = {"id": 1, "role_code": "teacher"}
    asyncio.run(classroom_admin.create_activity(SimpleNamespace(dict=lambda: {}), db=object(), current_user=user))
    asyncio.run(classroom_admin.update_activity(5, SimpleNamespace(dict=lambda **kw: {}), db=object(), current_user=user))
    asyncio.run(classroom_admin.duplicate_activity(5, db=object(), current_user=user))
    asyncio.run(classroom_admin.start_activity(5, db=object(), current_user=user))
    asyncio.run(classroom_admin.end_activity(5, None, db=object(), current_user=user))
    asyncio.run(classroom_admin.restart_activity(5, db=object(), current_user=user))
    asyncio.run(classroom_admin.delete_activity(5, db=object(), current_user=user))

    actions = [(p["type"], p["action"], p["activity_id"]) for _, p in recorder.events]
    assert actions == [
        ("classroom_interaction_changed", "create", 5),
        ("classroom_interaction_changed", "update", 5),
        ("classroom_interaction_changed", "duplicate", 5),
        ("classroom_interaction_changed", "start", 5),
        ("classroom_interaction_changed", "end", 5),
        ("classroom_interaction_changed", "restart", 5),
        ("classroom_interaction_changed", "delete", 5),
    ]
