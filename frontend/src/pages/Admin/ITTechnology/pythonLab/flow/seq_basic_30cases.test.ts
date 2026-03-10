import { buildUnifiedFlowFromPython } from "./python_sync";
import { validatePythonStrict } from "./python_runtime";

const CASES: Array<{ name: string; code: string }> = [
  { name: "01_print基础", code: "print('hello')\n" },
  { name: "02_print多参数", code: "a = 1\nb = 2\nprint(a, b)\n" },
  { name: "03_input字符串拼接", code: "name = input('name:')\nprint('hi', name)\n" },
  { name: "04_int_input", code: "x = int(input())\nprint(x + 1)\n" },
  { name: "05_float_input", code: "x = float(input())\nprint(x / 2)\n" },
  { name: "06_fstring", code: "name = 'ws'\nprint(f'hello {name}')\n" },
  { name: "07_四则运算", code: "a = 3 + 4 * 2\nprint(a)\n" },
  { name: "08_比较运算", code: "a = 3\nb = 4\nprint(a < b)\n" },
  { name: "09_if单分支", code: "x = 3\nif x > 0:\n  print('pos')\nprint('done')\n" },
  { name: "10_if_else", code: "x = 3\nif x % 2 == 0:\n  print('even')\nelse:\n  print('odd')\n" },
  { name: "11_if_elif_else", code: "x = 0\nif x > 0:\n  print('p')\nelif x < 0:\n  print('n')\nelse:\n  print('z')\n" },
  { name: "12_逻辑组合", code: "a = 3\nb = 5\nif a > 0 and b > 0:\n  print('ok')\n" },
  { name: "13_for_range", code: "for i in range(5):\n  print(i)\n" },
  { name: "14_while累加", code: "i = 0\ns = 0\nwhile i < 5:\n  s += i\n  i += 1\nprint(s)\n" },
  { name: "15_嵌套循环", code: "for i in range(2):\n  for j in range(2):\n    print(i, j)\n" },
  { name: "16_break", code: "i = 0\nwhile i < 10:\n  if i == 3:\n    break\n  i += 1\nprint(i)\n" },
  { name: "17_continue", code: "i = 0\nwhile i < 5:\n  i += 1\n  if i == 3:\n    continue\n  print(i)\n" },
  { name: "18_循环统计", code: "cnt = 0\nfor i in range(10):\n  if i % 2 == 0:\n    cnt += 1\nprint(cnt)\n" },
  { name: "19_列表遍历", code: "arr = [1, 2, 3]\nfor i in range(3):\n  print(arr[i])\n" },
  { name: "20_列表推导式", code: "arr = [1, 2, 3]\nsq = [x * x for x in arr]\nprint(sq)\n" },
  { name: "21_字典读取", code: "d = {'a': 1, 'b': 2}\nprint(d['a'])\n" },
  { name: "22_字符串切片", code: "s = 'python'\nprint(s[1:4])\n" },
  { name: "23_len_max_min_sum", code: "arr = [1, 2, 3]\nprint(len(arr), max(arr), min(arr), sum(arr))\n" },
  { name: "24_函数无参", code: "def hi():\n  print('hi')\nhi()\n" },
  { name: "25_函数有参返回", code: "def add(x, y):\n  return x + y\nprint(add(2, 3))\n" },
  { name: "26_局部变量返回", code: "def calc(a):\n  b = a * 2\n  return b\nprint(calc(3))\n" },
  { name: "27_递归阶乘", code: "def fact(n):\n  if n <= 1:\n    return 1\n  else:\n    return n * fact(n - 1)\nprint(fact(5))\n" },
  { name: "28_递归斐波那契", code: "def fib(n):\n  if n <= 1:\n    return n\n  else:\n    return fib(n - 1) + fib(n - 2)\nprint(fib(6))\n" },
  { name: "29_二分查找", code: "def bisect_left(target):\n  lo = 0\n  hi = 100\n  while lo < hi:\n    mid = (lo + hi) // 2\n    if mid < target:\n      lo = mid + 1\n    else:\n      hi = mid\n  return lo\nprint(bisect_left(37))\n" },
  { name: "30_冒泡排序", code: "arr = [3, 1, 2]\nn = 3\nfor i in range(n):\n  for j in range(n - 1 - i):\n    if arr[j] > arr[j + 1]:\n      arr[j], arr[j + 1] = arr[j + 1], arr[j]\nprint(arr)\n" },
];

test.each(CASES)("代码转图可构建: $name", (item: { name: string; code: string }) => {
  const { code } = item;
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;
  expect(built.nodes.length).toBeGreaterThan(1);
  expect(built.edges.length).toBeGreaterThan(0);
});

const STRICT_CASES = CASES.filter((item) => ![
  "06_fstring",
  "19_列表遍历",
  "20_列表推导式",
  "21_字典读取",
  "22_字符串切片",
  "23_len_max_min_sum",
  "30_冒泡排序",
].includes(item.name));

test.each(STRICT_CASES)("严格校验可通过: $name", (item: { name: string; code: string }) => {
  const { code } = item;
  const v = validatePythonStrict(code);
  expect(v.ok).toBe(true);
});
