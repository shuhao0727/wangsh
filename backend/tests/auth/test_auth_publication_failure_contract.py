"""Author regressions: real ASGI/JWT/SQLite; not PostgreSQL lock proof.

Run through the external no-network/no-dotenv harness. Fault tests deliberately
record surviving credentials: 503 is a failure contract, not durable revocation.
"""
import asyncio
import json
from contextlib import asynccontextmanager
from http.cookies import SimpleCookie

import pytest

from app.api.endpoints.auth import auth as api
from app.core.config import settings
from app.core.session_guard import get_user_session
from test_logout_revocation_isolated import isolated as base_isolated  # noqa: F401


@pytest.fixture
def isolated(base_isolated, monkeypatch):
    @asynccontextmanager
    async def context():
        async with base_isolated() as h:
            class ReadClient:
                async def get(self, key):
                    if h.cache.fail_read:
                        raise RuntimeError("synthetic Redis GET ACL denied")
                    value = h.cache.data.get(key)
                    return json.dumps(value) if value is not None else None

            async def get_client():
                return ReadClient()

            monkeypatch.setattr(h.cache, "get_client", get_client)
            yield h
    return context


@pytest.mark.parametrize("pg_fail,redis_fail", [(False, False), (False, True), (True, False), (True, True)])
@pytest.mark.parametrize("legacy", [False, True])
def test_logout_failure_is_explicit_and_cookies_are_cleared(isolated, pg_fail, redis_fail, legacy):
    async def run():
        async with isolated() as h:
            pair = await h.legacy_login() if legacy else await h.login()
            h.fail_commit = pg_fail
            h.cache.fail_write = "false" if redis_fail else None
            response = await h.request("POST", "/logout", token=pair["access_token"])
            assert response.status_code == (503 if pg_fail else 200)
            if pg_fail:
                assert response.json()["revocation_status"] == "incomplete"
                assert response.json()["message"] != "登出成功"
            cleared = SimpleCookie()
            for value in response.headers.get_list("set-cookie"):
                cleared.load(value)
            for name in (settings.ACCESS_TOKEN_COOKIE_NAME, settings.REFRESH_TOKEN_COOKIE_NAME):
                assert cleared[name].value == ""
                assert cleared[name]["max-age"] == "0"
            h.fail_commit = False
            h.cache.fail_write = None
            assert await h.revoked(pair) is (not pg_fail)
            await h.me(pair, 200 if pg_fail else 401)
            # Failed durable commit leaves credentials alive; cache failure alone does not.
            await h.refresh(pair, 200 if pg_fail else 401)
    asyncio.run(run())


def test_login_failed_commit_preserves_existing_nonce_and_refresh(isolated):
    async def run():
        async with isolated() as h:
            pair = await h.login()
            old_session = await get_user_session(1)
            h.fail_commit = True
            with pytest.raises(RuntimeError, match="commit failure"):
                await h.request("POST", "/login", data={"username": "Synthetic a", "password": "ID-a"})
            h.fail_commit = False
            assert await get_user_session(1) == old_session
            assert await h.revoked(pair) is False
            await h.me(pair, 200)
            await h.refresh(pair, 200)
    asyncio.run(run())


def test_new_login_in_commit_publish_gap_cannot_be_overwritten(isolated, monkeypatch):
    async def run():
        async with isolated() as h:
            original = api._publish_committed_login
            winner = {}

            async def insert_new_login(db, uid, rt, request):
                monkeypatch.setattr(api, "_publish_committed_login", original)
                winner.update(await h.login())
                return await original(db, uid, rt, request)

            monkeypatch.setattr(api, "_publish_committed_login", insert_new_login)
            response = await h.request("POST", "/login", data={"username": "Synthetic a", "password": "ID-a"})
            assert response.status_code == 409
            assert not response.headers.get_list("set-cookie")
            await h.me(winner, 200)
            await h.refresh(winner, 200)
    asyncio.run(run())


@pytest.mark.parametrize("authority", ["revoked_family_access", "legacy_access", "committed_refresh"])
def test_logout_in_commit_publish_gap_requires_live_authority(isolated, monkeypatch, authority):
    async def run():
        async with isolated() as h:
            old = await h.legacy_login() if authority == "legacy_access" else await h.login()
            original = api._publish_committed_login

            async def insert_logout(db, uid, rt, request):
                cookies = {settings.REFRESH_TOKEN_COOKIE_NAME: rt} if authority == "committed_refresh" else None
                response = await h.request("POST", "/logout", token=old["access_token"], cookies=cookies)
                assert response.status_code == 200
                assert await h.revoked({"refresh_token": rt}) is (authority == "committed_refresh")
                return await original(db, uid, rt, request)

            monkeypatch.setattr(api, "_publish_committed_login", insert_logout)
            response = await h.request("POST", "/login", data={"username": "Synthetic a", "password": "ID-a"})
            if authority != "committed_refresh":
                # Old family was already revoked by the new login commit and
                # cannot revoke the newer issuance merely via a stale Redis nonce.
                assert response.status_code == 200
                await h.me(response.json(), 200)
            else:
                assert response.status_code == 409
                assert not response.headers.get_list("set-cookie")
            await h.me(old, 401)
            await h.refresh(old, 401)
    asyncio.run(run())


