"""Optional authentication is full session authentication, or anonymous.

Real synthetic JWT/login/logout, ORM and ASGI routes; no PG/Redis/network.
Run only via the external no-dotenv isolated runner, not the auth directory.
"""
import asyncio
from datetime import timedelta

import pytest
from fastapi import HTTPException

from app.core import deps
from app.core.config import settings
from app.services import auth as auth_service
from test_logout_revocation_isolated import isolated  # noqa: F401
from test_subject_ambiguity_isolated import alter, request, retoken, wire_probes


async def optional_id(h, expected, *, token=None, cookies=None):
    response = await request(h, "/probe/optional", token=token, cookies=cookies)
    assert response.status_code == 200
    assert response.json() == {"id": expected}


@pytest.mark.parametrize("state", ["disabled", "deleted", "renamed"])
def test_optional_never_adopts_unique_rebound_subject(isolated, state):
    async def run():
        async with isolated() as h:
            wire_probes(h)
            a, b = await h.login("a"), await h.login("b")
            await optional_id(h, 1, token=a["access_token"])
            await optional_id(h, 2, token=b["access_token"])
            await alter(h, 1, full_name="synthetic-b")
            await alter(h, 2, **({"is_active": False} if state == "disabled" else (
                {"is_deleted": True} if state == "deleted" else {"username": "renamed-b"}
            )))
            # The other user's live session exists. Old owner's token is NOT that session.
            await optional_id(h, None, token=b["access_token"])
            await h.me(b, 401)
            await optional_id(h, 1, token=a["access_token"])
            await optional_id(h, None)
    asyncio.run(run())


@pytest.mark.parametrize("credential", ["bearer", "cookie"])
def test_optional_valid_anonymous_logout_nonce_and_relogin(isolated, credential):
    async def run():
        async with isolated() as h:
            wire_probes(h)
            pair = await h.login("a")
            def args(p):
                return ({"token": p["access_token"]} if credential == "bearer" else {
                    "cookies": {settings.ACCESS_TOKEN_COOKIE_NAME: p["access_token"]}
                })
            await optional_id(h, None)
            await optional_id(h, 1, **args(pair))
            await h.logout(token=pair["access_token"], cookies={})
            await optional_id(h, None, **args(pair))
            await h.me(pair, 401)
            fresh = await h.login("a")
            await optional_id(h, 1, **args(fresh))
            await optional_id(h, None, **args(pair))
    asyncio.run(run())


@pytest.mark.parametrize("kind", ["damaged", "expired", "missing_nonce", "wrong_nonce", "cache_missing"])
def test_optional_invalid_session_is_anonymous(isolated, kind):
    async def run():
        async with isolated() as h:
            wire_probes(h)
            pair = await h.login("a")
            token = pair["access_token"]
            if kind == "damaged":
                token = "synthetic-not-a-jwt"
            elif kind == "expired":
                token = auth_service.create_access_token(
                    auth_service.verify_token(token), expires_delta=timedelta(seconds=-1)
                )
            elif kind == "missing_nonce":
                payload = auth_service.verify_token(token)
                payload.pop("sn", None)
                token = auth_service.create_access_token(payload)
            elif kind == "wrong_nonce":
                token = retoken(pair, sn="synthetic-unrelated-nonce")
            else:
                h.cache.data.clear()
            await optional_id(h, None, token=token)
    asyncio.run(run())


@pytest.mark.parametrize("header", ["missing", "damaged", "ambiguous"])
@pytest.mark.parametrize("cookie_live", [True, False])
def test_optional_independent_cookie_fallback_is_also_session_checked(isolated, header, cookie_live):
    async def run():
        async with isolated() as h:
            wire_probes(h)
            a, b = await h.login("a"), await h.login("b")
            token = None if header == "missing" else "synthetic-damaged-header"
            if header == "ambiguous":
                await alter(h, 1, full_name="synthetic-b")
                token = b["access_token"]
            if not cookie_live:
                await h.logout(token=a["access_token"], cookies={})
            await optional_id(h, 1 if cookie_live else None, token=token,
                              cookies={settings.ACCESS_TOKEN_COOKIE_NAME: a["access_token"]})
    asyncio.run(run())


def test_optional_preserves_mandatory_header_priority_and_nonce_failure_rule(isolated):
    async def run():
        async with isolated() as h:
            wire_probes(h)
            a, b = await h.login("a"), await h.login("b")
            cookies = {settings.ACCESS_TOKEN_COOKIE_NAME: a["access_token"]}
            await optional_id(h, 2, token=b["access_token"], cookies=cookies)
            await h.logout(token=b["access_token"], cookies={})
            # Existing mandatory policy only falls back when header identity is unresolvable;
            # a resolvable header with a revoked nonce must not select a different account.
            await optional_id(h, None, token=b["access_token"], cookies=cookies)
            response = await request(h, "/api/v1/auth/me", token=b["access_token"], cookies=cookies)
            assert response.status_code == 401
            await optional_id(h, 1, cookies=cookies)
    asyncio.run(run())


def test_optional_enforces_request_ip_policy(isolated, monkeypatch):
    async def run():
        async with isolated() as h:
            wire_probes(h)
            pair = await h.login("a")  # Login harness IP is synthetic 192.0.2.10.
            await optional_id(h, 1, token=pair["access_token"])
            monkeypatch.setattr(settings, "AUTH_ENFORCE_SAME_IP_PER_REQUEST", True)
            # Probe client has a different IP. Neither verifier nor JWT is mocked.
            await optional_id(h, None, token=pair["access_token"])
    asyncio.run(run())


@pytest.mark.parametrize("status_code", [403, 503])
def test_optional_does_not_hide_non_auth_http_failures(monkeypatch, status_code):
    async def denied(**kwargs):
        raise HTTPException(status_code=status_code, detail="synthetic non-auth failure")
    monkeypatch.setattr(deps, "get_current_user", denied)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(deps.get_current_user_or_none(token="synthetic", db=object()))
    assert exc.value.status_code == status_code
