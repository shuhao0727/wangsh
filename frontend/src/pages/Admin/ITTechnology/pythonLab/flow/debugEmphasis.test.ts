import { buildForRangeIndex, inferDebugEmphasis } from "./debugEmphasis";

test("buildForRangeIndex indexes for-range by header line", () => {
  const code = ["n = 3", "for i in range(n):", "  print(i)", ""].join("\n");
  const idx = buildForRangeIndex(code);
  expect(idx.get(2)?.[0]?.v).toBe("i");
  expect(idx.get(2)?.[0]?.body).toEqual({ startLine: 3, endLine: 3 });
});

test("inferDebugEmphasis returns for_init when loop var appears at header", () => {
  const code = ["for i in range(3):", "  print(i)", ""].join("\n");
  const idx = buildForRangeIndex(code);
  const prevVars = new Map<string, { value: string; type: string }>();
  const nextVars = new Map<string, { value: string; type: string }>([["i", { value: "0", type: "int" }]]);
  const e = inferDebugEmphasis({ forRangeIndex: idx, activeLine: 1, prevActiveLine: null, prevVars, nextVars });
  expect(e).toEqual({ line: 1, role: "for_check" });
});

test("inferDebugEmphasis returns for_inc when loop var changes at header", () => {
  const code = ["for i in range(3):", "  print(i)", ""].join("\n");
  const idx = buildForRangeIndex(code);
  const prevVars = new Map<string, { value: string; type: string }>([["i", { value: "0", type: "int" }]]);
  const nextVars = new Map<string, { value: string; type: string }>([["i", { value: "1", type: "int" }]]);
  const e = inferDebugEmphasis({ forRangeIndex: idx, activeLine: 1, prevActiveLine: 1, prevVars, nextVars });
  expect(e).toEqual({ line: 1, role: "for_inc", thenRole: "for_check" });
});

test("inferDebugEmphasis returns for_check when loop var unchanged at header", () => {
  const code = ["for i in range(3):", "  print(i)", ""].join("\n");
  const idx = buildForRangeIndex(code);
  const prevVars = new Map<string, { value: string; type: string }>([["i", { value: "1", type: "int" }]]);
  const nextVars = new Map<string, { value: string; type: string }>([["i", { value: "1", type: "int" }]]);
  const e = inferDebugEmphasis({ forRangeIndex: idx, activeLine: 1, prevActiveLine: 1, prevVars, nextVars });
  expect(e).toEqual({ line: 1, role: "for_check" });
});

test("inferDebugEmphasis doesn't shift for_check from header when activeLine is body", () => {
  const code = ["for i in range(3):", "  print(i)", ""].join("\n");
  const idx = buildForRangeIndex(code);
  const prevVars = new Map<string, { value: string; type: string }>();
  const nextVars = new Map<string, { value: string; type: string }>([["i", { value: "0", type: "int" }]]);
  const e = inferDebugEmphasis({ forRangeIndex: idx, activeLine: 2, prevActiveLine: 1, prevVars, nextVars });
  expect(e).toBe(null);
});

test("inferDebugEmphasis infers for_inc transition when stepping from body to header", () => {
  const code = ["for i in range(3):", "  a = 1", "  b = 2", ""].join("\n");
  const idx = buildForRangeIndex(code);
  const prevVars = new Map<string, { value: string; type: string }>([["i", { value: "0", type: "int" }]]);
  const nextVars = new Map<string, { value: string; type: string }>([["i", { value: "0", type: "int" }]]);
  const e = inferDebugEmphasis({ forRangeIndex: idx, activeLine: 1, prevActiveLine: 3, prevVars, nextVars });
  expect(e).toEqual({ line: 1, role: "for_inc", thenRole: "for_check" });
});

test("inferDebugEmphasis supports range with expressions", () => {
  const code = ["total = 0", "for i in range(1, (10 + 1)):", "  total += i", ""].join("\n");
  const idx = buildForRangeIndex(code);
  const prevVars = new Map<string, { value: string; type: string }>();
  const nextVars = new Map<string, { value: string; type: string }>([["total", { value: "0", type: "int" }]]);
  const e = inferDebugEmphasis({ forRangeIndex: idx, activeLine: 2, prevActiveLine: 1, prevVars, nextVars });
  expect(e).toEqual({ line: 2, role: "for_check" });
});
