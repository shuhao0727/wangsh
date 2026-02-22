import { applyPlainLayoutToCanvas, buildDot, parsePlain, DEFAULT_BEAUTIFY_PARAMS } from "./beautify";

test("parsePlain reads graph size and node centers", () => {
  const plain = [
    "graph 4.0 3.0 1.0",
    "node n_1 1.0 2.0 0.5 0.3 A solid box black lightgrey",
    "node n_2 2.5 1.0 0.6 0.3 B solid box black lightgrey",
    "stop",
  ].join("\n");
  const g = parsePlain(plain);
  expect(g.widthIn).toBeCloseTo(4.0);
  expect(g.heightIn).toBeCloseTo(3.0);
  expect(g.nodes.get("n_1")?.cxIn).toBeCloseTo(1.0);
});

test("applyPlainLayoutToCanvas maps node centers into canvas x/y", () => {
  const nodes: any[] = [
    { id: "a", shape: "process", title: "A", x: 0, y: 0 },
    { id: "b", shape: "process", title: "B", x: 0, y: 0 },
  ];
  const edges: any[] = [{ id: "e1", from: "a", to: "b", style: "straight" }];
  const { nameById, edgeNameById } = buildDot(nodes as any, edges as any, DEFAULT_BEAUTIFY_PARAMS);
  const plain = [
    "graph 4.0 3.0 1.0",
    "node n_1 1.0 2.0 0.5 0.3 A solid box black lightgrey",
    "node n_2 2.0 1.0 0.5 0.3 B solid box black lightgrey",
    "stop",
  ].join("\n");
  const out = applyPlainLayoutToCanvas(nodes as any, edges as any, plain, nameById, edgeNameById);
  const a = out.nodes.find((n: any) => n.id === "a");
  const b = out.nodes.find((n: any) => n.id === "b");
  expect(a).toBeTruthy();
  expect(b).toBeTruthy();
  expect(typeof a?.x).toBe("number");
  expect(typeof a?.y).toBe("number");
});
