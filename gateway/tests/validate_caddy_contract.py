"""Static contract for this repository's two request_body guards, not a Caddy parser.

Only the current line-oriented block syntax is supported. Backend budgets are
read as a restricted AST; this module never imports or executes application code.
"""

import argparse
import ast
from dataclasses import dataclass
from pathlib import Path
import re
import shlex
import sys


GAME_PATH = "/api/v1/admin/it/games"


class ContractError(ValueError):
    pass


@dataclass
class Directive:
    words: tuple[str, ...]
    children: list["Directive"] | None = None


def parse_blocks(source: str) -> list[Directive]:
    """Read existing one-directive-per-line blocks, excluding real comments."""
    root: list[Directive] = []
    stack = [root]
    for number, line in enumerate(source.splitlines(), 1):
        try:
            words = shlex.split(line, comments=True)
        except ValueError as exc:
            raise ContractError(f"Caddyfile line {number}: {exc}") from exc
        if not words:
            continue
        if words == ["}"]:
            if len(stack) == 1:
                raise ContractError(f"unexpected closing block on line {number}")
            stack.pop()
            continue
        opens = words[-1] == "{"
        head = words[:-1] if opens else words
        if "{" in head or "}" in head:
            raise ContractError(f"unsupported inline block on line {number}")
        node = Directive(tuple(head), [] if opens else None)
        stack[-1].append(node)
        if opens:
            stack.append(node.children)
    if len(stack) != 1:
        raise ContractError("unclosed Caddyfile block")
    return root


def one(nodes: list[Directive], name: str) -> Directive:
    matches = [node for node in nodes if node.words and node.words[0] == name]
    if len(matches) != 1:
        raise ContractError(f"expected exactly one {name}, found {len(matches)}")
    return matches[0]


def block(node: Directive, words: tuple[str, ...]) -> list[Directive]:
    if node.words != words or node.children is None:
        raise ContractError(f"expected block: {' '.join(words)}")
    return node.children


def leaf(node: Directive, words: tuple[str, ...]) -> None:
    if node.words != words or node.children is not None:
        raise ContractError(f"expected directive: {' '.join(words)}")


def byte_size(value: str) -> int:
    """Accept integer bytes/B, decimal MB and binary MiB, never guessed units."""
    match = re.fullmatch(r"([0-9]+)(B|MB|MiB)?", value)
    if match is None:
        raise ContractError(f"unsupported max_size literal: {value!r}")
    size = int(match[1]) * {None: 1, "B": 1, "MB": 1_000_000, "MiB": 1_048_576}[match[2]]
    if size <= 0:
        raise ContractError("max_size must be positive")
    return size


def backend_game_budget(source: str) -> int:
    """Resolve GAME_UPLOAD_BUDGET's integer allowance without eval or imports."""
    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        raise ContractError(f"cannot parse backend request budget: {exc.msg}") from exc
    assignments: dict[str, list[ast.expr]] = {}
    for statement in tree.body:
        if isinstance(statement, ast.Assign) and len(statement.targets) == 1:
            target, value = statement.targets[0], statement.value
        elif isinstance(statement, ast.AnnAssign):
            target, value = statement.target, statement.value
        else:
            continue
        if isinstance(target, ast.Name) and value is not None:
            assignments.setdefault(target.id, []).append(value)

    def assigned(name: str) -> ast.expr:
        values = assignments.get(name, [])
        if len(values) != 1:
            raise ContractError(f"expected one backend assignment for {name}, found {len(values)}")
        return values[0]

    def integer(node: ast.expr, visiting: frozenset[str] = frozenset()) -> int:
        if isinstance(node, ast.Constant) and type(node.value) is int:
            return node.value
        if isinstance(node, ast.Name):
            if node.id in visiting:
                raise ContractError(f"cyclic backend budget constant: {node.id}")
            return integer(assigned(node.id), visiting | {node.id})
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Mult)):
            left, right = integer(node.left, visiting), integer(node.right, visiting)
            return left + right if isinstance(node.op, ast.Add) else left * right
        raise ContractError("backend body budget must use integer literals, names, + or *")

    call = assigned("GAME_UPLOAD_BUDGET")
    if (
        not isinstance(call, ast.Call)
        or not isinstance(call.func, ast.Name)
        or call.func.id != "RequestBudget"
        or len(call.args) > 3
        or any(isinstance(arg, ast.Starred) for arg in call.args)
        or any(kw.arg not in {"name", "max_body_bytes", "receive_idle_seconds"} for kw in call.keywords)
    ):
        raise ContractError("GAME_UPLOAD_BUDGET must be a static RequestBudget call")
    candidates = ([call.args[1]] if len(call.args) >= 2 else []) + [
        kw.value for kw in call.keywords if kw.arg == "max_body_bytes"
    ]
    if len(candidates) != 1:
        raise ContractError("cannot uniquely resolve GAME_UPLOAD_BUDGET.max_body_bytes")
    size = integer(candidates[0])
    if size <= 0:
        raise ContractError("GAME_UPLOAD_BUDGET must be positive")
    return size


