import asyncio
import inspect
from types import SimpleNamespace

from fastapi.params import Depends

import app.core.deps as deps
import app.api.endpoints.agents.ai_agents.crud as crud_api
import app.api.endpoints.agents.ai_agents.usage as usage_api
import app.api.endpoints.agents.ai_agents.conversations as conversations_api
import app.api.endpoints.agents.ai_agents.group_discussion as group_discussion_api
import app.api.endpoints.agents.ai_agents.stream as stream_api
import app.api.endpoints.agents.model_discovery as model_discovery_api


def _assert_depends_on(func, parameter_name, dependency):
    sig = inspect.signature(func)
    default = sig.parameters[parameter_name].default
    assert isinstance(default, Depends)
    assert default.dependency is dependency


def test_usage_routes_require_admin():
    _assert_depends_on(usage_api.read_agent_usage, "_", deps.require_admin)
    _assert_depends_on(usage_api.read_agent_usage_statistics, "_", deps.require_admin)


def test_usage_create_requires_login():
    _assert_depends_on(usage_api.create_usage_record, "current_user", deps.require_registered_user)


def test_model_discovery_discover_routes_require_admin():
    _assert_depends_on(model_discovery_api.discover_models, "_", deps.require_admin)
    _assert_depends_on(model_discovery_api.discover_models_by_agent, "_", deps.require_admin)


def test_model_discovery_preset_models_requires_admin():
    _assert_depends_on(model_discovery_api.get_preset_models, "_user", deps.require_admin)


def test_model_discovery_detect_provider_requires_admin():
    _assert_depends_on(model_discovery_api.detect_provider_from_endpoint, "_user", deps.require_admin)


def test_model_discovery_supported_providers_requires_admin():
    _assert_depends_on(model_discovery_api.get_supported_providers, "_user", deps.require_admin)


def test_ai_agents_crud_routes_require_admin():
    _assert_depends_on(crud_api.read_agents, "_", deps.require_admin)
    _assert_depends_on(crud_api.get_agents_statistics, "_", deps.require_admin)
    _assert_depends_on(crud_api.read_agent, "_", deps.require_admin)
    _assert_depends_on(crud_api.create_new_agent, "_", deps.require_admin)
    _assert_depends_on(crud_api.update_existing_agent, "_", deps.require_admin)
    _assert_depends_on(crud_api.delete_existing_agent, "_", deps.require_admin)
    _assert_depends_on(crud_api.test_agent_connection, "_", deps.require_admin)
    _assert_depends_on(crud_api.discover_agent_models, "_", deps.require_admin)


def test_active_agents_requires_registered_login():
    _assert_depends_on(crud_api.read_active_agents, "current_user", deps.require_registered_user)


def test_conversation_routes_require_registered_login():
    _assert_depends_on(conversations_api.list_conversations, "current_user", deps.require_registered_user)
    _assert_depends_on(conversations_api.get_conversation, "current_user", deps.require_registered_user)


def test_chat_stream_requires_registered_login():
    _assert_depends_on(stream_api.stream_agent_chat_endpoint, "current_user", deps.require_registered_user)


def test_group_discussion_public_config_is_not_anonymous():
    _assert_depends_on(group_discussion_api.get_public_config, "current_user", deps.require_registered_user)
    _assert_depends_on(
        group_discussion_api.stream_public_config,
        "current_user",
        deps.require_registered_user_sse,
    )


def test_registered_user_dependency_rejects_guest_role():
    try:
        asyncio.run(deps.require_registered_user({"id": 99, "role_code": "guest"}))
    except deps.HTTPException as exc:
        assert exc.status_code == 403
    else:
        raise AssertionError("guest role must not access agent features")


def test_registered_user_dependency_allows_supported_roles():
    for role_code in ("student", "teacher", "admin", "super_admin"):
        user = {"id": 99, "role_code": role_code}
        assert asyncio.run(deps.require_registered_user(user)) == user


class _FakeResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeDB:
    async def execute(self, _stmt):
        # create_usage_record 仅需要确认 agent 存在
        return _FakeResult(SimpleNamespace(id=7))


def test_create_usage_record_forces_current_user_id(monkeypatch):
    captured = {}

    async def fake_create_agent_usage(db, **kwargs):
        captured.update(kwargs)
        return {
            "id": 1,
            "user_id": kwargs["user_id"],
            "moxing_id": kwargs["agent_id"],
        }

    monkeypatch.setattr(usage_api, "create_agent_usage", fake_create_agent_usage)

    usage_in = usage_api.AgentUsageCreate(
        agent_id=7,
        user_id=99999,  # 模拟前端篡改
        question="q",
        answer="a",
        used_at="1999-01-01T00:00:00Z",  # 模拟客户端电脑时间错误
    )

    result = asyncio.run(
        usage_api.create_usage_record(
            usage_in=usage_in,
            db=_FakeDB(),
            current_user={"id": 12345, "role_code": "student"},
        )
    )

    assert captured["user_id"] == 12345
    assert captured["agent_id"] == 7
    assert "used_at" not in captured
    assert result["user_id"] == 12345


def test_create_usage_record_does_not_require_client_user_id(monkeypatch):
    captured = {}

    async def fake_create_agent_usage(db, **kwargs):
        captured.update(kwargs)
        return {
            "id": 1,
            "user_id": kwargs["user_id"],
            "moxing_id": kwargs["agent_id"],
        }

    monkeypatch.setattr(usage_api, "create_agent_usage", fake_create_agent_usage)

    usage_in = usage_api.AgentUsageCreate(
        agent_id=7,
        question="q",
        answer="a",
    )

    result = asyncio.run(
        usage_api.create_usage_record(
            usage_in=usage_in,
            db=_FakeDB(),
            current_user={"id": 12345, "role_code": "student"},
        )
    )

    assert captured["user_id"] == 12345
    assert "used_at" not in captured
    assert result["user_id"] == 12345
