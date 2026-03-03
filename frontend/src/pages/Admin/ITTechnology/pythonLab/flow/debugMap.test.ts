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

