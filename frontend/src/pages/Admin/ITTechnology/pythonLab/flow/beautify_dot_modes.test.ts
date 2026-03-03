import { buildDot, buildDotDisplay, DEFAULT_BEAUTIFY_PARAMS } from "./beautify";

test("buildDotDisplay does not insert helper split-edges", () => {
  const nodes: any[] = [
    { id: "a", shape: "process", title: "A", x: 0, y: 0 },
    { id: "b", shape: "process", title: "B", x: 0, y: 0 },
  ];
  const edges: any[] = [{ id: "e1", from: "a", to: "b", style: "straight", label: "x" }];
  const res = buildDotDisplay(nodes as any, edges as any, DEFAULT_BEAUTIFY_PARAMS);
  expect(res.dot.includes("e_1")).toBe(false);
  expect(res.dot.includes("shape=none")).toBe(false);
  expect(res.dot.includes("arrowhead=none")).toBe(false);
});

test("buildDot does not insert helper split-edges for mapping", () => {
  const nodes: any[] = [
    { id: "a", shape: "process", title: "A", x: 0, y: 0 },
    { id: "b", shape: "process", title: "B", x: 0, y: 0 },
  ];
  const edges: any[] = [{ id: "e1", from: "a", to: "b", style: "straight", label: "x" }];
  const res = buildDot(nodes as any, edges as any, DEFAULT_BEAUTIFY_PARAMS);
  expect(res.dot.includes("e_1")).toBe(false);
  expect(res.dot.includes("shape=none")).toBe(false);
  expect(res.dot.includes("arrowhead=none")).toBe(false);
});
