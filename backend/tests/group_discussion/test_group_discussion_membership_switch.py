import asyncio
from datetime import date
from types import SimpleNamespace

import app.services.agents.group_discussion as gd


class _FakeResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeDB:
    def __init__(self, execute_values):
        self._execute_values = list(execute_values)
        self.execute_count = 0
        self.delete_count = 0
        self.flush_count = 0
        self.commit_count = 0
        self.added = []

    async def execute(self, _stmt):
        if self.execute_count >= len(self._execute_values):
            raise AssertionError("unexpected db.execute call")
        value = self._execute_values[self.execute_count]
        self.execute_count += 1
        return _FakeResult(value)

    async def delete(self, _obj):
        self.delete_count += 1

    async def flush(self):
        self.flush_count += 1

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.commit_count += 1

    async def refresh(self, _obj):
        return None


def test_admin_joining_second_group_does_not_write_membership():
    today = date.today()
    target_session = SimpleNamespace(
        id=22,
        session_date=today,
        class_name="高一(1)班",
        group_no="2",
        group_name="第二组",
        created_by_user_id=2,
    )
    db = _FakeDB([target_session])

    got = asyncio.run(
        gd.get_or_create_today_session(
            db,
            class_name="高一(1)班",
            group_no="2",
            group_name="第二组",
            user={"id": 1, "role_code": "admin", "class_name": "高一(1)班"},
        )
    )

    assert got.id == 22
    assert db.execute_count == 1
    assert db.delete_count == 0
    assert db.flush_count == 0
    assert db.commit_count == 0
    assert len(db.added) == 0
