import { computeDebugNodeSelection } from "./debugMap";
import { buildUnifiedFlowFromPython } from "./python_sync";

test("DebugMap for-range 包含 init/check/inc nodeId 与 bodyLineRange", () => {
  const code = ["n = 3", "for i in range(n):", "  print(i)", ""].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;

  const dm = built.debugMap;
  expect(dm.forRanges.length).toBe(1);
  const fr = dm.forRanges[0];
  expect(fr.headerLine).toBe(2);
  expect(fr.var).toBe("i");
  expect(fr.bodyLineRange).toEqual({ startLine: 3, endLine: 3 });

  const init = built.nodes.find((n) => n.id === fr.initNodeId) ?? null;
  const check = built.nodes.find((n) => n.id === fr.checkNodeId) ?? null;
  const inc = built.nodes.find((n) => n.id === fr.incNodeId) ?? null;

  expect(init?.sourceLine).toBe(2);
  expect((init as any)?.sourceRole).toBe("for_init");
  expect(check?.shape).toBe("decision");
  expect(check?.sourceLine).toBe(2);
  expect((check as any)?.sourceRole).toBe("for_check");
  expect(inc?.sourceLine).toBe(2);
  expect((inc as any)?.sourceRole).toBe("for_inc");
});

test("强调选择：停在 for-range 头部行时选择 checkNodeId", () => {
  const code = ["n = 3", "for i in range(n):", "  print(i)", ""].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;
  const fr = built.debugMap.forRanges[0];

  const selection = computeDebugNodeSelection({
    debugMap: built.debugMap,
    activeLine: 2,
    prevActiveLine: null,
    prevVars: new Map(),
    nextVars: new Map([["i", { value: "0", type: "int" }]]),
  });

  expect(selection.activeNodeId).toBe(fr.checkNodeId);
  expect(selection.transitionQueue).toEqual([fr.checkNodeId]);
});

test("强调选择：循环体→头部步进时出现 inc→check 的过渡队列", () => {
  const code = ["n = 3", "for i in range(n):", "  print(i)", ""].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;
  const fr = built.debugMap.forRanges[0];

  const selection = computeDebugNodeSelection({
    debugMap: built.debugMap,
    activeLine: 2,
    prevActiveLine: 3,
    prevVars: new Map([["i", { value: "0", type: "int" }]]),
    nextVars: new Map([["i", { value: "0", type: "int" }]]),
  });

  expect(selection.activeNodeId).toBe(fr.incNodeId);
  expect(selection.transitionQueue).toEqual([fr.incNodeId, fr.checkNodeId]);
});

test("强调选择：头部邻近行若已有映射节点，不强制抢占为 for 回边", () => {
  const code = ["n = 3", "for i in range(n):", "  print(i)", "print('done')", ""].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;
  const line1Node = built.nodes.find((n) => n.sourceLine === 1) ?? null;
  expect(line1Node).not.toBeNull();

  const selection = computeDebugNodeSelection({
    debugMap: built.debugMap,
    activeLine: 1,
    prevActiveLine: 3,
    prevVars: new Map([["i", { value: "0", type: "int" }]]),
    nextVars: new Map([["i", { value: "0", type: "int" }]]),
  });

  expect(selection.activeFlowLine).toBe(1);
  expect(selection.activeNodeId).toBe(line1Node?.id || null);
  expect(selection.transitionQueue.length).toBe(1);
});

test("强调选择：当前行已有映射节点时不被邻近循环语义抢占", () => {
  const code = ["total = 0", "i = 1", "while i <= 3:", "  total += i", "  i += 1", "print(total)", ""].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;
  const printNode = built.nodes.find((n) => n.sourceLine === 6) ?? null;
  expect(printNode).not.toBeNull();

  const selection = computeDebugNodeSelection({
    debugMap: built.debugMap,
    activeLine: 6,
    prevActiveLine: 5,
    prevVars: new Map([["i", { value: "3", type: "int" }], ["total", { value: "6", type: "int" }]]),
    nextVars: new Map([["i", { value: "4", type: "int" }], ["total", { value: "6", type: "int" }]]),
  });

  expect(selection.activeFlowLine).toBe(6);
  expect(selection.activeNodeId).toBe(printNode?.id || null);
});

test("强调选择：无法按行命中时也会回退到任意节点（避免空强调）", () => {
  const code = ["n = 3", "for i in range(n):", "  print(i)", ""].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;

  const selection = computeDebugNodeSelection({
    debugMap: built.debugMap,
    activeLine: 999,
    prevActiveLine: null,
    prevVars: new Map(),
    nextVars: new Map(),
  });

  expect(selection.activeNodeId).toBeTruthy();
});

