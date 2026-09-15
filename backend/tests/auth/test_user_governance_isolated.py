"""Synthetic AC-02/AC-03 account-governance regression.

Run only through a reviewed bootstrap that disables dotenv, conftest and
external network before collection.  SQLite proves transaction/state semantics;
it is deliberately not accepted as PostgreSQL concurrency evidence.
"""
import os
import pytest

if os.environ.get("R6_ACCOUNT_GOVERNANCE_ISOLATED") != "1":
    pytest.skip("requires isolated account-governance bootstrap", allow_module_level=True)

import asyncio
import io
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.endpoints.management.users import import_service, users, users_helpers
from app.api.endpoints.management.users.schemas import (
    BatchDeleteRequest,
    UserCreate,
    UserUpdate,
)
from app.core import startup
from app.core.session_family import durable_access_is_active
from app.db.database import Base
from app.models import AuthAuthority, AuthSessionState, RefreshToken, User
from app.services import user_governance


@asynccontextmanager
async def isolated_db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
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
    async with factory() as db:
        db.add(AuthAuthority(id=1, ready=True))
        db.add_all(
            [
                User(id=1, username="root-a", full_name="Root A", role_code="super_admin", is_active=True, is_deleted=False),
                User(id=2, username="student-a", student_id="S-2", full_name="Student A", role_code="student", is_active=True, is_deleted=False),
            ]
        )
        await db.commit()
    try:
        yield factory
    finally:
        await engine.dispose()


async def seed_credential(factory, user_id: int, *, nonce: str = "synthetic-nonce") -> None:
    async with factory() as db:
        db.add(
            RefreshToken(
                user_id=user_id,
                token=f"refresh-{user_id}-{nonce}",
                expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
                is_revoked=False,
            )
        )
        db.add(
            AuthSessionState(
                user_id=user_id,
                nonce=nonce,
                ip="192.0.2.10",
                active=True,
                ip_expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            )
        )
        await db.commit()


async def state(factory, user_id: int):
    async with factory() as db:
        user = await db.get(User, user_id)
        session = await db.get(AuthSessionState, user_id)
        revoked = await db.scalar(
            select(RefreshToken.is_revoked).where(RefreshToken.user_id == user_id)
        )
        return user, session, revoked


@pytest.fixture(autouse=True)
def no_publication(monkeypatch):
    async def publish(*_args, **_kwargs):
        return None

    monkeypatch.setattr(users, "publish", publish)
    monkeypatch.setattr(users_helpers, "publish", publish)


def test_disable_then_enable_never_revives_old_generation():
    async def run():
        async with isolated_db() as factory:
            await seed_credential(factory, 2)
            async with factory() as db:
                assert await durable_access_is_active(
                    db, 2, {"sn": "synthetic-nonce"}
                ) is True
                assert await durable_access_is_active(
                    db, 2, {"sn": "synthetic-nonce", "sf": 1}
                ) is True
                await users.update_user(
                    2,
                    UserUpdate(is_active=False),
                    {"id": 1, "role_code": "super_admin"},
                    db,
                )
            user, session, revoked = await state(factory, 2)
            assert user.is_active is False
            assert session is not None and session.active is False
            assert revoked is True
            tombstone_nonce = session.nonce
            async with factory() as db:
                assert await durable_access_is_active(
                    db, 2, {"sn": tombstone_nonce}
                ) is False
                assert await durable_access_is_active(
                    db, 2, {"sn": tombstone_nonce, "sf": 1}
                ) is False

            async with factory() as db:
                await users.update_user(2, UserUpdate(is_active=True), {"id": 1, "role_code": "super_admin"}, db)
            user, session, revoked = await state(factory, 2)
            assert user.is_active is True
            assert session is not None and session.active is False
            assert session.nonce == tombstone_nonce
            assert revoked is True
            async with factory() as db:
                assert await durable_access_is_active(
                    db, 2, {"sn": tombstone_nonce}
                ) is False

    asyncio.run(run())


