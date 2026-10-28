"""AI SSE 端点的「设置阶段」失败必须返回非 200，而不是 200 + event: error 帧。

覆盖：
- `/ai-agents/stream`：prepare_agent_stream 抛 _StreamSetupError 时按错误码映射
  404 / 409 / 503，且不再顺带发出 SSE 帧；
- `/analysis/student-chains/stream`：prompt_template_id 指向不存在的模板时返回 404。

使用 auth 目录的共享隔离夹具（真实 JWT/路由/SQLite ORM，合成身份，无外网）。
这不是真实 PostgreSQL、Redis 或浏览器 SSE 证据。
"""
import asyncio
import importlib.util
from pathlib import Path

import httpx
import pytest
from sqlalchemy import update

from app.api.endpoints.agents.ai_agents import analysis_streams
from app.api.endpoints.agents.ai_agents import stream as stream_module
from app.models import User
from app.models.agents import AgentAnalysisPromptTemplate
from app.services.agents import chat_stream

_spec = importlib.util.spec_from_file_location(
    "ai_sse_setup_status_fixture",
    Path(__file__).parents[1] / "auth/test_logout_revocation_isolated.py",
)
_fixture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_fixture)
isolated = _fixture.isolated


async def _post(h, path, body):
    pair = await h.login()
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=h.app, client=("192.0.2.10", 12345)),
        base_url="http://isolated.invalid",
        headers={"Authorization": f"Bearer {pair['access_token']}"},
    ) as client:
        return await client.post(path, json=body)


@pytest.mark.parametrize(
    "error,status_code",
    [
        ({"error": "invalid_agent"}, 404),
        ({"error": "agent_inactive", "message": "该智能体已停用"}, 409),
        ({"error": "missing_endpoint", "message": "未配置API地址"}, 409),
        ({"error": "missing_api_key", "message": "未配置API密钥"}, 409),
        ({"error": "circuit_open", "message": "暂时不可用"}, 409),
        ({"error": "stream_setup_failed", "message": "初始化失败"}, 503),
        ({"error": "stream_failed", "message": "读取配置失败"}, 503),
        # 未知错误码按最保守的 503 处理，而不是意外降级成 200。
        ({"error": "something_new"}, 503),
    ],
)
def test_chat_stream_setup_error_returns_http_status(isolated, monkeypatch, error, status_code):
    async def run():
        async with isolated() as h:
            h.app.include_router(stream_module.router, prefix="/api/v1/ai-agents")

            async def fail_prepare(*args, **kwargs):
                raise chat_stream._StreamSetupError(dict(error))

            async def must_not_stream(*args, **kwargs):
                raise AssertionError("provider stream must not start after setup failure")

            monkeypatch.setattr(chat_stream, "prepare_agent_stream", fail_prepare)
            monkeypatch.setattr(chat_stream, "stream_agent_chat", must_not_stream)

            response = await _post(h, "/api/v1/ai-agents/stream", {"agent_id": 999999, "message": "hi"})

            assert response.status_code == status_code, response.text
            assert "text/event-stream" not in response.headers.get("content-type", "")
            assert "event: error" not in response.text
            expected_code = error["error"] if error["error"] in {
                "invalid_agent", "agent_inactive", "missing_endpoint", "missing_api_key",
                "circuit_open", "stream_setup_failed", "stream_failed",
            } else "stream_setup_failed"
            assert response.json()["detail"]["error"] == expected_code

    asyncio.run(run())


def test_chat_stream_stream_failed_detail_hidden_outside_debug(isolated, monkeypatch):
    async def run():
        async with isolated() as h:
            h.app.include_router(stream_module.router, prefix="/api/v1/ai-agents")

            async def fail_prepare(*args, **kwargs):
                raise chat_stream._StreamSetupError(
                    {"error": "stream_failed", "message": "读取智能体配置失败", "detail": "secret-dsn"}
                )

            monkeypatch.setattr(chat_stream, "prepare_agent_stream", fail_prepare)
            monkeypatch.setattr(stream_module.settings, "DEBUG", False)

            response = await _post(h, "/api/v1/ai-agents/stream", {"agent_id": 1, "message": "hi"})

            assert response.status_code == 503
            assert "secret-dsn" not in response.text

    asyncio.run(run())


def test_student_chain_stream_rejects_missing_prompt_template(isolated, monkeypatch):
    async def run():
        async with isolated() as h:
            h.app.include_router(analysis_streams.router, prefix="/api/v1/ai-agents")
            # 夹具只建了 auth 相关表；为模板查询补建合成表（真实 ORM 映射）。
            async with h.db_factory() as db:
                await db.run_sync(
                    lambda s: AgentAnalysisPromptTemplate.__table__.create(s.connection(), checkfirst=True)
                )
                await db.execute(update(User).where(User.id == 1).values(role_code="admin"))
                await db.commit()

            async def started(*args, **kwargs):
                raise AssertionError("analysis stream must not start when template is missing")

            monkeypatch.setattr(analysis_streams, "analyze_student_chains_v2", started)

            response = await _post(
                h,
                "/api/v1/ai-agents/analysis/student-chains/stream",
                {"agent_id": 1, "prompt_template_id": 987654},
            )

            assert response.status_code == 404, response.text
            assert "event:" not in response.text

    asyncio.run(run())


def test_setup_error_status_mapping_is_stable():
    http_exc = stream_module._setup_error_status({"error": "invalid_agent"})
    assert http_exc.status_code == 404
    assert http_exc.detail == {"error": "invalid_agent"}
