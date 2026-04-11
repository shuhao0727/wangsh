"""
Flow 构建器模块

包含流程图构建的核心逻辑。
"""

import ast
import time
from typing import Any, Dict, List, Optional, Tuple

from app.api.pythonlab.constants import (
    API_VERSION_FLOW,
    CACHE_KEY_FLOW_PREFIX,
    DEFAULT_FLOW_MAX_PARSE_MS,
    DEFAULT_MAX_AST_NODES,
    DEFAULT_MAX_DEPTH,
    DEFAULT_MAX_EDGES,
    DEFAULT_MAX_NODES,
    E_AST_TOO_LARGE,
    E_PARSE_TIMEOUT,
    E_SYNTAX,
    MAX_CODE_SIZE_BYTES,
    PARSER_VERSION_FLOW,
    W_TRUNCATED,
    WS_RATE_LIMIT_PER_SEC,
)
from app.api.pythonlab.structured_ir import build_ir_functions, build_ir_module
from app.api.pythonlab.utils import make_edge, options_hash, sha256_text, stable_id
from app.utils.cache import cache

from .ast_transformer import _lower_block
from .build_ctx import _BuildCtx
from .utils import (
    _collect_ast_nodes,
    _extract_call_name,
    _make_node,
    _node_title_wrapper,
)


def _build_fallback_flow_result(code: str, diagnostics: List[Dict[str, Any]], parse_ms: int, fallback_title: str) -> Dict[str, Any]:
    module_id = stable_id("Module", "1")
    total_lines = max(1, len(code.splitlines()))
    module_node = {
        "id": module_id,
        "kind": "Module",
        "title": "main.py",
        "range": {"startLine": 1, "startCol": 1, "endLine": total_lines, "endCol": 1},
        "parentId": None,
    }
    fallback_node = {
        "id": stable_id("Fallback", "1", "1", str(total_lines), module_id, fallback_title),
        "kind": "Fallback",
        "title": fallback_title,
        "range": {"startLine": 1, "startCol": 1, "endLine": total_lines, "endCol": 1},
        "parentId": module_id,
    }
    return {
        "version": API_VERSION_FLOW,
        "parserVersion": PARSER_VERSION_FLOW,
        "codeSha256": sha256_text(code),
        "entryNodeId": fallback_node["id"],
        "exitNodeIds": [fallback_node["id"]],
        "exitEdges": [{"from": fallback_node["id"], "kind": "Next"}],
        "nodes": [module_node, fallback_node],
        "edges": [make_edge("Entry", module_id, fallback_node["id"], "回退")],
        "diagnostics": diagnostics,
        "stats": {"parseMs": parse_ms, "cacheHit": False, "nodeCount": 2, "edgeCount": 1, "truncated": False},
    }


