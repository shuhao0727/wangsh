"""Run only after disabling dotenv/secrets/conftest/plugins and restricting network.

HTTP tests override get_current_user, NOT require_registered_user. They prove role
and account fencing, not JWT/session/DB authentication. Lua tests execute the real
script using fakeredis[lua]; the opt-in local Redis case uses random keys only.
"""

import asyncio
import json
from contextlib import asynccontextmanager
import os
from pathlib import Path
import uuid

import pytest

if os.environ.get("AI_PARTNER_ISOLATED_TESTS") != "1":
    pytest.skip("Requires pre-collection isolated bootstrap", allow_module_level=True)

import fakeredis.aioredis
from fastapi import FastAPI, HTTPException, Request
import httpx
from pydantic import ValidationError
import redis.asyncio as redis
from redis.exceptions import ConnectionError as RedisConnectionError

from app.api.endpoints import ai_partner as api
from app.core import deps
from app.core.config import Settings, settings
from app.db.database import get_db
from app.services import ai_partner_leaderboard as service

PATH = "/api/v1/ai-partner/leaderboard"


def identity(user_id=1, role="student", name="同名同学"):
    return {"X-Test-Id": str(user_id), "X-Test-Role": role, "X-Test-Name": name.encode().hex()}


async def submission(store, round_id, score=50, user_id=1, ai_name="我的伙伴"):
    """Seed trusted Redis evidence, not a client-supplied score."""
    token = uuid.uuid4().hex + uuid.uuid4().hex
    from app.services.ai_partner_evaluation import receipt_key
    await store.set(receipt_key(round_id, token), json.dumps({"round_id": round_id, "user_id": str(user_id), "ai_name": ai_name.strip(), "score": score}), ex=60)
    return {"round_id": round_id, "expected_user_id": user_id, "ai_name": ai_name, "evaluation_id": token}


def check(response, status=200):
    assert response.status_code == status, response.text
    assert response.headers["cache-control"] == "no-store"
    if status == 200:
        body = response.json()
        assert set(body) == {"round_id", "status", "expires_at", "rows"}
        for row in body["rows"]:
            assert set(row) == {"rank", "student_name", "ai_name", "score", "is_me"}
    return response.json()


@asynccontextmanager
async def harness(monkeypatch, *, client=None, duration=3600, real_auth=False):
    round_id = "test-" + uuid.uuid4().hex
    monkeypatch.setattr(settings, "AI_PARTNER_LEADERBOARD_ROUND_ID", round_id)
    monkeypatch.setattr(settings, "AI_PARTNER_LEADERBOARD_DURATION_SECONDS", duration)
    real_storage = os.environ.get("AI_PARTNER_TEST_STORAGE") == "redis"
    if client is not None:
        store = client
    elif real_storage:
        store = redis.Redis(
            host="127.0.0.1", port=int(os.environ["AI_PARTNER_TEST_LOCAL_REDIS_PORT"]),
            db=0, decode_responses=True, socket_connect_timeout=1, socket_timeout=2,
        )
    else:
        store = fakeredis.aioredis.FakeRedis(decode_responses=True)

    async def get_client():
        return store

    monkeypatch.setattr(service.cache, "get_client", get_client)
    app = FastAPI()
    app.include_router(api.router, prefix="/api/v1/ai-partner")

    async def authenticated(request: Request):
        if "X-Test-Id" not in request.headers:
            raise HTTPException(401, "需要登录")
        return {
            "id": int(request.headers["X-Test-Id"]),
            "role_code": request.headers.get("X-Test-Role", "student"),
            "full_name": bytes.fromhex(request.headers.get("X-Test-Name", "")).decode(),
            "username": "sensitive-login-id",
            "student_id": "sensitive-student-id",
        }

    async def no_db():
        yield None

    app.dependency_overrides[get_db] = no_db
    if not real_auth:
        app.dependency_overrides[deps.get_current_user] = authenticated
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as http:
            yield http, store, round_id
    finally:
        if client is None:
            if real_storage:
                # Exact random test keys only; never clear shared keys/patterns.
                await store.delete(*service.round_keys(round_id), *service.round_keys(round_id + "-next"))
            await store.aclose()