def validate_contract(config_source: str, budget_source: str) -> tuple[int, int]:
    roots = parse_blocks(config_source)
    site = block(one(roots, ":80"), (":80",))
    leaf(one(site, "@game_upload"), ("@game_upload", "path", GAME_PATH))
    leaf(one(site, "@body_guarded"), ("@body_guarded", "not", "path", GAME_PATH))

    # Two complementary site-level guards only: never select a later fallback
    # max_size, and reject an extra global/nested guard that would still cap games.
    def guards(nodes: list[Directive]) -> list[Directive]:
        found = []
        for node in nodes:
            if node.words and node.words[0] == "request_body":
                found.append(node)
            if node.children is not None:
                found.extend(guards(node.children))
        return found

    bodies = [node for node in site if node.words and node.words[0] == "request_body"]
    if len(bodies) != 2 or len(guards(roots)) != 2:
        raise ContractError("expected exactly two complementary site-level request_body guards")
    limits = {}
    for body in bodies:
        if len(body.words) != 2 or body.words[1] not in {"@game_upload", "@body_guarded"}:
            raise ContractError("request_body must reference @game_upload or @body_guarded")
        matcher = body.words[1]
        if matcher in limits:
            raise ContractError(f"duplicate request_body for {matcher}")
        children = block(body, ("request_body", matcher))
        maximum = one(children, "max_size")
        if len(children) != 1 or maximum.children is not None or len(maximum.words) != 2:
            raise ContractError(f"expected one max_size in request_body {matcher}")
        limits[matcher] = byte_size(maximum.words[1])
    if limits["@body_guarded"] != 16_000_000:
        raise ContractError("ordinary request_body must remain 16MB (16000000 bytes)")

    globals_ = [node for node in roots if not node.words and node.children is not None]
    if len(globals_) != 1:
        raise ContractError("expected one global options block")
    servers = block(one(globals_[0].children, "servers"), ("servers",))
    timeouts = block(one(servers, "timeouts"), ("timeouts",))
    leaf(one(timeouts, "read_body"), ("read_body", "30s"))

    required = backend_game_budget(budget_source)
    actual = limits["@game_upload"]
    if actual < required:
        raise ContractError(
            f"game request_body max_size {actual}B is below backend "
            f"GAME_UPLOAD_BUDGET {required}B (includes multipart allowance)"
        )
    return actual, required


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("config", type=Path)
    parser.add_argument("backend_budget", type=Path)
    args = parser.parse_args(argv)
    try:
        actual, required = validate_contract(
            args.config.read_text(encoding="utf-8"),
            args.backend_budget.read_text(encoding="utf-8"),
        )
    except (ContractError, OSError, UnicodeError) as exc:
        print(f"Caddy request-body contract: FAIL: {exc}", file=sys.stderr)
        return 1
    print(
        f"Caddy request-body contract: PASS (game {actual}B >= {required}B; "
        "fallback 16000000B; read_body 30s)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
