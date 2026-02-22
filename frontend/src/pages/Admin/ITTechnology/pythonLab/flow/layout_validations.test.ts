import { buildUnifiedFlowFromPython } from "./python_sync";
import { arrangeFromIRElk } from "./ir_layout_elk";
import { nodeSize } from "./ports";

function rectFor(n: { x: number; y: number; shape: any }) {
  const s = nodeSize(n.shape);
  return { minX: n.x, minY: n.y, maxX: n.x + s.w, maxY: n.y + s.h };
}

function rectIntersects(a: { minX: number; minY: number; maxX: number; maxY: number }, b: { minX: number; minY: number; maxX: number; maxY: number }) {
  return !(a.maxX <= b.minX || a.minX >= b.maxX || a.maxY <= b.minY || a.minY >= b.maxY);
}

test("ELK layout keeps fib for-range loop body below decision and no node overlaps", async () => {
  const code = ["n = 10", "a = 0", "b = 1", "for i in range(n):", "  print(a)", "  a, b = b, a + b", ""].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;

  const laid = await arrangeFromIRElk(built.nodes, built.edges);
  const nodeById = new Map(laid.nodes.map((n) => [n.id, n] as const));

  const decision = laid.nodes.find((n) => n.shape === "decision" && n.title.replaceAll(" ", "").includes("i<n"));
  expect(decision).toBeTruthy();
  if (!decision) return;

  const yes = laid.edges.find((e) => e.from === decision.id && (e.label ?? "").trim() === "是");
  expect(yes).toBeTruthy();
  if (!yes) return;
  const printNode = nodeById.get(yes.to);
  expect(printNode).toBeTruthy();
  if (!printNode) return;
  expect(printNode.y).toBeGreaterThan(decision.y);

  const ab = laid.nodes.find((n) => n.title.trim() === "a, b = b, a + b");
  expect(ab).toBeTruthy();
  if (!ab) return;
  expect(ab.y).toBeGreaterThan(decision.y);

  for (let i = 0; i < laid.nodes.length; i++) {
    for (let j = i + 1; j < laid.nodes.length; j++) {
      const aR = rectFor(laid.nodes[i]);
      const bR = rectFor(laid.nodes[j]);
      expect(rectIntersects(aR, bR)).toBe(false);
    }
  }
});

test("ELK layout keeps if/else branches below decision and print after merge", async () => {
  const code = [
    "x = 3",
    "if x % 2 == 0:",
    "  msg = 'even'",
    "else:",
    "  msg = 'odd'",
    "print(msg)",
    "",
  ].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;
  const laid = await arrangeFromIRElk(built.nodes, built.edges);
  const nodeById = new Map(laid.nodes.map((n) => [n.id, n] as const));

  const decision = laid.nodes.find((n) => n.shape === "decision" && n.title.includes("%") && n.title.includes("=="));
  expect(decision).toBeTruthy();
  if (!decision) return;

  const yes = laid.edges.find((e) => e.from === decision.id && (e.label ?? "").trim() === "是");
  const no = laid.edges.find((e) => e.from === decision.id && (e.label ?? "").trim() === "否");
  expect(yes).toBeTruthy();
  expect(no).toBeTruthy();
  if (!yes || !no) return;
  const thenN = nodeById.get(yes.to)!;
  const elseN = nodeById.get(no.to)!;
  expect(thenN.y).toBeGreaterThan(decision.y);
  expect(elseN.y).toBeGreaterThan(decision.y);

  const print = laid.nodes.find((n) => n.shape === "io" && n.title.trim().startsWith("print("));
  expect(print).toBeTruthy();
  if (!print) return;
  expect(print.y).toBeGreaterThan(Math.max(thenN.y, elseN.y) - 1);
});

test("ELK layout packs main and function flows without overlapping", async () => {
  const code = [
    "def sum_n(n):",
    "  total = 0",
    "  for i in range(n):",
    "    total += i",
    "  return total",
    "",
    "ans = sum_n(10)",
    "print(ans)",
    "",
  ].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;
  const laid = await arrangeFromIRElk(built.nodes, built.edges);

  const mainStart = laid.nodes.find((n) => n.shape === "start_end" && n.title.includes("开始"));
  const fnStart = laid.nodes.find((n) => n.shape === "start_end" && n.title.trim().toLowerCase().startsWith("def "));
  expect(mainStart).toBeTruthy();
  expect(fnStart).toBeTruthy();
  if (!mainStart || !fnStart) return;

  const mainNodes = laid.nodes.filter((n) => !n.id.startsWith("fn_"));
  const fnNodes = laid.nodes.filter((n) => n.id.startsWith("fn_"));

  const bA = (() => {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const n of mainNodes) {
      const r = rectFor(n);
      minX = Math.min(minX, r.minX);
      minY = Math.min(minY, r.minY);
      maxX = Math.max(maxX, r.maxX);
      maxY = Math.max(maxY, r.maxY);
    }
    return { minX, minY, maxX, maxY };
  })();
  const bB = (() => {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const n of fnNodes) {
      const r = rectFor(n);
      minX = Math.min(minX, r.minX);
      minY = Math.min(minY, r.minY);
      maxX = Math.max(maxX, r.maxX);
      maxY = Math.max(maxY, r.maxY);
    }
    return { minX, minY, maxX, maxY };
  })();

  expect(rectIntersects(bA, bB)).toBe(false);
});

