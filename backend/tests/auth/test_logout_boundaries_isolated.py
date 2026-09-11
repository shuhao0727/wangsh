"""Logout counterexamples using the synthetic, no-network auth harness.

Run with the external isolated runner and --noconftest, never normal app setup.
Interleavings here prove revalidation logic, not PostgreSQL lock scheduling.
"""
import asyncio
from datetime import datetime, timedelta, timezone
from http.cookies import SimpleCookie

import pytest
from sqlalchemy import update

from app.api.endpoints.auth import auth as auth_api
from app.core.config import settings
from app.models import RefreshToken, User
from app.services import auth as auth_service
from test_logout_revocation_isolated import isolated  # noqa: F401


def test_expired_header_uses_fresh_refresh_not_conflicting_access_cookie(isolated):
    async def scenario():
        async with isolated() as h:
            a, b = await h.login("a"), await h.login("b")
            expired = auth_service.create_access_token(
                auth_service.verify_token(a["access_token"]),
                expires_delta=timedelta(seconds=-10),
            )
            await h.logout(token=expired, cookies={
                settings.ACCESS_TOKEN_COOKIE_NAME: a["access_token"],
                settings.REFRESH_TOKEN_COOKIE_NAME: b["refresh_token"],
            })
            assert await h.revoked(a) is False
            assert await h.revoked(b) is True
            await h.me(a, 200)
            await h.me(b, 401)
            await h.refresh(b, 401)
    asyncio.run(scenario())


@pytest.mark.parametrize("invalid", ["unknown", "expired", "revoked"])
def test_invalid_configured_refresh_does_not_fall_through_to_other_owner(isolated, invalid):
    async def scenario():
        async with isolated() as h:
            a, b = await h.login("a"), await h.login("b")
            token = "synthetic-invalid-owned-refresh"
            if invalid != "unknown":
                async with h.db_factory() as db:
                    db.add(RefreshToken(
                        user_id=2, token=token,
                        expires_at=datetime.now(timezone.utc) + timedelta(
                            days=-1 if invalid == "expired" else 1,
                        ), is_revoked=invalid == "revoked",
                    ))
                    await db.commit()
            before = h.commit_attempts
            await h.logout(cookies={
                settings.REFRESH_TOKEN_COOKIE_NAME: token,
                "refresh_token": a["refresh_token"],
            })
            assert h.commit_attempts == before
            for pair in (a, b):
                assert await h.revoked(pair) is False
                await h.me(pair, 200)
                await h.refresh(pair, 200)
    asyncio.run(scenario())


@pytest.mark.parametrize("field", ["is_active", "is_deleted"])
@pytest.mark.parametrize("access", ["valid", "missing"])
def test_unavailable_owner_cannot_authorize_revocation(isolated, field, access):
    async def scenario():
        async with isolated() as h:
            a, b = await h.login("a"), await h.login("b")
            async with h.db_factory() as db:
                await db.execute(update(User).where(User.id == 1).values(
                    **{field: field == "is_deleted"},
                ))
                await db.commit()
            cache_before = dict(h.cache.data)
            before = h.commit_attempts
            await h.logout(a, access=access)
            assert h.commit_attempts == before
            assert h.cache.data == cache_before
            assert await h.revoked(a) is False
            assert await h.revoked(b) is False
            await h.me(b, 200)
    asyncio.run(scenario())


@pytest.mark.parametrize("refresh_owner", ["old", "other"])
def test_access_nonce_is_rechecked_after_user_lock_wait(isolated, monkeypatch, refresh_owner):
    async def scenario():
        async with isolated() as h:
            old, b = await h.login("a"), await h.login("b")
            original_lock = auth_api.lock_user_for_login
            replacement = []

            async def login_before_lock(db, user_id):
                assert user_id == 1
                # Real synthetic login finishes before logout acquires the lock.
                with monkeypatch.context() as login_patch:
                    login_patch.setattr(auth_api, "lock_user_for_login", original_lock)
                    new = await h.login("a")
                replacement.append(new)
                return await original_lock(db, user_id)

            monkeypatch.setattr(auth_api, "lock_user_for_login", login_before_lock)
            refresh = old if refresh_owner == "old" else b
            await h.logout(token=old["access_token"], cookies={
                settings.REFRESH_TOKEN_COOKIE_NAME: refresh["refresh_token"],
            })
            assert len(replacement) == 1
            # Stop interleaving after logout; later refresh now also takes this lock.
            monkeypatch.setattr(auth_api, "lock_user_for_login", original_lock)
            new = replacement[0]
            assert await h.revoked(new) is False
            assert await h.revoked(b) is (refresh_owner == "other")
            await h.me(new, 200)
            await h.refresh(new, 200)
            await h.me(b, 401 if refresh_owner == "other" else 200)
    asyncio.run(scenario())


