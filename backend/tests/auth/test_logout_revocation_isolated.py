"""Logout regression: real JWT/router/ORM, synthetic SQLite and memory cache only.

No dependency on a running app, PostgreSQL or Redis. SQLite does not prove PG
row-lock scheduling; the lock-boundary cases exercise deterministic interleavings.
"""
import asyncio
import copy
import json
import secrets
import socket
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from http.cookies import SimpleCookie

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.endpoints.auth import auth as auth_api
from app.core import session_guard
from app.core.config import settings
from app.db.database import Base, get_db
from app.db import database
from app.models import RefreshToken, User, AuthSessionState, AuthAuthority
from app.services import auth as auth_service
from app.utils import rate_limit


class MemoryCache:
    def __init__(self):
        self.data = {}
        self.fail_write = None
        self.fail_read = False

    async def get(self, key):
        if self.fail_read and key.startswith("auth:session:uid:"):
            return None  # Production Cache.get returns None on Redis errors.
        return copy.deepcopy(self.data.get(key))

    async def set(self, key, value, expire_seconds=None):
        if key.startswith("auth:session:uid:"):
            if self.fail_write == "raise":
                raise RuntimeError("synthetic cache write failure")
            if self.fail_write == "false":
                return False
        self.data[key] = copy.deepcopy(value)
        return True

    async def get_client(self):
        cache = self

        class StrictClient:
            async def get(self, key):
                # Raw Redis GET raises on outage, unlike Cache.get's fallback.
                if cache.fail_read:
                    raise RuntimeError("synthetic Redis GET failure")
                value = cache.data.get(key)
                return None if value is None else json.dumps(value).encode()

            async def set(self, *args, **kwargs):
                raise RuntimeError("isolated cache: use the real in-memory rate limiter")

        return StrictClient()


class LogoutHarness:
    def __init__(self):
        self.cache = MemoryCache()
        self.fail_commit = False
        self.commit_attempts = 0
        self.rollbacks = 0
        self.rollback_active_transactions = []
        self.db_factory = None
        self.app = None

    async def request(self, method, path, *, token=None, cookies=None, reset_rate=True, **kwargs):
        if reset_rate:
            rate_limit.rate_limiter._mem._last.clear()
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        # Independent clients never accidentally replay or replace Cookie fixtures.
        async with AsyncClient(
            transport=ASGITransport(app=self.app, client=("192.0.2.10", 12345)),
            base_url="http://isolated.invalid", cookies=cookies, headers=headers,
        ) as client:
            return await client.request(method, "/api/v1/auth" + path, **kwargs)

    async def login(self, user="a"):
        response = await self.request(
            "POST", "/login", data={"username": f"Synthetic {user}", "password": f"ID-{user}"},
        )
        assert response.status_code == 200
        return response.json()

    async def legacy_login(self, user="a"):
        """Explicit pre-family issuance, using real DB rows and signed legacy JWT.

        Do not weaken new login to make historic fault characterization green.
        """
        pair = await self.login(user)
        opaque = secrets.token_urlsafe(64)
        async with self.db_factory() as db:
            row = (await db.execute(select(RefreshToken).where(
                RefreshToken.token == pair["refresh_token"],
            ))).scalar_one()
            row.token = opaque
            await db.commit()
        payload = auth_service.verify_token(pair["access_token"])
        payload.pop("sf", None)
        return {**pair, "access_token": auth_service.create_access_token(payload), "refresh_token": opaque}

    async def logout(self, pair=None, *, access="valid", cookies=None, token=None, expected_status=200):
        if cookies is None:
            cookies = {}
            if pair:
                cookies[settings.REFRESH_TOKEN_COOKIE_NAME] = pair["refresh_token"]
                if access == "valid":
                    cookies[settings.ACCESS_TOKEN_COOKIE_NAME] = pair["access_token"]
                elif access == "expired":
                    payload = auth_service.verify_token(pair["access_token"])
                    cookies[settings.ACCESS_TOKEN_COOKIE_NAME] = auth_service.create_access_token(
                        payload, expires_delta=timedelta(seconds=-10),
                    )
                elif access == "damaged":
                    cookies[settings.ACCESS_TOKEN_COOKIE_NAME] = "not-a-jwt"
        response = await self.request("POST", "/logout", cookies=cookies, token=token)
        assert response.status_code == expected_status
        if expected_status == 200:
            assert response.json()["message"] == "登出成功"
        else:
            assert expected_status == 503
            assert response.json()["revocation_status"] == "incomplete"
            assert response.json()["message"] == "服务端会话撤销未完成，客户端 Cookie 已清理，请稍后重试"
        cleared = SimpleCookie()
        for header in response.headers.get_list("set-cookie"):
            cleared.load(header)
        for key in (settings.ACCESS_TOKEN_COOKIE_NAME, settings.REFRESH_TOKEN_COOKIE_NAME):
            assert cleared[key].value == ""
            assert cleared[key]["max-age"] == "0"
        return response

    async def revoked(self, pair):
        # Separate session proves committed state, not an in-transaction object.
        async with self.db_factory() as db:
            return (await db.execute(select(RefreshToken.is_revoked).where(
                RefreshToken.token == pair["refresh_token"],
            ))).scalar_one()

    async def me(self, pair, expected):
        response = await self.request("GET", "/me", token=pair["access_token"])
        assert response.status_code == expected

    async def refresh(self, pair, expected):
        response = await self.request("POST", "/refresh", json={"refresh_token": pair["refresh_token"]})
        assert response.status_code == expected
        return response.json()


