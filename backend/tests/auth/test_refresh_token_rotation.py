import asyncio
import os
import re
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from sqlalchemy import delete, select
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models import AuthAuthority, AuthSessionState, RefreshToken, User
from app.services import auth


def dedicated_url():
    """并发用例只允许专用 PostgreSQL 测试库；缺失时跳过而不是直连正常库。"""
    value = os.environ.get("TEST_DATABASE_URL", "").strip()
    if not value:
        pytest.skip("Set TEST_DATABASE_URL to a dedicated PostgreSQL test database")
    parsed = make_url(value)
    if parsed.drivername != "postgresql+asyncpg" or not re.search(
        r"(?:^|[_-])(?:test|testing|ci)(?:$|[_-])", parsed.database or "", re.I
    ):
        pytest.fail("Refusing non-asyncpg or non-test database before connecting")
    return value


def _legacy_seed_token():
    # 无 ws1. 前缀的 legacy refresh，family 为 None，绕过 family nonce 校验。
    return f"seed-{datetime.now(timezone.utc).timestamp()}"


async def _seed_durable_state(db, user_id: int, *, active: bool = True) -> None:
    """并发用例的合成持久权威：gate 就绪 + 用户行 state，不改变锁序语义。"""
    gate = await db.get(AuthAuthority, 1)
    if gate is None:
        db.add(AuthAuthority(id=1, ready=True))
    else:
        gate.ready = True
    state = await db.get(AuthSessionState, user_id)
    if state is None:
        db.add(AuthSessionState(user_id=user_id, nonce="", ip="127.0.0.1", active=active))
    else:
        state.active = active
    await db.flush()


class _ScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeDB:
    """合成会话：顺序回答 rotate_refresh_token 的查询链。

    顺序：owner(user_id) → user → 持久 state → token；另支持 advisory-lock 分支。
    """

    def __init__(self, token_record, user, *, rotate_user_id=None):
        state = SimpleNamespace(
            user_id=user.id, active=True, nonce="", ip="127.0.0.1",
            ip_expires_at=None,
        )
        values = (
            [rotate_user_id, user, state, token_record]
            if rotate_user_id is not None
            else [token_record, user]
        )
        self._results = iter(_ScalarResult(value) for value in values)
        self.added = []
        self.commit_count = 0
        self.rollback_count = 0

    async def execute(self, _query):
        return next(self._results)

    def add(self, value):
        self.added.append(value)

    async def commit(self):
        self.commit_count += 1

    async def rollback(self):
        self.rollback_count += 1

    async def flush(self):
        pass

    def get_bind(self):
        return SimpleNamespace(dialect=SimpleNamespace(name="sqlite"))

    async def scalar(self, _query):
        return True  # auth_authority.ready


def test_rotate_refresh_token_revokes_and_issues_in_one_commit():
    token_record = SimpleNamespace(
        user_id=7,
        is_revoked=False,
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
    )
    user = SimpleNamespace(
        id=7,
        role_code="teacher",
        username="teacher",
        student_id="T007",
        full_name="Teacher",
        class_name=None,
        study_year=None,
        is_active=True,
        is_deleted=False,
    )
    db = _FakeDB(token_record, user, rotate_user_id=7)

    result = asyncio.run(auth.rotate_refresh_token(db, "old-token"))

    assert result is not None
    assert result["user_id"] == 7
    assert result["refresh_token"]
    assert token_record.is_revoked is True
    assert len(db.added) == 1
    assert db.added[0].token == result["refresh_token"]
    assert db.commit_count == 1
    assert db.rollback_count == 0


def test_verify_refresh_token_rejects_inactive_user():
    token_record = SimpleNamespace(user_id=7)
    user = SimpleNamespace(
        id=7,
        role_code="student",
        username="student",
        student_id="S007",
        full_name="Student",
        class_name="Class 1",
        study_year=2026,
        is_active=False,
        is_deleted=False,
    )
    db = _FakeDB(token_record, user)

    result = asyncio.run(auth.verify_refresh_token(db, "inactive-user-token"))

    assert result is None


def test_verify_and_rotate_refresh_token_reject_deleted_user():
    token_record = SimpleNamespace(
        user_id=7,
        is_revoked=False,
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
    )
    user = SimpleNamespace(
        id=7,
        role_code="student",
        username="student",
        student_id="S007",
        full_name="Student",
        class_name="Class 1",
        study_year=2026,
        is_active=True,
        is_deleted=True,
    )

    verify_db = _FakeDB(token_record, user)
    rotate_db = _FakeDB(token_record, user, rotate_user_id=7)

    assert asyncio.run(auth.verify_refresh_token(verify_db, "deleted-user-token")) is None
    assert asyncio.run(auth.rotate_refresh_token(rotate_db, "deleted-user-token")) is None
    assert rotate_db.rollback_count == 1
    assert rotate_db.commit_count == 0


def test_concurrent_refresh_rotation_allows_only_one_consumer():
    async def run():
        engine = create_async_engine(dedicated_url())
        Session = async_sessionmaker(engine, expire_on_commit=False)
        seed_token = f"concurrency-{datetime.now(timezone.utc).timestamp()}"
        suffix = str(datetime.now(timezone.utc).timestamp()).replace(".", "")
        username = f"refresh-race-{suffix}"
        results = []

        async with Session() as db:
            user = User(
                username=username,
                full_name="Refresh Rotation Race Test",
                role_code="teacher",
                is_active=True,
                is_deleted=False,
            )
            db.add(user)
            await db.flush()
            user_id = user.id
            db.add(
                RefreshToken(
                    user_id=user_id,
                    token=seed_token,
                    expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
                    is_revoked=False,
                )
            )
            await _seed_durable_state(db, user_id)
            await db.commit()

        async def consume():
            async with Session() as db:
                return await auth.rotate_refresh_token(db, seed_token)

        try:
            results = await asyncio.gather(consume(), consume())
            assert sum(result is not None for result in results) == 1
        finally:
            async with Session() as db:
                await db.execute(
                    delete(RefreshToken).where(
                        (RefreshToken.token == seed_token)
                        | RefreshToken.token.in_(
                            [
                                result["refresh_token"]
                                for result in results
                                if result is not None
                            ]
                        )
                    )
                )
                await db.execute(delete(User).where(User.id == user_id))
                await db.commit()
            await engine.dispose()

    asyncio.run(run())