test("DebugMap for-in（列表）包含 next/bind 与 bodyLineRange", () => {
  const code = ["arr = [1, 2, 3]", "for x in arr:", "  print(x)", ""].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;
  expect(built.debugMap.forIns.length).toBe(1);
  const fi = built.debugMap.forIns[0];
  expect(fi.headerLine).toBe(2);
  expect(fi.vars).toEqual(["x"]);
  expect(fi.bodyLineRange).toEqual({ startLine: 3, endLine: 3 });
  const next = built.nodes.find((n) => n.id === fi.nextNodeId) ?? null;
  const bind = built.nodes.find((n) => n.id === fi.bindNodeId) ?? null;
  expect((next as any)?.sourceRole).toBe("for_in_next");
  expect((bind as any)?.sourceRole).toBe("for_in_bind");
});

test("强调选择：for-in 变量变化时出现 bind→next 的过渡队列", () => {
  const code = ["arr = [1, 2, 3]", "for x in arr:", "  print(x)", ""].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;
  const fi = built.debugMap.forIns[0];
  const selection = computeDebugNodeSelection({
    debugMap: built.debugMap,
    activeLine: 2,
    prevActiveLine: 3,
    prevVars: new Map([["x", { value: "1", type: "int" }]]),
    nextVars: new Map([["x", { value: "2", type: "int" }]]),
  });
  expect(selection.activeNodeId).toBe(fi.bindNodeId);
  expect(selection.transitionQueue).toEqual([fi.bindNodeId, fi.nextNodeId]);
});

test("while 条件节点具备 while_check 角色", () => {
  const code = ["i = 0", "while i < 3:", "  i += 1", ""].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;
  const cond = built.nodes.find((n) => n.shape === "decision" && n.sourceLine === 2) ?? null;
  expect((cond as any)?.sourceRole).toBe("while_check");
});

test("语句角色：aug_assign / call_site / return_stmt", () => {
  const code = ["def add(x, y):", "  return x + y", "", "x = add(2, 3)", "x += 1", ""].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;
  const call = built.nodes.find((n) => n.title.trim().includes("add(2, 3)")) ?? null;
  expect((call as any)?.sourceRole).toBe("call_site");
  const aug = built.nodes.find((n) => n.title.trim() === "x += 1") ?? null;
  expect((aug as any)?.sourceRole).toBe("aug_assign");
  const ret = built.nodes.find((n) => n.title.trim().startsWith("return ")) ?? null;
  expect((ret as any)?.sourceRole).toBe("return_stmt");
});

test("while 尾行断点轨迹会在条件为真时回访条件节点", () => {
  const code = ["total = 0", "i = 1", "while i <= 3:", "  total += i", "  i += 1", "print(total)", ""].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;

  const frames = [
    { line: 3, vars: new Map([["i", { value: "1", type: "int" }], ["total", { value: "0", type: "int" }]]) },
    { line: 4, vars: new Map([["i", { value: "1", type: "int" }], ["total", { value: "0", type: "int" }]]) },
    { line: 5, vars: new Map([["i", { value: "1", type: "int" }], ["total", { value: "1", type: "int" }]]) },
    { line: 6, vars: new Map([["i", { value: "2", type: "int" }], ["total", { value: "1", type: "int" }]]) },
    { line: 4, vars: new Map([["i", { value: "2", type: "int" }], ["total", { value: "1", type: "int" }]]) },
    { line: 5, vars: new Map([["i", { value: "2", type: "int" }], ["total", { value: "3", type: "int" }]]) },
    { line: 6, vars: new Map([["i", { value: "3", type: "int" }], ["total", { value: "3", type: "int" }]]) },
    { line: 4, vars: new Map([["i", { value: "3", type: "int" }], ["total", { value: "3", type: "int" }]]) },
    { line: 5, vars: new Map([["i", { value: "3", type: "int" }], ["total", { value: "6", type: "int" }]]) },
    { line: 6, vars: new Map([["i", { value: "4", type: "int" }], ["total", { value: "6", type: "int" }]]) },
  ];

  const activeFlowLines: number[] = [];
  let prevActiveLine: number | null = null;
  let prevVars = new Map<string, { value: string; type: string }>();
  for (const frame of frames) {
    const selection = computeDebugNodeSelection({
      debugMap: built.debugMap,
      activeLine: frame.line,
      prevActiveLine,
      prevVars,
      nextVars: frame.vars,
    });
    activeFlowLines.push(selection.activeFlowLine || 0);
    prevActiveLine = frame.line;
    prevVars = frame.vars;
  }

  expect(activeFlowLines).toEqual([3, 4, 5, 3, 4, 5, 3, 4, 5, 6]);
});
