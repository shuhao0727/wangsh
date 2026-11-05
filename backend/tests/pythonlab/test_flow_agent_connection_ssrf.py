"""SSRF-FLOW-01：flow 智能体出站（code_generator.chat_completion）回归用例。

覆盖两条出站路径：
  - 请求体 api_url：POST /flow/test_agent_connection（仅管理员）
  - 管理员 feature flag：ai_chat 等接口读取 python_lab_agent_config / ai_agent_config

所有出站请求都经 httpx.MockTransport，不向任何真实地址（含内网/回环/元数据）发请求；
地址一律用字面 IP 或白名单主机名，出站校验不做 DNS 解析。
"""

import asyncio
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from loguru import logger

import app.core.deps as deps
import app.services.agents.code_generator as code_generator_module
from app.api.pythonlab.flow import ai_service
from app.api.pythonlab.flow.api import router as flow_router
from app.api.pythonlab.flow.exceptions import AIAgentError
from app.core.config import settings
from app.services.agents.code_generator import code_generator_client
from app.services.agents.endpoint_security import reset_trusted_endpoint_cache

PUBLIC_URL = "http://8.8.8.8/v1"
INTERNAL_URLS = [
    "http://10.0.0.1/",
    "http://127.0.0.1:6379/",
    "http://169.254.169.254/latest/meta-data/",
]
UPSTREAM_BODY = "INTERNAL-SECRET-BODY"
API_KEY = "sk-test-secret-key"
OK_RESPONSE = {"choices": [{"message": {"content": "pong"}}]}


class _FakeDbResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeFeatureDb:
    """只返回一条 ai_agent_config 的替身 DB（与 agent_bridge 用例同一写法）。"""

    def __init__(self, config_value):
        self._entry = SimpleNamespace(value=config_value)

    async def execute(self, _query):
        return _FakeDbResult(self._entry)


@pytest.fixture(autouse=True)
def _empty_whitelist(monkeypatch):
    # 固定白名单为空，避免本机环境变量影响判定
    monkeypatch.setattr(settings, "AGENT_TRUSTED_INTERNAL_ENDPOINTS", "")
    reset_trusted_endpoint_cache()
    yield
    reset_trusted_endpoint_cache()


@pytest.fixture
def upstream(monkeypatch):
    """把全局客户端换成记录请求的 MockTransport，并沿用生产客户端的重定向配置。"""
    state = SimpleNamespace(
        requests=[],
        handler=lambda request: httpx.Response(200, json=OK_RESPONSE),
    )

    def record(request):
        state.requests.append(request)
        return state.handler(request)

    replacement = httpx.AsyncClient(
        transport=httpx.MockTransport(record),
        follow_redirects=code_generator_client.client.follow_redirects,
    )
    monkeypatch.setattr(code_generator_client, "client", replacement)
    yield state
    asyncio.run(replacement.aclose())


@pytest.fixture
def sleeps(monkeypatch):
    """记录退避 sleep 而不真正等待；只替换 code_generator 模块内的 asyncio 引用。"""
    calls = []

    async def fake_sleep(delay):
        calls.append(delay)

    monkeypatch.setattr(code_generator_module, "asyncio", SimpleNamespace(sleep=fake_sleep))
    return calls


def _client(role):
    app = FastAPI()
    app.include_router(flow_router)

    async def _current_user():
        return {"id": 1, "role_code": role, "full_name": role, "is_active": True}

    app.dependency_overrides[deps.get_current_user] = _current_user
    return TestClient(app, raise_server_exceptions=False)


def _test_connection(role, api_url):
    return _client(role).post(
        "/flow/test_agent_connection",
        json={"api_url": api_url, "api_key": API_KEY, "model": "gpt-test"},
    )


@pytest.mark.parametrize("api_url", INTERNAL_URLS)
def test_request_body_internal_url_rejected_without_request_or_retry(api_url, upstream, sleeps):
    resp = _test_connection("admin", api_url)

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is False
    assert body["error"].startswith("目标地址不允许")
    assert upstream.requests == []
    assert sleeps == []


