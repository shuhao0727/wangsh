from types import SimpleNamespace

from app.services.agents.providers import common


def _make_agent(
    *,
    agent_type: str = "openai",
    api_endpoint: str | None = None,
    api_key: str | None = None,
    api_key_encrypted: str | None = None,
):
    return SimpleNamespace(
        agent_type=agent_type,
        api_endpoint=api_endpoint,
        api_key=api_key,
        api_key_encrypted=api_key_encrypted,
    )


def test_resolve_credentials_fallbacks_to_openrouter_when_endpoint_missing(monkeypatch):
    monkeypatch.setattr(common.settings, "OPENROUTER_API_URL", "https://openrouter.ai/api/v1")
    monkeypatch.setattr(common.settings, "OPENROUTER_API_KEY", "sk-or-global")

    agent = _make_agent(api_endpoint=None, api_key=None)
    endpoint, api_key = common.resolve_credentials(agent)

    assert endpoint == "https://openrouter.ai/api/v1"
    assert api_key == "sk-or-global"


def test_resolve_credentials_does_not_apply_openrouter_key_to_siliconflow(monkeypatch):
    monkeypatch.setattr(common.settings, "OPENROUTER_API_KEY", "sk-or-global")

    agent = _make_agent(api_endpoint="https://api.siliconflow.cn/v1", api_key=None)
    endpoint, api_key = common.resolve_credentials(agent)

    assert endpoint == "https://api.siliconflow.cn/v1"
    assert api_key is None


def test_resolve_credentials_uses_openrouter_global_key_for_openrouter_endpoint(monkeypatch):
    monkeypatch.setattr(common.settings, "OPENROUTER_API_KEY", "sk-or-global")

    agent = _make_agent(api_endpoint="https://openrouter.ai/api/v1", api_key=None)
    endpoint, api_key = common.resolve_credentials(agent)

    assert endpoint == "https://openrouter.ai/api/v1"
    assert api_key == "sk-or-global"