def test_waiting_then_highest_score_keeps_winning_work(monkeypatch):
    async def scenario():
        async with harness(monkeypatch) as (http, store, rid):
            first = check(await http.get(PATH, headers=identity()))
            assert first == {"round_id": rid, "status": "waiting", "expires_at": None, "rows": []}
            keys = service.round_keys(rid)
            assert not await store.exists(keys[0], keys[1])
            posted = check(await http.post(PATH, headers=identity(), json=await submission(store, rid, 80, ai_name="高分作品")))
            deadline = await store.get(keys[0])
            assert posted["status"] == "open" and posted["expires_at"]
            for score in [80, 79, 0]:
                result = check(await http.post(PATH, headers=identity(), json=await submission(store, rid, score, ai_name="不能覆盖")))
                assert result == posted
                assert await store.get(keys[0]) == deadline
            improved = check(await http.post(PATH, headers=identity(), json=await submission(store, rid, 100, ai_name="新作品")))
            assert improved["rows"][0]["score"] == 100
            assert improved["rows"][0]["ai_name"] == "新作品"
            assert improved["expires_at"] == posted["expires_at"]
            assert await store.pttl(keys[0]) == -1
            assert 0 < await store.pttl(keys[1]) <= 3600000
    asyncio.run(scenario())


def test_distinct_accounts_same_name_and_competition_ranks(monkeypatch):
    async def scenario():
        async with harness(monkeypatch) as (http, store, rid):
            for uid, score in [(1, 100), (2, 90), (3, 90), (4, 0)]:
                check(await http.post(PATH, headers=identity(uid), json=await submission(store, rid, score, uid)))
            rows = check(await http.get(PATH, headers=identity(3)))["rows"]
            assert [r["rank"] for r in rows] == [1, 2, 2, 4]
            assert [r["score"] for r in rows] == [100, 90, 90, 0]
            assert [r["is_me"] for r in rows] == [False, False, True, False]
            assert {r["student_name"] for r in rows} == {"同名同学"}
    asyncio.run(scenario())


@pytest.mark.parametrize("score", [0, 100])
def test_score_boundaries(monkeypatch, score):
    async def scenario():
        async with harness(monkeypatch) as (http, store, rid):
            body = check(await http.post(PATH, headers=identity(), json=await submission(store, rid, score)))
            assert body["rows"][0]["score"] == score
    asyncio.run(scenario())


@pytest.mark.parametrize("patch", [
    {"score": -1}, {"score": 101}, {"score": True}, {"score": False},
    {"score": 3.0}, {"score": 1.5}, {"score": "50"}, {"score": None},
    {"expected_user_id": 0}, {"expected_user_id": -1}, {"expected_user_id": True},
    {"expected_user_id": 1.0}, {"expected_user_id": "1"},
    {"round_id": ""}, {"round_id": "x" * 129},
    {"ai_name": ""}, {"ai_name": "   "}, {"ai_name": "x" * 81}, {"ai_name": 123},
    {"user_id": 2}, {"student_name": "伪造姓名"}, {"full_name": "伪造姓名"},
    {"student_id": "123456"}, {"role_code": "admin"},
])
def test_strict_validation_and_no_start_on_invalid_input(monkeypatch, patch):
    async def scenario():
        async with harness(monkeypatch) as (http, store, rid):
            payload = {**await submission(store, rid), **patch}
            check(await http.post(PATH, headers=identity(), json=payload), 422)
            assert not await store.exists(*service.round_keys(rid))
    asyncio.run(scenario())


def test_round_and_account_conflicts_never_start_round(monkeypatch):
    async def scenario():
        async with harness(monkeypatch) as (http, store, rid):
            check(await http.post(PATH, headers=identity(), json=await submission(store, "old-round")), 409)
            check(await http.post(PATH, headers=identity(2), json=await submission(store, rid, user_id=1)), 409)
            assert not await store.exists(*service.round_keys(rid))
    asyncio.run(scenario())


@pytest.mark.parametrize("role", ["student", "teacher", "admin", "super_admin"])
def test_registered_roles_can_read_and_participate(monkeypatch, role):
    async def scenario():
        async with harness(monkeypatch) as (http, store, rid):
            check(await http.get(PATH, headers=identity(role=role)))
            check(await http.post(PATH, headers=identity(role=role), json=await submission(store, rid)))
    asyncio.run(scenario())


@pytest.mark.parametrize("method", ["GET", "POST"])
@pytest.mark.parametrize("role", ["guest", "unknown"])
def test_guest_and_unknown_roles_rejected(monkeypatch, method, role):
    async def scenario():
        async with harness(monkeypatch) as (http, store, rid):
            response = await http.request(method, PATH, headers=identity(role=role), **({"json": await submission(store, rid)} if method == "POST" else {}))
            check(response, 403)
            assert not await store.exists(*service.round_keys(rid))
    asyncio.run(scenario())


@pytest.mark.parametrize("method", ["GET", "POST"])
def test_real_auth_dependency_rejects_anonymous_and_query_token(monkeypatch, method):
    async def scenario():
        async with harness(monkeypatch, real_auth=True) as (http, store, rid):
            for suffix in ["", "?token=not-an-access-channel"]:
                response = await http.request(method, PATH + suffix, **({"json": await submission(store, rid)} if method == "POST" else {}))
                check(response, 401)
            assert not await store.exists(*service.round_keys(rid))
    asyncio.run(scenario())


