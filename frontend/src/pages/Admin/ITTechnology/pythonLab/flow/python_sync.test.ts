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
    { id: "cond", shape: "decision", title: "i < n ?", x: 0, y: 0 },
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
  expect(g.python.includes("for i in range(n):")).toBe(true);
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

  const decision = built.nodes.find((n) => n.shape === "decision" && n.title.replaceAll(" ", "").includes("i<n"));
  expect(decision).toBeTruthy();
  if (!decision) return;

  const yesEdge = (outs.get(decision.id) || []).find((e) => (e.label ?? "").trim() === "是");
  expect(yesEdge).toBeTruthy();
  if (!yesEdge) return;

  const printNodeId = yesEdge.to;
  expect(nodeById.get(printNodeId)?.title.trim().startsWith("print(")).toBe(true);

  const targetTitle = "a, b = b, a + b";
  const targetNode = built.nodes.find((n) => n.title.trim() === targetTitle);
  expect(targetNode).toBeTruthy();
  if (!targetNode) return;

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

  expect(bfs(printNodeId, targetNode.id)).toBe(true);
  expect(bfs(targetNode.id, decision.id)).toBe(true);
});
