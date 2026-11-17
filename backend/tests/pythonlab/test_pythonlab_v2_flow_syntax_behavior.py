import asyncio
from copy import deepcopy

import pytest
from fastapi import HTTPException

import app.api.pythonlab.flow as flow_api
import app.api.pythonlab.flow.builder as builder_module
import app.api.pythonlab.syntax as syntax_api
from app.api.pythonlab.constants import (
    DEFAULT_FLOW_MAX_PARSE_MS,
    DEFAULT_MAX_AST_NODES,
    DEFAULT_MAX_DEPTH,
    DEFAULT_MAX_EDGES,
    DEFAULT_MAX_NODES,
    MAX_AI_MESSAGES,
    MAX_AI_PAYLOAD_BYTES,
    MAX_CODE_SIZE_BYTES,
)
from app.api.pythonlab.flow.exceptions import SizeLimitError


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
    assert build_calls[0][1]["limits"]["maxNodes"] == DEFAULT_MAX_NODES
    assert build_calls[0][1]["limits"]["maxParseMs"] == DEFAULT_FLOW_MAX_PARSE_MS

    normalized = builder_module._normalize_options(payload["options"])
    opt_hash = flow_api.options_hash(normalized)
    sha = flow_api.sha256_text(payload["code"])
    cache_key = f"{flow_api.CACHE_KEY_FLOW_PREFIX}:{flow_api.PARSER_VERSION_FLOW}:{opt_hash}:{sha}"
    assert cache_key in fake_cache.store


def test_normalize_flow_options_clamps_client_limits():
    normalized = builder_module._normalize_options({
        "limits": {
            "maxNodes": 10**9,
            "maxEdges": -1,
            "maxAstNodes": 0,
            "maxParseMs": 10**9,
        },
        "expand": {"maxDepth": 10**9, "functions": "bad"},
    })

    assert normalized["limits"]["maxNodes"] == DEFAULT_MAX_NODES
    assert normalized["limits"]["maxEdges"] == DEFAULT_MAX_EDGES
    assert normalized["limits"]["maxAstNodes"] == DEFAULT_MAX_AST_NODES
    assert normalized["limits"]["maxParseMs"] == DEFAULT_FLOW_MAX_PARSE_MS
    assert normalized["expand"]["maxDepth"] == DEFAULT_MAX_DEPTH
    assert normalized["expand"]["functions"] == "all"


def test_normalize_flow_options_rejects_invalid_integer_string():
    with pytest.raises(ValueError):
        builder_module._normalize_options({"expand": {"maxDepth": "invalid"}})


def test_parse_flow_uses_clamped_limits_for_build_and_cache(monkeypatch):
    fake_cache = FakeCache()
    captured = {}

    def fake_build_flow(code: str, options: dict):
        captured.update(options)
        return {
            "version": flow_api.API_VERSION_FLOW,
            "parserVersion": flow_api.PARSER_VERSION_FLOW,
            "codeSha256": flow_api.sha256_text(code),
            "entryNodeId": "node-1",
            "exitNodeIds": ["node-1"],
            "exitEdges": [],
            "nodes": [{"id": "node-1", "kind": "Stmt", "title": "x"}],
            "edges": [],
            "diagnostics": [],
            "stats": {"parseMs": 1, "cacheHit": False, "nodeCount": 1, "edgeCount": 0, "truncated": False},
        }

    monkeypatch.setattr(builder_module, "cache", fake_cache)
    monkeypatch.setattr(builder_module, "_build_flow", fake_build_flow)
    monkeypatch.setattr(flow_api, "_now_ms", lambda: 1_000)

    asyncio.run(flow_api.parse_flow(
        {
            "code": "print('ok')\n",
            "options": {
                "limits": {
                    "maxNodes": 10**9,
                    "maxEdges": 10**9,
                    "maxAstNodes": 10**9,
                    "maxParseMs": 10**9,
                },
                "expand": {"maxDepth": 10**9},
            },
        },
        current_user={"id": 1},
    ))

    assert captured["limits"]["maxNodes"] == DEFAULT_MAX_NODES
    assert captured["limits"]["maxEdges"] == DEFAULT_MAX_EDGES
    assert captured["limits"]["maxAstNodes"] == DEFAULT_MAX_AST_NODES
    assert captured["limits"]["maxParseMs"] == DEFAULT_FLOW_MAX_PARSE_MS
    assert captured["expand"]["maxDepth"] == DEFAULT_MAX_DEPTH
    key = next(iter(fake_cache.store))
    assert flow_api.options_hash(builder_module._normalize_options({
        "limits": {"maxNodes": 10**9, "maxEdges": 10**9, "maxAstNodes": 10**9, "maxParseMs": 10**9},
        "expand": {"maxDepth": 10**9},
    })) in key


def test_build_flow_handles_ast_recursion_error():
    code = "x = " + "+".join(["1"] * 13_000)

    result = builder_module._build_flow(code, {})

    assert result["diagnostics"]
    assert "RecursionError" in result["diagnostics"][0]["message"]


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


def test_check_syntax_handles_recursion_error():
    code = "x = " + "+".join(["1"] * 13_000)

    result = asyncio.run(syntax_api.check_syntax(syntax_api.SyntaxCheckRequest(code=code)))

    assert result["ok"] is False
    assert result["errors"]
    assert "嵌套过深" in result["errors"][0].message


def test_check_syntax_rejects_oversized_code():
    code = "a=1\n" * (MAX_CODE_SIZE_BYTES // 4 + 1)

    try:
        asyncio.run(syntax_api.check_syntax(syntax_api.SyntaxCheckRequest(code=code)))
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 413


def test_ai_chat_rejects_too_many_messages():
    messages = [{"role": "user", "content": "x"} for _ in range(MAX_AI_MESSAGES + 1)]

    try:
        asyncio.run(flow_api.ai_chat({"messages": messages}, current_user={"id": 1}, db=object()))
        raise AssertionError("expected SizeLimitError")
    except SizeLimitError as exc:
        assert exc.status_code == 413


def test_ai_chat_rejects_oversized_payload():
    messages = [{"role": "user", "content": "x" * (MAX_AI_PAYLOAD_BYTES + 1)}]

    try:
        asyncio.run(flow_api.ai_chat({"messages": messages}, current_user={"id": 1}, db=object()))
        raise AssertionError("expected SizeLimitError")
    except SizeLimitError as exc:
        assert exc.status_code == 413


def test_generate_code_rejects_oversized_flow():
    flow = {"nodes": ["x" * (MAX_AI_PAYLOAD_BYTES + 1)]}

    try:
        asyncio.run(flow_api.generate_code_from_flow({"flow": flow}, current_user={"id": 1}, db=object()))
        raise AssertionError("expected SizeLimitError")
    except SizeLimitError as exc:
        assert exc.status_code == 413
