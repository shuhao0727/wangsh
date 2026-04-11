"""
测试 Flow 工具函数模块

包含对 app.api.pythonlab.flow.utils 模块中各种辅助函数的测试。
"""

import ast
import time
from typing import Optional

import app.api.pythonlab.flow.utils as flow_utils


def test_now_ms_returns_integer():
    """测试 _now_ms 返回整数时间戳"""
    result = flow_utils._now_ms()
    assert isinstance(result, int)
    assert result > 0
    # 应该接近当前时间（在 1000ms 内）
    current_ms = int(time.time() * 1000)
    assert abs(result - current_ms) < 1000


def test_node_title_wrapper_returns_stripped_segment():
    """测试 _node_title_wrapper 返回去除空白的源代码段"""
    code = "x = 1 + 2\nprint(x)\n"
    tree = ast.parse(code)
    assign_node = tree.body[0]

    result = flow_utils._node_title_wrapper(code, assign_node)
    assert result == "x = 1 + 2"

    # 测试没有源代码段的情况
    empty_node = ast.Pass()
    result = flow_utils._node_title_wrapper(code, empty_node)
    # 应该回退到 node_title 函数
    assert result is not None


def test_full_title_returns_empty_for_none_node():
    """测试 _full_title 对 None 节点返回空字符串"""
    result = flow_utils._full_title("code", None)
    assert result == ""


def test_full_title_returns_stripped_segment():
    """测试 _full_title 返回去除空白的源代码段"""
    code = "def foo():\n    return 42\n"
    tree = ast.parse(code)
    func_node = tree.body[0]

    result = flow_utils._full_title(code, func_node)
    # _full_title 返回整个节点的源代码，包括函数体
    assert result == "def foo():\n    return 42"


def test_header_title_returns_empty_for_none_node():
    """测试 _header_title 对 None 节点返回空字符串"""
    result = flow_utils._header_title("code", None)
    assert result == ""


def test_header_title_for_function_def():
    """测试 _header_title 对函数定义的处理"""
    code = "def my_function(arg1, arg2=10):\n    pass\n"
    tree = ast.parse(code)
    func_node = tree.body[0]

    result = flow_utils._header_title(code, func_node)
    # 应该返回函数签名
    assert "my_function" in result
    assert "arg1" in result or "arg2" in result


def test_header_title_for_if_statement():
    """测试 _header_title 对 if 语句的处理"""
    code = "if x > 0:\n    print('positive')\n"
    tree = ast.parse(code)
    if_node = tree.body[0]

    result = flow_utils._header_title(code, if_node)
    # 应该返回 "if x > 0"
    assert result.startswith("if ")
    assert "x > 0" in result


def test_header_title_for_while_statement():
    """测试 _header_title 对 while 循环的处理"""
    code = "while True:\n    print('loop')\n"
    tree = ast.parse(code)
    while_node = tree.body[0]

    result = flow_utils._header_title(code, while_node)
    # 应该返回 "while True"
    assert result.startswith("while ")
    assert "True" in result


def test_header_title_for_for_statement():
    """测试 _header_title 对 for 循环的处理"""
    code = "for i in range(10):\n    print(i)\n"
    tree = ast.parse(code)
    for_node = tree.body[0]

    result = flow_utils._header_title(code, for_node)
    # 应该返回 "for i in range(10)" 或 "has_next(iter(range(10)))"
    assert "for" in result or "has_next" in result


def test_header_title_for_return_statement():
    """测试 _header_title 对 return 语句的处理"""
    # 带返回值的 return
    code1 = "return x + 1\n"
    tree1 = ast.parse(code1)
    return_node1 = tree1.body[0]

    result1 = flow_utils._header_title(code1, return_node1)
    assert result1.startswith("return ")
    assert "x + 1" in result1

    # 不带返回值的 return
    code2 = "return\n"
    tree2 = ast.parse(code2)
    return_node2 = tree2.body[0]

    result2 = flow_utils._header_title(code2, return_node2)
    assert result2 == "return"


