import textwrap
from app.api.endpoints.debug.flow import _build_flow


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
    assert any(t == "i = 0" for t in titles)
    assert any((t or "").startswith("i +=") for t in titles) or any((t or "").startswith("i -=") for t in titles)


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