@pytest.fixture
def isolated(monkeypatch, tmp_path):
    def deny_network(*args, **kwargs):
        raise AssertionError("isolated logout tests must not connect to external services")

    monkeypatch.setattr(socket.socket, "connect", deny_network)
    monkeypatch.setattr(settings, "SECRET_KEY", secrets.token_urlsafe(48))
    monkeypatch.setattr(settings, "AUTH_USER_UNIQUE_PER_IP", False)
    monkeypatch.setattr(settings, "AUTH_ENFORCE_SAME_IP_PER_REQUEST", False)
    monkeypatch.setattr(settings, "AUTH_TRUST_X_FORWARDED_FOR", False)
    monkeypatch.setattr(settings, "COOKIE_SECURE", False)
    monkeypatch.setattr(settings, "COOKIE_DOMAIN", None)
    harness = LogoutHarness()
    monkeypatch.setattr(session_guard, "cache", harness.cache)
    monkeypatch.setattr(rate_limit, "cache", harness.cache)
    monkeypatch.setattr(rate_limit, "rate_limiter", rate_limit.RateLimiter())
    monkeypatch.setattr(auth_api, "rate_limiter", rate_limit.rate_limiter)

    @asynccontextmanager
    async def context():
        class FaultSession(AsyncSession):
            async def commit(self):
                harness.commit_attempts += 1
                if harness.fail_commit:
                    raise RuntimeError("synthetic database commit failure")
                await super().commit()

            async def rollback(self):
                harness.rollbacks += 1
                harness.rollback_active_transactions.append(self.in_transaction())
                await super().rollback()

        # WebSocket auth watchers overlap login/logout DB sessions. An in-memory
        # SQLite URL uses one StaticPool connection, so concurrent transactions can
        # rollback or close each other under coverage. A per-context file keeps the
        # test isolated while giving each short-lived session its own connection.
        db_path = tmp_path / f"auth-{secrets.token_hex(8)}.sqlite3"
        engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")

        @event.listens_for(engine.sync_engine, "connect")
        def configure_sqlite(connection, _):
            # SSE/WS session checks overlap logout writes. WAL mirrors PostgreSQL's
            # reader/writer concurrency closely enough for this isolation fixture;
            # rollback-journal mode can make a covered read block the logout commit.
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute("PRAGMA foreign_keys=ON")

        harness.db_factory = async_sessionmaker(engine, class_=FaultSession, expire_on_commit=False)
        # Streams/WS revalidate through short-lived sessions, also isolated here.
        monkeypatch.setattr(database, "AsyncSessionLocal", harness.db_factory)
        try:
            async with engine.begin() as connection:
                await connection.run_sync(lambda c: Base.metadata.create_all(
                    c, tables=[User.__table__, RefreshToken.__table__, AuthSessionState.__table__, AuthAuthority.__table__],
                ))
            async with harness.db_factory() as db:
                # Empty synthetic database: explicitly enroll before test users exist.
                db.add(AuthAuthority(id=1, ready=False))
                await db.commit()
                await auth_service.bootstrap_durable_auth_authority(db, legacy_writers_stopped=True)
                db.add_all([User(
                    id=i, username=f"synthetic-{name}", full_name=f"Synthetic {name}",
                    student_id=f"ID-{name}", role_code="student", is_active=True, is_deleted=False,
                ) for i, name in [(1, "a"), (2, "b")]])
                await db.commit()
            harness.app = FastAPI()
            harness.app.include_router(auth_api.router, prefix="/api/v1/auth")

            async def isolated_db():
                async with harness.db_factory() as db:
                    yield db

            harness.app.dependency_overrides[get_db] = isolated_db
            yield harness
        finally:
            await engine.dispose()

    return context