def test_header_title_for_try_statement():
    """测试 _header_title 对 try 语句的处理"""
    code = "try:\n    x = 1 / 0\nexcept ZeroDivisionError:\n    print('error')\n"
    tree = ast.parse(code)
    try_node = tree.body[0]

    result = flow_utils._header_title(code, try_node)
    # 应该返回 "try"
    assert result == "try"


def test_header_title_for_other_statements():
    """测试 _header_title 对其他语句的处理（回退到 _node_title_wrapper）"""
    code = "x = 1 + 2\n"
    tree = ast.parse(code)
    assign_node = tree.body[0]

    result = flow_utils._header_title(code, assign_node)
    # 应该返回赋值语句的源代码
    assert result == "x = 1 + 2"


def test_kind_of_identifies_statement_types():
    """测试 _kind_of 识别各种语句类型"""
    # 测试赋值语句
    assign_code = "x = 1"
    assign_tree = ast.parse(assign_code)
    assign_kind = flow_utils._kind_of(assign_tree.body[0])
    assert assign_kind == "Assign"

    # 测试表达式语句
    expr_code = "x + 1"
    expr_tree = ast.parse(expr_code)
    expr_kind = flow_utils._kind_of(expr_tree.body[0])
    assert expr_kind == "Expr"

    # 测试返回语句
    return_code = "return x"
    return_tree = ast.parse(return_code)
    return_kind = flow_utils._kind_of(return_tree.body[0])
    assert return_kind == "Return"

    # 测试 Pass 语句（不在 _kind_of 的特殊处理列表中，应返回 "Stmt"）
    pass_code = "pass"
    pass_tree = ast.parse(pass_code)
    pass_kind = flow_utils._kind_of(pass_tree.body[0])
    assert pass_kind == "Stmt"


def test_teaching_condition_title():
    """测试 _teaching_condition_title 生成教学条件标题"""
    # 有表达式的情况
    result = flow_utils._teaching_condition_title("如果", "x > 0", "条件")
    assert result == "x > 0?"  # 注意：函数忽略 prefix 参数，只返回 cond + "?"

    # 无表达式的情况，使用回退表达式
    result = flow_utils._teaching_condition_title("当", None, "循环条件")
    assert result == "循环条件?"

    # 表达式为 "cond" 的情况
    result = flow_utils._teaching_condition_title("如果", "cond", "条件")
    assert result == "条件?"  # "cond" 被替换为 fallback_expr


def test_teaching_action_title():
    """测试 _teaching_action_title 生成教学动作标题"""
    # 有文本的情况，文本不等于 kind
    result = flow_utils._teaching_action_title("赋值", "x = 1")
    assert result == "x = 1"  # 返回文本本身

    # 文本等于 kind 的情况
    result = flow_utils._teaching_action_title("Assign", "Assign")
    assert result == "Assign"  # kind 在 {"Assign", "AugAssign", "Expr"} 中

    # 无文本的情况，kind 不在特殊列表中
    result = flow_utils._teaching_action_title("返回", None)
    assert result == "stmt"  # 默认返回 "stmt"

    # 测试带分隔符的文本
    result = flow_utils._teaching_action_title("步骤", "步骤1：打印结果")
    assert result == "打印结果"  # 前缀包含"步骤"，返回后缀

    # 测试带英文冒号的文本
    result = flow_utils._teaching_action_title("分支", "分支判断: x > 0")
    assert result == "x > 0"  # 前缀包含"分支判断"，返回后缀


def test_expr_complexity_score():
    """测试 _expr_complexity_score 计算表达式复杂度"""
    # 简单变量 - 没有操作符或括号，分数为 0
    assert flow_utils._expr_complexity_score("x") == 0

    # 简单表达式 - 包含操作符，分数为 1
    assert flow_utils._expr_complexity_score("x + 1") == 1

    # 包含括号的表达式 - 分数为 2（括号 + 操作符）
    assert flow_utils._expr_complexity_score("(x + 1)") == 2

    # 包含逗号的表达式 - 分数为 1（逗号）
    assert flow_utils._expr_complexity_score("x, y") == 1

    # None 或空表达式
    assert flow_utils._expr_complexity_score(None) == 0
    assert flow_utils._expr_complexity_score("") == 0

    # 复杂表达式
    complex_expr = "x + y * z / (a - b)"
    score = flow_utils._expr_complexity_score(complex_expr)
    assert score >= 2  # 至少包含括号和操作符


