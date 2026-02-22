import asyncio
import ast
import time
from typing import Any, Dict, List, Optional, Tuple, Set

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import require_admin
from app.utils.cache import cache
from app.api.endpoints.debug.structured_ir import (
    IRAction,
    IRBlock,
    IRBreak,
    IRContinue,
    IRForEach,
    IRForRange,
    IRFunction,
    IRIf,
    IRReturn,
    IRStmt,
    IRWhile,
    build_ir_functions,
    build_ir_module,
)
from app.api.endpoints.debug.constants import (
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
from app.api.endpoints.debug.utils import (
    is_elif_if,
    make_edge,
    node_title,
    options_hash,
    range_from_ast,
    sha256_text,
    stable_id,
)

router = APIRouter()


def _now_ms() -> int:
    return int(time.time() * 1000)


def _node_title_wrapper(code: str, n: ast.AST) -> str:
    seg = ast.get_source_segment(code, n)
    if isinstance(seg, str) and seg.strip():
        return seg.strip()
    return node_title(code, n)


def _full_title(code: str, n: Optional[ast.AST]) -> str:
    if n is None:
        return ""
    seg = ast.get_source_segment(code, n)
    return seg.strip() if isinstance(seg, str) else ""


def _header_title(code: str, n: Optional[ast.AST]) -> str:
    if n is None:
        return ""
    if isinstance(n, ast.FunctionDef):
        name = str(getattr(n, "name", "") or "")
        args: List[str] = []
        try:
            for a in getattr(n.args, "posonlyargs", []) or []:
                args.append(str(getattr(a, "arg", "") or ""))
        except Exception:
            pass
        if getattr(n.args, "posonlyargs", None):
            args.append("/")
        try:
            for a in getattr(n.args, "args", []) or []:
                args.append(str(getattr(a, "arg", "") or ""))
        except Exception:
            pass
        if getattr(n.args, "vararg", None) is not None:
            args.append(f"*{getattr(n.args.vararg, 'arg', '')}")
        elif getattr(n.args, "kwonlyargs", None):
            args.append("*")
        try:
            for a in getattr(n.args, "kwonlyargs", []) or []:
                args.append(str(getattr(a, "arg", "") or ""))
        except Exception:
            pass
        if getattr(n.args, "kwarg", None) is not None:
            args.append(f"**{getattr(n.args.kwarg, 'arg', '')}")
        sig = ", ".join([a for a in args if a])
        return f"def {name}({sig})"

    if isinstance(n, ast.If):
        head = "elif" if is_elif_if(n) else "if"
        try:
            return f"{head} {ast.unparse(n.test).strip()}"
        except Exception:
            return head

    if isinstance(n, ast.While):
        try:
            return f"while {ast.unparse(n.test).strip()}"
        except Exception:
            return "while"

    if isinstance(n, ast.For):
        try:
            target = ast.unparse(n.target).strip()
            if isinstance(n.iter, ast.Call) and isinstance(n.iter.func, ast.Name) and n.iter.func.id == "range":
                args = list(getattr(n.iter, "args", []) or [])
                stop = args[0] if len(args) >= 1 else None
                step = args[2] if len(args) >= 3 else None
                op = "<"
                if isinstance(step, ast.Constant) and isinstance(step.value, int) and step.value < 0:
                    op = ">"
                if stop is not None:
                    return f"{target} {op} {ast.unparse(stop).strip()}"
            it = ast.unparse(n.iter).strip()
            return f"for {target} in {it}"
        except Exception:
            return "for"

    if isinstance(n, ast.Return):
        if n.value is None:
            return "return"
        try:
            return f"return {ast.unparse(n.value).strip()}"
        except Exception:
            return "return"

    return _node_title_wrapper(code, n)


def _kind_of(stmt: ast.AST) -> str:
    if isinstance(stmt, ast.FunctionDef):
        return "Function"
    if isinstance(stmt, ast.If):
        return "If"
    if isinstance(stmt, ast.While):
        return "While"
    if isinstance(stmt, ast.For):
        return "For"
    if isinstance(stmt, ast.Return):
        return "Return"
    if isinstance(stmt, ast.Break):
        return "Break"
    if isinstance(stmt, ast.Continue):
        return "Continue"
    if isinstance(stmt, ast.Assign):
        return "Assign"
    if isinstance(stmt, ast.AugAssign):
        return "AugAssign"
    if isinstance(stmt, ast.Expr):
        return "Expr"
    return "Stmt"


def _make_node(code: str, kind: str, n: Optional[ast.AST], parent_id: Optional[str], title: Optional[str] = None) -> Dict[str, Any]:
    if n is None:
        rng = {"startLine": 1, "startCol": 1, "endLine": 1, "endCol": 1}
    else:
        rng = range_from_ast(n)
        if kind in {"If", "Elif", "While", "For", "ForEach"}:
            rng = dict(rng)
            rng["endLine"] = rng["startLine"]
            rng["endCol"] = max(rng["startCol"], rng["endCol"])
    full = _full_title(code, n)
    t = (title or (_header_title(code, n) if n is not None else "")).strip() or kind
    nid = stable_id(kind, str(rng["startLine"]), str(rng["startCol"]), str(rng["endLine"]), str(rng["endCol"]), parent_id or "", t)
    node = {"id": nid, "kind": kind, "title": t, "range": rng, "parentId": parent_id}
    if full and full != t:
        node["fullTitle"] = full
    return node


def _mark_synthetic(ctx: "_BuildCtx", nid: Optional[str]) -> None:
    if not nid:
        return
    for n in ctx.nodes:
        if n.get("id") == nid:
            n.pop("range", None)
            n.pop("fullTitle", None)
            return


def _collect_ast_nodes(tree: ast.AST, max_nodes: int) -> Tuple[bool, int]:
    count = 0
    for _ in ast.walk(tree):
        count += 1
        if count > max_nodes:
            return False, count
    return True, count


class _BuildCtx:
    def __init__(self, code: str, max_nodes: int, max_edges: int):
        self.code = code
        self.max_nodes = max_nodes
        self.max_edges = max_edges
        self.nodes: List[Dict[str, Any]] = []
        self.edges: List[Dict[str, Any]] = []
        self.diagnostics: List[Dict[str, Any]] = []
        self.truncated = False
        self.func_name_to_id: Dict[str, str] = {}
        self.module_id: str = stable_id("Module", "1")

    def add_node(self, node: Dict[str, Any]) -> Optional[str]:
        if self.truncated:
            return None
        if len(self.nodes) >= self.max_nodes:
            self.truncated = True
            self.diagnostics.append({"level": "warn", "code": W_TRUNCATED, "message": "流程图过大，已进行折叠/截断"})
            return None
        self.nodes.append(node)
        return node["id"]

    def add_edge(self, edge: Dict[str, Any]) -> None:
        if self.truncated:
            return
        if len(self.edges) >= self.max_edges:
            self.truncated = True
            self.diagnostics.append({"level": "warn", "code": W_TRUNCATED, "message": "流程图过大，已进行折叠/截断"})
            return
        self.edges.append(edge)


def _pend(from_id: str, kind: str, label: Optional[str] = None) -> Tuple[str, str, Optional[str]]:
    return (from_id, kind, label)


def _split_pend(pend: List[Tuple[str, str, Optional[str]]]) -> Dict[str, List[Tuple[str, str, Optional[str]]]]:
    out: Dict[str, List[Tuple[str, str, Optional[str]]]] = {}
    for p in pend or []:
        out.setdefault(p[1], []).append(p)
    return out


def _lower_block(ctx: _BuildCtx, block: IRBlock, parent_id: Optional[str], loop_header_stack: List[str]) -> Tuple[Optional[str], List[Tuple[str, str, Optional[str]]]]:
    entry: Optional[str] = None
    pend: List[Tuple[str, str, Optional[str]]] = []
    for s in block.stmts or []:
        sid, s_pend = _lower_stmt(ctx, s, parent_id, loop_header_stack)
        if sid is None:
            if not ctx.truncated:
                continue
            collapsed = _make_node(ctx.code, "CollapsedBlock", getattr(s, "node", None), parent_id, title="已折叠：后续语句")
            cid = ctx.add_node(collapsed)
            if cid is None:
                return entry, pend
            if entry is None:
                entry = cid
            for (from_id, kind, label) in pend:
                if kind == "Next":
                    ctx.add_edge(make_edge("Next", from_id, cid))
                elif kind == "False":
                    ctx.add_edge(make_edge("False", from_id, cid, "否"))
            return entry, [_pend(cid, "Next", None)]
        if entry is None:
            entry = sid
            pend = s_pend
            continue
        for (from_id, kind, label) in pend:
            if kind == "Next":
                ctx.add_edge(make_edge("Next", from_id, sid, label))
            elif kind == "False":
                ctx.add_edge(make_edge("False", from_id, sid, "否"))
            elif kind == "Return":
                ctx.add_edge(make_edge("Return", from_id, sid, "返回"))
        pend = s_pend
    return entry, pend


def _lower_stmt(ctx: _BuildCtx, stmt: IRStmt, parent_id: Optional[str], loop_header_stack: List[str]) -> Tuple[Optional[str], List[Tuple[str, str, Optional[str]]]]:
    if isinstance(stmt, IRAction):
        nid = ctx.add_node(_make_node(ctx.code, stmt.kind, stmt.node, parent_id, title=stmt.text))
        return nid, [_pend(nid, "Next", None)] if nid else (None, [])

    if isinstance(stmt, IRReturn):
        title = "return" if not stmt.expr else f"return {stmt.expr}"
        nid = ctx.add_node(_make_node(ctx.code, "Return", stmt.node, parent_id, title=title))
        return nid, [_pend(nid, "Return", None)] if nid else (None, [])

    if isinstance(stmt, IRBreak):
        nid = ctx.add_node(_make_node(ctx.code, "Break", stmt.node, parent_id, title="break"))
        if not nid:
            return None, []
        if loop_header_stack:
            return nid, [_pend(nid, "Break", None)]
        ctx.diagnostics.append({"level": "warn", "code": "W_BREAK_OUTSIDE_LOOP", "message": "break 出现在循环外"})
        return nid, []

    if isinstance(stmt, IRContinue):
        nid = ctx.add_node(_make_node(ctx.code, "Continue", stmt.node, parent_id, title="continue"))
        if not nid:
            return None, []
        if loop_header_stack:
            return nid, [_pend(nid, "Continue", None)]
        ctx.diagnostics.append({"level": "warn", "code": "W_CONTINUE_OUTSIDE_LOOP", "message": "continue 出现在循环外"})
        return nid, []

    if isinstance(stmt, IRIf):
        head_id = ctx.add_node(_make_node(ctx.code, "If", stmt.node, parent_id, title=f"if {stmt.cond}"))
        if not head_id:
            return None, []
        then_entry, then_pend = _lower_block(ctx, stmt.then_block, parent_id, loop_header_stack)
        if then_entry:
            ctx.add_edge(make_edge("True", head_id, then_entry, "是"))
        pend: List[Tuple[str, str, Optional[str]]] = []
        pend.extend(then_pend or [])

        cur_false_from = head_id
        for (cond, blk, elif_node) in stmt.elifs:
            elif_id = ctx.add_node(_make_node(ctx.code, "Elif", elif_node, parent_id, title=f"elif {cond}"))
            if not elif_id:
                break
            ctx.add_edge(make_edge("False", cur_false_from, elif_id, "否"))
            e_entry, e_pend = _lower_block(ctx, blk, parent_id, loop_header_stack)
            if e_entry:
                ctx.add_edge(make_edge("True", elif_id, e_entry, "是"))
            pend.extend(e_pend or [])
            cur_false_from = elif_id

        if stmt.else_block is not None:
            else_entry, else_pend = _lower_block(ctx, stmt.else_block, parent_id, loop_header_stack)
            if else_entry:
                ctx.add_edge(make_edge("False", cur_false_from, else_entry, "否"))
                pend.extend(else_pend or [])
            else:
                pend.append(_pend(cur_false_from, "False", None))
        else:
            pend.append(_pend(cur_false_from, "False", None))

        if not pend:
            pend = [_pend(head_id, "Next", None)]
        return head_id, pend

    if isinstance(stmt, IRWhile):
        loop_id = ctx.add_node(_make_node(ctx.code, "While", stmt.node, parent_id, title=f"while {stmt.cond}"))
        if not loop_id:
            return None, []
        loop_header_stack.append(loop_id)
        body_entry, body_pend = _lower_block(ctx, stmt.body, parent_id, loop_header_stack)
        loop_header_stack.pop()
        if body_entry:
            ctx.add_edge(make_edge("True", loop_id, body_entry, "是"))
        pend_map = _split_pend(body_pend)
        for (from_id, _k, _label) in (pend_map.get("Next") or []):
            ctx.add_edge(make_edge("Back", from_id, loop_id, "回边"))
        for (from_id, _k, _label) in (pend_map.get("Continue") or []):
            ctx.add_edge(make_edge("Back", from_id, loop_id, "回边"))
        out: List[Tuple[str, str, Optional[str]]] = []
        for (from_id, _k, _label) in (pend_map.get("Break") or []):
            out.append(_pend(from_id, "Next", "跳出"))
        for (from_id, _k, _label) in (pend_map.get("Return") or []):
            out.append(_pend(from_id, "Return", None))
        out.append(_pend(loop_id, "False", None))
        return loop_id, out

    if isinstance(stmt, IRForRange):
        init_id = ctx.add_node(_make_node(ctx.code, "ForInit", stmt.node, parent_id, title=f"{stmt.var} = {stmt.start}"))
        cond_title = f"{stmt.var} {stmt.direction} {stmt.stop}"
        loop_id = ctx.add_node(_make_node(ctx.code, "For", stmt.node, parent_id, title=cond_title))
        step_title = f"{stmt.var} += {stmt.step}"
        if stmt.step.startswith("-"):
            step_title = f"{stmt.var} -= {stmt.step[1:].strip() or '1'}"
        step_id = ctx.add_node(_make_node(ctx.code, "ForStep", stmt.node, parent_id, title=step_title))
        _mark_synthetic(ctx, init_id)
        _mark_synthetic(ctx, step_id)
        if not loop_id:
            return None, []
        if init_id:
            ctx.add_edge(make_edge("Next", init_id, loop_id))
        loop_header_stack.append(loop_id)
        body_entry, body_pend = _lower_block(ctx, stmt.body, parent_id, loop_header_stack)
        loop_header_stack.pop()
        if body_entry:
            ctx.add_edge(make_edge("True", loop_id, body_entry, "是"))
        if step_id:
            ctx.add_edge(make_edge("Back", step_id, loop_id, "回边"))
        pend_map = _split_pend(body_pend)
        if step_id:
            for (from_id, _k, _label) in (pend_map.get("Next") or []):
                ctx.add_edge(make_edge("Next", from_id, step_id))
            for (from_id, _k, _label) in (pend_map.get("Continue") or []):
                ctx.add_edge(make_edge("Next", from_id, step_id, "继续"))
        else:
            for (from_id, _k, _label) in (pend_map.get("Next") or []):
                ctx.add_edge(make_edge("Back", from_id, loop_id, "回边"))
            for (from_id, _k, _label) in (pend_map.get("Continue") or []):
                ctx.add_edge(make_edge("Back", from_id, loop_id, "回边"))
        out: List[Tuple[str, str, Optional[str]]] = []
        for (from_id, _k, _label) in (pend_map.get("Break") or []):
            out.append(_pend(from_id, "Next", "跳出"))
        for (from_id, _k, _label) in (pend_map.get("Return") or []):
            out.append(_pend(from_id, "Return", None))
        out.append(_pend(loop_id, "False", None))
        return (init_id or loop_id), out

    if isinstance(stmt, IRForEach):
        init_id = ctx.add_node(_make_node(ctx.code, "ForEachInit", stmt.node, parent_id, title=f"_it = iter({stmt.iter_expr})"))
        loop_id = ctx.add_node(_make_node(ctx.code, "ForEach", stmt.node, parent_id, title="还有下一个元素？"))
        next_id = ctx.add_node(_make_node(ctx.code, "ForEachNext", stmt.node, parent_id, title=f"{stmt.var} = next(_it)"))
        _mark_synthetic(ctx, init_id)
        _mark_synthetic(ctx, next_id)
        if not loop_id:
            return None, []
        if init_id:
            ctx.add_edge(make_edge("Next", init_id, loop_id))
        if next_id:
            ctx.add_edge(make_edge("True", loop_id, next_id, "是"))
        loop_header_stack.append(loop_id)
        body_entry, body_pend = _lower_block(ctx, stmt.body, parent_id, loop_header_stack)
        loop_header_stack.pop()
        if next_id and body_entry:
            ctx.add_edge(make_edge("Next", next_id, body_entry))
        pend_map = _split_pend(body_pend)
        for (from_id, _k, _label) in (pend_map.get("Next") or []):
            ctx.add_edge(make_edge("Back", from_id, loop_id, "回边"))
        for (from_id, _k, _label) in (pend_map.get("Continue") or []):
            ctx.add_edge(make_edge("Back", from_id, loop_id, "回边"))
        out: List[Tuple[str, str, Optional[str]]] = []
        for (from_id, _k, _label) in (pend_map.get("Break") or []):
            out.append(_pend(from_id, "Next", "跳出"))
        for (from_id, _k, _label) in (pend_map.get("Return") or []):
            out.append(_pend(from_id, "Return", None))
        out.append(_pend(loop_id, "False", None))
        return (init_id or loop_id), out

    nid = ctx.add_node(_make_node(ctx.code, "Stmt", getattr(stmt, "node", None), parent_id))
    return nid, [_pend(nid, "Next", None)] if nid else (None, [])


def _extract_call_name(stmt: ast.stmt) -> Optional[str]:
    call: Optional[ast.Call] = None
    if isinstance(stmt, ast.Assign):
        if isinstance(stmt.value, ast.Call):
            call = stmt.value
    elif isinstance(stmt, ast.Expr):
        if isinstance(stmt.value, ast.Call):
            call = stmt.value
    elif isinstance(stmt, ast.Return):
        if isinstance(stmt.value, ast.Call):
            call = stmt.value
    if not call:
        return None
    fn = call.func
    if isinstance(fn, ast.Name) and isinstance(fn.id, str) and fn.id:
        return fn.id
    return None


def _node_id_for_stmt(code: str, stmt: ast.stmt, parent_id: str) -> str:
    kind = _kind_of(stmt)
    if kind == "If" and isinstance(stmt, ast.If) and is_elif_if(stmt):
        kind = "Elif"
    return _make_node(code, kind, stmt, parent_id)["id"]


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
        return {
            "version": API_VERSION_FLOW,
            "parserVersion": PARSER_VERSION_FLOW,
            "codeSha256": sha256_text(code),
            "nodes": [],
            "edges": [],
            "diagnostics": diagnostics,
            "stats": {"parseMs": parse_ms, "cacheHit": False, "nodeCount": 0, "edgeCount": 0, "truncated": False},
        }

    ok_ast, ast_count = _collect_ast_nodes(tree, max_ast_nodes)
    if not ok_ast:
        diagnostics.append({"level": "error", "code": E_AST_TOO_LARGE, "message": f"代码结构过大（AST 节点数 {ast_count}），已拒绝解析"})
        parse_ms = int((time.perf_counter() - t0) * 1000)
        return {
            "version": API_VERSION_FLOW,
            "parserVersion": PARSER_VERSION_FLOW,
            "codeSha256": sha256_text(code),
            "nodes": [],
            "edges": [],
            "diagnostics": diagnostics,
            "stats": {"parseMs": parse_ms, "cacheHit": False, "nodeCount": 0, "edgeCount": 0, "truncated": False},
        }

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
            fn_id = ctx.add_node(_make_node(ctx.code, "Function", fn.node, ctx.module_id, title=f"def {fn.sig}"))
            if not fn_id:
                continue
            try:
                ctx.func_name_to_id[str(fn.name or "")] = fn_id
            except Exception:
                pass
            fn_entry, fn_pend = _lower_block(ctx, fn.body, fn_id, [])
            if fn_entry:
                ctx.add_edge(make_edge("Entry", fn_id, fn_entry, "定义"))
            fn_end_id = ctx.add_node(_make_node(ctx.code, "FunctionEnd", fn.node, fn_id, title="函数结束"))
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
                kind = _kind_of(s)
                title = _node_title_wrapper(ctx.code, s)
                from_id = _make_node(ctx.code, kind, s, module_node["id"], title=title)["id"]
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


@router.post("/flow/parse")
async def parse_flow(payload: Dict[str, Any], current_user: Dict[str, Any] = Depends(require_admin)):
    user_id = int(current_user.get("id") or 0)
    code = payload.get("code")
    if not isinstance(code, str):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="code 必须为字符串")

    if len(code.encode("utf-8")) > MAX_CODE_SIZE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="code 过大")

    options = payload.get("options")
    if not isinstance(options, dict):
        options = {}
    limits = options.get("limits")
    if not isinstance(limits, dict):
        limits = {}
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
        if int(cur) > WS_RATE_LIMIT_PER_SEC: # Reuse rate limit
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="请求过于频繁")
    except HTTPException:
        raise
    except Exception:
        pass

    try:
        built = await asyncio.wait_for(asyncio.to_thread(_build_flow, code, options), timeout=max(0.2, max_parse_ms / 1000.0))
    except asyncio.TimeoutError:
        built = {
            "version": API_VERSION_FLOW,
            "parserVersion": PARSER_VERSION_FLOW,
            "codeSha256": sha,
            "nodes": [],
            "edges": [],
            "diagnostics": [{"level": "error", "code": E_PARSE_TIMEOUT, "message": "解析超时，已中止"}],
            "stats": {"parseMs": max_parse_ms, "cacheHit": False, "nodeCount": 0, "edgeCount": 0, "truncated": False},
        }

    try:
        ttl = 3600
        await cache.set(cache_key, built, expire_seconds=ttl)
    except Exception:
        pass

    return built
