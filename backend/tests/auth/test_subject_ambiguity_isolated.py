"""Legacy subject containment, not immutable-identity migration.

Use the external no-dotenv/no-network runner and explicit test allowlist.
Real JWT, ORM, auth router and dependencies; synthetic SQLite/cache only.
"""
import asyncio
from datetime import timedelta

import pytest
from fastapi import Depends
from httpx import ASGITransport, AsyncClient

from app.core import deps
from app.core.config import settings
from app.models import User
from app.services import auth as auth_service
from test_logout_revocation_isolated import isolated  # noqa: F401


async def alter(h, uid, **fields):
    async with h.db_factory() as db:
        user = await db.get(User, uid)
        for key, value in fields.items():
            setattr(user, key, value)
        await db.commit()


async def resolve(h, token):
    async with h.db_factory() as db:
        return await auth_service.get_current_user(token, db)


def retoken(pair, **claims):
    payload = auth_service.verify_token(pair["access_token"])
    payload.update(claims)
    return auth_service.create_access_token(payload)


def wire_probes(h):
    # Only the test app mounts these routes; actual production dependency bodies.
    @h.app.get("/probe/optional")
    async def optional(user=Depends(deps.get_current_user_or_none)):
        return {"id": user["id"] if user else None}

    @h.app.get("/probe/sse")
    async def sse(user=Depends(deps.get_current_user_sse)):
        return {"id": user["id"]}


async def request(h, path, *, token=None, cookies=None, **kwargs):
    async with AsyncClient(
        transport=ASGITransport(app=h.app, raise_app_exceptions=False),
        base_url="http://isolated.invalid", cookies=cookies,
        headers={"Authorization": f"Bearer {token}"} if token else {},
    ) as client:
        return await client.get(path, **kwargs)


@pytest.mark.parametrize("owner_field,collider_field", [
    ("username", "full_name"), ("username", "student_id"),
    ("student_id", "username"), ("student_id", "full_name"),
    ("full_name", "username"), ("full_name", "student_id"),
    ("full_name", "full_name"),
])
def test_all_legal_cross_field_collisions_reject_and_restore(isolated, owner_field, collider_field):
    async def run():
        async with isolated() as h:
            pair = await h.login("b")
            subject = "synthetic-shared-subject"
            await alter(h, 2, **{owner_field: subject})
            # full_name subjects are synthetic legacy compatibility shapes, not a claimed issuer.
            token = retoken(pair, sub=subject)
            assert (await resolve(h, token))["id"] == 2
            await alter(h, 1, **{collider_field: subject})
            assert await resolve(h, token) is None
            response = await request(h, "/api/v1/auth/me", token=token)
            assert response.status_code == 401
            await alter(h, 1, **{collider_field: "restored-collider"})
            assert (await resolve(h, token))["id"] == 2
            assert (await request(h, "/api/v1/auth/me", token=token)).status_code == 200
    asyncio.run(run())


@pytest.mark.parametrize("entry", ["bearer", "cookie", "sse", "optional"])
def test_real_entrypoints_reject_ambiguous_subject_without_500(isolated, entry):
    async def run():
        async with isolated() as h:
            wire_probes(h)
            pair = await h.login("b")
            await alter(h, 1, full_name="synthetic-b")
            token = pair["access_token"]
            if entry == "cookie":
                response = await request(h, "/api/v1/auth/me", cookies={settings.ACCESS_TOKEN_COOKIE_NAME: token})
            elif entry == "sse":
                response = await request(h, "/probe/sse", params={"token": token})
            else:
                response = await request(h, "/probe/optional" if entry == "optional" else "/api/v1/auth/me", token=token)
            assert response.status_code == (200 if entry == "optional" else 401)
            if entry == "optional":
                assert response.json() == {"id": None}
    asyncio.run(run())


@pytest.mark.parametrize("cookie_state", ["valid", "ambiguous", "expired", "wrong-nonce"])
@pytest.mark.parametrize("entry", ["http", "sse"])
def test_ambiguous_header_falls_back_only_to_independent_valid_cookie(isolated, cookie_state, entry):
    async def run():
        async with isolated() as h:
            wire_probes(h)
            a, b = await h.login("a"), await h.login("b")
            await alter(h, 1, full_name="synthetic-b")
            cookie = a["access_token"]
            if cookie_state == "ambiguous":
                cookie = b["access_token"]
            elif cookie_state == "expired":
                cookie = auth_service.create_access_token(
                    auth_service.verify_token(cookie), expires_delta=timedelta(seconds=-10),
                )
            elif cookie_state == "wrong-nonce":
                cookie = retoken(a, sn="wrong-nonce")
            response = await request(
                h, "/api/v1/auth/me" if entry == "http" else "/probe/sse",
                token=b["access_token"], cookies={settings.ACCESS_TOKEN_COOKIE_NAME: cookie},
            )
            assert response.status_code == (200 if cookie_state == "valid" else 401)
            if cookie_state == "valid":
                assert response.json()["id"] == 1
    asyncio.run(run())