def test_concurrent_login_refresh_issue_leaves_only_one_active_token():
    issue_login_refresh_token = getattr(auth, "issue_login_refresh_token", None)
    assert callable(issue_login_refresh_token), (
        "login refresh token issuance must be an atomic service operation"
    )

    async def run():
        engine = create_async_engine(dedicated_url())
        Session = async_sessionmaker(engine, expire_on_commit=False)
        suffix = str(datetime.now(timezone.utc).timestamp()).replace(".", "")
        username = f"login-race-{suffix}"

        async with Session() as db:
            user = User(
                username=username,
                full_name="Login Race Test",
                role_code="teacher",
                is_active=True,
                is_deleted=False,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            user_id = user.id
            await _seed_durable_state(db, user_id)
            await db.commit()

        async def issue():
            async with Session() as db:
                return await issue_login_refresh_token(db, user_id)

        try:
            tokens = await asyncio.gather(issue(), issue())
            async with Session() as db:
                active_tokens = (
                    await db.execute(
                        select(RefreshToken.token).where(
                            RefreshToken.user_id == user_id,
                            RefreshToken.is_revoked.is_(False),
                        )
                    )
                ).scalars().all()

            assert len(active_tokens) == 1
            assert active_tokens[0] in tokens
        finally:
            async with Session() as db:
                await db.execute(delete(User).where(User.id == user_id))
                await db.commit()
            await engine.dispose()

    asyncio.run(run())


def test_refresh_waits_for_login_user_lock_and_rechecks_revocation():
    async def run():
        engine = create_async_engine(dedicated_url())
        Session = async_sessionmaker(engine, expire_on_commit=False)
        suffix = str(datetime.now(timezone.utc).timestamp()).replace(".", "")
        username = f"login-refresh-race-{suffix}"
        seed_token = f"login-refresh-token-{suffix}"

        async with Session() as db:
            user = User(
                username=username,
                full_name="Login Refresh Race Test",
                role_code="teacher",
                is_active=True,
                is_deleted=False,
            )
            db.add(user)
            await db.flush()
            user_id = user.id
            db.add(
                RefreshToken(
                    user_id=user_id,
                    token=seed_token,
                    expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
                    is_revoked=False,
                )
            )
            await _seed_durable_state(db, user_id)
            await db.commit()

        login_db = Session()
        try:
            locked_user_id = (
                await login_db.execute(
                    select(User.id)
                    .where(User.id == user_id)
                    .with_for_update()
                )
            ).scalar_one()
            assert locked_user_id == user_id

            async def refresh():
                async with Session() as db:
                    return await auth.rotate_refresh_token(db, seed_token)

            refresh_task = asyncio.create_task(refresh())
            await asyncio.sleep(0.1)
            assert not refresh_task.done(), (
                "refresh must wait for the same user lock held by login"
            )

            await auth.issue_login_refresh_token(
                login_db,
                user_id,
                user_locked=True,
                commit=False,
            )
            await login_db.commit()

            assert await refresh_task is None
        finally:
            await login_db.rollback()
            await login_db.close()
            async with Session() as db:
                await db.execute(delete(User).where(User.id == user_id))
                await db.commit()
            await engine.dispose()

    asyncio.run(run())


def test_refresh_waits_for_logout_user_lock_and_rechecks_revocation():
    async def run():
        engine = create_async_engine(dedicated_url())
        Session = async_sessionmaker(engine, expire_on_commit=False)
        suffix = str(datetime.now(timezone.utc).timestamp()).replace(".", "")
        username = f"logout-refresh-race-{suffix}"
        seed_token = f"logout-refresh-token-{suffix}"

        async with Session() as db:
            user = User(
                username=username,
                full_name="Logout Refresh Race Test",
                role_code="teacher",
                is_active=True,
                is_deleted=False,
            )
            db.add(user)
            await db.flush()
            user_id = user.id
            db.add(
                RefreshToken(
                    user_id=user_id,
                    token=seed_token,
                    expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
                    is_revoked=False,
                )
            )
            await _seed_durable_state(db, user_id)
            await db.commit()

        logout_db = Session()
        try:
            assert await auth.lock_user_for_login(logout_db, user_id) is True

            async def refresh():
                async with Session() as db:
                    return await auth.rotate_refresh_token(db, seed_token)

            refresh_task = asyncio.create_task(refresh())
            await asyncio.sleep(0.1)
            assert not refresh_task.done(), (
                "refresh must wait for the same user lock held by logout"
            )

            await auth.revoke_all_user_refresh_tokens(
                logout_db,
                user_id,
                commit=False,
            )
            await logout_db.commit()

            assert await refresh_task is None
        finally:
            await logout_db.rollback()
            await logout_db.close()
            async with Session() as db:
                await db.execute(delete(User).where(User.id == user_id))
                await db.commit()
            await engine.dispose()

    asyncio.run(run())