def test_profile_edit_does_not_revoke_current_generation():
    async def run():
        async with isolated_db() as factory:
            await seed_credential(factory, 2)
            async with factory() as db:
                await users.update_user(
                    2,
                    UserUpdate(full_name="Student A Updated"),
                    {"id": 1, "role_code": "super_admin"},
                    db,
                )
            user, session, revoked = await state(factory, 2)
            assert user.full_name == "Student A Updated"
            assert session is not None and session.active is True
            assert session.nonce == "synthetic-nonce"
            assert revoked is False

    asyncio.run(run())


def test_committed_revocation_survives_publication_failure(monkeypatch):
    async def run():
        async with isolated_db() as factory:
            await seed_credential(factory, 2)

            async def fail_publish(*_args, **_kwargs):
                raise RuntimeError("synthetic broker failure")

            monkeypatch.setattr(users, "publish", fail_publish)
            async with factory() as db:
                response = await users.update_user(
                    2,
                    UserUpdate(is_active=False),
                    {"id": 1, "role_code": "super_admin"},
                    db,
                )
                assert response.is_active is False
            user, session, revoked = await state(factory, 2)
            assert user.is_active is False
            assert session is not None and session.active is False
            assert revoked is True

    asyncio.run(run())


def test_restore_repairs_pre_fix_inactive_account_without_tombstone():
    async def run():
        async with isolated_db() as factory:
            await seed_credential(factory, 2, nonce="old-generation")
            async with factory() as db:
                user = await db.get(User, 2)
                user.is_active = False
                await db.commit()
            async with factory() as db:
                await users.update_user(2, UserUpdate(is_active=True), {"id": 1, "role_code": "super_admin"}, db)
            user, session, revoked = await state(factory, 2)
            assert user.is_active is True
            assert session is not None and session.active is False
            assert revoked is True

    asyncio.run(run())


@pytest.mark.parametrize("mode", ["single", "batch"])
def test_soft_delete_revokes_in_same_transaction(mode):
    async def run():
        async with isolated_db() as factory:
            await seed_credential(factory, 2)
            async with factory() as db:
                if mode == "single":
                    await users.delete_user(2, {"id": 1, "role_code": "super_admin"}, db)
                else:
                    await users_helpers.batch_delete_users(
                        BatchDeleteRequest(user_ids=[2]),
                        {"id": 1, "role_code": "super_admin"},
                        db,
                    )
            user, session, revoked = await state(factory, 2)
            assert user.is_deleted is True
            assert session is not None and session.active is False
            assert revoked is True

    asyncio.run(run())


def test_import_deactivation_uses_same_durable_revocation():
    async def run():
        async with isolated_db() as factory:
            await seed_credential(factory, 2)
            content = "学号,姓名,状态,角色\nS-2,Student A,false,student\n".encode()
            upload = UploadFile(filename="synthetic.csv", file=io.BytesIO(content))
            async with factory() as db:
                result = await import_service.import_users(
                    upload, {"id": 1, "role_code": "super_admin"}, db
                )
            assert result.success is True and result.updated_count == 1
            user, session, revoked = await state(factory, 2)
            assert user.is_active is False
            assert session is not None and session.active is False
            assert revoked is True

    asyncio.run(run())