@pytest.mark.parametrize("api_url", INTERNAL_URLS)
def test_feature_flag_internal_url_rejected_without_request_or_retry(api_url, upstream, sleeps):
    db = _FakeFeatureDb({"api_url": api_url, "api_key": API_KEY, "model": "gpt-test"})

    with pytest.raises(AIAgentError) as excinfo:
        asyncio.run(ai_service.ai_chat_internal([{"role": "user", "content": "hi"}], db))

    assert excinfo.value.status_code == 502
    assert str(excinfo.value.detail).startswith("目标地址不允许")
    assert upstream.requests == []
    assert sleeps == []


def test_feature_flag_whitelisted_internal_endpoint_still_allowed(monkeypatch, upstream):
    """管理员配置的受信内部端点（AGENT_TRUSTED_INTERNAL_ENDPOINTS）不被新校验误拒。"""
    monkeypatch.setattr(settings, "AGENT_TRUSTED_INTERNAL_ENDPOINTS", "http://dify-api:5001/v1")
    reset_trusted_endpoint_cache()
    db = _FakeFeatureDb({"api_url": "http://dify-api:5001/v1", "api_key": API_KEY, "model": "m"})

    result = asyncio.run(ai_service.ai_chat_internal([{"role": "user", "content": "hi"}], db))

    assert result == {"message": "pong"}
    assert [str(r.url) for r in upstream.requests] == ["http://dify-api:5001/v1/chat/completions"]


def test_redirect_to_internal_is_not_followed(upstream, sleeps):
    def handler(request):
        if request.url.host == "8.8.8.8":
            return httpx.Response(
                302,
                headers={"location": "http://169.254.169.254/latest/meta-data/"},
                text=UPSTREAM_BODY,
            )
        return httpx.Response(200, text="METADATA-LEAKED")

    upstream.handler = handler

    resp = _test_connection("admin", PUBLIC_URL)

    assert code_generator_client.client.follow_redirects is False
    assert [r.url.host for r in upstream.requests] == ["8.8.8.8"]
    assert sleeps == []
    body = resp.json()
    assert body["success"] is False
    assert "重定向" in body["error"]
    assert UPSTREAM_BODY not in resp.text
    assert "169.254" not in resp.text
    assert "METADATA-LEAKED" not in resp.text


def test_upstream_500_returns_status_and_fixed_text_only(upstream, sleeps):
    upstream.handler = lambda request: httpx.Response(500, text=f"{UPSTREAM_BODY} echo={API_KEY}")
    logs = []
    sink_id = logger.add(lambda message: logs.append(str(message)), level="WARNING")
    try:
        resp = _test_connection("admin", PUBLIC_URL)
    finally:
        logger.remove(sink_id)

    assert resp.json() == {
        "success": False,
        "error": "HTTP 500: 上游服务返回错误，详情见服务端日志",
        "python_code": "",
    }
    # 5xx 仍按原逻辑退避重试
    assert len(upstream.requests) == 3
    assert sleeps == [0.5, 1.0]
    # 上游响应体只进服务端日志，且日志不含密钥
    server_log = "".join(logs)
    assert UPSTREAM_BODY in server_log
    assert API_KEY not in server_log


@pytest.mark.parametrize("role", ["student", "teacher"])
def test_test_agent_connection_rejects_non_admin(role, upstream):
    resp = _test_connection(role, PUBLIC_URL)

    assert resp.status_code == 403
    assert upstream.requests == []


@pytest.mark.parametrize("role", ["admin", "super_admin"])
def test_test_agent_connection_allows_admin(role, upstream):
    resp = _test_connection(role, PUBLIC_URL)

    assert resp.status_code == 200
    assert resp.json()["success"] is True
    assert [str(r.url) for r in upstream.requests] == ["http://8.8.8.8/v1/chat/completions"]