def test_successful_relogin_replaces_both_credentials(isolated):
    async def run():
        async with isolated() as h:
            old = await h.login()
            new = await h.login()
            await h.me(old, 401)
            await h.refresh(old, 401)
            await h.me(new, 200)
            await h.refresh(new, 200)
    asyncio.run(run())


@pytest.mark.parametrize("legacy", [False, True])
def test_postcommit_redis_failure_does_not_restore_revoked_refresh(isolated, legacy):
    async def run():
        async with isolated() as h:
            old = await h.legacy_login() if legacy else await h.login()
            h.cache.fail_write = "false"
            with pytest.raises(RuntimeError, match="服务端会话"):
                await h.request("POST", "/login", data={"username": "Synthetic a", "password": "ID-a"})
            h.cache.fail_write = None
            assert await h.revoked(old) is True
            # Durable nonce rejects legacy access even if Redis publication fails.
            await h.me(old, 401)
            await h.refresh(old, 401)
    asyncio.run(run())


def test_committed_unpublished_family_can_recover_but_original_publisher_is_fenced(isolated, monkeypatch):
    async def run():
        async with isolated() as h:
            await h.login()
            original = api._publish_committed_login
            winner = {}

            async def insert_refresh(db, uid, rt, request):
                # The wrapper is one-shot: the refresh's own publish must be real.
                monkeypatch.setattr(api, "_publish_committed_login", original)
                result = await h.request("POST", "/refresh", json={"refresh_token": rt})
                assert result.status_code == 200
                assert await h.revoked({"refresh_token": rt}) is True
                winner.update(result.json())
                return await original(db, uid, rt, request)

            monkeypatch.setattr(api, "_publish_committed_login", insert_refresh)
            response = await h.request("POST", "/login", data={"username": "Synthetic a", "password": "ID-a"})
            assert response.status_code == 409
            assert not response.headers.get_list("set-cookie")
            await h.me(winner, 200)
            await h.refresh(winner, 200)
    asyncio.run(run())


def test_logout_bearer_only_read_outage_is_503_not_success(isolated):
    async def run():
        async with isolated() as h:
            pair = await h.login()
            h.cache.fail_read = True
            response = await h.request("POST", "/logout", token=pair["access_token"])
            assert response.status_code == 503
            assert response.json()["revocation_status"] == "incomplete"
            assert len(response.headers.get_list("set-cookie")) == 2
            h.cache.fail_read = False
            assert await h.revoked(pair) is False
            await h.me(pair, 200)
    asyncio.run(run())


def test_logout_read_outage_preserves_independent_refresh_fallback(isolated):
    async def run():
        async with isolated() as h:
            pair = await h.login()
            h.cache.fail_read = True
            response = await h.request("POST", "/logout", token=pair["access_token"], cookies={
                settings.REFRESH_TOKEN_COOKIE_NAME: pair["refresh_token"],
            })
            assert response.status_code == 200
            assert len(response.headers.get_list("set-cookie")) == 2
            h.cache.fail_read = False
            assert await h.revoked(pair) is True
            await h.me(pair, 401)
            await h.refresh(pair, 401)
    asyncio.run(run())


@pytest.mark.parametrize("stored", [None, {}, {"nonce": "mismatch"}])
def test_missing_or_wrong_nonce_cannot_authorize_logout(isolated, stored):
    async def run():
        async with isolated() as h:
            pair = await h.login()
            h.cache.data["auth:session:uid:1"] = stored
            response = await h.request("POST", "/logout", token=pair["access_token"])
            assert response.status_code == 200  # No authenticated current session.
            assert await h.revoked(pair) is False
            assert h.cache.data["auth:session:uid:1"] == stored
    asyncio.run(run())


@pytest.mark.parametrize("raw", [b"not-json", b"[]", b"null"])
def test_corrupt_session_read_cannot_report_success(isolated, monkeypatch, raw):
    async def run():
        async with isolated() as h:
            pair = await h.login()

            class CorruptClient:
                async def get(self, key):
                    return raw

            async def client():
                return CorruptClient()

            monkeypatch.setattr(h.cache, "get_client", client)
            response = await h.request("POST", "/logout", token=pair["access_token"])
            assert response.status_code == 503
            assert await h.revoked(pair) is False
    asyncio.run(run())
