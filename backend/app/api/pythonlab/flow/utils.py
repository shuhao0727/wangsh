"""
Flow 工具函数模块

包含各种辅助函数和常量。
"""

import ast
import time
from typing import Any, Dict, List, Optional, Tuple, Set

from app.api.pythonlab.utils import (
    is_elif_if,
    make_edge,
    node_title,
    options_hash,
    range_from_ast,
    sha256_text,
    stable_id,
)

from .constants import COMPLEX_SPLIT_THRESHOLD


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


def _for_each_requires_split(stmt) -> bool:
    """检查 ForEach 是否需要拆分"""
    from app.api.pythonlab.structured_ir import IRForEach
    if not isinstance(stmt, IRForEach):
        return False
    score = 1 + _expr_complexity_score(stmt.iter_expr)
    if len(stmt.body.stmts) > 1:
        score += 1
    return score >= COMPLEX_SPLIT_THRESHOLD


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


def _mark_synthetic(ctx, nid: Optional[str]) -> None:
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


def _pend(from_id: str, kind: str, label: Optional[str] = None) -> Tuple[str, str, Optional[str]]:
    return (from_id, kind, label)


def _split_pend(pend: List[Tuple[str, str, Optional[str]]]) -> Dict[str, List[Tuple[str, str, Optional[str]]]]:
    out: Dict[str, List[Tuple[str, str, Optional[str]]]] = {}
    for p in pend or []:
        out.setdefault(p[1], []).append(p)
    return out