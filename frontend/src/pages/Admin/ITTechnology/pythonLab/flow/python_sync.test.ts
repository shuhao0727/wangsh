import { buildFlowsFromPython } from "./python_sync";
import { buildUnifiedFlowFromPython } from "./python_sync";

test("buildFlowsFromPython returns function flows and main flow", () => {
  const code = ["def add(x, y):", "  return x + y", "", "x = add(2, 3)", "print(x)", ""].join("\n");
  const built = buildFlowsFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;
  expect(built.functions.length).toBe(1);
  expect(built.functions[0].name).toBe("add");
  expect(built.functions[0].nodes.some((n) => n.shape === "start_end" && n.title.startsWith("def add"))).toBe(true);
  expect(built.main.nodes.some((n) => n.shape === "subroutine" && n.title.includes("add("))).toBe(true);
});

test("buildUnifiedFlowFromPython merges functions into one graph", () => {
  const code = ["def add(x, y):", "  return x + y", "", "x = add(2, 3)", "print(x)", ""].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;
  expect(built.nodes.some((n) => n.shape === "start_end" && n.title.startsWith("def add"))).toBe(true);
  expect(built.nodes.some((n) => n.shape === "subroutine" && n.title.includes("add("))).toBe(true);
});

test("generatePythonFromFlow converts while to for with variable end", () => {
  const { generatePythonFromFlow } = require("./ir");
  const nodes = [
    { id: "start", shape: "start_end", title: "开始", x: 0, y: 0 },
    { id: "n", shape: "process", title: "n = 10", x: 0, y: 0 },
    { id: "a", shape: "process", title: "a = 0", x: 0, y: 0 },
    { id: "b", shape: "process", title: "b = 1", x: 0, y: 0 },
    { id: "i0", shape: "process", title: "i = 0", x: 0, y: 0 },
    { id: "cond", shape: "decision", title: "i ∈ [0, n)?", x: 0, y: 0 },
    { id: "out", shape: "io", title: "print(a)", x: 0, y: 0 },
    { id: "step1", shape: "process", title: "a, b = b, a + b", x: 0, y: 0 },
    { id: "step2", shape: "process", title: "i += 1", x: 0, y: 0 },
    { id: "end", shape: "start_end", title: "结束", x: 0, y: 0 },
  ];
  const edges = [
    { id: "e1", from: "start", to: "n", style: "straight", routeMode: "auto", anchor: null },
    { id: "e2", from: "n", to: "a", style: "straight", routeMode: "auto", anchor: null },
    { id: "e3", from: "a", to: "b", style: "straight", routeMode: "auto", anchor: null },
    { id: "e4", from: "b", to: "i0", style: "straight", routeMode: "auto", anchor: null },
    { id: "e5", from: "i0", to: "cond", style: "straight", routeMode: "auto", anchor: null },
    { id: "e6", from: "cond", to: "out", style: "straight", routeMode: "auto", anchor: null, label: "是", fromPort: "bottom" },
    { id: "e7", from: "out", to: "step1", style: "straight", routeMode: "auto", anchor: null },
    { id: "e8", from: "step1", to: "step2", style: "straight", routeMode: "auto", anchor: null },
    { id: "e9", from: "step2", to: "cond", style: "straight", routeMode: "auto", anchor: null, fromPort: "left", toPort: "left" },
    { id: "e10", from: "cond", to: "end", style: "straight", routeMode: "auto", anchor: null, label: "否", fromPort: "right" },
  ];
  const g = generatePythonFromFlow(nodes, edges);
  expect(g.python.includes("for i in range(0, n):")).toBe(true);
  expect(g.python.includes("while")).toBe(false);
});

test("buildUnifiedFlowFromPython keeps for-range body statements inside loop", () => {
  const code = ["n = 10", "a = 0", "b = 1", "for i in range(n):", "  print(a)", "  a, b = b, a + b", ""].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;

  const nodeById = new Map(built.nodes.map((n) => [n.id, n] as const));
  const outs = new Map<string, { to: string; label?: string }[]>();
  for (const n of built.nodes) outs.set(n.id, []);
  for (const e of built.edges) (outs.get(e.from) ?? outs.set(e.from, []).get(e.from)!).push({ to: e.to, label: e.label });

  const decision = built.nodes.find((n) => n.shape === "decision" && (n as any).sourceRole === "for_check");
  expect(decision).toBeTruthy();
  if (!decision) return;

  const yesEdge = (outs.get(decision.id) || []).find((e) => (e.label ?? "").trim() === "是");
  expect(yesEdge).toBeTruthy();
  if (!yesEdge) return;

  // 教科书风格：条件→是→循环体第一条语句(print)
  const firstBodyId = yesEdge.to;
  expect(nodeById.get(firstBodyId)?.title.trim().startsWith("print(")).toBe(true);

  const targetTitle = "a, b = b, a + b";
  const targetNode = built.nodes.find((n) => n.title.trim() === targetTitle);
  expect(targetNode).toBeTruthy();
  if (!targetNode) return;

  // 递增节点 i += 1 应存在
  const incNode = built.nodes.find((n) => (n as any).sourceRole === "for_inc");
  expect(incNode).toBeTruthy();

  const bfs = (start: string, goal: string) => {
    const q: string[] = [start];
    const seen = new Set<string>([start]);
    while (q.length) {
      const u = q.shift()!;
      if (u === goal) return true;
      for (const e of outs.get(u) || []) {
        if (!seen.has(e.to)) {
          seen.add(e.to);
          q.push(e.to);
        }
      }
    }
    return false;
  };

  expect(bfs(firstBodyId, targetNode.id)).toBe(true);
  expect(bfs(targetNode.id, decision.id)).toBe(true);
});

