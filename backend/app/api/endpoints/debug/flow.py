import asyncio
import ast
import time
from typing import Any, Dict, List, Optional, Tuple, Set

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.deps import require_user, require_admin
from app.db.database import get_db
from app.models.core.feature_flag import FeatureFlag
from app.models.agents.optimization import OptimizeLog
from app.utils.cache import cache
from app.api.endpoints.debug.structured_ir import (
    IRAction,
    IRBlock,
    IRBreak,
    IRClass,
    IRContinue,
    IRForEach,
    IRForRange,
    IRFunction,
    IRIf,
    IRImport,
    IRReturn,
    IRStmt,
    IRTry,
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

COMPLEX_SPLIT_THRESHOLD = 2


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
                it = ast.unparse(n.iter).strip()
                return f"has_next(iter({it}))"
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

    if isinstance(n, ast.Try):
        return "try"

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
    if isinstance(stmt, ast.Try):
        return "Try"
    if isinstance(stmt, ast.Assign):
        return "Assign"
    if isinstance(stmt, ast.AugAssign):
        return "AugAssign"
    if isinstance(stmt, ast.Expr):
        return "Expr"
    return "Stmt"


def _teaching_condition_title(prefix: str, expr: Optional[str], fallback_expr: str) -> str:
    cond = str(expr or "").strip()
    if not cond or cond.lower() == "cond":
        cond = fallback_expr
    return f"{cond}?"


def _teaching_action_title(kind: str, text: Optional[str]) -> str:
    normalized = str(text or "").strip()
    if normalized:
        sep = "：" if "：" in normalized else (":" if ":" in normalized else "")
        if sep:
            idx = normalized.find(sep)
            prefix = normalized[:idx].strip() if idx >= 0 else ""
            suffix = normalized[idx + 1 :].strip() if idx >= 0 else ""
            if prefix and (
                "步骤" in prefix
                or "取第一个元素" in prefix
                or "获取下一个元素" in prefix
                or "分支判断" in prefix
                or "循环判断" in prefix
                or "否则如果" in prefix
            ):
                if suffix:
                    return suffix
                return normalized
    if normalized and normalized != kind:
        return normalized
    if kind in {"Assign", "AugAssign", "Expr"}:
        return kind
    return "stmt"


def _expr_complexity_score(expr: Optional[str]) -> int:
    text = str(expr or "").strip()
    if not text:
        return 0
    score = 0
    if "(" in text or ")" in text:
        score += 1
    if any(op in text for op in ("+", "-", "*", "/", "%", "==", "!=", ">=", "<=", ">", "<", " and ", " or ")):
        score += 1
    if "," in text:
        score += 1
    if "[" in text or "]" in text or "{" in text or "}" in text:
        score += 1
    if len(text) > 24:
        score += 1
    return score



def _for_each_requires_split(stmt: IRForEach) -> bool:
    score = 1 + _expr_complexity_score(stmt.iter_expr)
    if len(stmt.body.stmts) > 1:
        score += 1
    return score >= COMPLEX_SPLIT_THRESHOLD


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
            n["synthetic"] = True
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
    if isinstance(stmt, IRClass):
        head_id = ctx.add_node(_make_node(ctx.code, "Start", stmt.node, parent_id, title=f"定义类：{stmt.name}"))
        if not head_id:
            return None, []
        
        # Class body is executed on definition
        body_entry, body_pend = _lower_block(ctx, stmt.body, head_id, loop_header_stack)
        
        if body_entry:
            ctx.add_edge(make_edge("Entry", head_id, body_entry, "定义"))
            
        end_id = ctx.add_node(_make_node(ctx.code, "End", stmt.node, head_id, title="类定义结束"))
        if end_id:
            # Connect all body exits to End Class
            for (from_id, k, label) in body_pend:
                if k == "Next":
                    ctx.add_edge(make_edge("Next", from_id, end_id, label))
                elif k == "Return":
                    # Class body return? Rare, but semantically "end of body"
                    ctx.add_edge(make_edge("Next", from_id, end_id, "结束"))
                # Break/Continue in class body? Invalid syntax usually, but handle gracefully
        
        return head_id, [_pend(end_id or head_id, "Next", None)]

    if isinstance(stmt, IRImport):
        # Flatten names
        title = ""
        if stmt.from_module:
            title = f"导入：from {stmt.from_module} import {', '.join(stmt.names)}"
        else:
            title = f"导入：import {', '.join(stmt.names)}"
        
        nid = ctx.add_node(_make_node(ctx.code, "Process", stmt.node, parent_id, title=title))
        return nid, [_pend(nid, "Next", None)] if nid else (None, [])

    if isinstance(stmt, IRAction):
        # Check for I/O semantic mapping
        kind = stmt.kind
        title = _teaching_action_title(kind, stmt.text)
        
        # Check for print() -> Output
        # ... (Existing I/O logic)
        
        # Check for List/Dict operations
        # Inspect the AST node
        target_node = stmt.node
        if isinstance(target_node, ast.Expr):
            target_node = target_node.value
        elif isinstance(target_node, ast.Assign):
            target_node = target_node.value
            
        if isinstance(target_node, ast.Call) and isinstance(target_node.func, ast.Attribute):
            method_name = target_node.func.attr
            if method_name in {"append", "insert", "remove", "sort", "reverse", "extend", "clear"}:
                kind = "list_op"
            elif method_name in {"get", "keys", "values", "items", "update"}:
                kind = "dict_op"
            elif method_name == "pop":
                # ambiguous, default to list_op for now or generic process
                kind = "list_op"
            elif method_name in {"split", "strip", "lstrip", "rstrip", "upper", "lower",
                                  "replace", "join", "find", "rfind", "startswith", "endswith",
                                  "format", "count", "index", "title", "capitalize", "swapcase",
                                  "center", "ljust", "rjust", "zfill", "encode", "decode"}:
                kind = "str_op"

        # Check for print() -> Output (Re-apply existing logic with kind override check)
        if isinstance(stmt.node, ast.Expr) and isinstance(stmt.node.value, ast.Call):
            call = stmt.node.value
            if isinstance(call.func, ast.Name) and call.func.id == "print":
                kind = "Output"
            elif isinstance(call.func, ast.Name) and call.func.id == "input":
                kind = "Input"
            elif isinstance(call.func, ast.Name) and kind not in ("list_op", "dict_op", "str_op"):
                kind = "Subprocess"
        
        if isinstance(stmt.node, ast.Assign) and isinstance(stmt.node.value, ast.Call):
            call = stmt.node.value
            if isinstance(call.func, ast.Name) and call.func.id == "input":
                kind = "Input"

        nid = ctx.add_node(_make_node(ctx.code, kind, stmt.node, parent_id, title=title))
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
        head_id = ctx.add_node(_make_node(ctx.code, "If", stmt.node, parent_id, title=_teaching_condition_title("判断", stmt.cond, "条件表达式")))
        if not head_id:
            return None, []
        then_entry, then_pend = _lower_block(ctx, stmt.then_block, parent_id, loop_header_stack)
        if then_entry:
            ctx.add_edge(make_edge("True", head_id, then_entry, "是"))
        pend: List[Tuple[str, str, Optional[str]]] = []
        pend.extend(then_pend or [])

        cur_false_from = head_id
        for (cond, blk, elif_node) in stmt.elifs:
            elif_id = ctx.add_node(_make_node(ctx.code, "Elif", elif_node, parent_id, title=_teaching_condition_title("否则判断", cond, "条件表达式")))
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
        loop_id = ctx.add_node(_make_node(ctx.code, "While", stmt.node, parent_id, title=_teaching_condition_title("循环", stmt.cond, "循环条件")))
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
        if str(stmt.step).strip() == "1":
            iter_expr = f"range({stmt.start}, {stmt.stop})"
        else:
            iter_expr = f"range({stmt.start}, {stmt.stop}, {stmt.step})"
        # 区间风格：所有 range 都拆分为 初始化 → 条件(区间) → 循环体 → 递增
        step_text = str(stmt.step).strip()
        step_num = int(step_text) if step_text.lstrip("-").isdigit() else None
        is_neg = step_num is not None and step_num < 0
        step_annotation = "" if step_text in ("1", "-1") else f", 步长={step_text}"
        init_title = f"{stmt.var} = {stmt.start}"
        if is_neg:
            cond_title = f"{stmt.var} ∈ ({stmt.stop}, {stmt.start}]{step_annotation}?"
        else:
            cond_title = f"{stmt.var} ∈ [{stmt.start}, {stmt.stop}){step_annotation}?"
        if step_text == "1":
            inc_title = f"{stmt.var} += 1"
        elif step_text == "-1":
            inc_title = f"{stmt.var} -= 1"
        elif step_num is not None and step_num < 0:
            inc_title = f"{stmt.var} -= {abs(step_num)}"
        else:
            inc_title = f"{stmt.var} += {step_text}"
        init_id = ctx.add_node(
            _make_node(ctx.code, "ForInit", stmt.node, parent_id, title=init_title)
        )
        loop_id = ctx.add_node(_make_node(ctx.code, "For", stmt.node, parent_id, title=cond_title))
        _mark_synthetic(ctx, init_id)
        if not loop_id:
            return None, []
        if init_id:
            ctx.add_edge(make_edge("Next", init_id, loop_id))
        loop_header_stack.append(loop_id)
        body_entry, body_pend = _lower_block(ctx, stmt.body, parent_id, loop_header_stack)
        loop_header_stack.pop()
        inc_id = ctx.add_node(
            _make_node(ctx.code, "ForStep", stmt.node, parent_id, title=inc_title)
        )
        _mark_synthetic(ctx, inc_id)
        if body_entry:
            ctx.add_edge(make_edge("True", loop_id, body_entry, "是"))
        pend_map = _split_pend(body_pend)
        for (from_id, _k, _label) in (pend_map.get("Next") or []):
            if inc_id:
                ctx.add_edge(make_edge("Next", from_id, inc_id))
            else:
                ctx.add_edge(make_edge("Back", from_id, loop_id, "回边"))
        for (from_id, _k, _label) in (pend_map.get("Continue") or []):
            if inc_id:
                ctx.add_edge(make_edge("Next", from_id, inc_id))
            else:
                ctx.add_edge(make_edge("Back", from_id, loop_id, "回边"))
        if inc_id:
            ctx.add_edge(make_edge("Back", inc_id, loop_id, "回边"))
        out: List[Tuple[str, str, Optional[str]]] = []
        for (from_id, _k, _label) in (pend_map.get("Break") or []):
            out.append(_pend(from_id, "Next", "跳出"))
        for (from_id, _k, _label) in (pend_map.get("Return") or []):
            out.append(_pend(from_id, "Return", None))
        out.append(_pend(loop_id, "False", None))
        return (init_id or loop_id), out

    if isinstance(stmt, IRForEach):
        cond_title = f"{stmt.iter_expr} 未遍历完?"
        loop_id = ctx.add_node(_make_node(ctx.code, "ForEach", stmt.node, parent_id, title=cond_title))
        next_id = ctx.add_node(_make_node(ctx.code, "ForEachNext", stmt.node, parent_id, title=f"{stmt.var} = 当前元素"))
        _mark_synthetic(ctx, next_id)
        if not loop_id:
            return None, []
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
        return loop_id, out

    if isinstance(stmt, IRTry):
        head_id = ctx.add_node(_make_node(ctx.code, "Try", stmt.node, parent_id, title="尝试执行"))
        if not head_id:
            return None, []
            
        # Try Body
        body_entry, body_pend = _lower_block(ctx, stmt.body, parent_id, loop_header_stack)
        if body_entry:
            ctx.add_edge(make_edge("Next", head_id, body_entry))
            
        # Collect all exits from body
        # Normal exits go to Orelse (if present) or Finally (if present) or Next
        # Exception exits go to Handlers
        
        # In this simplified visualization, we connect body ends to Finally or Next
        # And we implicitly link Try head to Handlers (as if catching from head) 
        # This is a visualization compromise. A true CFG would link every statement in body to handlers.
        
        pend: List[Tuple[str, str, Optional[str]]] = []
        
        # Link handlers
        for (typ, handler_block) in stmt.handlers:
            h_id = ctx.add_node(_make_node(ctx.code, "Except", stmt.node, parent_id, title=f"捕获异常：{typ}"))
            if h_id:
                ctx.add_edge(make_edge("Exception", head_id, h_id, "异常"))
                h_entry, h_pend = _lower_block(ctx, handler_block, parent_id, loop_header_stack)
                if h_entry:
                    ctx.add_edge(make_edge("Next", h_id, h_entry))
                pend.extend(h_pend or [])

        # Process Body pendings
        # If we have else/finally, flow goes there.
        target_after_body = None
        if stmt.orelse:
            # If we have else block, normal execution goes there
            else_entry, else_pend = _lower_block(ctx, stmt.orelse, parent_id, loop_header_stack)
            if else_entry:
                # All 'Next' from body go to else_entry
                for (from_id, k, label) in body_pend:
                    if k == "Next":
                        ctx.add_edge(make_edge("Next", from_id, else_entry, label))
                    else:
                        pend.append((from_id, k, label))
                pend.extend(else_pend or [])
            else:
                pend.extend(body_pend or [])
        else:
            pend.extend(body_pend or [])
            
        # Finally block
        if stmt.finalbody:
            fin_entry, fin_pend = _lower_block(ctx, stmt.finalbody, parent_id, loop_header_stack)
            if fin_entry:
                # All pending 'Next' from above (body+else+handlers) go to finally
                # Note: Break/Return/Continue also execute finally, but visualizing that is hard.
                # We usually just link Next.
                new_pend: List[Tuple[str, str, Optional[str]]] = []
                for (from_id, k, label) in pend:
                    if k == "Next":
                        ctx.add_edge(make_edge("Next", from_id, fin_entry, label))
                    else:
                        new_pend.append((from_id, k, label))
                pend = new_pend
                pend.extend(fin_pend or [])
        
        return head_id, pend

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


import json
from app.services.agents.code_generator import code_generator_client

import os
from pathlib import Path

# ... (imports)

PROMPT_TEMPLATE_PATH = Path(__file__).resolve().parents[4] / "prompts" / "flowchart_to_python.txt"
OPTIMIZE_CODE_TEMPLATE_PATH = Path(__file__).resolve().parents[4] / "prompts" / "optimize_code.txt"

DEFAULT_OPTIMIZE_CODE_PROMPT = """你是一位资深 Python 代码优化专家。
请在不改变原始业务语义的前提下优化代码，可提升可读性、健壮性和性能。
输出必须满足以下要求：
1. 仅输出可直接运行的 Python 代码。
2. 不要输出解释、标题、前后缀、注释说明或 Markdown 代码块标记。
3. 严格保持与输入代码语义一致。"""

def _strip_markdown_fence(content: str) -> str:
    text = (content or "").strip()
    if not text:
        return ""
    if text.startswith("```"):
        lines = text.splitlines()
        if lines:
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def _normalize_optimized_python_code(raw: str) -> str:
    text = _strip_markdown_fence(raw)
    try:
        ast.parse(text)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI returned invalid python code: {exc}") from exc
    return text


def _ensure_conservative_code_optimization(original_code: str, optimized_code: str) -> str:
    try:
        original_tree = ast.parse(original_code or "")
        optimized_tree = ast.parse(optimized_code or "")
    except Exception:
        return optimized_code

    def _collect_symbols(tree: ast.AST) -> Tuple[Set[str], Set[str]]:
        funcs: Set[str] = set()
        classes: Set[str] = set()
        for n in ast.walk(tree):
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
                funcs.add(str(getattr(n, "name", "") or ""))
            elif isinstance(n, ast.ClassDef):
                classes.add(str(getattr(n, "name", "") or ""))
        funcs.discard("")
        classes.discard("")
        return funcs, classes

    original_funcs, original_classes = _collect_symbols(original_tree)
    optimized_funcs, optimized_classes = _collect_symbols(optimized_tree)
    if not original_funcs.issubset(optimized_funcs):
        raise HTTPException(status_code=502, detail="AI changed key function names; optimization rejected")
    if not original_classes.issubset(optimized_classes):
        raise HTTPException(status_code=502, detail="AI changed key class names; optimization rejected")
    return optimized_code


# ... (other functions)

@router.post("/optimize/code")
async def optimize_code(
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Optimize Python code using AI
    """
    code = payload.get("code")
    if not isinstance(code, str):
        raise HTTPException(status_code=400, detail="code must be a string")

    # Fetch agent config
    api_url, api_key, model = await _get_agent_config(db)
    if not api_url or not api_key:
        raise HTTPException(status_code=503, detail="AI Agent not configured")

    # Load prompt
    prompt_template = DEFAULT_OPTIMIZE_CODE_PROMPT
    if OPTIMIZE_CODE_TEMPLATE_PATH.exists():
        try:
            prompt_template = OPTIMIZE_CODE_TEMPLATE_PATH.read_text(encoding="utf-8")
        except Exception:
            pass

    # Call AI
    messages = [
        {"role": "system", "content": prompt_template},
        {"role": "user", "content": code}
    ]
    
    try:
        result = await asyncio.wait_for(
            code_generator_client.chat_completion(
                messages, api_url=api_url, api_key=api_key, model=model
            ),
            timeout=60.0
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="AI request timed out")

    if not result["success"]:
        raise HTTPException(status_code=502, detail=result.get("error", "AI request failed"))

    optimized_code = _normalize_optimized_python_code(result["message"])
    optimized_code = _ensure_conservative_code_optimization(code, optimized_code)

    # Log to DB
    log_entry = OptimizeLog(
        user_id=int(current_user.get("id") or 0),
        type="code",
        original_content=code,
        optimized_content=optimized_code,
        status="pending"
    )
    db.add(log_entry)
    await db.commit()
    await db.refresh(log_entry)

    return {"optimized_code": optimized_code, "log_id": log_entry.id, "rollback_id": log_entry.rollback_id}


@router.post("/optimize/apply/{log_id}")
async def apply_optimization(
    log_id: int,
    current_user: Dict[str, Any] = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark optimization as applied
    """
    query = select(OptimizeLog).where(OptimizeLog.id == log_id)
    result = await db.execute(query)
    log_entry = result.scalar_one_or_none()
    
    if not log_entry:
        raise HTTPException(status_code=404, detail="Log not found")
        
    log_entry.status = "applied"
    await db.commit()
    return {"success": True}


@router.get("/optimize/rollback/{log_id}")
async def rollback_optimization(
    log_id: int,
    current_user: Dict[str, Any] = Depends(require_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get original content for rollback
    """
    query = select(OptimizeLog).where(OptimizeLog.id == log_id)
    result = await db.execute(query)
    log_entry = result.scalar_one_or_none()
    
    if not log_entry:
        raise HTTPException(status_code=404, detail="Log not found")
    
    content = log_entry.original_content
    if log_entry.type == "flow":
        try:
            content = json.loads(content)
        except (json.JSONDecodeError, TypeError, ValueError):
            pass
            
    return {"original_content": content, "type": log_entry.type}


async def _get_agent_config(db: AsyncSession):
    try:
        query = select(FeatureFlag).where(FeatureFlag.key == "python_lab_agent_config")
        result = await db.execute(query)
        config_entry = result.scalar_one_or_none()
        if config_entry and config_entry.value:
            return config_entry.value.get("api_url"), config_entry.value.get("api_key"), config_entry.value.get("model")
    except Exception:
        pass
    return None, None, None


@router.get("/flow/prompt_template")
async def get_prompt_template(current_user: Dict[str, Any] = Depends(require_admin)):
    """
    读取提示词模板文件内容
    """
    if not PROMPT_TEMPLATE_PATH.exists():
        return {"content": ""}
    try:
        content = PROMPT_TEMPLATE_PATH.read_text(encoding="utf-8")
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read prompt file: {e}")

@router.post("/flow/prompt_template")
async def save_prompt_template(payload: Dict[str, str], current_user: Dict[str, Any] = Depends(require_admin)):
    """
    保存提示词模板文件内容
    """
    content = payload.get("content", "")
    try:
        PROMPT_TEMPLATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        PROMPT_TEMPLATE_PATH.write_text(content, encoding="utf-8")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write prompt file: {e}")

@router.post("/ai/chat")
async def ai_chat(
    payload: Dict[str, Any], 
    current_user: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    通用 AI 对话接口
    """
    messages = payload.get("messages")
    if not isinstance(messages, list):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="messages must be a list")

    # Fetch agent config from DB
    api_url = None
    api_key = None
    model = None
    
    try:
        query = select(FeatureFlag).where(FeatureFlag.key == "python_lab_agent_config")
        result = await db.execute(query)
        config_entry = result.scalar_one_or_none()
        if config_entry and config_entry.value:
            api_url = config_entry.value.get("api_url")
            api_key = config_entry.value.get("api_key")
            model = config_entry.value.get("model")
    except Exception:
        pass

    try:
        result = await asyncio.wait_for(
            code_generator_client.chat_completion(
                messages,
                api_url=api_url,
                api_key=api_key,
                model=model
            ),
            timeout=18.0,
        )
    except asyncio.TimeoutError:
        return {"error": "AI request timeout", "message": ""}
    
    if result["success"]:
        return {"message": result["message"]}
    
    return {"error": result["error"], "message": ""}

@router.post("/flow/generate_code")
async def generate_code_from_flow(
    payload: Dict[str, Any], 
    current_user: Dict[str, Any] = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    使用 AI 智能体根据流程图生成 Python 代码
    """
    flow_json = payload.get("flow")
    if not isinstance(flow_json, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="flow 必须为 JSON 对象")

    # Fetch agent config from DB (only URL and Key)
    api_url = None
    api_key = None
    model = None
    
    try:
        query = select(FeatureFlag).where(FeatureFlag.key == "python_lab_agent_config")
        result = await db.execute(query)
        config_entry = result.scalar_one_or_none()
        if config_entry and config_entry.value:
            api_url = config_entry.value.get("api_url")
            api_key = config_entry.value.get("api_key")
            model = config_entry.value.get("model")
    except Exception:
        pass

    # Read prompt template from file
    prompt_template = None
    if PROMPT_TEMPLATE_PATH.exists():
        try:
            prompt_template = PROMPT_TEMPLATE_PATH.read_text(encoding="utf-8")
        except Exception:
            pass

    # Call Agent API
    try:
        result = await asyncio.wait_for(
            code_generator_client.generate_code(
                flow_json,
                api_url=api_url,
                api_key=api_key,
                prompt_template=prompt_template,
                model=model
            ),
            timeout=20.0,
        )
    except asyncio.TimeoutError:
        return {"error": "AI request timeout", "code": ""}
    
    if result["success"]:
        return {"code": result["python_code"]}
    
    # If agent fails, return error to let frontend fallback
    return {"error": result["error"], "code": ""}



@router.post("/flow/test_agent_connection")
async def test_agent_connection(
    payload: Dict[str, Any]
):
    """
    测试智能体连接配置 (Allow anonymous for dev test only, or fix auth)
    Uses chat_completion with a simple ping to verify connectivity and auth.
    """
    api_url = payload.get("api_url")
    api_key = payload.get("api_key")
    model = payload.get("model")
    
    # Simple ping message to test connection
    messages = [{"role": "user", "content": "Hello, are you online?"}]

    result = await code_generator_client.chat_completion(
        messages, 
        api_url=api_url, 
        api_key=api_key,
        model=model
    )
    
    # Map chat result to expected test response format
    if result["success"]:
        return {"success": True, "python_code": "# Connection Successful\n# AI Response: " + result["message"]}
    else:
        return {"success": False, "error": result["error"], "python_code": ""}

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
