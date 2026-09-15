"""Opt-in PostgreSQL concurrency proof for AC-03 account governance.

This module refuses non-loopback or non-test database URLs.  It creates one
unique schema and drops it in ``finally``; it must never target a normal WangSh
schema or database.
"""
from __future__ import annotations

import asyncio
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager
from urllib.parse import urlsplit

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

if os.environ.get("R6_ACCOUNT_GOVERNANCE_PG") != "1":
    pytest.skip("requires dedicated PostgreSQL bootstrap", allow_module_level=True)

DATABASE_URL = os.environ.get("R6_ACCOUNT_GOVERNANCE_PG_URL", "")
parsed_url = urlsplit(DATABASE_URL.replace("postgresql+asyncpg", "postgresql", 1))
database_name = parsed_url.path.removeprefix("/").lower()
if (
    parsed_url.scheme != "postgresql"
    or parsed_url.hostname not in {"127.0.0.1", "localhost", "::1"}
    or not any(marker in database_name for marker in ("test", "testing", "ci"))
):
    raise RuntimeError("AC-03 PG tests require a loopback, explicitly test-named database")

from app.api.endpoints.management.users import users
from app.api.endpoints.management.users.schemas import UserCreate, UserUpdate
from app.core.session_family import durable_access_is_active
from app.db.database import Base
from app.models import AuthAuthority, AuthSessionState, RefreshToken, User

_SCHEMA_PATTERN = re.compile(r"^ac03_[0-9a-f]+$")


@asynccontextmanager
async def isolated_pg():
    schema = f"ac03_{uuid.uuid4().hex}"
    assert _SCHEMA_PATTERN.fullmatch(schema)
    admin_engine = create_async_engine(DATABASE_URL)
    engine = None
    try:
        async with admin_engine.begin() as conn:
            await conn.execute(text(f'CREATE SCHEMA "{schema}"'))
        engine = create_async_engine(
            DATABASE_URL,
            connect_args={"server_settings": {"search_path": schema}},
        )
        async with engine.begin() as conn:
            await conn.run_sync(
                lambda sync_conn: Base.metadata.create_all(
                    sync_conn,
                    tables=[
                        User.__table__,
                        RefreshToken.__table__,
                        AuthSessionState.__table__,
                        AuthAuthority.__table__,
                    ],
                )
            )
        factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
        async with factory() as db:
            db.add(AuthAuthority(id=1, ready=True))
            db.add_all(
                [
                    User(
                        id=1,
                        username="root-a",
                        full_name="Root A",
                        role_code="super_admin",
                        is_active=True,
                        is_deleted=False,
                    ),
                    User(
                        id=2,
                        username="root-b",
                        full_name="Root B",
                        role_code="super_admin",
                        is_active=True,
                        is_deleted=False,
                    ),
                    User(
                        id=3,
                        username="student-a",
                        student_id="S-3",
                        full_name="Student A",
                        role_code="student",
                        is_active=True,
                        is_deleted=False,
                    ),
                ]
            )
            await db.commit()
            await db.execute(
                text(
                    "SELECT setval(pg_get_serial_sequence('sys_users', 'id'), "
                    "(SELECT max(id) FROM sys_users), true)"
                )
            )
            await db.commit()
        yield factory
    finally:
        if engine is not None:
            await engine.dispose()
        async with admin_engine.begin() as conn:
            await conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        await admin_engine.dispose()


@pytest.fixture(autouse=True)
def no_publication(monkeypatch):
    async def publish(*_args, **_kwargs):
        return None

    monkeypatch.setattr(users, "publish", publish)


async def _active_super_admin_ids(factory) -> list[int]:
    async with factory() as db:
        return list(
            (
                await db.execute(
                    select(User.id)
                    .where(
                        User.role_code == "super_admin",
                        User.is_active.is_(True),
                        User.is_deleted.is_(False),
                    )
                    .order_by(User.id)
                )
            ).scalars().all()
        )


async def _run_update(factory, actor_id: int, target_id: int, update: UserUpdate):
    async with factory() as db:
        try:
            await users.update_user(
                target_id,
                update,
                {"id": actor_id, "role_code": "super_admin"},
                db,
            )
            return "success", None
        except HTTPException as exc:
            await db.rollback()
            return "http_error", exc


