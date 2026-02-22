import ast
from dataclasses import dataclass
from typing import List, Optional, Tuple


@dataclass(frozen=True)
class IRStmt:
    node: ast.AST


@dataclass(frozen=True)
class IRAction(IRStmt):
    kind: str
    text: str


@dataclass(frozen=True)
class IRIf(IRStmt):
    cond: str
    then_block: "IRBlock"
    elifs: List[Tuple[str, "IRBlock", ast.AST]]
    else_block: Optional["IRBlock"]


@dataclass(frozen=True)
class IRWhile(IRStmt):
    cond: str
    body: "IRBlock"


@dataclass(frozen=True)
class IRForRange(IRStmt):
    var: str
    start: str
    stop: str
    step: str
    direction: str
    body: "IRBlock"


@dataclass(frozen=True)
class IRForEach(IRStmt):
    var: str
    iter_expr: str
    body: "IRBlock"


@dataclass(frozen=True)
class IRReturn(IRStmt):
    expr: Optional[str]


@dataclass(frozen=True)
class IRBreak(IRStmt):
    pass


@dataclass(frozen=True)
class IRContinue(IRStmt):
    pass


@dataclass(frozen=True)
class IRFunction(IRStmt):
    name: str
    sig: str
    body: "IRBlock"


@dataclass(frozen=True)
class IRBlock:
    stmts: List[IRStmt]


def _unparse(x: ast.AST) -> str:
    try:
        return ast.unparse(x).strip()
    except Exception:
        return ""


def _is_range_call(x: ast.AST) -> bool:
    return isinstance(x, ast.Call) and isinstance(x.func, ast.Name) and x.func.id == "range"


def _range_parts(x: ast.Call) -> Optional[Tuple[str, str, str, str]]:
    args = list(getattr(x, "args", []) or [])
    if len(args) not in {1, 2, 3}:
        return None
    if len(args) == 1:
        start = "0"
        stop = _unparse(args[0])
        step = "1"
    elif len(args) == 2:
        start = _unparse(args[0])
        stop = _unparse(args[1])
        step = "1"
    else:
        start = _unparse(args[0])
        stop = _unparse(args[1])
        step = _unparse(args[2])
    if not stop:
        return None
    direction = "<"
    if isinstance(args[-1], ast.Constant) and isinstance(args[-1].value, int) and len(args) == 3:
        if int(args[-1].value) < 0:
            direction = ">"
    elif step.startswith("-"):
        direction = ">"
    return start or "0", stop, step or "1", direction


def build_ir_module(tree: ast.Module) -> IRBlock:
    stmts: List[IRStmt] = []
    for s in list(getattr(tree, "body", []) or []):
        if isinstance(s, ast.FunctionDef):
            continue
        stmts.append(_build_stmt(s))
    return IRBlock(stmts=stmts)


def build_ir_functions(tree: ast.Module) -> List[IRFunction]:
    out: List[IRFunction] = []
    for s in list(getattr(tree, "body", []) or []):
        if not isinstance(s, ast.FunctionDef):
            continue
        name = str(getattr(s, "name", "") or "")
        sig = _format_sig(s)
        out.append(IRFunction(node=s, name=name, sig=sig, body=_build_block(list(getattr(s, "body", []) or []))))
    return out


def _format_sig(fn: ast.FunctionDef) -> str:
    name = str(getattr(fn, "name", "") or "")
    args: List[str] = []
    try:
        for a in getattr(fn.args, "posonlyargs", []) or []:
            args.append(str(getattr(a, "arg", "") or ""))
    except Exception:
        pass
    if getattr(fn.args, "posonlyargs", None):
        args.append("/")
    try:
        for a in getattr(fn.args, "args", []) or []:
            args.append(str(getattr(a, "arg", "") or ""))
    except Exception:
        pass
    if getattr(fn.args, "vararg", None) is not None:
        args.append(f"*{getattr(fn.args.vararg, 'arg', '')}")
    elif getattr(fn.args, "kwonlyargs", None):
        args.append("*")
    try:
        for a in getattr(fn.args, "kwonlyargs", []) or []:
            args.append(str(getattr(a, "arg", "") or ""))
    except Exception:
        pass
    if getattr(fn.args, "kwarg", None) is not None:
        args.append(f"**{getattr(fn.args.kwarg, 'arg', '')}")
    sig = ", ".join([a for a in args if a])
    return f"{name}({sig})"


def _build_block(stmts: List[ast.stmt]) -> IRBlock:
    out: List[IRStmt] = []
    for s in stmts or []:
        out.append(_build_stmt(s))
    return IRBlock(stmts=out)


def _build_stmt(s: ast.stmt) -> IRStmt:
    if isinstance(s, ast.If):
        cond = _unparse(s.test) or "cond"
        then_block = _build_block(list(getattr(s, "body", []) or []))
        elifs: List[Tuple[str, IRBlock, ast.AST]] = []
        else_block: Optional[IRBlock] = None
        orelse = list(getattr(s, "orelse", []) or [])
        cur_else = orelse
        while len(cur_else) == 1 and isinstance(cur_else[0], ast.If):
            eif: ast.If = cur_else[0]
            elifs.append((_unparse(eif.test) or "cond", _build_block(list(getattr(eif, "body", []) or [])), eif))
            cur_else = list(getattr(eif, "orelse", []) or [])
        if cur_else:
            else_block = _build_block(cur_else)
        return IRIf(node=s, cond=cond, then_block=then_block, elifs=elifs, else_block=else_block)

    if isinstance(s, ast.While):
        cond = _unparse(s.test) or "cond"
        body = _build_block(list(getattr(s, "body", []) or []))
        return IRWhile(node=s, cond=cond, body=body)

    if isinstance(s, ast.For):
        if isinstance(s.target, ast.Name):
            var = s.target.id
            if _is_range_call(s.iter):
                parts = _range_parts(s.iter)  # type: ignore[arg-type]
                if parts is not None:
                    start, stop, step, direction = parts
                    body = _build_block(list(getattr(s, "body", []) or []))
                    return IRForRange(node=s, var=var, start=start, stop=stop, step=step, direction=direction, body=body)
        var_txt = _unparse(s.target) or "item"
        iter_txt = _unparse(s.iter) or "iterable"
        body = _build_block(list(getattr(s, "body", []) or []))
        return IRForEach(node=s, var=var_txt, iter_expr=iter_txt, body=body)

    if isinstance(s, ast.Return):
        expr = _unparse(s.value) if getattr(s, "value", None) is not None else None
        return IRReturn(node=s, expr=expr or None)

    if isinstance(s, ast.Break):
        return IRBreak(node=s)
    if isinstance(s, ast.Continue):
        return IRContinue(node=s)

    kind = type(s).__name__
    text = _unparse(s) or kind
    if isinstance(s, ast.Assign):
        kind = "Assign"
    elif isinstance(s, ast.AugAssign):
        kind = "AugAssign"
    elif isinstance(s, ast.Expr):
        kind = "Expr"
    return IRAction(node=s, kind=kind, text=text)