@pytest.mark.parametrize("change", ["expired", "revoked", "owner", "disabled", "deleted"])
def test_refresh_proof_is_invalidated_while_waiting_for_user_lock(isolated, monkeypatch, change):
    async def scenario():
        async with isolated() as h:
            a, b = await h.login("a"), await h.login("b")
            # A separate valid proof lets us verify that rejecting a stale proof
            # does not revoke all the owner's otherwise valid credentials.
            probe = "synthetic-lock-boundary-refresh"
            async with h.db_factory() as db:
                db.add(RefreshToken(user_id=1, token=probe, is_revoked=False,
                                    expires_at=datetime.now(timezone.utc) + timedelta(days=1)))
                await db.commit()
            original_lock = auth_service.lock_user_for_login
            calls = []

            async def invalidate_before_lock(db, user_id):
                assert user_id == 1
                calls.append(user_id)
                async with h.db_factory() as writer:
                    if change in ("disabled", "deleted"):
                        values = {"is_active": False} if change == "disabled" else {"is_deleted": True}
                        await writer.execute(update(User).where(User.id == 1).values(**values))
                    else:
                        values = {
                            "expired": {"expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)},
                            "revoked": {"is_revoked": True},
                            "owner": {"user_id": 2},
                        }[change]
                        await writer.execute(update(RefreshToken).where(
                            RefreshToken.token == probe,
                        ).values(**values))
                    await writer.commit()
                return await original_lock(db, user_id)

            monkeypatch.setattr(auth_service, "lock_user_for_login", invalidate_before_lock)
            cache_before = dict(h.cache.data)
            attempts, rollbacks = h.commit_attempts, h.rollbacks
            await h.logout(cookies={settings.REFRESH_TOKEN_COOKIE_NAME: probe})
            assert calls == [1]
            assert h.commit_attempts == attempts + 1  # Only the interleaved writer.
            assert h.rollbacks == rollbacks + 1
            assert h.cache.data == cache_before
            for pair in (a, b):
                assert await h.revoked(pair) is False
            await h.me(b, 200)
    asyncio.run(scenario())


@pytest.mark.parametrize("access", ["valid", "missing"])
@pytest.mark.parametrize("after_update", [False, True])
def test_db_revocation_failure_rolls_back_and_clears_scoped_cookies(
    isolated, monkeypatch, access, after_update,
):
    async def scenario():
        async with isolated() as h:
            monkeypatch.setattr(settings, "COOKIE_DOMAIN", "isolated.invalid")
            monkeypatch.setattr(settings, "ACCESS_TOKEN_COOKIE_NAME", "scoped-access")
            monkeypatch.setattr(settings, "REFRESH_TOKEN_COOKIE_NAME", "scoped-refresh")
            pair = await h.login()
            original_revoke = auth_api.revoke_durable_session

            async def fail_revoke(db, user_id):
                if after_update:
                    await original_revoke(db, user_id)
                raise RuntimeError("synthetic revocation database failure")

            monkeypatch.setattr(auth_api, "revoke_durable_session", fail_revoke)
            attempts, rollbacks = h.commit_attempts, h.rollbacks
            response = await h.logout(pair, access=access, expected_status=503)
            assert h.commit_attempts == attempts
            assert h.rollbacks == rollbacks + 1
            cleared = SimpleCookie()
            for header in response.headers.get_list("set-cookie"):
                cleared.load(header)
            assert set(cleared) == {"scoped-access", "scoped-refresh"}
            for cookie in cleared.values():
                assert cookie["domain"] == "isolated.invalid"
                assert cookie["path"] == "/"
                assert cookie["expires"]
            assert await h.revoked(pair) is False
            await h.me(pair, 200)
            await h.refresh(pair, 200)
    asyncio.run(scenario())


@pytest.mark.parametrize("rollback_fails", [False, True])
def test_cache_and_commit_failure_never_claims_revocation(isolated, monkeypatch, rollback_fails):
    async def scenario():
        async with isolated() as h:
            pair = await h.login()
            original_rollback = h.db_factory.class_.rollback

            async def failed_rollback(db):
                # Release synthetic resources, then exercise the response boundary
                # for a rollback that raises. This is not real driver recovery.
                await original_rollback(db)
                raise RuntimeError("synthetic rollback failure")

            if rollback_fails:
                monkeypatch.setattr(h.db_factory.class_, "rollback", failed_rollback)
            h.fail_commit = True
            h.cache.fail_write = "raise"
            attempts, rollbacks = h.commit_attempts, h.rollbacks
            await h.logout(pair, expected_status=503)
            assert h.commit_attempts == attempts + 1
            assert h.rollbacks == rollbacks + 1
            h.fail_commit = False
            h.cache.fail_write = None
            monkeypatch.setattr(h.db_factory.class_, "rollback", original_rollback)
            assert await h.revoked(pair) is False
            await h.me(pair, 200)
            await h.refresh(pair, 200)
    asyncio.run(scenario())


def test_refresh_in_body_is_not_logout_authority(isolated):
    async def scenario():
        async with isolated() as h:
            pair = await h.login()
            response = await h.request("POST", "/logout", json={"refresh_token": pair["refresh_token"]})
            assert response.status_code == 200
            assert len(response.headers.get_list("set-cookie")) == 2
            assert await h.revoked(pair) is False
            await h.me(pair, 200)
    asyncio.run(scenario())