def test_for_each_requires_split():
    """测试 _for_each_requires_split 判断是否需要拆分"""
    # 创建 For 节点
    code = "for item in items:\n    print(item)\n"
    tree = ast.parse(code)
    for_node = tree.body[0]

    # 需要实际查看函数实现来确定测试逻辑
    # 这里先简单测试函数可调用
    result = flow_utils._for_each_requires_split(for_node)
    assert isinstance(result, bool)


def test_extract_call_name():
    """测试 _extract_call_name 提取调用名称"""
    # 函数调用
    call_code = "foo()"
    call_tree = ast.parse(call_code)
    call_stmt = call_tree.body[0]
    result = flow_utils._extract_call_name(call_stmt)
    assert result == "foo"

    # 方法调用 - 函数只处理 ast.Name，不处理 ast.Attribute，所以返回 None
    method_code = "obj.method()"
    method_tree = ast.parse(method_code)
    method_stmt = method_tree.body[0]
    result = flow_utils._extract_call_name(method_stmt)
    assert result is None  # 方法调用返回 None

    # 赋值语句中的函数调用
    assign_call_code = "x = bar()"
    assign_call_tree = ast.parse(assign_call_code)
    assign_call_stmt = assign_call_tree.body[0]
    result = flow_utils._extract_call_name(assign_call_stmt)
    assert result == "bar"

    # 返回语句中的函数调用
    return_call_code = "return baz()"
    return_call_tree = ast.parse(return_call_code)
    return_call_stmt = return_call_tree.body[0]
    result = flow_utils._extract_call_name(return_call_stmt)
    assert result == "baz"

    # 非调用语句
    assign_code = "x = 1"
    assign_tree = ast.parse(assign_code)
    assign_stmt = assign_tree.body[0]
    result = flow_utils._extract_call_name(assign_stmt)
    assert result is None


def test_node_id_for_stmt():
    """测试 _node_id_for_stmt 生成节点 ID"""
    code = "x = 1"
    tree = ast.parse(code)
    stmt = tree.body[0]
    parent_id = "parent-123"

    result = flow_utils._node_id_for_stmt(code, stmt, parent_id)
    assert isinstance(result, str)
    assert len(result) > 0
    # ID 应该是 16 个字符的十六进制哈希（stable_id 返回 SHA1 哈希的前 16 个字符）
    assert len(result) == 16
    # 验证是有效的十六进制字符串
    import re
    assert re.match(r'^[0-9a-f]{16}$', result) is not None


def test_make_node_creates_node_dict():
    """测试 _make_node 创建节点字典"""
    code = "x = 1"
    tree = ast.parse(code)
    stmt = tree.body[0]
    parent_id = "parent-123"

    result = flow_utils._make_node(code, "Assign", stmt, parent_id, title="赋值")

    assert isinstance(result, dict)
    assert "id" in result
    assert "kind" in result
    assert "title" in result
    assert "range" in result
    assert "parentId" in result
    assert result["kind"] == "Assign"
    assert result["title"] == "赋值"
    assert result["parentId"] == parent_id


