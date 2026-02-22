import type { PythonLabExperiment } from "./types";

export const pythonLabStorageKey = "python_lab_experiments";

const defaultExperiments: PythonLabExperiment[] = [
  {
    id: "loops",
    title: "循环：求和",
    level: "基础",
    tags: ["for", "range", "sum"],
    scenario: "循环",
    starterCode: "total = 0\nfor i in range(1, 11):\n    total += i\nprint(total)\n",
  },
  {
    id: "nested_if",
    title: "条件分支：成绩等级（嵌套分支）",
    level: "进阶",
    tags: ["if", "else"],
    scenario: "条件分支",
    starterCode:
      "score = 83\nif score >= 90:\n    grade = \"A\"\nelse:\n    if score >= 60:\n        grade = \"B\"\n    else:\n        grade = \"C\"\nprint(grade)\n",
  },
  {
    id: "functions",
    title: "函数调用：add",
    level: "基础",
    tags: ["def", "return", "call"],
    scenario: "函数调用",
    starterCode: "def add(a, b):\n    return a + b\n\nx = add(2, 3)\nprint(x)\n",
  },
  {
    id: "exception_safe_div",
    title: "异常处理：安全除法",
    level: "进阶",
    starterCode:
      "def safe_div(a, b):\n    try:\n        return a / b\n    except ZeroDivisionError:\n        return None\n\nprint(safe_div(10, 2))\nprint(safe_div(10, 0))\n",
    tags: ["try", "except", "return"],
    scenario: "异常处理",
  },
  {
    id: "recursion_factorial",
    title: "递归：阶乘",
    level: "进阶",
    tags: ["def", "if", "return", "recursion"],
    scenario: "递归",
    starterCode:
      "def fact(n):\n    if n <= 1:\n        return 1\n    return n * fact(n - 1)\n\nprint(fact(5))\n",
  },
  {
    id: "concurrency_asyncio",
    title: "并发：asyncio.gather",
    level: "进阶",
    tags: ["asyncio", "async", "await"],
    scenario: "并发",
    starterCode:
      "import asyncio\n\nasync def work(x):\n    await asyncio.sleep(0.1)\n    return x * x\n\nasync def main():\n    results = await asyncio.gather(work(2), work(3), work(4))\n    print(results)\n\nasyncio.run(main())\n",
  },
  {
    id: "io_input_calc",
    title: "I/O：输入两个数求和",
    level: "基础",
    tags: ["input", "int", "print"],
    scenario: "I/O",
    starterCode: "a = int(input(\"a=\"))\nb = int(input(\"b=\"))\nprint(a + b)\n",
  },
  {
    id: "data_struct_counter",
    title: "数据结构：词频统计",
    level: "进阶",
    tags: ["dict", "for", "get"],
    scenario: "数据结构",
    starterCode:
      "text = \"to be or not to be\"\nwords = text.split()\ncounts = {}\nfor w in words:\n    counts[w] = counts.get(w, 0) + 1\nprint(counts)\n",
  },
  {
    id: "algorithm_binary_search",
    title: "算法：二分查找",
    level: "进阶",
    tags: ["def", "while", "elif", "return"],
    scenario: "算法",
    starterCode:
      "def binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1\n\nsorted_list = [1, 3, 5, 7, 9, 11, 13, 15]\nprint(binary_search(sorted_list, 7))\n",
  },
  {
    id: "oop_account",
    title: "面向对象：账户类",
    level: "进阶",
    tags: ["class", "__init__", "try", "except"],
    scenario: "面向对象",
    starterCode:
      "class Account:\n    def __init__(self, balance):\n        self.balance = balance\n\n    def deposit(self, amount):\n        self.balance += amount\n\n    def withdraw(self, amount):\n        if amount > self.balance:\n            raise ValueError(\"insufficient\")\n        self.balance -= amount\n\nacc = Account(100)\nacc.deposit(50)\ntry:\n    acc.withdraw(200)\nexcept ValueError:\n    print(\"fail\")\nprint(acc.balance)\n",
  },
];

function normalizeExperiment(raw: any, defaultsById: Map<string, PythonLabExperiment>): PythonLabExperiment | null {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" ? raw.id : "";
  const title = typeof raw.title === "string" ? raw.title : "";
  const starterCode = typeof raw.starterCode === "string" ? raw.starterCode : "";
  const level = raw.level === "入门" || raw.level === "基础" || raw.level === "进阶" ? raw.level : "入门";
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((t: any) => typeof t === "string") : [];

  const d = id ? defaultsById.get(id) : undefined;
  const scenarioRaw = typeof raw.scenario === "string" ? raw.scenario : "";
  const scenario =
    scenarioRaw === "循环" ||
    scenarioRaw === "条件分支" ||
    scenarioRaw === "函数调用" ||
    scenarioRaw === "异常处理" ||
    scenarioRaw === "递归" ||
    scenarioRaw === "并发" ||
    scenarioRaw === "I/O" ||
    scenarioRaw === "数据结构" ||
    scenarioRaw === "算法" ||
    scenarioRaw === "面向对象"
      ? scenarioRaw
      : d?.scenario ?? "循环";

  if (!id || !title || !starterCode) return null;
  return { id, title, level, tags, scenario, starterCode };
}

export function loadPythonLabExperiments(): PythonLabExperiment[] {
  const defaultsById = new Map(defaultExperiments.map((e) => [e.id, e] as const));
  try {
    const raw = localStorage.getItem(pythonLabStorageKey);
    if (!raw) return defaultExperiments;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const saved = parsed
        .map((x) => normalizeExperiment(x, defaultsById))
        .filter(Boolean) as PythonLabExperiment[];
      const savedById = new Map(saved.map((e) => [e.id, e] as const));
      const merged = saved.slice();
      for (const d of defaultExperiments) {
        if (!savedById.has(d.id)) merged.push(d);
      }
      return merged;
    }
    return defaultExperiments;
  } catch {
    return defaultExperiments;
  }
}

export function savePythonLabExperiments(items: PythonLabExperiment[]) {
  localStorage.setItem(pythonLabStorageKey, JSON.stringify(items));
}