@pytest.mark.parametrize("access", ["valid", "missing", "expired", "damaged"])
def test_logout_revokes_retained_copies_with_refresh_fallback(isolated, access):
    async def scenario():
        async with isolated() as h:
            pair = await h.login()
            await h.me(pair, 200)
            await h.logout(pair, access=access)
            assert await h.revoked(pair) is True
            await h.me(pair, 401)
            await h.refresh(pair, 401)
    asyncio.run(scenario())


@pytest.mark.parametrize("access", ["valid", "missing"])
@pytest.mark.parametrize("failure", ["false", "raise"])
@pytest.mark.parametrize("legacy", [False, True])
def test_cache_write_failure_does_not_rollback_refresh_revocation(isolated, access, failure, legacy):
    async def scenario():
        async with isolated() as h:
            pair = await h.legacy_login() if legacy else await h.login()
            h.cache.fail_write = failure
            attempts, rollbacks = h.commit_attempts, h.rollbacks
            await h.logout(pair, access=access, expected_status=200)
            assert h.commit_attempts == attempts + 1
            # Durable logout no longer writes cache or needs error rollback.
            assert h.rollbacks == rollbacks
            h.cache.fail_write = None
            assert await h.revoked(pair) is True
            await h.refresh(pair, 401)
            # Durable nonce fencing covers legacy access as well.
            await h.me(pair, 401)
    asyncio.run(scenario())


@pytest.mark.parametrize("invalid", ["absent", "unknown", "expired", "revoked"])
def test_invalid_refresh_cannot_revoke_current_session(isolated, invalid):
    async def scenario():
        async with isolated() as h:
            pair = await h.login()
            cookies = {settings.ACCESS_TOKEN_COOKIE_NAME: "not-a-jwt"}
            if invalid != "absent":
                cookies[settings.REFRESH_TOKEN_COOKIE_NAME] = "synthetic-invalid-refresh"
            if invalid in ("expired", "revoked"):
                async with h.db_factory() as db:
                    db.add(RefreshToken(
                        user_id=1, token=cookies[settings.REFRESH_TOKEN_COOKIE_NAME],
                        expires_at=datetime.now(timezone.utc) + timedelta(days=-1 if invalid == "expired" else 1),
                        is_revoked=invalid == "revoked",
                    ))
                    await db.commit()
            await h.logout(cookies=cookies)
            assert await h.revoked(pair) is False
            await h.me(pair, 200)
            await h.refresh(pair, 200)
    asyncio.run(scenario())


def test_old_session_logout_preserves_new_login(isolated):
    async def scenario():
        async with isolated() as h:
            old = await h.login()
            new = await h.login()
            await h.me(old, 401)
            await h.refresh(old, 401)
            await h.logout(old)
            assert await h.revoked(new) is False
            await h.me(new, 200)
            await h.refresh(new, 200)
    asyncio.run(scenario())


@pytest.mark.parametrize("access", ["missing", "valid"])
def test_refresh_replay_cannot_restore_logged_out_session(isolated, access):
    async def scenario():
        async with isolated() as h:
            old = await h.login()
            new = await h.refresh(old, 200)
            await h.logout(new, access=access)
            await h.refresh(old, 401)
            await h.refresh(new, 401)
            await h.me(new, 401)
    asyncio.run(scenario())


def test_valid_header_targets_only_its_owner_not_conflicting_cookies(isolated):
    async def scenario():
        async with isolated() as h:
            a, b = await h.login("a"), await h.login("b")
            await h.logout(b, token=a["access_token"])
            assert await h.revoked(a) is True
            assert await h.revoked(b) is False
            await h.me(a, 401)
            await h.refresh(a, 401)
            await h.me(b, 200)
            await h.refresh(b, 200)
    asyncio.run(scenario())


def test_invalid_header_can_fall_back_to_valid_refresh_cookie(isolated):
    async def scenario():
        async with isolated() as h:
            pair = await h.login()
            await h.logout(pair, token="not-a-jwt")
            assert await h.revoked(pair) is True
            await h.me(pair, 401)
            await h.refresh(pair, 401)
    asyncio.run(scenario())


@pytest.mark.parametrize("cache_missing", [False, True])
def test_valid_refresh_revoked_even_if_nonce_cannot_be_read(isolated, cache_missing):
    async def scenario():
        async with isolated() as h:
            pair = await h.login()
            if cache_missing:
                h.cache.data.clear()
            else:
                h.cache.fail_read = True
            await h.logout(pair)
            h.cache.fail_read = False
            assert await h.revoked(pair) is True
            await h.me(pair, 401)
            await h.refresh(pair, 401)
    asyncio.run(scenario())


def test_legacy_refresh_cookie_is_revoked(isolated):
    async def scenario():
        async with isolated() as h:
            pair = await h.login()
            await h.logout(cookies={"refresh_token": pair["refresh_token"]})
            assert await h.revoked(pair) is True
            await h.refresh(pair, 401)
    asyncio.run(scenario())


