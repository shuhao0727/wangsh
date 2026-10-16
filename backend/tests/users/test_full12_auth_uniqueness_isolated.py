"""Real SQLite multi-row uniqueness regression; no production connections.

Run with the reviewed external no-dotenv/no-network bootstrap. This proves
the ORM result handling and atomic rejection, not PostgreSQL concurrency.
"""
import os

import pytest

if os.environ.get("FULL12_AUTH_ISOLATED") != "1":
    pytest.skip("requires full12 isolated bootstrap", allow_module_level=True)

import asyncio
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.endpoints.management.users import users
from app.models import User


@pytest.mark.parametrize("operation", ["create", "update"])
def test_distinct_username_and_student_id_conflicts_are_bad_requests(monkeypatch, operation):
    async def lock(_db, *, actor_id, target_ids):
        return {"id": actor_id, "role_code": "super_admin"}, {}

    monkeypatch.setattr(users, "lock_account_governance", lock)

    async def run():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with engine.begin() as conn:
                await conn.run_sync(User.__table__.create)
            async with factory() as db:
                first = User(username="full12_auth_a", student_id="full12_auth_sid_a", full_name="A", role_code="student")
                second = User(username="full12_auth_b", student_id="full12_auth_sid_b", full_name="B", role_code="student")
                target = User(username="full12_auth_c", student_id="full12_auth_sid_c", full_name="C", role_code="student")
                db.add_all([first, second, target])
                await db.commit()
                if operation == "create":
                    async def invoke():
                        return await users.create_user(users.UserCreate(username=first.username, student_id=second.student_id, full_name="Rejected"), {"id": 1, "role_code": "super_admin"}, db)
                else:
                    async def invoke():
                        return await users._assert_update_unique_fields(db, target, target.id, users.UserUpdate(username=first.username, student_id=second.student_id))
                with pytest.raises(HTTPException) as exc:
                    await invoke()
                assert exc.value.status_code == 400
                assert exc.value.detail in {"用户名已存在", "学号已存在"}
                await db.rollback()
            async with factory() as db:
                rows = (await db.execute(select(User).order_by(User.id))).scalars().all()
                assert [(r.username, r.student_id) for r in rows] == [
                    ("full12_auth_a", "full12_auth_sid_a"),
                    ("full12_auth_b", "full12_auth_sid_b"),
                    ("full12_auth_c", "full12_auth_sid_c"),
                ]
        finally:
            await engine.dispose()

    asyncio.run(run())
