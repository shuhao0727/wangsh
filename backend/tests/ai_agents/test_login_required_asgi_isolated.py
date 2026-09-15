"""Real ASGI admission contract for the user-facing AI agent routes.

Uses the shared auth/JWT/SQLite harness. Business services are controlled doubles so
this test proves authentication is resolved before agent listing, history access,
configuration reads, or provider streaming starts.
"""
import asyncio
import importlib.util
from pathlib import Path

import httpx

from app.api.endpoints.agents.ai_agents import router as ai_agents_router
from app.api.endpoints.agents.ai_agents import conversations, crud, group_discussion
from app.services.agents import chat_stream

_spec = importlib.util.spec_from_file_location(
    "ai_login_required_fixture",
    Path(__file__).parents[1] / "auth/test_logout_revocation_isolated.py",
)
_fixture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_fixture)
isolated = _fixture.isolated


ROUTES = (
    ("GET", "/api/v1/ai-agents/active", None),
    ("GET", "/api/v1/ai-agents/conversations", None),
    ("POST", "/api/v1/ai-agents/stream", {"agent_id": 1, "message": "hello"}),
    ("GET", "/api/v1/ai-agents/group-discussion/public-config", None),
    ("GET", "/api/v1/ai-agents/group-discussion/public-config/stream", None),
)


def test_anonymous_requests_stop_before_ai_business_services(isolated, monkeypatch):
    async def run():
        async with isolated() as h:
            h.app.include_router(ai_agents_router, prefix="/api/v1/ai-agents")
            calls = []

            async def active(*args, **kwargs):
                calls.append("active")
                return []

            async def history(*args, **kwargs):
                calls.append("history")
                return []

            async def public_config(*args, **kwargs):
                calls.append("public_config")
                return True

            async def provider(*args, **kwargs):
                calls.append("provider")
                yield "data: should-not-run\n\n"

            monkeypatch.setattr(crud, "get_active_agents", active)
            monkeypatch.setattr(conversations, "list_user_conversations", history)
            monkeypatch.setattr(
                group_discussion.GroupDiscussionPublicConfigService,
                "get_enabled",
                public_config,
            )
            monkeypatch.setattr(chat_stream, "stream_agent_chat", provider)

            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=h.app, client=("192.0.2.10", 12345)),
                base_url="http://isolated.invalid",
            ) as client:
                for method, path, body in ROUTES:
                    response = await client.request(method, path, json=body)
                    assert response.status_code == 401, (method, path, response.text)

            assert calls == []

    asyncio.run(run())


def test_registered_user_can_use_core_ai_routes(isolated, monkeypatch):
    async def run():
        async with isolated() as h:
            h.app.include_router(ai_agents_router, prefix="/api/v1/ai-agents")
            calls = []

            async def active(*args, **kwargs):
                calls.append("active")
                return []

            async def history(*args, **kwargs):
                calls.append("history")
                return []

            async def public_config(*args, **kwargs):
                calls.append("public_config")
                return True

            async def provider(*args, **kwargs):
                calls.append("provider")
                yield "data: authenticated\n\n"

            monkeypatch.setattr(crud, "get_active_agents", active)
            monkeypatch.setattr(conversations, "list_user_conversations", history)
            monkeypatch.setattr(
                group_discussion.GroupDiscussionPublicConfigService,
                "get_enabled",
                public_config,
            )
            monkeypatch.setattr(chat_stream, "stream_agent_chat", provider)

            pair = await h.login()
            headers = {"Authorization": f"Bearer {pair['access_token']}"}
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=h.app, client=("192.0.2.10", 12345)),
                base_url="http://isolated.invalid",
                headers=headers,
            ) as client:
                active_response = await client.get("/api/v1/ai-agents/active")
                history_response = await client.get("/api/v1/ai-agents/conversations")
                config_response = await client.get(
                    "/api/v1/ai-agents/group-discussion/public-config"
                )
                stream_response = await client.post(
                    "/api/v1/ai-agents/stream",
                    json={"agent_id": 1, "message": "hello"},
                )

            assert active_response.status_code == 200
            assert active_response.json() == []
            assert history_response.status_code == 200
            assert history_response.json() == []
            assert config_response.status_code == 200
            assert config_response.json()["enabled"] is True
            assert stream_response.status_code == 200
            assert "authenticated" in stream_response.text
            assert calls == ["active", "history", "public_config", "provider"]

    asyncio.run(run())