test("ELK layout is deterministic for same input", async () => {
  const code = [
    "def sum_n(n):",
    "  total = 0",
    "  for i in range(n):",
    "    total += i",
    "  return total",
    "",
    "ans = sum_n(10)",
    "print(ans)",
    "",
  ].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;

  const a = await arrangeFromIRElk(built.nodes, built.edges, { width: 1000, height: 700 });
  const b = await arrangeFromIRElk(built.nodes, built.edges, { width: 1000, height: 700 });
  const byIdA = new Map(a.nodes.map((n) => [n.id, n] as const));
  for (const n of b.nodes) {
    const nA = byIdA.get(n.id);
    expect(nA).toBeTruthy();
    if (!nA) continue;
    expect(n.x).toBe(nA.x);
    expect(n.y).toBe(nA.y);
  }
});

test("ELK layout is deterministic for demo function graph (no def title)", async () => {
  const id = (name: string) => `demo_det_${name}`;
  const fnNodes = [
    { id: id("fn_start"), shape: "start_end", title: "sum_n(n)", x: 0, y: 0 },
    { id: id("fn_total0"), shape: "process", title: "total = 0", x: 0, y: 0 },
    { id: id("fn_i1"), shape: "process", title: "i = 1", x: 0, y: 0 },
    { id: id("fn_cond"), shape: "decision", title: "i <= n ?", x: 0, y: 0 },
    { id: id("fn_add"), shape: "process", title: "total += i", x: 0, y: 0 },
    { id: id("fn_inc"), shape: "process", title: "i += 1", x: 0, y: 0 },
    { id: id("fn_ret"), shape: "process", title: "return total", x: 0, y: 0 },
  ] as any;
  const fnEdges = [
    { id: id("fe1"), from: id("fn_start"), to: id("fn_total0"), style: "straight", routeMode: "auto", anchor: null },
    { id: id("fe2"), from: id("fn_total0"), to: id("fn_i1"), style: "straight", routeMode: "auto", anchor: null },
    { id: id("fe3"), from: id("fn_i1"), to: id("fn_cond"), style: "straight", routeMode: "auto", anchor: null },
    { id: id("fe4"), from: id("fn_cond"), to: id("fn_add"), style: "straight", routeMode: "auto", anchor: null, label: "是", fromPort: "bottom" },
    { id: id("fe5"), from: id("fn_add"), to: id("fn_inc"), style: "straight", routeMode: "auto", anchor: null },
    { id: id("fe6"), from: id("fn_inc"), to: id("fn_cond"), style: "straight", routeMode: "auto", anchor: null, fromPort: "left", toPort: "left" },
    { id: id("fe7"), from: id("fn_cond"), to: id("fn_ret"), style: "straight", routeMode: "auto", anchor: null, label: "否", fromPort: "right" },
  ] as any;

  const mainNodes = [
    { id: id("main_start"), shape: "start_end", title: "开始", x: 0, y: 0 },
    { id: id("main_call"), shape: "subroutine", title: "ans = sum_n(100)", x: 0, y: 0 },
    { id: id("main_end"), shape: "start_end", title: "结束", x: 0, y: 0 },
  ] as any;
  const mainEdges = [
    { id: id("me1"), from: id("main_start"), to: id("main_call"), style: "straight", routeMode: "auto", anchor: null },
    { id: id("me2"), from: id("main_call"), to: id("main_end"), style: "straight", routeMode: "auto", anchor: null },
  ] as any;

  const nodes = [...fnNodes, ...mainNodes];
  const edges = [...fnEdges, ...mainEdges];
  const a = await arrangeFromIRElk(nodes, edges, { width: 1000, height: 700 });
  const b = await arrangeFromIRElk(nodes, edges, { width: 1000, height: 700 });
  const byIdA = new Map(a.nodes.map((n) => [n.id, n] as const));
  for (const n of b.nodes) {
    const nA = byIdA.get(n.id);
    expect(nA).toBeTruthy();
    if (!nA) continue;
    expect(n.x).toBe(nA.x);
    expect(n.y).toBe(nA.y);
  }
});
