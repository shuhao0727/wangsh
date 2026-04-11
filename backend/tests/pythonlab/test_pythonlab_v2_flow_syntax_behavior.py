import asyncio
from copy import deepcopy

from fastapi import HTTPException

import app.api.pythonlab.flow as flow_api
import app.api.pythonlab.syntax as syntax_api


class FakeRedisClient:
    def __init__(self):
        self.counters: dict[str, int] = {}
        self.expiries: dict[str, int] = {}

    async def incr(self, key: str):
        next_value = self.counters.get(key, 0) + 1
        self.counters[key] = next_value
        return next_value

    async def expire(self, key: str, seconds: int):
        self.expiries[key] = seconds


class FakeCache:
    def __init__(self):
        self.store: dict[str, object] = {}
        self.client = FakeRedisClient()
        self.expiries: dict[str, int] = {}

    async def get(self, key: str):
        value = self.store.get(key)
        return deepcopy(value)

    async def set(self, key: str, value, expire_seconds: int | None = None):
        self.store[key] = deepcopy(value)
        if expire_seconds is not None:
            self.expiries[key] = expire_seconds
        return True

    async def get_client(self):
        return self.client


def test_parse_flow_caches_result_and_marks_cache_hit(monkeypatch):
    fake_cache = FakeCache()
    build_calls: list[tuple[str, dict]] = []

    def fake_build_flow(code: str, options: dict):
        build_calls.append((code, options))
        return {
            "version": flow_api.API_VERSION_FLOW,
            "parserVersion": flow_api.PARSER_VERSION_FLOW,
            "codeSha256": flow_api.sha256_text(code),
            "entryNodeId": "node-1",
            "exitNodeIds": ["node-1"],
            "exitEdges": [{"from": "node-1", "kind": "Next"}],
            "nodes": [{"id": "node-1", "kind": "Stmt", "title": "print('ok')"}],
            "edges": [],
            "diagnostics": [],
            "stats": {
                "parseMs": 12,
                "cacheHit": False,
                "nodeCount": 1,
                "edgeCount": 0,
                "truncated": False,
            },
        }

    # Need to patch the actual cache import in builder module
    import app.api.pythonlab.flow.builder as builder_module
    monkeypatch.setattr(builder_module, "cache", fake_cache)
    monkeypatch.setattr(builder_module, "_build_flow", fake_build_flow)
    monkeypatch.setattr(flow_api, "_now_ms", lambda: 1_000)

    payload = {"code": "print('ok')\n", "options": {"limits": {"maxParseMs": 1500}}}

    first = asyncio.run(flow_api.parse_flow(payload, current_user={"id": 21}))
    second = asyncio.run(flow_api.parse_flow(payload, current_user={"id": 21}))

    assert first["stats"]["cacheHit"] is False
    assert second["stats"]["cacheHit"] is True
    assert len(build_calls) == 1

    opt_hash = flow_api.options_hash(payload["options"])
    sha = flow_api.sha256_text(payload["code"])
    cache_key = f"{flow_api.CACHE_KEY_FLOW_PREFIX}:{flow_api.PARSER_VERSION_FLOW}:{opt_hash}:{sha}"
    assert cache_key in fake_cache.store


def test_parse_flow_rejects_invalid_code_payload():
    try:
        asyncio.run(flow_api.parse_flow({"code": 123}, current_user={"id": 1}))
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "code 必须为字符串" in str(exc.detail)


def test_check_syntax_reports_syntax_errors():
    result = asyncio.run(syntax_api.check_syntax(syntax_api.SyntaxCheckRequest(code="if True print('x')\n")))

    assert result["ok"] is False
    assert result["errors"]
    assert result["errors"][0].source == "syntax"


def test_check_syntax_accepts_valid_python():
    result = asyncio.run(syntax_api.check_syntax(syntax_api.SyntaxCheckRequest(code="a = 1\nprint(a)\n")))

    assert result["ok"] is True
    assert result["errors"] == []