test("buildUnifiedFlowFromPython for-range start/stop/step 变体保持三段式语义", () => {
  const code = [
    "for i in range(n):",
    "  print(i)",
    "for j in range(1, n):",
    "  print(j)",
    "for k in range(1, n, 2):",
    "  print(k)",
    "",
  ].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;

  const headers = built.debugMap.forRanges.sort((a, b) => a.headerLine - b.headerLine);
  expect(headers.map((x) => x.var)).toEqual(["i", "j", "k"]);

  const initTitles = headers.map((meta) => (built.nodes.find((n) => n.id === meta.initNodeId)?.title || "").replaceAll(" ", ""));
  expect(initTitles).toEqual(["i=0", "j=1", "k=1"]);

  // 教科书风格：init → check 直连
  const hasInitToCheckEdge = (v: "i" | "j" | "k") => {
    const h = headers.find((x) => x.var === v);
    if (!h) return false;
    return built.edges.some((e) => e.from === h.initNodeId && e.to === h.checkNodeId);
  };
  expect(hasInitToCheckEdge("i")).toBe(true);
  expect(hasInitToCheckEdge("j")).toBe(true);
  expect(hasInitToCheckEdge("k")).toBe(true);

  const checkTitles = headers.map((meta) => (built.nodes.find((n) => n.id === meta.checkNodeId)?.title || "").replaceAll(" ", ""));
  expect(checkTitles).toEqual(["i∈[0,n)", "j∈[1,n)", "k∈[1,n),步长=2"]);
});

test("buildUnifiedFlowFromPython 将列表与字典语句映射为 list_op/dict_op", () => {
  const code = [
    "nums = [1, 2, 3]",
    "nums.append(4)",
    "counter = {}",
    "counter['a'] = 1",
    "counter.get('a', 0)",
    "",
  ].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;

  const byTitle = (x: string) => built.nodes.find((n) => n.title.trim() === x) ?? null;
  expect(byTitle("nums = [1, 2, 3]")?.shape).toBe("list_op");
  expect(byTitle("nums.append(4)")?.shape).toBe("list_op");
  expect(byTitle("counter = {}")?.shape).toBe("dict_op");
  expect(byTitle("counter['a'] = 1")?.shape).toBe("dict_op");
  expect(byTitle("counter.get('a', 0)")?.shape).toBe("dict_op");
  expect(byTitle("nums.append(4)")?.sourceRole).not.toBe("call_site");
  expect(byTitle("counter.get('a', 0)")?.sourceRole).not.toBe("call_site");
});

test("buildUnifiedFlowFromPython pop() → list_op, 独立字典下标 → dict_op", () => {
  const code = [
    "nums = [1, 2, 3]",
    "nums.pop()",
    "nums.pop(0)",
    "d = {'a': 1}",
    "d['a']",
    "",
  ].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;

  const byTitle = (x: string) => built.nodes.find((n) => n.title.trim() === x) ?? null;
  expect(byTitle("nums.pop()")?.shape).toBe("list_op");
  expect(byTitle("nums.pop(0)")?.shape).toBe("list_op");
  expect(byTitle("d['a']")?.shape).toBe("dict_op");
});

test("buildUnifiedFlowFromPython 字符串操作映射为 str_op", () => {
  const code = [
    "s = 'hello world'",
    "words = s.split(' ')",
    "s.upper()",
    "s.replace('hello', 'hi')",
    "",
  ].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;

  const byTitle = (x: string) => built.nodes.find((n) => n.title.trim() === x) ?? null;
  expect(byTitle("words = s.split(' ')")?.shape).toBe("str_op");
  expect(byTitle("s.upper()")?.shape).toBe("str_op");
  expect(byTitle("s.replace('hello', 'hi')")?.shape).toBe("str_op");
});

test("buildUnifiedFlowFromPython break/continue/return 映射为 jump", () => {
  const code = [
    "def foo(x):",
    "  for i in range(10):",
    "    if i == x:",
    "      return i",
    "    if i == 5:",
    "      break",
    "  return -1",
    "",
  ].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;

  const jumpNodes = built.nodes.filter((n) => n.shape === "jump");
  expect(jumpNodes.length).toBeGreaterThanOrEqual(2);
  expect(jumpNodes.some((n) => n.title.trim() === "break")).toBe(true);
  expect(jumpNodes.some((n) => n.title.trim().startsWith("return"))).toBe(true);
});