@pytest.mark.parametrize("access", ["valid", "missing"])
@pytest.mark.parametrize("legacy", [False, True])
def test_commit_failure_clears_cookies_but_does_not_claim_durable_revocation(isolated, access, legacy):
    async def scenario():
        async with isolated() as h:
            pair = await h.legacy_login() if legacy else await h.login()
            h.fail_commit = True
            attempts, rollbacks = h.commit_attempts, h.rollbacks
            await h.logout(pair, access=access, expected_status=503)
            h.fail_commit = False
            assert h.commit_attempts == attempts + 1
            assert h.rollbacks == rollbacks + 1
            assert await h.revoked(pair) is False
            # Failed DB-first logout has no cache side effects; retry must revoke.
            await h.me(pair, 200)
            rotated = await h.refresh(pair, 200)
            await h.logout(rotated)
            await h.me(rotated, 401)
            await h.refresh(rotated, 401)
    asyncio.run(scenario())


@pytest.mark.parametrize("access", ["valid", "missing", "expired", "damaged"])
def test_access_only_requires_valid_current_nonce(isolated, access):
    async def scenario():
        async with isolated() as h:
            pair = await h.login()
            # Remove refresh from the pair without losing the access credential.
            access_only = dict(pair, refresh_token="")
            await h.logout(access_only, access=access)
            assert await h.revoked(pair) is (access == "valid")
            await h.me(pair, 401 if access == "valid" else 200)
            await h.refresh(pair, 401 if access == "valid" else 200)
    asyncio.run(scenario())


def test_configured_refresh_cookie_precedes_conflicting_legacy_cookie(isolated):
    async def scenario():
        async with isolated() as h:
            a, b = await h.login("a"), await h.login("b")
            await h.logout(cookies={
                settings.REFRESH_TOKEN_COOKIE_NAME: a["refresh_token"],
                "refresh_token": b["refresh_token"],
            })
            assert await h.revoked(a) is True
            assert await h.revoked(b) is False
            await h.me(a, 401)
            await h.me(b, 200)
    asyncio.run(scenario())


def test_stale_access_lock_is_released_before_refresh_owner_lock(isolated, monkeypatch):
    async def scenario():
        async with isolated() as h:
            a_old = await h.login("a")
            a_new, b = await h.login("a"), await h.login("b")
            before = h.rollbacks
            original_lock = auth_service.lock_user_for_login
            locked = []

            async def check_lock(db, user_id):
                assert user_id == 2
                assert h.rollbacks == before + 1
                locked.append(user_id)
                return await original_lock(db, user_id)

            monkeypatch.setattr(auth_service, "lock_user_for_login", check_lock)
            await h.logout(b, token=a_old["access_token"])
            assert locked == [2]
            assert await h.revoked(a_new) is False
            assert await h.revoked(b) is True
            await h.me(a_new, 200)
            await h.me(b, 401)
    asyncio.run(scenario())


@pytest.mark.parametrize("replacement", ["login", "refresh"])
def test_refresh_is_revalidated_after_waiting_for_user_lock(isolated, monkeypatch, replacement):
    async def scenario():
        async with isolated() as h:
            old = await h.login()
            original_lock = auth_service.lock_user_for_login
            interleaved = []

            async def replace_before_lock(db, user_id):
                # The helper already read the old token's owner. Simulate another
                # transaction completing BEFORE this transaction obtains the lock.
                assert user_id == 1
                new = await h.login() if replacement == "login" else await h.refresh(old, 200)
                interleaved.append(new)
                return await original_lock(db, user_id)

            monkeypatch.setattr(auth_service, "lock_user_for_login", replace_before_lock)
            await h.logout(old, access="missing")
            assert len(interleaved) == 1
            new = interleaved[0]
            assert await h.revoked(old) is True
            assert await h.revoked(new) is False
            await h.me(new, 200)
            await h.refresh(new, 200)
    asyncio.run(scenario())


def test_cache_read_exception_can_still_use_refresh(isolated, monkeypatch):
    async def scenario():
        async with isolated() as h:
            pair = await h.login()

            h.cache.fail_read = True
            await h.logout(pair)
            h.cache.fail_read = False
            assert await h.revoked(pair) is True
            await h.me(pair, 401)
            await h.refresh(pair, 401)
    asyncio.run(scenario())


def test_no_credential_logout_does_not_revoke_anyone(isolated):
    async def scenario():
        async with isolated() as h:
            a, b = await h.login("a"), await h.login("b")
            await h.logout()
            for pair in (a, b):
                assert await h.revoked(pair) is False
                await h.me(pair, 200)
    asyncio.run(scenario())