async def _run_create(factory, actor_id: int, payload: UserCreate):
    async with factory() as db:
        try:
            created = await users.create_user(
                payload,
                {"id": actor_id, "role_code": "super_admin"},
                db,
            )
            return "success", created
        except HTTPException as exc:
            await db.rollback()
            return "http_error", exc


def test_disable_restore_keeps_old_pg_credentials_revoked():
    async def run():
        async with isolated_pg() as factory:
            old_nonce = "pg-old-generation"
            async with factory() as db:
                db.add(
                    AuthSessionState(
                        user_id=3,
                        nonce=old_nonce,
                        ip="192.0.2.30",
                        active=True,
                        ip_expires_at=datetime.now(timezone.utc)
                        + timedelta(hours=1),
                    )
                )
                db.add(
                    RefreshToken(
                        user_id=3,
                        token="pg-old-refresh",
                        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
                        is_revoked=False,
                    )
                )
                await db.commit()
            async with factory() as db:
                await users.update_user(
                    3,
                    UserUpdate(is_active=False),
                    {"id": 1, "role_code": "super_admin"},
                    db,
                )
            async with factory() as db:
                await users.update_user(
                    3,
                    UserUpdate(is_active=True),
                    {"id": 1, "role_code": "super_admin"},
                    db,
                )
            async with factory() as db:
                student = await db.get(User, 3)
                session = await db.get(AuthSessionState, 3)
                refresh_revoked = await db.scalar(
                    select(RefreshToken.is_revoked).where(RefreshToken.user_id == 3)
                )
                assert student.is_active is True
                assert session is not None and session.active is False
                assert session.nonce == old_nonce
                assert refresh_revoked is True
                assert await durable_access_is_active(
                    db, 3, {"sn": old_nonce}
                ) is False

    asyncio.run(run())


def test_concurrent_self_deactivation_preserves_one_active_super_admin():
    async def run():
        async with isolated_pg() as factory:
            start = asyncio.Event()

            async def deactivate(user_id: int):
                await start.wait()
                return await _run_update(
                    factory, user_id, user_id, UserUpdate(is_active=False)
                )

            tasks = [asyncio.create_task(deactivate(1)), asyncio.create_task(deactivate(2))]
            start.set()
            results = await asyncio.gather(*tasks)
            assert [result[0] for result in results].count("success") == 1, results
            errors = [result[1] for result in results if result[1] is not None]
            assert len(errors) == 1
            assert errors[0].status_code == 409
            assert errors[0].detail["code"] == "LAST_ACTIVE_SUPER_ADMIN"
            assert len(await _active_super_admin_ids(factory)) == 1

    asyncio.run(run())


def test_concurrent_mutual_demotion_revalidates_waiting_actor():
    async def run():
        async with isolated_pg() as factory:
            start = asyncio.Event()

            async def demote(actor_id: int, target_id: int):
                await start.wait()
                return await _run_update(
                    factory, actor_id, target_id, UserUpdate(role_code="admin")
                )

            tasks = [
                asyncio.create_task(demote(1, 2)),
                asyncio.create_task(demote(2, 1)),
            ]
            start.set()
            results = await asyncio.gather(*tasks)
            assert [result[0] for result in results].count("success") == 1
            errors = [result[1] for result in results if result[1] is not None]
            assert len(errors) == 1
            assert errors[0].status_code == 403
            assert len(await _active_super_admin_ids(factory)) == 1

    asyncio.run(run())


def test_concurrent_create_rechecks_student_id_after_auth_lock():
    async def run():
        async with isolated_pg() as factory:
            start = asyncio.Event()

            async def create(full_name: str, username: str):
                await start.wait()
                return await _run_create(
                    factory,
                    1,
                    UserCreate(
                        student_id="AUTH-RACE-1",
                        username=username,
                        full_name=full_name,
                        role_code="student",
                    ),
                )

            tasks = [
                asyncio.create_task(create("Race Student A", "race-student-a")),
                asyncio.create_task(create("Race Student B", "race-student-b")),
            ]
            start.set()
            results = await asyncio.gather(*tasks)

            assert [result[0] for result in results].count("success") == 1, results
            errors = [
                result[1]
                for result in results
                if result[0] == "http_error"
            ]
            assert len(errors) == 1
            assert errors[0].status_code == 400
            assert errors[0].detail == "学号已存在"

            async with factory() as db:
                count = await db.scalar(
                    select(func.count())
                    .select_from(User)
                    .where(User.student_id == "AUTH-RACE-1")
                )
                assert count == 1

    asyncio.run(run())