@pytest.mark.parametrize("refresh_owner", ["a", "b", None])
def test_logout_ambiguous_access_does_not_skip_independent_refresh(isolated, refresh_owner):
    async def run():
        async with isolated() as h:
            a, b = await h.login("a"), await h.login("b")
            await alter(h, 1, full_name="synthetic-b")
            pairs = {"a": a, "b": b}
            cookies = ({settings.REFRESH_TOKEN_COOKIE_NAME: pairs[refresh_owner]["refresh_token"]}
                       if refresh_owner else {})
            await h.logout(token=b["access_token"], cookies=cookies)
            for owner, pair in pairs.items():
                assert await h.revoked(pair) is (owner == refresh_owner)
            # Remove collision to distinguish ambiguity denial from actual nonce revocation.
            await alter(h, 1, full_name="Synthetic a")
            for owner, pair in pairs.items():
                await h.me(pair, 401 if owner == refresh_owner else 200)
    asyncio.run(run())


@pytest.mark.parametrize("subject", [None, "", 2, True, ["synthetic-b"], {"name": "synthetic-b"}])
def test_malformed_subject_never_reaches_database_or_claim_fallback(isolated, subject):
    async def run():
        async with isolated() as h:
            pair = await h.login("b")
            token = retoken(pair, sub=subject)
            assert await resolve(h, token) is None
            assert await auth_service.get_current_user(token) is None
            assert (await request(h, "/api/v1/auth/me", token=token)).status_code == 401
            await h.logout(token=token, cookies={settings.REFRESH_TOKEN_COOKIE_NAME: pair["refresh_token"]})
            assert await h.revoked(pair) is True
    asyncio.run(run())


@pytest.mark.parametrize("state", ["disabled", "deleted", "renamed"])
def test_no_database_identity_does_not_fabricate_id_zero(isolated, state):
    async def run():
        async with isolated() as h:
            wire_probes(h)
            pair = await h.login("b")
            fields = {"is_active": False} if state == "disabled" else (
                {"is_deleted": True} if state == "deleted" else {"username": "renamed-b"}
            )
            await alter(h, 2, **fields)
            assert await resolve(h, pair["access_token"]) is None
            response = await request(h, "/probe/optional", token=pair["access_token"])
            assert response.status_code == 200 and response.json() == {"id": None}
            await h.me(pair, 401)
    asyncio.run(run())


@pytest.mark.parametrize("state", ["disabled", "deleted"])
def test_unavailable_collider_not_an_active_identity_for_any_resolver(isolated, state):
    async def run():
        async with isolated() as h:
            pair = await h.login("b")
            await alter(h, 1, full_name="synthetic-b", **(
                {"is_active": False} if state == "disabled" else {"is_deleted": True}
            ))
            assert (await resolve(h, pair["access_token"]))["id"] == 2
            await h.me(pair, 200)
            # No refresh: logout access parsing must use the same live-candidate set.
            await h.logout(token=pair["access_token"], cookies={})
            assert await h.revoked(pair) is True
            await h.me(pair, 401)
    asyncio.run(run())


def test_one_row_matching_multiple_fields_is_not_ambiguous(isolated):
    async def run():
        async with isolated() as h:
            pair = await h.login("b")
            await alter(h, 2, full_name="synthetic-b", student_id="synthetic-b")
            assert (await resolve(h, pair["access_token"]))["id"] == 2
            await h.me(pair, 200)
            await h.logout(token=pair["access_token"], cookies={})
            assert await h.revoked(pair) is True
    asyncio.run(run())


@pytest.mark.parametrize("state", ["disabled", "deleted", "renamed"])
def test_optional_rejects_rebinding_while_raw_lookup_remains_unbound(isolated, state):
    """Optional session boundary must reject; raw lookup still lacks owner binding."""
    async def run():
        async with isolated() as h:
            wire_probes(h)
            a, b = await h.login("a"), await h.login("b")
            await alter(h, 1, full_name="synthetic-b")
            await alter(h, 2, **({"is_active": False} if state == "disabled" else (
                {"is_deleted": True} if state == "deleted" else {"username": "renamed-b"}
            )))
            assert (await resolve(h, b["access_token"]))["id"] == 1
            response = await request(h, "/probe/optional", token=b["access_token"])
            assert response.status_code == 200 and response.json() == {"id": None}
            await h.me(b, 401)  # Mandatory nonce validation still prevents this access.
            await h.logout(token=b["access_token"], cookies={})
            assert await h.revoked(a) is False
            await h.me(a, 200)
    asyncio.run(run())


def test_residual_refresh_can_still_issue_ambiguous_legacy_subject(isolated):
    """ID-bound refresh still issues mutable subject: policy/migration not changed."""
    async def run():
        async with isolated() as h:
            pair = await h.login("b")
            await alter(h, 1, full_name="synthetic-b")
            fresh = await h.refresh(pair, 200)
            assert await h.revoked(pair) is True
            assert auth_service.verify_token(fresh["access_token"])["sub"] == "synthetic-b"
            assert await resolve(h, fresh["access_token"]) is None
            await h.me(fresh, 401)
    asyncio.run(run())
