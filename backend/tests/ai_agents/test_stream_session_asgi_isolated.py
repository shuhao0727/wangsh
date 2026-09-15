"""Actual AI SSE ASGI routes + auth/JWT/SQLite/family checks, no network/provider.

Shared auth fixture supplies only synthetic storage. No auth dependency or stream
checker is overridden. Providers/pubsub are controllable test doubles; this is
not TCP/browser, PostgreSQL locking, or real Redis evidence.
"""
import asyncio
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import update

from app.api.endpoints.agents.ai_agents import analysis_streams, stream, group_discussion
from app.core import deps, stream_session, session_family
from app.core.config import settings
from app.models import User, RefreshToken, AIAgent
from app.services.agents import chat_stream

_spec = importlib.util.spec_from_file_location(
    "ai_sse_auth_fixture", Path(__file__).parents[1] / "auth/test_logout_revocation_isolated.py")
_fixture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_fixture)
isolated = _fixture.isolated

CASES = [
    (analysis_streams, "/analysis/hot-questions/stream", "POST", "admin"),
    (analysis_streams, "/analysis/student-chains/stream", "POST", "admin"),
    (analysis_streams, "/analysis/task-analyses/stream", "POST", "admin"),
    (stream, "/stream", "POST", "student"),
    (group_discussion, "/group-discussion/stream", "GET", "student"),
]
IDS = ["hot", "chains", "task", "chat", "discussion"]


class Wire:
    """Drive real ASGI receive/send without buffering an endless SSE response."""
    def __init__(self, app, path, method, token=None, query=b"", cookie=False):
        self.messages = []
        self.incoming = asyncio.Queue()
        self.frame = asyncio.Event()
        body = json.dumps({"agent_id": 1, "task_sheet": "synthetic", "message": "hello"}).encode()
        headers = [(b"content-type", b"application/json")]
        if token:
            if cookie:
                headers.append((b"cookie", (settings.ACCESS_TOKEN_COOKIE_NAME + "=" + token).encode()))
            else:
                headers.append((b"authorization", ("Bearer " + token).encode()))
        self.scope = dict(type="http", asgi={"version": "3.0", "spec_version": "2.3"},
                          http_version="1.1", method=method, scheme="http", path=path,
                          raw_path=path.encode(), query_string=query, root_path="", headers=headers,
                          client=("192.0.2.10", 12345), server=("isolated.invalid", 80))
        self.incoming.put_nowait(dict(type="http.request", body=body, more_body=False))
        self.task = asyncio.create_task(app(self.scope, self.incoming.get, self.send))

    async def send(self, message):
        self.messages.append(message)
        if message.get("body"):
            self.frame.set()

    @property
    def status(self):
        return next(m["status"] for m in self.messages if m["type"] == "http.response.start")

    async def close(self):
        if not self.task.done():
            self.incoming.put_nowait({"type": "http.disconnect"})
        try:
            await asyncio.wait_for(self.task, 2)
        finally:
            if not self.task.done():
                self.task.cancel()
            await asyncio.gather(self.task, return_exceptions=True)


async def setup(h, monkeypatch, case):
    module, path, method, role = case
    async with h.db_factory() as db:
        await db.execute(update(User).where(User.id == 1).values(role_code=role))
        await db.commit()
    pair = await h.login()
    h.app.include_router(module.router)
    monkeypatch.setattr(stream_session, "CHECK_INTERVAL_SECONDS", 0.01)
    # Only the task generator's agent lookup is synthetic; auth ORM queries are real.
    class DBProxy:
        def __init__(self, db):
            self.db = db
        def __getattr__(self, name):
            return getattr(self.db, name)
        async def execute(self, statement, *args, **kwargs):
            if any(c.get("entity") is AIAgent for c in getattr(statement, "column_descriptions", [])):
                return SimpleNamespace(scalar_one_or_none=lambda: None)
            return await self.db.execute(statement, *args, **kwargs)
    async def db_dependency():
        async with h.db_factory() as db:
            yield DBProxy(db)
    h.app.dependency_overrides[deps.get_db] = db_dependency
    state = SimpleNamespace(entered=asyncio.Event(), released=asyncio.Event(), cleaned=asyncio.Event())
    async def blocked_prompt(*args, **kwargs):
        state.entered.set()
        try:
            await state.released.wait()
            return "synthetic"
        finally:
            state.cleaned.set()
    async def chat(*args, **kwargs):
        try:
            yield "data: before\n\n"
            state.entered.set()
            await state.released.wait()
            yield "data: private_after_revocation\n\n"
        finally:
            state.cleaned.set()
    async def task_analysis(*args, **kwargs):
        try:
            yield {"event": "progress", "message": "before"}
            state.entered.set()
            await state.released.wait()
            yield {"event": "progress", "message": "private_after_revocation"}
        finally:
            state.cleaned.set()
    monkeypatch.setattr(analysis_streams, "_resolve_prompt_text", blocked_prompt)
    monkeypatch.setattr(analysis_streams, "stream_task_sheet_analysis", task_analysis)
    monkeypatch.setattr(chat_stream, "stream_agent_chat", chat)
    async def allow(*args, **kwargs):
        pass
    monkeypatch.setattr(group_discussion, "_enforce_frontend_visibility", allow)
    monkeypatch.setattr(group_discussion, "ensure_session_view_access", allow)
    monkeypatch.setattr(settings, "GROUP_DISCUSSION_REDIS_ENABLED", True)
    class PubSub:
        first = True
        async def subscribe(self, *args):
            pass
        async def get_message(self, **kwargs):
            if self.first:
                self.first = False
                return None
            state.entered.set()
            await state.released.wait()
            return {"data": "synthetic"}
        async def unsubscribe(self, *args):
            state.cleaned.set()
        async def close(self):
            state.cleaned.set()
    async def client():
        return SimpleNamespace(pubsub=PubSub)
    monkeypatch.setattr(group_discussion, "cache", SimpleNamespace(get_client=client))
    return pair, state


