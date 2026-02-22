import asyncio
import ast
import hashlib
import json
import time
from typing import Any, Dict, List, Optional, Set, Tuple, Union

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import require_admin
from app.utils.cache import cache
from app.api.endpoints.debug.constants import (
    API_VERSION_PSEUDO,
    CACHE_KEY_PSEUDO_PREFIX,
    DEFAULT_MAX_PARSE_MS,
    E_PARSE_TIMEOUT,
    E_SYNTAX,
    MAX_CODE_SIZE_BYTES,
    PARSER_VERSION_PSEUDO,
    WS_RATE_LIMIT_PER_SEC,
)

router = APIRouter()


def _now_ms() -> int:
    return int(time.time() * 1000)


def _sha256_text(s: str) -> str:
    return hashlib.sha256((s or "").encode("utf-8")).hexdigest()


def _options_hash(options: Dict[str, Any]) -> str:
    try:
        raw = json.dumps(options or {}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    except Exception:
        raw = str(options or {})
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def _range_from_ast(n: ast.AST) -> Dict[str, int]:
    sl = int(getattr(n, "lineno", 1) or 1)
    sc0 = int(getattr(n, "col_offset", 0) or 0)
    el = int(getattr(n, "end_lineno", sl) or sl)
    ec0 = int(getattr(n, "end_col_offset", sc0) or sc0)
    return {"startLine": sl, "startCol": sc0 + 1, "endLine": el, "endCol": ec0 + 1}


class _CodeView:
    __slots__ = ("code", "lines", "_contains_cache", "_seg_cache", "_call_cache")

    def __init__(self, code: str, tree: Optional[ast.AST] = None):
        self.code = code
        self.lines = code.splitlines()
        self._contains_cache: Dict[Tuple[int, str], bool] = {}
        self._seg_cache: Dict[int, str] = {}
        self._call_cache: Dict[int, Set[str]] = {}
        if tree:
            self._precompute_calls(tree)

    def _precompute_calls(self, tree: ast.AST) -> None:
        """
        Pre-compute interesting calls for each statement node to avoid O(N^2) walk.
        We only care about 'input' and 'print' for now.
        """
        for node in ast.walk(tree):
            if isinstance(node, (ast.Assign, ast.AnnAssign, ast.Expr, ast.AugAssign)):
                calls: Set[str] = set()
                for child in ast.walk(node):
                    if isinstance(child, ast.Call):
                        func = child.func
                        if isinstance(func, ast.Name) and func.id in {"input", "print"}:
                            calls.add(func.id)
                if calls:
                    self._call_cache[id(node)] = calls

    def seg(self, n: Optional[ast.AST]) -> str:
        if n is None:
            return ""
        key = id(n)
        cached = self._seg_cache.get(key)
        if cached is not None:
            return cached

        sl = int(getattr(n, "lineno", 0) or 0)
        sc0 = int(getattr(n, "col_offset", 0) or 0)
        el = int(getattr(n, "end_lineno", sl) or sl)
        ec0 = int(getattr(n, "end_col_offset", sc0) or sc0)
        out = ""

        try:
            if sl <= 0 or el <= 0 or sl > el:
                out = ""
            elif not self.lines:
                out = ""
            elif sl > len(self.lines) or el > len(self.lines):
                out = ""
            elif sl == el:
                line = self.lines[sl - 1]
                out = line[max(0, sc0) : max(0, ec0)].strip()
            else:
                first = self.lines[sl - 1][max(0, sc0) :]
                mid = self.lines[sl: el - 1]
                last = self.lines[el - 1][: max(0, ec0)]
                out = ("\n".join([first] + mid + [last])).strip()
        except Exception:
            out = ""

        if not out:
            # Fallback to ast.get_source_segment only if manual slicing fails
            # This is expensive as it re-splits lines internally
            try:
                s = ast.get_source_segment(self.code, n)
                if isinstance(s, str) and s.strip():
                    out = s.strip()
            except Exception:
                out = ""

        self._seg_cache[key] = out
        return out

    def stmt_fallback(self, n: ast.AST) -> str:
        rng = _range_from_ast(n)
        idx = rng["startLine"] - 1
        if 0 <= idx < len(self.lines):
            return self.lines[idx].strip()
        return type(n).__name__

    def contains_call(self, n: ast.AST, name: str) -> bool:
        # Check precomputed cache first
        node_calls = self._call_cache.get(id(n))
        if node_calls is not None:
            return name in node_calls

        # Fallback to walk if not precomputed (e.g. for sub-expressions)
        k = (id(n), name)
        hit = self._contains_cache.get(k)
        if hit is not None:
            return hit
        for sub in ast.walk(n):
            if _is_name_call(sub, name):
                self._contains_cache[k] = True
                return True
        self._contains_cache[k] = False
        return False


def _is_name_call(n: ast.AST, name: str) -> bool:
    if not isinstance(n, ast.Call):
        return False
    f = n.func
    return isinstance(f, ast.Name) and f.id == name


def _targets_text(view: _CodeView, targets: List[ast.AST]) -> str:
    parts: List[str] = []
    for t in targets:
        s = view.seg(t)
        parts.append(s if s else type(t).__name__)
    return ", ".join([p for p in parts if p]) or "变量"


def _emit_stmt(
    view: _CodeView,
    n: ast.stmt,
    indent: int,
    rules: Dict[str, Dict[str, Any]],
    loss: List[Dict[str, Any]],
) -> List[Tuple[str, str, Dict[str, int], str]]:
    pad = "  " * max(0, indent)
    rng = _range_from_ast(n)

    def use(rule_id: str, desc: str):
        cur = rules.get(rule_id)
        if not cur:
            rules[rule_id] = {"id": rule_id, "count": 1, "description": desc}
            return
        cur["count"] = int(cur.get("count") or 0) + 1

    out: List[Tuple[str, str, Dict[str, int], str]] = []

    if isinstance(n, ast.Assign):
        value_seg = view.seg(n.value)
        targets_seg = _targets_text(view, list(n.targets or []))
        if view.contains_call(n.value, "input"):
            use("R_INPUT_CALL_INPUT", "将 input() 识别为输入")
            out.append(("input", f"{pad}读入 {targets_seg}", rng, view.seg(n) or view.stmt_fallback(n)))
        else:
            use("R_PROCESS_ASSIGN", "将赋值语句归为处理")
            rhs = value_seg if value_seg else "表达式"
            out.append(("process", f"{pad}{targets_seg} ← {rhs}", rng, view.seg(n) or view.stmt_fallback(n)))
        return out

    if isinstance(n, ast.AnnAssign):
        targets_seg = view.seg(n.target) or "变量"
        value_seg = view.seg(n.value) if n.value is not None else ""
        if n.value is not None and view.contains_call(n.value, "input"):
            use("R_INPUT_CALL_INPUT", "将 input() 识别为输入")
            out.append(("input", f"{pad}读入 {targets_seg}", rng, view.seg(n) or view.stmt_fallback(n)))
        else:
            use("R_PROCESS_ASSIGN", "将赋值语句归为处理")
            if value_seg:
                out.append(("process", f"{pad}{targets_seg} ← {value_seg}", rng, view.seg(n) or view.stmt_fallback(n)))
            else:
                out.append(("process", f"{pad}声明 {targets_seg}", rng, view.seg(n) or view.stmt_fallback(n)))
        return out

    if isinstance(n, ast.AugAssign):
        use("R_PROCESS_AUGASSIGN", "将增量赋值归为处理")
        target = view.seg(n.target) or "变量"
        op_map = {
            ast.Add: "+", ast.Sub: "-", ast.Mult: "*", ast.Div: "/",
            ast.FloorDiv: "//", ast.Mod: "%", ast.Pow: "**",
            ast.LShift: "<<", ast.RShift: ">>", ast.BitOr: "|",
            ast.BitXor: "^", ast.BitAnd: "&",
        }
        op = op_map.get(type(n.op), type(n.op).__name__)
        val = view.seg(n.value) or "表达式"
        out.append(("process", f"{pad}{target} ← {target} {op} {val}", rng, view.seg(n) or view.stmt_fallback(n)))
        return out

    if isinstance(n, ast.Expr) and isinstance(n.value, ast.Call) and _is_name_call(n.value, "print"):
        use("R_OUTPUT_CALL_PRINT", "将 print() 识别为输出")
        args = ", ".join([view.seg(a) or "表达式" for a in list(n.value.args or [])])
        out.append(("output", f"{pad}输出 {args}".rstrip(), rng, view.seg(n) or view.stmt_fallback(n)))
        return out

    if isinstance(n, ast.Return):
        use("R_OUTPUT_RETURN", "将 return 识别为输出")
        val = view.seg(n.value) if n.value is not None else ""
        out.append(("output", f"{pad}返回 {val}".rstrip(), rng, view.seg(n) or view.stmt_fallback(n)))
        return out

    if isinstance(n, ast.If):
        use("R_PROCESS_IF", "将 if 结构归为处理（控制流）")
        test = view.seg(n.test) or "条件"
        out.append(("process", f"{pad}如果 {test}：", rng, view.seg(n.test) or view.stmt_fallback(n)))
        for s in list(n.body or []):
            out.extend(_emit_stmt(view, s, indent + 1, rules, loss))
        if list(n.orelse or []):
            out.append(("process", f"{pad}否则：", rng, "else"))
            for s in list(n.orelse or []):
                out.extend(_emit_stmt(view, s, indent + 1, rules, loss))
        return out

    if isinstance(n, ast.For):
        use("R_PROCESS_FOR", "将 for 循环归为处理（控制流）")
        target = view.seg(n.target) or "变量"
        it = view.seg(n.iter) or "可迭代对象"
        out.append(("process", f"{pad}对 {target} 遍历 {it}：", rng, view.seg(n.iter) or view.stmt_fallback(n)))
        for s in list(n.body or []):
            out.extend(_emit_stmt(view, s, indent + 1, rules, loss))
        if list(n.orelse or []):
            out.append(("process", f"{pad}循环结束后：", rng, "for-else"))
            for s in list(n.orelse or []):
                out.extend(_emit_stmt(view, s, indent + 1, rules, loss))
        return out

    if isinstance(n, ast.While):
        use("R_PROCESS_WHILE", "将 while 循环归为处理（控制流）")
        test = view.seg(n.test) or "条件"
        out.append(("process", f"{pad}当 {test} 时循环：", rng, view.seg(n.test) or view.stmt_fallback(n)))
        for s in list(n.body or []):
            out.extend(_emit_stmt(view, s, indent + 1, rules, loss))
        if list(n.orelse or []):
            out.append(("process", f"{pad}循环结束后：", rng, "while-else"))
            for s in list(n.orelse or []):
                out.extend(_emit_stmt(view, s, indent + 1, rules, loss))
        return out

    if isinstance(n, ast.Break):
        use("R_PROCESS_BREAK", "将 break 归为处理（控制流）")
        out.append(("process", f"{pad}跳出循环", rng, view.seg(n) or view.stmt_fallback(n)))
        return out

    if isinstance(n, ast.Continue):
        use("R_PROCESS_CONTINUE", "将 continue 归为处理（控制流）")
        out.append(("process", f"{pad}继续下一轮", rng, view.seg(n) or view.stmt_fallback(n)))
        return out

    if isinstance(n, ast.Pass):
        use("R_PROCESS_PASS", "将 pass 归为处理")
        out.append(("process", f"{pad}跳过", rng, view.seg(n) or view.stmt_fallback(n)))
        return out

    if isinstance(n, ast.FunctionDef):
        use("R_PROCESS_FUNCTIONDEF", "将函数定义归为处理（结构定义）")
        args = ", ".join([a.arg for a in list(n.args.args or [])]) if hasattr(n, "args") else ""
        out.append(("process", f"{pad}定义函数 {n.name}({args})：".rstrip(), rng, view.seg(n) or view.stmt_fallback(n)))
        for s in list(n.body or []):
            out.extend(_emit_stmt(view, s, indent + 1, rules, loss))
        return out

    seg = view.seg(n)
    if not seg:
        loss.append({"code": "L_SEGMENT_MISSING", "message": "无法获取源代码片段，已使用兜底文本", "range": rng})
        seg = view.stmt_fallback(n)

    if isinstance(n, (ast.Import, ast.ImportFrom, ast.With, ast.Try, ast.ClassDef, ast.Raise, ast.Assert)):
        loss.append({"code": "L_UNSUPPORTED_STMT", "message": f"未对 {type(n).__name__} 做专门伪代码映射，已原样保留", "range": rng})
        use("R_PROCESS_GENERIC_UNSUPPORTED", "未专门映射的语句类型，保留原样文本")
    else:
        use("R_PROCESS_GENERIC", "其他语句归为处理")

    out.append(("process", f"{pad}{seg}", rng, view.seg(n) or view.stmt_fallback(n)))
    return out


def _build_pseudocode(code: str, options: Dict[str, Any]) -> Dict[str, Any]:
    start_ms = _now_ms()
    diagnostics: List[Dict[str, Any]] = []

    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        diagnostics.append(
            {
                "level": "error",
                "code": E_SYNTAX,
                "message": f"SyntaxError: {e.msg}",
                "line": int(getattr(e, "lineno", 1) or 1),
                "col": int(getattr(e, "offset", 1) or 1),
            }
        )
        return {
            "version": API_VERSION_PSEUDO,
            "parserVersion": PARSER_VERSION_PSEUDO,
            "codeSha256": _sha256_text(code),
            "input": {"items": []},
            "process": {"items": []},
            "output": {"items": []},
            "rulesUsed": [],
            "lossPoints": [],
            "reversibility": {"score": 0.0, "level": "low", "reasons": ["语法错误，无法解析 AST"]},
            "diagnostics": diagnostics,
            "stats": {"parseMs": _now_ms() - start_ms, "cacheHit": False},
        }

    rules: Dict[str, Dict[str, Any]] = {}
    loss: List[Dict[str, Any]] = []
    items: Dict[str, List[Dict[str, Any]]] = {"input": [], "process": [], "output": []}
    view = _CodeView(code, tree)

    for stmt in list(getattr(tree, "body", []) or []):
        emitted = _emit_stmt(view, stmt, 0, rules, loss)
        for bucket, text, rng, source in emitted:
            items[bucket].append({"text": text, "range": rng, "source": source})

    loss_count = len(loss)
    score = max(0.0, min(1.0, 1.0 - (loss_count * 0.12)))
    if score >= 0.85:
        level = "high"
    elif score >= 0.6:
        level = "medium"
    else:
        level = "low"

    reasons: List[str] = []
    if loss_count:
        reasons.append(f"存在 {loss_count} 个信息损失点（未专门映射或片段缺失）")
    else:
        reasons.append("语句均可映射为伪代码文本，损失点为 0")

    return {
        "version": API_VERSION_PSEUDO,
        "parserVersion": PARSER_VERSION_PSEUDO,
        "codeSha256": _sha256_text(code),
        "input": {"items": items["input"]},
        "process": {"items": items["process"]},
        "output": {"items": items["output"]},
        "rulesUsed": list(rules.values()),
        "lossPoints": loss,
        "reversibility": {"score": score, "level": level, "reasons": reasons},
        "diagnostics": diagnostics,
        "stats": {"parseMs": _now_ms() - start_ms, "cacheHit": False},
    }


@router.post("/pseudocode/parse")
async def parse_pseudocode(payload: Dict[str, Any], current_user: Dict[str, Any] = Depends(require_admin)):
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
    max_parse_ms = int(limits.get("maxParseMs") or DEFAULT_MAX_PARSE_MS)

    sha = _sha256_text(code)
    opt_hash = _options_hash(options)
    cache_key = f"{CACHE_KEY_PSEUDO_PREFIX}:{PARSER_VERSION_PSEUDO}:{opt_hash}:{sha}"
    cached = await cache.get(cache_key)
    if isinstance(cached, dict) and cached.get("version") == API_VERSION_PSEUDO and cached.get("parserVersion") == PARSER_VERSION_PSEUDO:
        try:
            stats = cached.get("stats") if isinstance(cached.get("stats"), dict) else {}
            stats["cacheHit"] = True
            cached["stats"] = stats
        except Exception:
            pass
        return cached

    try:
        client = await cache.get_client()
        rl_key = f"{CACHE_KEY_PSEUDO_PREFIX}:rl:{user_id}:{_now_ms() // 1000}"
        cur = await client.incr(rl_key)
        if cur == 1:
            await client.expire(rl_key, 2)
        if int(cur) > WS_RATE_LIMIT_PER_SEC: # Reuse rate limit constant
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="请求过于频繁")
    except HTTPException:
        raise
    except Exception:
        pass

    try:
        built = await asyncio.wait_for(asyncio.to_thread(_build_pseudocode, code, options), timeout=max(0.2, max_parse_ms / 1000.0))
    except asyncio.TimeoutError:
        built = {
            "version": API_VERSION_PSEUDO,
            "parserVersion": PARSER_VERSION_PSEUDO,
            "codeSha256": sha,
            "input": {"items": []},
            "process": {"items": []},
            "output": {"items": []},
            "rulesUsed": [],
            "lossPoints": [{"code": E_PARSE_TIMEOUT, "message": "解析超时，已中止"}],
            "reversibility": {"score": 0.0, "level": "low", "reasons": ["解析超时"]},
            "diagnostics": [{"level": "error", "code": E_PARSE_TIMEOUT, "message": "解析超时，已中止"}],
            "stats": {"parseMs": max_parse_ms, "cacheHit": False},
        }

    try:
        ttl = 3600
        await cache.set(cache_key, built, expire_seconds=ttl)
    except Exception:
        pass

    return built
