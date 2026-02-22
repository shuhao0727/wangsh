import ast
import hashlib
import json
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timezone

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def stable_id(*parts: str) -> str:
    raw = "|".join([p or "" for p in parts])
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]

def sha256_text(s: str) -> str:
    return hashlib.sha256((s or "").encode("utf-8")).hexdigest()

def options_hash(options: Dict[str, Any]) -> str:
    try:
        raw = json.dumps(options or {}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    except Exception:
        raw = str(options or {})
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]

def range_from_ast(n: ast.AST) -> Dict[str, int]:
    sl = int(getattr(n, "lineno", 1) or 1)
    sc0 = int(getattr(n, "col_offset", 0) or 0)
    el = int(getattr(n, "end_lineno", sl) or sl)
    ec0 = int(getattr(n, "end_col_offset", sc0) or sc0)
    return {"startLine": sl, "startCol": sc0 + 1, "endLine": el, "endCol": ec0 + 1}

def node_title(code: str, n: ast.AST) -> str:
    try:
        seg = ast.get_source_segment(code, n)
        if isinstance(seg, str) and seg.strip():
            return seg.strip()
    except Exception:
        pass
        
    rng = range_from_ast(n)
    lines = code.splitlines()
    idx = rng["startLine"] - 1
    if 0 <= idx < len(lines):
        return lines[idx].strip()
    return type(n).__name__

def is_elif_if(n: ast.If) -> bool:
    return bool(getattr(n, "_pythonlab_is_elif", False))

def mark_elif_chain(n: ast.AST) -> None:
    for child in ast.walk(n):
        if isinstance(child, ast.If):
            for o in getattr(child, "orelse", []) or []:
                if isinstance(o, ast.If):
                    setattr(o, "_pythonlab_is_elif", True)

def make_edge(kind: str, from_id: str, to_id: str, label: Optional[str] = None) -> Dict[str, Any]:
    eid = stable_id(kind, from_id, to_id, label or "")
    e: Dict[str, Any] = {"id": eid, "from": from_id, "to": to_id, "kind": kind}
    if label:
        e["label"] = label
    return e


def kind_of(n: ast.AST) -> str:
    if isinstance(n, ast.FunctionDef):
        return "Function"
    if isinstance(n, ast.AsyncFunctionDef):
        return "AsyncFunction"
    if isinstance(n, ast.ClassDef):
        return "Class"
    if isinstance(n, ast.If):
        return "If"
    if isinstance(n, ast.While):
        return "While"
    if isinstance(n, ast.For):
        return "For"
    if isinstance(n, ast.AsyncFor):
        return "AsyncFor"
    if isinstance(n, ast.Return):
        return "Return"
    if isinstance(n, ast.Break):
        return "Break"
    if isinstance(n, ast.Continue):
        return "Continue"
    if isinstance(n, ast.Assign):
        return "Assign"
    if isinstance(n, ast.AugAssign):
        return "AugAssign"
    if isinstance(n, ast.AnnAssign):
        return "AnnAssign"
    if isinstance(n, ast.Expr):
        return "Expr"
    if isinstance(n, ast.Pass):
        return "Pass"
    if isinstance(n, ast.Raise):
        return "Raise"
    if isinstance(n, ast.Assert):
        return "Assert"
    if isinstance(n, ast.Delete):
        return "Delete"
    if isinstance(n, ast.Try):
        return "Try"
    if isinstance(n, ast.Import):
        return "Import"
    if isinstance(n, ast.ImportFrom):
        return "ImportFrom"
    if isinstance(n, ast.Global):
        return "Global"
    if isinstance(n, ast.Nonlocal):
        return "Nonlocal"
    if isinstance(n, ast.With):
        return "With"
    if isinstance(n, ast.AsyncWith):
        return "AsyncWith"
    return "Stmt"
