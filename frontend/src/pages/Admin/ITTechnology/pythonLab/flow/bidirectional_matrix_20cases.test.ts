import { generatePythonFromFlow } from "./ir";
import { validatePythonStrict } from "./python_runtime";
import { buildUnifiedFlowFromPython } from "./python_sync";
import { classifyConversionFailure } from "./conversionFailure";

type MatrixCase = {
  name: string;
  code: string;
  mustContain: string[];
};

const CASES: MatrixCase[] = [
  { name: "01_assign_print", code: "a = 1\nb = 2\nprint(a + b)\n", mustContain: ["print("] },
  { name: "02_if_else", code: "x = 3\nif x > 0:\n  print('p')\nelse:\n  print('n')\n", mustContain: ["if ", "else:", "print("] },
  { name: "03_while_loop", code: "i = 0\nwhile i < 3:\n  print(i)\n  i += 1\n", mustContain: ["print("] },
  { name: "04_for_range_stop", code: "for i in range(5):\n  print(i)\n", mustContain: ["for ", "range("] },
  { name: "05_for_range_step", code: "for i in range(1, 10, 2):\n  print(i)\n", mustContain: ["for ", "range("] },
  { name: "06_nested_if", code: "x = 7\nif x > 0:\n  if x % 2 == 1:\n    print('odd')\n", mustContain: ["if ", "print("] },
  { name: "07_list_ops", code: "arr = [1, 2]\narr.append(3)\nprint(arr)\n", mustContain: ["append(", "print("] },
  { name: "08_dict_ops", code: "d = {'a': 1}\nd['b'] = 2\nprint(d['a'])\n", mustContain: ["print("] },
  { name: "09_function_call", code: "def add(x, y):\n  return x + y\nprint(add(2, 3))\n", mustContain: ["def add", "return ", "print("] },
  { name: "10_recursion_fact", code: "def fact(n):\n  if n <= 1:\n    return 1\n  return n * fact(n - 1)\nprint(fact(5))\n", mustContain: ["def fact", "fact(", "return "] },
  { name: "11_recursion_fib", code: "def fib(n):\n  if n <= 1:\n    return n\n  return fib(n - 1) + fib(n - 2)\nprint(fib(6))\n", mustContain: ["def fib", "fib(", "return "] },
  { name: "12_binary_search", code: "def bisect_left(target):\n  lo = 0\n  hi = 100\n  while lo < hi:\n    mid = (lo + hi) // 2\n    if mid < target:\n      lo = mid + 1\n    else:\n      hi = mid\n  return lo\nprint(bisect_left(37))\n", mustContain: ["def bisect_left", "while ", "mid ="] },
  { name: "13_break", code: "i = 0\nwhile i < 10:\n  if i == 3:\n    break\n  i += 1\nprint(i)\n", mustContain: ["break", "while "] },
  { name: "14_continue", code: "i = 0\nwhile i < 5:\n  i += 1\n  if i == 3:\n    continue\n  print(i)\n", mustContain: ["continue", "while "] },
  { name: "15_nested_for", code: "for i in range(2):\n  for j in range(2):\n    print(i, j)\n", mustContain: ["for ", "print("] },
  { name: "16_for_in_list", code: "items = [1, 2, 3]\nfor x in items:\n  print(x)\n", mustContain: ["for ", "in ", "print("] },
  { name: "17_for_in_enumerate", code: "items = [10, 20]\nfor i, x in enumerate(items):\n  print(i, x)\n", mustContain: ["for ", "enumerate(", "print("] },
  { name: "18_sum_accumulate", code: "total = 0\nfor i in range(1, 6):\n  total += i\nprint(total)\n", mustContain: ["for ", "total +=", "print("] },
  { name: "19_minimum_search", code: "arr = [3, 1, 2]\nmn = arr[0]\nfor i in range(1, 3):\n  if arr[i] < mn:\n    mn = arr[i]\nprint(mn)\n", mustContain: ["for ", "if ", "print("] },
  { name: "20_dict_update_loop", code: "d = {'a': 1, 'b': 2}\nfor k in d:\n  d[k] = d[k] + 1\nprint(d)\n", mustContain: ["for ", "print("] },
];

const normalizeCompact = (s: string) => s.replace(/\s+/g, "");

test("20 样例双向回归矩阵通过", () => {
  const report = CASES.map((item) => {
    const built1 = buildUnifiedFlowFromPython(item.code);
    if (!built1) {
      return { name: item.name, ok: false, stage: "code_to_flow", reason: "buildUnifiedFlowFromPython 返回 null" };
    }
    const code1 = generatePythonFromFlow(built1.nodes, built1.edges).python;
    const v1 = validatePythonStrict(code1);
    const fail1 = classifyConversionFailure({ code: code1, strictOk: v1.ok, strictErrors: v1.ok ? [] : v1.errors, warnings: built1.warnings });
    const compactCode1 = normalizeCompact(code1);
    const missed = v1.ok ? item.mustContain.filter((token) => !compactCode1.includes(normalizeCompact(token))) : [];

    const built2 = buildUnifiedFlowFromPython(code1);
    if (!built2) {
      return { name: item.name, ok: false, stage: "graph_to_code_to_graph", reason: "二次 buildUnifiedFlowFromPython 返回 null" };
    }
    const code2 = generatePythonFromFlow(built2.nodes, built2.edges).python;
    const v2 = validatePythonStrict(code2);
    const fail2 = classifyConversionFailure({ code: code2, strictOk: v2.ok, strictErrors: v2.ok ? [] : v2.errors, warnings: built2.warnings });

    return {
      name: item.name,
      ok: true,
      strict1: v1.ok,
      strict2: v2.ok,
      category1: fail1.category,
      category2: fail2.category,
      missed,
      nodes1: built1.nodes.length,
      edges1: built1.edges.length,
      nodes2: built2.nodes.length,
      edges2: built2.edges.length,
    };
  });

  const failed = report.filter((x) => !x.ok);
  const strict1Pass = report.filter((x) => "strict1" in x && x.strict1).length;
  const strict2Pass = report.filter((x) => "strict2" in x && x.strict2).length;
  const containsFailures = report.filter((x) => {
    const missed = "missed" in x ? x.missed : undefined;
    return Array.isArray(missed) && missed.length > 0;
  });
  expect(failed).toEqual([]);
  expect(report).toHaveLength(20);
  expect(strict1Pass).toBeGreaterThanOrEqual(10);
  expect(strict2Pass).toBeGreaterThanOrEqual(10);
  expect(containsFailures).toEqual([]);
});
