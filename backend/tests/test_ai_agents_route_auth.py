import asyncio
import inspect
from types import SimpleNamespace

from fastapi.params import Depends

import app.core.deps as deps
import app.api.endpoints.agents.ai_agents.crud as crud_api
import app.api.endpoints.agents.ai_agents.usage as usage_api
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
    _assert_depends_on(usage_api.create_usage_record, "current_user", deps.require_user)


def test_model_discovery_discover_routes_require_admin():
    _assert_depends_on(model_discovery_api.discover_models, "_", deps.require_admin)
    _assert_depends_on(model_discovery_api.discover_models_by_agent, "_", deps.require_admin)


def test_ai_agents_crud_routes_require_admin():
    _assert_depends_on(crud_api.read_agents, "_", deps.require_admin)
    _assert_depends_on(crud_api.get_agents_statistics, "_", deps.require_admin)
    _assert_depends_on(crud_api.read_agent, "_", deps.require_admin)
    _assert_depends_on(crud_api.create_new_agent, "_", deps.require_admin)
    _assert_depends_on(crud_api.update_existing_agent, "_", deps.require_admin)
    _assert_depends_on(crud_api.delete_existing_agent, "_", deps.require_admin)
    _assert_depends_on(crud_api.test_agent_connection, "_", deps.require_admin)
    _assert_depends_on(crud_api.discover_agent_models, "_", deps.require_admin)


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
    assert result["user_id"] == 12345