def test_missing_name_fallback_never_exposes_login_ids(monkeypatch):
    async def scenario():
        async with harness(monkeypatch) as (http, store, rid):
            response = await http.post(PATH, headers=identity(name="  "), json=await submission(store, rid, ai_name="  伙伴  "))
            row = check(response)["rows"][0]
            assert row["student_name"] == "课堂参与者" and row["ai_name"] == "伙伴"
            assert "sensitive-" not in response.text and "user_id" not in response.text
    asyncio.run(scenario())


def test_concurrent_first_submission_highest_and_deadline(monkeypatch):
    async def scenario():
        async with harness(monkeypatch) as (http, store, rid):
            scores = [10, 95, 40, 70, 0, 95, 30, 100, 20, 99] * 2
            responses = await asyncio.gather(*[
                http.post(PATH, headers=identity(), json=await submission(store, rid, score, ai_name=f"work-{score}"))
                for score in scores
            ])
            results = [check(response) for response in responses]
            assert len({result["expires_at"] for result in results}) == 1
            result = check(await http.get(PATH, headers=identity()))
            assert len(result["rows"]) == 1
            assert result["rows"][0]["score"] == 100
            assert result["rows"][0]["ai_name"] == "work-100"
            assert await store.hlen(service.round_keys(rid)[1]) == 1
    asyncio.run(scenario())


def test_fixed_expiration_and_old_round_cannot_revive(monkeypatch):
    async def scenario():
        async with harness(monkeypatch, duration=1) as (http, store, rid):
            first = check(await http.post(PATH, headers=identity(), json=await submission(store, rid)))
            keys = service.round_keys(rid)
            deadline = await store.get(keys[0])
            await asyncio.sleep(0.15)
            improved = check(await http.post(PATH, headers=identity(), json=await submission(store, rid, 100)))
            assert improved["expires_at"] == first["expires_at"]
            assert await store.get(keys[0]) == deadline
            await asyncio.sleep(0.95)
            # Redis TTL, not a GET, must remove all account/score/rate data.
            assert not await store.exists(keys[1], keys[2])
            assert await store.get(keys[0]) == deadline
            assert await store.pttl(keys[0]) == -1
            for _ in range(2):
                ended = check(await http.get(PATH, headers=identity()))
                assert ended == {"round_id": rid, "status": "ended", "expires_at": first["expires_at"], "rows": []}
                check(await http.post(PATH, headers=identity(), json=await submission(store, rid, 100)), 410)
            assert not await store.exists(keys[1], keys[2])
            monkeypatch.setattr(settings, "AI_PARTNER_LEADERBOARD_ROUND_ID", rid + "-next")
            assert check(await http.get(PATH, headers=identity()))["status"] == "waiting"
            check(await http.post(PATH, headers=identity(), json=await submission(store, rid, 100)), 409)
            assert check(await http.post(PATH, headers=identity(), json=await submission(store, rid + "-next")))["status"] == "open"
    asyncio.run(scenario())