@pytest.mark.parametrize(
    "operation",
    [
        "deactivate",
        "demote",
        "delete",
        "batch-delete",
        "import-demote",
        "import-deactivate",
    ],
)
def test_last_active_super_admin_is_preserved(operation):
    async def run():
        async with isolated_db() as factory:
            async with factory() as db:
                try:
                    if operation == "deactivate":
                        await users.update_user(1, UserUpdate(is_active=False), {"id": 1, "role_code": "super_admin"}, db)
                    elif operation == "demote":
                        await users.update_user(1, UserUpdate(role_code="admin"), {"id": 1, "role_code": "super_admin"}, db)
                    elif operation == "delete":
                        await users.delete_user(1, {"id": 1, "role_code": "super_admin"}, db)
                    elif operation == "batch-delete":
                        await users_helpers.batch_delete_users(
                            BatchDeleteRequest(user_ids=[1]),
                            {"id": 1, "role_code": "super_admin"},
                            db,
                        )
                    else:
                        import_row = (
                            "ROOT-1,Root A,false,super_admin"
                            if operation == "import-deactivate"
                            else "ROOT-1,Root A,true,admin"
                        )
                        upload = UploadFile(
                            filename="synthetic.csv",
                            file=io.BytesIO(
                                f"学号,姓名,状态,角色\n{import_row}\n".encode()
                            ),
                        )
                        root = await db.get(User, 1)
                        root.student_id = "ROOT-1"
                        await db.commit()
                        result = await import_service.import_users(
                            upload, {"id": 1, "role_code": "super_admin"}, db
                        )
                        assert result.success is False
                        assert user_governance.LAST_ACTIVE_SUPER_ADMIN in result.errors[0].message
                        return
                except HTTPException as exc:
                    assert exc.status_code == 409
                    assert exc.detail["code"] == user_governance.LAST_ACTIVE_SUPER_ADMIN
                    await db.rollback()
                else:
                    raise AssertionError("last active super_admin mutation unexpectedly succeeded")

            async with factory() as db:
                root = await db.get(User, 1)
                assert root.role_code == "super_admin"
                assert root.is_active is True
                assert root.is_deleted is False

    asyncio.run(run())


def test_batch_delete_all_active_super_admins_is_atomic():
    async def run():
        async with isolated_db() as factory:
            async with factory() as db:
                db.add(
                    User(
                        id=3,
                        username="root-b",
                        full_name="Root B",
                        role_code="super_admin",
                        is_active=True,
                        is_deleted=False,
                    )
                )
                await db.commit()
            async with factory() as db:
                with pytest.raises(HTTPException) as raised:
                    await users_helpers.batch_delete_users(
                        BatchDeleteRequest(user_ids=[1, 3]),
                        {"id": 1, "role_code": "super_admin"},
                        db,
                    )
                assert raised.value.status_code == 409
                assert (
                    raised.value.detail["code"]
                    == user_governance.LAST_ACTIVE_SUPER_ADMIN
                )
                await db.rollback()
            async with factory() as db:
                roots = (
                    await db.execute(
                        select(User).where(User.id.in_([1, 3])).order_by(User.id)
                    )
                ).scalars().all()
                assert [root.is_deleted for root in roots] == [False, False]

    asyncio.run(run())


def test_two_super_admins_allow_only_one_sequential_removal():
    async def run():
        async with isolated_db() as factory:
            async with factory() as db:
                db.add(User(id=3, username="root-b", full_name="Root B", role_code="super_admin", is_active=True, is_deleted=False))
                await db.commit()
            async with factory() as db:
                await users.update_user(1, UserUpdate(is_active=False), {"id": 3, "role_code": "super_admin"}, db)
            async with factory() as db:
                with pytest.raises(HTTPException) as raised:
                    await users.update_user(3, UserUpdate(is_active=False), {"id": 3, "role_code": "super_admin"}, db)
                assert raised.value.status_code == 409
                assert raised.value.detail["code"] == user_governance.LAST_ACTIVE_SUPER_ADMIN
                await db.rollback()
            async with factory() as db:
                count = len(
                    (
                        await db.execute(
                            select(User.id).where(
                                User.role_code == "super_admin",
                                User.is_active.is_(True),
                                User.is_deleted.is_(False),
                            )
                        )
                    ).scalars().all()
                )
                assert count == 1

    asyncio.run(run())


def test_revocation_failure_rolls_back_account_and_credentials(monkeypatch):
    async def run():
        async with isolated_db() as factory:
            await seed_credential(factory, 2)
            original = user_governance.revoke_durable_session

            async def fail_after_writes(db, user_id):
                await original(db, user_id)
                raise RuntimeError("synthetic failure before commit")

            monkeypatch.setattr(user_governance, "revoke_durable_session", fail_after_writes)
            async with factory() as db:
                with pytest.raises(HTTPException) as raised:
                    await users.update_user(2, UserUpdate(is_active=False), {"id": 1, "role_code": "super_admin"}, db)
                assert raised.value.status_code == 500
            user, session, revoked = await state(factory, 2)
            assert user.is_active is True
            assert session is not None and session.active is True
            assert revoked is False

    asyncio.run(run())


