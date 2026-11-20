import asyncio

from fastapi import HTTPException

import app.api.pythonlab.cfg as cfg_api
from app.api.pythonlab.constants import (
    DEFAULT_MAX_NODES,
    MAX_CODE_SIZE_BYTES,
    MAX_NODE_TITLE_CHARS,
)


def test_parse_cfg_rejects_invalid_code_payload():
    try:
        asyncio.run(cfg_api.parse_cfg({"code": 123}, current_user={"id": 1}))
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 400
        assert "code 必须为字符串" in str(exc.detail)


def test_parse_cfg_returns_module_and_entry_edge_for_valid_code():
    code = "\n".join(
        [
            "a = 1",
            "if a > 0:",
            "    print('pos')",
            "else:",
            "    print('zero')",
        ]
    )

    result = asyncio.run(cfg_api.parse_cfg({"code": code}, current_user={"id": 1}))

    assert result["sourcePath"] == cfg_api.WORKSPACE_MAIN_PY
    assert result["version"] == cfg_api.VERSION_CFG
    assert result["diagnostics"] == []
    assert result["nodes"]
    assert result["edges"]

    kinds = [node["kind"] for node in result["nodes"]]
    assert "Module" in kinds
    assert "Assign" in kinds
    assert "If" in kinds

    entry_edges = [edge for edge in result["edges"] if edge["kind"] == "Entry"]
    assert len(entry_edges) == 1
    assert entry_edges[0]["from"] == result["nodes"][0]["id"]


def test_parse_cfg_marks_elif_nodes_in_chain():
    code = "\n".join(
        [
            "if x > 10:",
            "    print('big')",
            "elif x > 5:",
            "    print('mid')",
            "else:",
            "    print('small')",
        ]
    )

    result = asyncio.run(cfg_api.parse_cfg({"code": code}, current_user={"id": 1}))

    kinds = [node["kind"] for node in result["nodes"]]
    assert "If" in kinds
    assert "Elif" in kinds
    false_edges = [edge for edge in result["edges"] if edge["kind"] == "False"]
    assert false_edges, "expected false branch edges for if/elif chain"


def test_parse_cfg_reports_syntax_error_diagnostics():
    result = asyncio.run(cfg_api.parse_cfg({"code": "if True print('x')\n"}, current_user={"id": 1}))

    assert result["nodes"] == []
    assert result["edges"] == []
    assert result["diagnostics"]
    assert result["diagnostics"][0]["level"] == "error"
    assert "SyntaxError" in result["diagnostics"][0]["message"]


def test_parse_cfg_rejects_oversized_code():
    code = "a=1\n" * (MAX_CODE_SIZE_BYTES // 4 + 1)

    try:
        asyncio.run(cfg_api.parse_cfg({"code": code}, current_user={"id": 1}))
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 413


def test_parse_cfg_rejects_deep_elif_recursion():
    code = "if x:\n    pass\n" + "elif x:\n    pass\n" * 600

    try:
        asyncio.run(cfg_api.parse_cfg({"code": code}, current_user={"id": 1}))
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 413
        assert "嵌套过深" in str(exc.detail)


def test_parse_cfg_rejects_too_many_nodes():
    code = "a=1\n" * (DEFAULT_MAX_NODES + 1)

    try:
        asyncio.run(cfg_api.parse_cfg({"code": code}, current_user={"id": 1}))
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 413
        assert "节点过多" in str(exc.detail)


def test_parse_cfg_bounds_compound_statement_titles():
    """复合语句标题覆盖整段子树：不设上限时 240KB 代码实测返回 14.6MB。

    这里断言标题与总响应都被收住，防止再次放大。
    """
    depth, leaves = 40, 400
    lines = ["    " * i + f"if x{i} > 0:" for i in range(depth)]
    body = "    " * depth
    lines += [body + f"value_{i} = compute_{i}(a_{i}, b_{i}, c_{i}) + d_{i}" for i in range(leaves)]
    code = "\n".join(lines) + "\n"
    assert len(code.encode("utf-8")) < MAX_CODE_SIZE_BYTES

    result = asyncio.run(cfg_api.parse_cfg({"code": code}, current_user={"id": 1}))

    titles = [node["title"] for node in result["nodes"]]
    assert max(len(t) for t in titles) <= MAX_NODE_TITLE_CHARS + 1  # +1 为省略号
    # 输入约 60KB；未限长时同一形状会放大到数十 MB。
    assert len(str(result)) < 4 * len(code)