@pytest.mark.parametrize("case", CASES, ids=IDS)
@pytest.mark.parametrize("ending", ["logout", "family_revoke", "family_db_failure", "disconnect"])
def test_asgi_admission_idle_revocation_and_cleanup(isolated, monkeypatch, case, ending):
    async def run():
        async with isolated() as h:
            pair, state = await setup(h, monkeypatch, case)
            _, path, method, _ = case
            wire = Wire(h.app, path, method, pair["access_token"], b"session_id=1")
            try:
                await asyncio.wait_for(wire.frame.wait(), 2)
                await asyncio.wait_for(state.entered.wait(), 2)
                assert wire.status == 200
                # Real get_current_user must remember the accepted effective credential.
                assert bool(wire.scope.get("state", {}).get("accepted_stream_session"))
                if ending == "logout":
                    await h.logout(pair)
                elif ending == "family_revoke":
                    async with h.db_factory() as db:
                        await db.execute(update(RefreshToken).where(RefreshToken.user_id == 1).values(is_revoked=True))
                        await db.commit()
                elif ending == "family_db_failure":
                    async def unavailable(*args, **kwargs):
                        raise RuntimeError("synthetic family database unavailable")
                    monkeypatch.setattr(session_family, "family_is_active", unavailable)
                else:
                    wire.incoming.put_nowait({"type": "http.disconnect"})
                # Idle source remains held: the guard, not another business event, must stop it.
                await asyncio.wait_for(asyncio.shield(wire.task), 1)
                assert state.cleaned.is_set()
                assert not any(b"private_after_revocation" in m.get("body", b"") for m in wire.messages)
            finally:
                await wire.close()
    asyncio.run(run())


@pytest.mark.parametrize("case", CASES, ids=IDS)
@pytest.mark.parametrize("credential", ["missing", "query", "cookie", "bad_bearer_cookie"])
def test_asgi_credential_transport_scope(isolated, monkeypatch, case, credential):
    async def run():
        async with isolated() as h:
            pair, state = await setup(h, monkeypatch, case)
            _, path, method, _ = case
            query = b"session_id=1"
            if credential == "query":
                query += b"&token=" + pair["access_token"].encode()
            use_cookie = credential in ("cookie", "bad_bearer_cookie")
            wire = Wire(h.app, path, method, pair["access_token"] if use_cookie else None, query, cookie=use_cookie)
            # Task does not run until the next await; set conflicting header before dispatch.
            if credential == "bad_bearer_cookie":
                wire.scope["headers"].append((b"authorization", b"Bearer invalid.synthetic"))
            allowed = use_cookie or (credential == "query" and method == "GET")
            try:
                await asyncio.wait_for(wire.frame.wait(), 2)
                assert wire.status == (200 if allowed else 401)
                if allowed:
                    accepted = wire.scope["state"]["accepted_stream_session"]
                    assert accepted[0] == 1
                    assert bool(accepted[1] == pair["access_token"])
                else:
                    assert not state.entered.is_set()
            finally:
                await wire.close()
    asyncio.run(run())


@pytest.mark.parametrize("case", CASES[:3], ids=IDS[:3])
def test_analysis_still_rejects_student(isolated, monkeypatch, case):
    async def run():
        async with isolated() as h:
            pair, _ = await setup(h, monkeypatch, case)
            async with h.db_factory() as db:
                await db.execute(update(User).where(User.id == 1).values(role_code="student"))
                await db.commit()
            wire = Wire(h.app, case[1], "POST", pair["access_token"])
            try:
                await asyncio.wait_for(wire.task, 2)
                assert wire.status == 403
            finally:
                await wire.close()
    asyncio.run(run())


def test_public_config_stream_requires_login_and_accepts_registered_user(isolated, monkeypatch):
    async def run():
        async with isolated() as h:
            h.app.include_router(group_discussion.router)

            async def enabled(db):
                return True

            monkeypatch.setattr(group_discussion.GroupDiscussionPublicConfigService, "get_enabled", enabled)
            monkeypatch.setattr(settings, "GROUP_DISCUSSION_REDIS_ENABLED", False)
            monkeypatch.setattr(stream_session, "CHECK_INTERVAL_SECONDS", 0.01)

            anonymous = Wire(h.app, "/group-discussion/public-config/stream", "GET")
            try:
                await asyncio.wait_for(anonymous.frame.wait(), 2)
                assert anonymous.status == 401
                assert not anonymous.scope.get("state", {}).get("accepted_stream_session")
                assert not any(b'"enabled": true' in m.get("body", b"") for m in anonymous.messages)
            finally:
                await anonymous.close()

            pair = await h.login()
            authenticated = Wire(
                h.app,
                "/group-discussion/public-config/stream",
                "GET",
                pair["access_token"],
            )
            try:
                await asyncio.wait_for(authenticated.frame.wait(), 2)
                assert authenticated.status == 200
                assert authenticated.scope["state"]["accepted_stream_session"][0] == 1
                assert any(b'"enabled": true' in m.get("body", b"") for m in authenticated.messages)
                await h.logout(pair)
                await asyncio.wait_for(asyncio.shield(authenticated.task), 1)
            finally:
                await authenticated.close()
    asyncio.run(run())
