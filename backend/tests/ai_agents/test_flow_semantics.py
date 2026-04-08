import textwrap
from app.api.pythonlab.flow import _build_flow
from app.api.pythonlab.constants import E_AST_TOO_LARGE, E_SYNTAX


def _parse(code: str, options: dict = None):
    return _build_flow(code, options or {"limits": {"maxParseMs": 1500}})


def test_while_has_false_and_exit():
    code = textwrap.dedent(
        """
        x = 3
        while x > 0:
            x -= 1
        """
    ).strip()
    js = _parse(code)
    assert js.get("nodes") is not None
    assert js.get("edges") is not None
    exit_edges = js.get("exitEdges") or []
    assert any(e.get("kind") == "False" for e in exit_edges)


def test_for_has_false_and_exit():
    code = textwrap.dedent(
        """
        for i in range(3):
            pass
        """
    ).strip()
    js = _parse(code)
    exit_edges = js.get("exitEdges") or []
    assert any(e.get("kind") == "False" for e in exit_edges)


def test_return_terminates_function():
    code = textwrap.dedent(
        """
        def f(x):
            if x > 0:
                return 1
            return 0
        y = f(2)
        """
    ).strip()
    js = _parse(code, {"expand": {"functions": "all"}})
    # 函数体存在 Return 节点
    assert any(n.get("kind") == "Return" for n in js["nodes"])


def test_binary_search_exits_present():
    code = textwrap.dedent(
        """
        def binary_search(arr, target):
            left, right = 0, len(arr) - 1
            while left <= right:
                mid = (left + right) // 2
                if arr[mid] == target:
                    return mid
                elif arr[mid] < target:
                    left = mid + 1
                else:
                    right = mid - 1
            return -1
        sorted_list = [1, 3, 5, 7, 9, 11, 13, 15]
        target_value = 7
        result_index = binary_search(sorted_list, target_value)
        """
    ).strip()
    js = _parse(code, {"expand": {"functions": "all"}})
    exit_edges = js.get("exitEdges") or []
    assert len(exit_edges) > 0


def test_module_only_defs_has_exit():
    code = textwrap.dedent(
        """
        def f(x):
            return x + 1

        def g(y):
            return y * 2
        """
    ).strip()
    js = _parse(code, {"expand": {"functions": "all"}})
    exits = js.get("exitNodeIds") or []
    assert len(exits) == 0


def test_fib_for_has_false_and_end():
    code = textwrap.dedent(
        """
        n = 10
        a = 0
        b = 1
        for i in range(n):
            a, b = b, a + b
            print(a)
        """
    ).strip()
    js = _parse(code)
    assert js.get("diagnostics") == []
    exit_edges = js.get("exitEdges") or []
    assert any(e.get("kind") == "False" for e in exit_edges)
    titles = [n.get("title") for n in js.get("nodes", [])]
    assert "i = 0" in titles
    assert "i ∈ [0, n)?" in titles
    assert "i += 1" in titles


def test_break_continue_has_false_and_end():
    code = textwrap.dedent(
        """
        i = 0
        s = 0
        while i < 10:
            i += 1
            if i % 2 == 0:
                continue
            if i > 7:
                break
            s += i
        print(s)
        """
    ).strip()
    js = _parse(code)
    assert js.get("diagnostics") == []
    assert any(e.get("kind") == "Back" for e in js.get("edges", []))
    assert any(e.get("kind") == "False" for e in js.get("edges", []))
    exit_edges = js.get("exitEdges") or []
    assert len(exit_edges) > 0


def test_for_each_has_false_exit():
    code = textwrap.dedent(
        """
        s = "abc"
        for ch in s:
            print(ch)
        """
    ).strip()
    js = _parse(code)
    assert js.get("diagnostics") == []
    assert any(n.get("kind") == "ForEach" for n in js.get("nodes", []))
    exit_edges = js.get("exitEdges") or []
    assert any(e.get("kind") == "False" for e in exit_edges)


def test_nested_loops_break_only_inner():
    code = textwrap.dedent(
        """
        total = 0
        for i in range(3):
            for j in range(5):
                if j == 2:
                    break
                total += j
        print(total)
        """
    ).strip()
    js = _parse(code)
    assert js.get("diagnostics") == []
    assert sum(1 for n in js.get("nodes", []) if n.get("kind") == "For") >= 2
    assert any(e.get("kind") == "Back" for e in js.get("edges", []))


def test_for_range_variants_use_consistent_three_stage_titles():
    code = textwrap.dedent(
        """
        for i in range(n):
            pass
        for j in range(1, n):
            pass
        for k in range(1, n, 2):
            pass
        """
    ).strip()
    js = _parse(code)
    assert js.get("diagnostics") == []
    titles = [n.get("title") for n in js.get("nodes", [])]
    assert "i = 0" in titles
    assert "i ∈ [0, n)?" in titles
    assert "i += 1" in titles
    assert "j = 1" in titles
    assert "j ∈ [1, n)?" in titles
    assert "j += 1" in titles
    assert "k = 1" in titles
    assert "k ∈ [1, n), 步长=2?" in titles
    assert "k += 2" in titles


def test_if_and_while_titles_are_teaching_oriented():
    code = textwrap.dedent(
        """
        x = 1
        if x > 0:
            while x < 3:
                x += 1
        """
    ).strip()
    js = _parse(code)
    titles = [n.get("title") for n in js.get("nodes", [])]
    assert "x > 0?" in titles
    assert "x < 3?" in titles


def test_key_action_titles_are_expression_first():
    code = textwrap.dedent(
        """
        total = 0
        total += 1
        print(total)
        name = input("name: ")
        """
    ).strip()
    js = _parse(code)
    titles = [n.get("title") for n in js.get("nodes", [])]
    assert "total = 0" in titles
    assert "total += 1" in titles
    assert "print(total)" in titles
    assert any((t or "").startswith("name = input(") for t in titles)


def test_for_each_split_threshold_prefers_simple_title():
    code = textwrap.dedent(
        """
        for ch in s:
            print(ch)
        for v in sorted(values):
            print(v)
            print(v + 1)
        """
    ).strip()
    js = _parse(code)
    titles = [n.get("title") for n in js.get("nodes", [])]
    assert "s 未遍历完?" in titles
    assert "ch = 当前元素" in titles
    assert "sorted(values) 未遍历完?" in titles
    assert "v = 当前元素" in titles


def test_syntax_error_returns_stable_fallback_graph():
    js = _parse("if True print('x')")
    diagnostics = js.get("diagnostics") or []
    assert any(d.get("code") == E_SYNTAX for d in diagnostics)
    assert js.get("entryNodeId")
    assert js.get("exitNodeIds") == [js.get("entryNodeId")]
    assert any(n.get("kind") == "Fallback" for n in js.get("nodes", []))
    assert any(e.get("kind") == "Entry" for e in js.get("edges", []))


def test_ast_too_large_returns_stable_fallback_graph():
    code = "\n".join([f"x{i} = {i}" for i in range(10)])
    js = _parse(code, {"limits": {"maxAstNodes": 5}})
    diagnostics = js.get("diagnostics") or []
    assert any(d.get("code") == E_AST_TOO_LARGE for d in diagnostics)
    assert js.get("entryNodeId")
    assert any(n.get("kind") == "Fallback" for n in js.get("nodes", []))