def test_expired_deadline_wins_even_if_scores_ttl_is_missing(monkeypatch):
    async def scenario():
        async with harness(monkeypatch) as (http, store, rid):
            check(await http.post(PATH, headers=identity(), json=await submission(store, rid)))
            keys = service.round_keys(rid)
            await store.persist(keys[1])
            seconds, micros = await store.time()
            await store.set(keys[0], seconds * 1000 + micros // 1000 - 1)
            responses = await asyncio.gather(
                http.post(PATH, headers=identity(), json=await submission(store, rid, 100)),
                http.get(PATH, headers=identity()),
            )
            check(responses[0], 410)
            assert check(responses[1])["rows"] == []
            assert not await store.exists(keys[1], keys[2])
    asyncio.run(scenario())


@pytest.mark.parametrize("method,limit", [("GET", 120), ("POST", 30)])
def test_per_account_rate_limit(monkeypatch, method, limit):
    async def scenario():
        async with harness(monkeypatch) as (http, store, rid):
            for _ in range(limit):
                check(await http.request(method, PATH, headers=identity(), **({"json": await submission(store, rid)} if method == "POST" else {})))
            response = await http.request(method, PATH, headers=identity(), **({"json": await submission(store, rid)} if method == "POST" else {}))
            check(response, 429)
            assert 1 <= int(response.headers["retry-after"]) <= 60
            check(await http.request(method, PATH, headers=identity(2), **({"json": await submission(store, rid, user_id=2)} if method == "POST" else {})))
    asyncio.run(scenario())


@pytest.mark.parametrize("method", ["GET", "POST"])
@pytest.mark.parametrize("failure", ["connect", "eval", "timeout"])
def test_redis_failures_are_503_not_success(monkeypatch, method, failure):
    async def scenario():
        async with harness(monkeypatch) as (http, store, rid):
            async def fail(*args, **kwargs):
                if failure == "timeout":
                    raise TimeoutError("isolated timeout")
                raise RedisConnectionError("isolated connection failure")
            if failure == "connect":
                monkeypatch.setattr(service.cache, "get_client", fail)
            else:
                monkeypatch.setattr(store, "eval", fail)
            response = await http.request(method, PATH, headers=identity(), **({"json": await submission(store, rid)} if method == "POST" else {}))
            check(response, 503)
            assert not await store.exists(*service.round_keys(rid))
    asyncio.run(scenario())


@pytest.mark.parametrize("method", ["GET", "POST"])
@pytest.mark.parametrize("failure_stage", ["endpoint", "dependency"])
def test_unhandled_errors_use_generic_handler_and_no_store(monkeypatch, method, failure_stage):
    async def scenario():
        async with harness(monkeypatch) as (http, store, rid):
            error = RuntimeError("sensitive-isolated-error-detail")
            handled = []
            original_handler = api.generic_exception_handler

            async def tracked_handler(request, exc):
                handled.append((request.url.path, exc))
                return await original_handler(request, exc)

            async def fail_endpoint(*args, **kwargs):
                raise error

            def fail_dependency(*args, **kwargs):
                raise error

            monkeypatch.setattr(api, "generic_exception_handler", tracked_handler)
            if failure_stage == "endpoint":
                monkeypatch.setattr(api, "get_leaderboard", fail_endpoint)
            else:
                monkeypatch.setattr(deps, "_ensure_registered_user", fail_dependency)
            response = await http.request(
                method, PATH, headers=identity(),
                **({"json": await submission(store, rid)} if method == "POST" else {}),
            )
            assert check(response, 500) == {"detail": "服务器内部错误", "request_id": None}
            assert handled == [(PATH, error)]
            assert str(error) not in response.text
            assert "RuntimeError" not in response.text
    asyncio.run(scenario())


def test_config_defaults_and_invalid_config():
    config = Settings(_env_file=None)
    assert config.AI_PARTNER_LEADERBOARD_ROUND_ID == "classroom"
    assert config.AI_PARTNER_LEADERBOARD_DURATION_SECONDS == 3600
    for values in [
        {"AI_PARTNER_LEADERBOARD_DURATION_SECONDS": 0},
        {"AI_PARTNER_LEADERBOARD_ROUND_ID": " "},
        {"AI_PARTNER_LEADERBOARD_ROUND_ID": "x" * 129},
    ]:
        with pytest.raises(ValidationError):
            Settings(_env_file=None, **values)


def test_router_registered_without_importing_other_features():
    import ast
    source = Path(__file__).resolve().parents[2] / "app" / "api" / "__init__.py"
    tree = ast.parse(source.read_text())
    imports = [node for node in ast.walk(tree) if isinstance(node, ast.ImportFrom)]
    assert any(node.module == "app.api.endpoints.ai_partner" for node in imports)
    assert any(
        isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
        and node.func.attr == "include_router"
        and node.args and isinstance(node.args[0], ast.Name) and node.args[0].id == "ai_partner_router"
        and any(k.arg == "prefix" and isinstance(k.value, ast.Constant) and k.value.value == "/ai-partner" for k in node.keywords)
        for node in ast.walk(tree)
    )


def test_existing_local_redis_opt_in(monkeypatch):
    port = os.environ.get("AI_PARTNER_TEST_LOCAL_REDIS_PORT")
    if not port:
        pytest.skip("Existing local Redis not opted in; fake Lua is not real Redis evidence")

    async def scenario():
        client = redis.Redis(host="127.0.0.1", port=int(port), db=0, decode_responses=True,
                             socket_connect_timeout=1, socket_timeout=2)
        keys = ()
        try:
            await client.ping()
            async with harness(monkeypatch, client=client, duration=1) as (http, store, rid):
                keys = service.round_keys(rid)
                assert not await store.exists(*keys)
                responses = await asyncio.gather(*[
                    http.post(PATH, headers=identity(), json=await submission(store, rid, score))
                    for score in [1, 80, 80, 50, 100, 0]
                ])
                results = [check(response) for response in responses]
                assert len({result["expires_at"] for result in results}) == 1
                assert check(await http.get(PATH, headers=identity()))["rows"][0]["score"] == 100
                deadline = await store.get(keys[0])
                await asyncio.sleep(1.1)
                assert not await store.exists(keys[1], keys[2])
                check(await http.post(PATH, headers=identity(), json=await submission(store, rid)), 410)
                assert check(await http.get(PATH, headers=identity()))["rows"] == []
                assert await store.get(keys[0]) == deadline
        finally:
            # Never SCAN/FLUSHDB/clear patterns: remove only this run's exact keys.
            if keys:
                await client.delete(*keys)
            await client.aclose()
    asyncio.run(scenario())