def test_create_user_revalidates_actor_after_auth_lock():
    async def run():
        async with isolated_db() as factory:
            async with factory() as db:
                actor = await db.get(User, 1)
                actor.role_code = "admin"
                await db.commit()
            async with factory() as db:
                with pytest.raises(HTTPException) as raised:
                    await users.create_user(
                        UserCreate(
                            username="new-root",
                            full_name="New Root",
                            role_code="super_admin",
                        ),
                        {"id": 1, "role_code": "super_admin"},
                        db,
                    )
                assert raised.value.status_code == 403
                await db.rollback()
            async with factory() as db:
                assert await db.scalar(
                    select(User.id).where(User.username == "new-root")
                ) is None

    asyncio.run(run())


def test_startup_does_not_reset_existing_super_admin(monkeypatch):
    async def run():
        async with isolated_db() as factory:
            async with factory() as db:
                actor = await db.get(User, 1)
                actor.hashed_password = "manually-managed-hash"
                actor.full_name = "Manually Managed"
                await db.commit()

            monkeypatch.setattr(startup, "AsyncSessionLocal", factory)
            monkeypatch.setattr(
                startup,
                "settings",
                type("Settings", (), {
                    "SUPER_ADMIN_USERNAME": "root-a",
                    "SUPER_ADMIN_PASSWORD": "bootstrap-only",
                    "SUPER_ADMIN_FULL_NAME": "Configured Name",
                })(),
            )
            monkeypatch.setattr(
                startup, "hash_super_admin_password",
                lambda: (_ for _ in ()).throw(AssertionError("must not rehash existing account")),
            )

            await startup.init_super_admin()

            async with factory() as db:
                actor = await db.get(User, 1)
                assert actor.hashed_password == "manually-managed-hash"
                assert actor.full_name == "Manually Managed"
                assert actor.role_code == "super_admin"
                assert actor.is_active is True

    asyncio.run(run())


def test_startup_does_not_reactivate_or_promote_configured_account(monkeypatch):
    async def run():
        async with isolated_db() as factory:
            async with factory() as db:
                actor = await db.get(User, 1)
                actor.role_code = "admin"
                actor.is_active = False
                await db.commit()

            monkeypatch.setattr(startup, "AsyncSessionLocal", factory)
            monkeypatch.setattr(
                startup,
                "settings",
                type("Settings", (), {
                    "SUPER_ADMIN_USERNAME": "root-a",
                    "SUPER_ADMIN_PASSWORD": "bootstrap-only",
                    "SUPER_ADMIN_FULL_NAME": "Configured Name",
                })(),
            )
            await startup.init_super_admin()

            async with factory() as db:
                actor = await db.get(User, 1)
                assert actor.role_code == "admin"
                assert actor.is_active is False

    asyncio.run(run())


def test_startup_creates_missing_super_admin_once_under_auth_lock(monkeypatch):
    async def run():
        async with isolated_db() as factory:
            monkeypatch.setattr(startup, "AsyncSessionLocal", factory)
            monkeypatch.setattr(
                startup,
                "settings",
                type("Settings", (), {
                    "SUPER_ADMIN_USERNAME": "bootstrap-root",
                    "SUPER_ADMIN_PASSWORD": "bootstrap-only",
                    "SUPER_ADMIN_FULL_NAME": "Bootstrap Root",
                })(),
            )
            monkeypatch.setattr(startup, "hash_super_admin_password", lambda: "bootstrap-hash")

            await startup.init_super_admin()
            await startup.init_super_admin()

            async with factory() as db:
                rows = (
                    await db.execute(
                        select(User).where(User.username == "bootstrap-root")
                    )
                ).scalars().all()
                assert len(rows) == 1
                assert rows[0].hashed_password == "bootstrap-hash"
                assert rows[0].role_code == "super_admin"
                assert rows[0].is_active is True
                assert rows[0].is_deleted is False

    asyncio.run(run())
