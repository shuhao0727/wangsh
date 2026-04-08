import asyncio

from fastapi import HTTPException

import app.api.pythonlab.cfg as cfg_api


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
