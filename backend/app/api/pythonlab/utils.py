import ast
import hashlib
import json
import re
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from app.api.pythonlab.constants import MAX_NODE_TITLE_CHARS

# 与 CPython ast._splitlines_no_ff 对齐：只认 \r\n、\r、\n，
# 不把 \f、\v 等 str.splitlines 认作换行，否则行号与列偏移会错位。
# 注意：CPython AST 的 col_offset / end_col_offset 是行内 UTF-8 字节偏移而非字符下标，
# 因此行索引必须建在 UTF-8 字节串上，否则含中文/多字节字符时会跨行错切。
_LINE_BREAK_BYTES = re.compile(rb"\r\n|[\r\n]")


class SourceText(str):
    """代码字符串 + 一次性的 UTF-8 行起始字节偏移索引。

    ast.get_source_segment 每次调用都重新切分整个源码，并按行前缀编码切片，
    2000 个节点在 240KB 代码上实测约 1 秒；建好 UTF-8 行索引后单节点开销只与片段上限有关。
    继承 str 是为了让既有的字符串用法（ast.parse、编解码、长度比较）保持原样。
    """

    _utf8: Optional[bytes]
    _line_starts: Optional[List[int]]

    def __new__(cls, value: str) -> "SourceText":
        obj = super().__new__(cls, value or "")
        obj._utf8 = None
        obj._line_starts = None
        return obj

    def _index(self) -> tuple[bytes, List[int]]:
        if self._utf8 is None or self._line_starts is None:
            utf8 = self.encode("utf-8")
            starts = [0]
            if utf8:
                starts.extend(m.end() for m in _LINE_BREAK_BYTES.finditer(utf8) if m.end() < len(utf8))
                starts.append(len(utf8))
            self._utf8 = utf8
            self._line_starts = starts
        return self._utf8, self._line_starts

    def _byte_span(self, n: ast.AST, starts: List[int]) -> Optional[tuple[int, int]]:
        try:
            lineno, end_lineno = int(n.lineno) - 1, int(n.end_lineno) - 1
            start_col, end_col = int(n.col_offset), int(n.end_col_offset)
        except (AttributeError, TypeError, ValueError):
            return None
        if min(lineno, start_col, end_col) < 0 or not (lineno <= end_lineno < len(starts) - 1):
            return None
        start = min(starts[lineno] + start_col, starts[lineno + 1])
        stop = min(starts[end_lineno] + end_col, starts[end_lineno + 1])
        return (start, stop) if start <= stop else None

    def segment(self, n: ast.AST, limit: int = 0) -> Optional[str]:
        """按节点取源码片段；limit > 0 时最多返回该字符长度，不复制整段。"""
        utf8, starts = self._index()
        span = self._byte_span(n, starts)
        if span is None:
            return None
        start, stop = span
        if limit > 0 and stop - start > limit * 4:
            # 1 个 Unicode 字符至多 4 个 UTF-8 字节；截断尾部可能残留的半个多字节字符后再按字符限长。
            return utf8[start : start + limit * 4].decode("utf-8", errors="ignore")[:limit]
        try:
            decoded = utf8[start:stop].decode("utf-8")
        except UnicodeDecodeError:
            return None
        return decoded[:limit] if limit > 0 else decoded


def source_segment(code: str, n: ast.AST, limit: int = 0) -> Optional[str]:
    """取节点源码片段；limit > 0 时最多返回该长度。"""
    if isinstance(code, SourceText):
        return code.segment(n, limit)
    try:
        seg = ast.get_source_segment(code, n)
    except Exception:
        return None
    if isinstance(seg, str) and limit > 0 and len(seg) > limit:
        return seg[:limit]
    return seg


def clamp_title(text: Optional[str], limit: int = MAX_NODE_TITLE_CHARS) -> str:
    """收敛展示文本长度；被截断时以省略号标记，便于前端提示未显示全。"""
    value = (text or "").strip()
    if limit > 0 and len(value) > limit:
        return value[:limit].rstrip() + "…"
    return value


def bounded_source_segment(code: str, n: ast.AST, limit: int) -> str:
    """按上限取节点源码片段，被截断时以省略号结尾。

    多取一个字符再判长，才能区分“恰好等于上限”和“已被截断”；
    先判长再 strip，避免截断点落在换行缩进空白时漏加省略号。
    """
    seg = source_segment(code, n, limit + 1 if limit > 0 else 0)
    if not seg:
        return ""
    if limit > 0 and len(seg) > limit:
        body = seg[:limit].strip()
        return f"{body}…" if body else ""
    return seg.strip()


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
    seg = bounded_source_segment(code, n, MAX_NODE_TITLE_CHARS)
    if seg:
        return seg

    rng = range_from_ast(n)
    lines = code.splitlines()
    idx = rng["startLine"] - 1
    if 0 <= idx < len(lines):
        return clamp_title(lines[idx])
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
