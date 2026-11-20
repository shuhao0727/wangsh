"""
Flow 构建器模块

包含流程图构建的核心逻辑。
"""

import ast
import time
from typing import Any, Dict, List

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
    PARSER_VERSION_FLOW,
    WS_RATE_LIMIT_PER_SEC,
)
from app.api.pythonlab.cpu_limits import run_cpu
from app.api.pythonlab.structured_ir import build_ir_functions, build_ir_module
from app.api.pythonlab.utils import SourceText, make_edge, options_hash, sha256_text, stable_id
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


def _clamp_int(value: Any, maximum: int) -> int:
    # bool 是 int 的子类，int(True) == 1 会让 {"maxParseMs": true} 变成 1ms。
    if isinstance(value, bool):
        raise ValueError(f"无效的整数配置: {value!r}")
    if value is None or value == "":
        return maximum
    try:
        parsed = int(value)
    except (TypeError, ValueError, OverflowError) as exc:
        # JSON 1e400 / Infinity 经 json.loads 变成 inf，int(inf) 抛 OverflowError。
        raise ValueError(f"无效的整数配置: {value!r}") from exc
    if parsed <= 0:
        return maximum
    return min(parsed, maximum)


def _normalize_options(options: Dict[str, Any]) -> Dict[str, Any]:
    """服务端钳制客户端可提交的解析预算，并用同一份 options 计算缓存键。

    只保留已知键：请求体里的未知键若进入 options_hash，会让缓存键无限分裂，
    每个键都缓存一份完整流程图。
    """
    source = options if isinstance(options, dict) else {}
    limits_raw = source.get("limits")
    limits_in = limits_raw if isinstance(limits_raw, dict) else {}
    expand_raw = source.get("expand")
    expand_in = expand_raw if isinstance(expand_raw, dict) else {}

    limits = {
        "maxNodes": _clamp_int(limits_in.get("maxNodes"), DEFAULT_MAX_NODES),
        "maxEdges": _clamp_int(limits_in.get("maxEdges"), DEFAULT_MAX_EDGES),
        "maxAstNodes": _clamp_int(limits_in.get("maxAstNodes"), DEFAULT_MAX_AST_NODES),
        "maxParseMs": _clamp_int(limits_in.get("maxParseMs"), DEFAULT_FLOW_MAX_PARSE_MS),
    }
    functions = str(expand_in.get("functions") or "all").strip().lower()
    expand = {
        "maxDepth": _clamp_int(expand_in.get("maxDepth"), DEFAULT_MAX_DEPTH),
        "functions": functions if functions in {"none", "top", "all"} else "all",
    }
    return {"limits": limits, "expand": expand}


def _parse_flow_ast(
    code: str,
    diagnostics: List[Dict[str, Any]],
    t0: float,
) -> tuple[ast.AST | None, Dict[str, Any] | None]:
    try:
        return ast.parse(code), None
    except RecursionError:
        diagnostics.append(
            {
                "level": "error",
                "code": E_SYNTAX,
                "message": "RecursionError: 代码嵌套过深",
                "range": {"startLine": 1, "startCol": 1, "endLine": 1, "endCol": 2},
            }
        )
        parse_ms = int((time.perf_counter() - t0) * 1000)
        return None, _build_fallback_flow_result(code, diagnostics, parse_ms, "嵌套过深，已回退到稳定展示")
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
        return None, _build_fallback_flow_result(code, diagnostics, parse_ms, "语法错误，已回退到稳定展示")


def _build_flow(code: str, options: Dict[str, Any]) -> Dict[str, Any]:
    t0 = time.perf_counter()
    # 一次建好行索引：每个节点都要按 range 切片取标题，逐节点重新切分源码是 O(节点×源码)。
    code = SourceText(code)
    options = _normalize_options(options)
    limits = options.get("limits") if isinstance(options.get("limits"), dict) else {}
    expand = options.get("expand") if isinstance(options.get("expand"), dict) else {}

    max_nodes = int(limits.get("maxNodes") or DEFAULT_MAX_NODES)
    max_edges = int(limits.get("maxEdges") or DEFAULT_MAX_EDGES)
    max_ast_nodes = int(limits.get("maxAstNodes") or DEFAULT_MAX_AST_NODES)
    # maxDepth is retained for API compatibility even though flow expansion does
    # not currently consume the value. Keep integer coercion as input validation.
    int(expand.get("maxDepth") or DEFAULT_MAX_DEPTH)
    expand_functions = str(expand.get("functions") or "all").strip().lower()
    if expand_functions not in {"none", "top", "all"}:
        expand_functions = "all"

    diagnostics: List[Dict[str, Any]] = []

    tree, fallback = _parse_flow_ast(code, diagnostics, t0)
    if fallback is not None:
        return fallback

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

    options = _normalize_options(options)
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
        built = await asyncio.wait_for(
            asyncio.to_thread(run_cpu, _build_flow, code, options),
            timeout=max(0.2, max_parse_ms / 1000.0),
        )
    except asyncio.TimeoutError:
        # 超时是瞬时失败：不写缓存，否则一次超时会在 TTL 内对所有用户固化。
        return _build_fallback_flow_result(
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
