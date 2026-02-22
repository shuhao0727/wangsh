import ast
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import require_admin
from app.utils.cache import cache
from app.api.endpoints.debug.constants import (
    CACHE_KEY_SESSION_PREFIX,
    VERSION_CFG,
    WORKSPACE_MAIN_PY,
)
from app.api.endpoints.debug.utils import (
    is_elif_if,
    make_edge,
    mark_elif_chain,
    node_title,
    range_from_ast,
    stable_id,
    kind_of,
)

router = APIRouter()


def _make_node(code: str, kind: str, n: ast.AST, parent_id: Optional[str]) -> Dict[str, Any]:
    rng = range_from_ast(n)
    title = node_title(code, n)
    nid = stable_id(
        kind,
        str(rng["startLine"]),
        str(rng["startCol"]),
        str(rng["endLine"]),
        str(rng["endCol"]),
        parent_id or "",
        title,
    )
    return {"id": nid, "kind": kind, "title": title, "range": rng, "parentId": parent_id}


def _build_stmt(
    code: str,
    stmt: ast.stmt,
    parent_id: Optional[str],
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
) -> Tuple[str, List[str]]:
    kind = kind_of(stmt)
    if kind == "If" and isinstance(stmt, ast.If) and is_elif_if(stmt):
        kind = "Elif"
    node = _make_node(code, kind, stmt, parent_id)
    nodes.append(node)
    nid = node["id"]

    if isinstance(stmt, ast.If):
        then_entry, then_exits = _build_block(code, stmt.body, parent_id, nodes, edges)
        else_entry, else_exits = _build_block(code, stmt.orelse, parent_id, nodes, edges)

        if then_entry:
            edges.append(make_edge("True", nid, then_entry, "是"))
        if else_entry:
            edges.append(make_edge("False", nid, else_entry, "否"))

        exits: List[str] = []
        exits.extend(then_exits or [])
        exits.extend(else_exits or [])
        if not exits:
            exits = [nid]
        return nid, exits

    if isinstance(stmt, (ast.While, ast.For)):
        body_entry, body_exits = _build_block(code, stmt.body, parent_id, nodes, edges)
        if body_entry:
            edges.append(make_edge("True", nid, body_entry, "是"))
            for ex in body_exits:
                edges.append(make_edge("Back", ex, nid, "回边"))
        return nid, [nid]

    if isinstance(stmt, (ast.Return, ast.Break, ast.Continue)):
        return nid, []

    return nid, [nid]


def _build_block(
    code: str,
    stmts: List[ast.stmt],
    parent_id: Optional[str],
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
) -> Tuple[Optional[str], List[str]]:
    entry: Optional[str] = None
    exits: List[str] = []
    for s in stmts or []:
        sid, s_exits = _build_stmt(code, s, parent_id, nodes, edges)
        if entry is None:
            entry = sid
            exits = s_exits
            continue
        for ex in exits:
            edges.append(make_edge("Next", ex, sid))
        exits = s_exits
    return entry, exits


def _generate_cfg_data(code: str) -> Dict[str, Any]:
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    diagnostics: List[Dict[str, Any]] = []

    try:
        tree = ast.parse(code)
        mark_elif_chain(tree)
    except SyntaxError as e:
        diagnostics.append(
            {
                "level": "error",
                "message": f"SyntaxError: {e.msg}",
                "line": int(getattr(e, "lineno", 1) or 1),
            }
        )
        return {
            "sourcePath": WORKSPACE_MAIN_PY,
            "version": VERSION_CFG,
            "nodes": [],
            "edges": [],
            "diagnostics": diagnostics,
        }

    module_node = {
        "id": stable_id("Module", "1"),
        "kind": "Module",
        "title": "main.py",
        "range": {
            "startLine": 1,
            "startCol": 1,
            "endLine": max(1, len(code.splitlines())),
            "endCol": 1,
        },
        "parentId": None,
    }
    nodes.append(module_node)
    entry, _ = _build_block(
        code, list(getattr(tree, "body", []) or []), module_node["id"], nodes, edges
    )
    if entry:
        edges.append(make_edge("Entry", module_node["id"], entry))

    return {
        "sourcePath": WORKSPACE_MAIN_PY,
        "version": VERSION_CFG,
        "nodes": nodes,
        "edges": edges,
        "diagnostics": diagnostics,
    }


@router.get("/sessions/{session_id}/cfg")
async def get_cfg(session_id: str, current_user: Dict[str, Any] = Depends(require_admin)):
    user_id = int(current_user.get("id") or 0)
    meta = await cache.get(f"{CACHE_KEY_SESSION_PREFIX}:{session_id}")
    if not meta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="会话不存在或已过期")
    if int(meta.get("owner_user_id") or 0) != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限访问该会话")

    code = await cache.get(f"{CACHE_KEY_SESSION_PREFIX}:{session_id}:code")
    if not isinstance(code, str):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="会话代码不存在或已过期")

    return _generate_cfg_data(code)


@router.post("/cfg/parse")
async def parse_cfg(
    payload: Dict[str, Any], current_user: Dict[str, Any] = Depends(require_admin)
):
    code = payload.get("code")
    if not isinstance(code, str):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="code 必须为字符串")

    return _generate_cfg_data(code)