def _build_flow(code: str, options: Dict[str, Any]) -> Dict[str, Any]:
    t0 = time.perf_counter()
    limits = options.get("limits") if isinstance(options.get("limits"), dict) else {}
    expand = options.get("expand") if isinstance(options.get("expand"), dict) else {}

    max_nodes = int(limits.get("maxNodes") or DEFAULT_MAX_NODES)
    max_edges = int(limits.get("maxEdges") or DEFAULT_MAX_EDGES)
    max_ast_nodes = int(limits.get("maxAstNodes") or DEFAULT_MAX_AST_NODES)
    max_depth = int(expand.get("maxDepth") or DEFAULT_MAX_DEPTH)
    expand_functions = str(expand.get("functions") or "all").strip().lower()
    if expand_functions not in {"none", "top", "all"}:
        expand_functions = "all"

    diagnostics: List[Dict[str, Any]] = []

    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        line = int(getattr(e, "lineno", 1) or 1)
        col = int(getattr(e, "offset", 1) or 1)
        diagnostics.append(
            {
                "level": "error",
                "code": E_SYNTAX,
                "message": f"SyntaxError: {e.msg}",
                "range": {"startLine": line, "startCol": col, "endLine": line, "endCol": col + 1},
            }
        )
        parse_ms = int((time.perf_counter() - t0) * 1000)
        return _build_fallback_flow_result(code, diagnostics, parse_ms, "语法错误，已回退到稳定展示")

    ok_ast, ast_count = _collect_ast_nodes(tree, max_ast_nodes)
    if not ok_ast:
        diagnostics.append({"level": "error", "code": E_AST_TOO_LARGE, "message": f"代码结构过大（AST 节点数 {ast_count}），已拒绝解析"})
        parse_ms = int((time.perf_counter() - t0) * 1000)
        return _build_fallback_flow_result(code, diagnostics, parse_ms, "结构过大，已回退到稳定展示")

    ctx = _BuildCtx(code=code, max_nodes=max_nodes, max_edges=max_edges)
    ctx.diagnostics.extend(diagnostics)
    module_node = {
        "id": ctx.module_id,
        "kind": "Module",
        "title": "main.py",
        "range": {"startLine": 1, "startCol": 1, "endLine": max(1, len(code.splitlines())), "endCol": 1},
        "parentId": None,
    }
    ctx.nodes.append(module_node)
    module_ir = build_ir_module(tree)
    entry, module_pend = _lower_block(ctx, module_ir, module_node["id"], [])
    if entry:
        ctx.add_edge(make_edge("Entry", module_node["id"], entry))

    functions_ir = build_ir_functions(tree)
    if expand_functions == "none":
        for fn in functions_ir:
            fn_id = ctx.add_node(_make_node(ctx.code, "Function", fn.node, ctx.module_id, title=f"def {fn.sig}"))
            if fn_id:
                try:
                    ctx.func_name_to_id[str(fn.name or "")] = fn_id
                except Exception:
                    pass
    else:
        for fn in functions_ir:
            fn_id = ctx.add_node(_make_node(ctx.code, "Start", fn.node, ctx.module_id, title=f"进入函数：{fn.name}"))
            if not fn_id:
                continue
            try:
                ctx.func_name_to_id[str(fn.name or "")] = fn_id
            except Exception:
                pass
            fn_entry, fn_pend = _lower_block(ctx, fn.body, fn_id, [])
            if fn_entry:
                ctx.add_edge(make_edge("Entry", fn_id, fn_entry, "定义"))
            fn_end_id = ctx.add_node(_make_node(ctx.code, "End", fn.node, fn_id, title="函数结束"))
            if fn_end_id:
                for (from_id, k, label) in fn_pend:
                    if k == "Next":
                        ctx.add_edge(make_edge("Next", from_id, fn_end_id, label))
                    elif k == "False":
                        ctx.add_edge(make_edge("False", from_id, fn_end_id, "否"))
                    elif k == "Return":
                        ctx.add_edge(make_edge("Return", from_id, fn_end_id, "返回"))
                    elif k in {"Break", "Continue"}:
                        ctx.add_edge(make_edge("Next", from_id, fn_end_id, "结束"))

    if not ctx.truncated and ctx.func_name_to_id and expand_functions == "none":
        module_stmts = list(getattr(tree, "body", []) or [])
        for s in module_stmts:
            name = _extract_call_name(s)
            if not name:
                continue
            fn_id = ctx.func_name_to_id.get(name)
            if not fn_id:
                continue
            try:
                # Subprocess call
                title = _node_title_wrapper(ctx.code, s)
                # This should be a Subprocess node linking to Function
                # But current logic is: create node for Call stmt, then edge to Function
                from_id = _make_node(ctx.code, "Subprocess", s, module_node["id"], title=title)["id"]
            except Exception:
                continue
            ctx.add_edge(make_edge("Call", from_id, fn_id, "调用"))

    parse_ms = int((time.perf_counter() - t0) * 1000)
    exit_edges: List[Dict[str, Any]] = []
    for (from_id, kind, label) in module_pend:
        if kind == "Next":
            exit_edges.append({"from": from_id, "kind": "Next"})
        elif kind == "False":
            exit_edges.append({"from": from_id, "kind": "False", "label": "否"})
        elif kind == "Return":
            exit_edges.append({"from": from_id, "kind": "Return", "label": "返回"})
    exit_ids = list(dict.fromkeys([e["from"] for e in exit_edges]))
    return {
        "version": API_VERSION_FLOW,
        "parserVersion": PARSER_VERSION_FLOW,
        "codeSha256": sha256_text(code),
        "entryNodeId": entry,
        "exitNodeIds": exit_ids,
        "exitEdges": exit_edges,
        "nodes": ctx.nodes,
        "edges": ctx.edges,
        "diagnostics": ctx.diagnostics,
        "stats": {"parseMs": parse_ms, "cacheHit": False, "nodeCount": len(ctx.nodes), "edgeCount": len(ctx.edges), "truncated": ctx.truncated},
    }


async def parse_flow_internal(code: str, options: Dict[str, Any], user_id: int) -> Dict[str, Any]:
    """内部解析函数，用于缓存和限流"""
    from .exceptions import RateLimitError
    from .utils import _now_ms

    limits = options.get("limits") if isinstance(options.get("limits"), dict) else {}
    max_parse_ms = int(limits.get("maxParseMs") or DEFAULT_FLOW_MAX_PARSE_MS)

    sha = sha256_text(code)
    opt_hash = options_hash(options)
    cache_key = f"{CACHE_KEY_FLOW_PREFIX}:{PARSER_VERSION_FLOW}:{opt_hash}:{sha}"
    cached = await cache.get(cache_key)
    if isinstance(cached, dict) and cached.get("version") == API_VERSION_FLOW and cached.get("parserVersion") == PARSER_VERSION_FLOW:
        try:
            stats = cached.get("stats") if isinstance(cached.get("stats"), dict) else {}
            stats["cacheHit"] = True
            cached["stats"] = stats
        except Exception:
            pass
        return cached

    try:
        client = await cache.get_client()
        rl_key = f"{CACHE_KEY_FLOW_PREFIX}:rl:{user_id}:{_now_ms() // 1000}"
        cur = await client.incr(rl_key)
        if cur == 1:
            await client.expire(rl_key, 2)
        if int(cur) > WS_RATE_LIMIT_PER_SEC:  # Reuse rate limit
            raise RateLimitError("请求过于频繁")
    except RateLimitError:
        raise
    except Exception:
        pass

    try:
        import asyncio
        built = await asyncio.wait_for(asyncio.to_thread(_build_flow, code, options), timeout=max(0.2, max_parse_ms / 1000.0))
    except asyncio.TimeoutError:
        built = _build_fallback_flow_result(
            code=code,
            diagnostics=[{"level": "error", "code": E_PARSE_TIMEOUT, "message": "解析超时，已中止"}],
            parse_ms=max_parse_ms,
            fallback_title="解析超时，已回退到稳定展示",
        )

    try:
        ttl = 3600
        await cache.set(cache_key, built, expire_seconds=ttl)
    except Exception:
        pass

    return built