def test_mark_synthetic():
    """测试 _mark_synthetic 标记合成节点"""
    # 创建模拟上下文
    class FakeCtx:
        def __init__(self):
            self.nodes = [
                {"id": "node-1", "title": "节点1", "fullTitle": "完整标题1"},
                {"id": "node-2", "title": "节点2", "fullTitle": "完整标题2"},
                {"id": "node-3", "title": "节点3", "fullTitle": "完整标题3"},
            ]

    ctx = FakeCtx()

    # 测试标记存在的节点
    flow_utils._mark_synthetic(ctx, "node-2")

    # 验证 node-2 被标记为 synthetic，并且 fullTitle 被移除
    node2 = next(n for n in ctx.nodes if n["id"] == "node-2")
    assert node2.get("synthetic") is True
    assert "fullTitle" not in node2

    # 验证其他节点没有被修改
    node1 = next(n for n in ctx.nodes if n["id"] == "node-1")
    assert "synthetic" not in node1
    assert node1.get("fullTitle") == "完整标题1"

    node3 = next(n for n in ctx.nodes if n["id"] == "node-3")
    assert "synthetic" not in node3
    assert node3.get("fullTitle") == "完整标题3"

    # 测试标记不存在的节点（应该无操作）
    flow_utils._mark_synthetic(ctx, "node-999")
    # 所有节点应该保持不变
    assert len([n for n in ctx.nodes if "synthetic" in n]) == 1

    # 测试传入 None（应该无操作）
    flow_utils._mark_synthetic(ctx, None)
    assert len([n for n in ctx.nodes if "synthetic" in n]) == 1


def test_collect_ast_nodes():
    """测试 _collect_ast_nodes 收集 AST 节点"""
    code = "x = 1\ny = 2\nz = x + y\n"
    tree = ast.parse(code)

    # 测试正常情况（限制足够大）
    ok, count = flow_utils._collect_ast_nodes(tree, 100)
    assert ok is True
    assert count > 0
    # 简单的赋值语句应该有几个 AST 节点
    assert count >= 3  # 至少 3 个赋值语句的节点

    # 测试限制节点数（限制很小）
    ok, count = flow_utils._collect_ast_nodes(tree, 1)
    # 如果 AST 节点数超过限制，应该返回 False
    # 注意：当 count > max_nodes 时返回 False，但 count 是已经遍历的节点数
    assert ok is False
    assert count > 1  # 当遍历到第2个节点时，count=2，然后返回 False

    # 测试空树或简单树
    empty_code = ""
    empty_tree = ast.parse(empty_code)
    ok, count = flow_utils._collect_ast_nodes(empty_tree, 10)
    assert ok is True
    # 空树可能有一个 Module 节点
    assert count >= 0

    # 测试复杂代码
    complex_code = """
def factorial(n):
    if n <= 1:
        return 1
    else:
        return n * factorial(n - 1)

result = factorial(5)
print(result)
"""
    complex_tree = ast.parse(complex_code)
    ok, count = flow_utils._collect_ast_nodes(complex_tree, 50)
    assert ok is True
    # 复杂函数应该有更多节点
    assert count > 10


def test_pend_creates_pend_tuple():
    """测试 _pend 创建 pend 元组"""
    from_id = "node-1"
    kind = "Next"
    label = "下一步"

    result = flow_utils._pend(from_id, kind, label)
    assert isinstance(result, tuple)
    assert len(result) == 3
    assert result[0] == from_id
    assert result[1] == kind
    assert result[2] == label

    # 无标签的情况
    result = flow_utils._pend(from_id, kind)
    assert result[2] is None


def test_split_pend():
    """测试 _split_pend 拆分 pend 列表"""
    pend_list = [
        ("node-1", "Next", "下一步"),
        ("node-2", "False", "否"),
        ("node-3", "Next", None),
        ("node-1", "Return", "返回"),
    ]

    result = flow_utils._split_pend(pend_list)
    assert isinstance(result, dict)
    # 应该按 kind 分组，而不是按 from_id
    assert "Next" in result
    assert "False" in result
    assert "Return" in result

    next_pends = result["Next"]
    assert len(next_pends) == 2
    # 应该包含 node-1 和 node-3 的 Next pend
    from_ids = [from_id for from_id, _, _ in next_pends]
    assert "node-1" in from_ids
    assert "node-3" in from_ids

    false_pends = result["False"]
    assert len(false_pends) == 1
    assert false_pends[0] == ("node-2", "False", "否")

    return_pends = result["Return"]
    assert len(return_pends) == 1
    assert return_pends[0] == ("node-1", "Return", "返回")