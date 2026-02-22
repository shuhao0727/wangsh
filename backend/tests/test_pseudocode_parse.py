import textwrap

from app.api.endpoints.debug.pseudocode import _build_pseudocode


def test_pseudocode_basic_io():
    code = textwrap.dedent(
        """
        x = input()
        y = x + 1
        print(y)
        """
    ).strip()
    js = _build_pseudocode(code, {"limits": {"maxParseMs": 1500}})
    assert js.get("version") == "pseudocode_v1"
    assert js.get("parserVersion") == "v1_ast"
    assert isinstance(js.get("input", {}).get("items"), list)
    assert isinstance(js.get("process", {}).get("items"), list)
    assert isinstance(js.get("output", {}).get("items"), list)
    assert any("读入" in (it.get("text") or "") for it in js["input"]["items"])
    assert any("输出" in (it.get("text") or "") for it in js["output"]["items"])
    assert js.get("reversibility", {}).get("score") is not None


def test_pseudocode_if_emits_structure():
    code = textwrap.dedent(
        """
        a = 1
        if a > 0:
            print(a)
        else:
            print(0)
        """
    ).strip()
    js = _build_pseudocode(code, {})
    process_text = "\n".join([(it.get("text") or "") for it in js["process"]["items"]])
    assert "如果" in process_text
    out_text = "\n".join([(it.get("text") or "") for it in js["output"]["items"]])
    assert "输出" in out_text
