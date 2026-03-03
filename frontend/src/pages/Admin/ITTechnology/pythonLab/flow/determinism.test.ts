import { sortFlowEdgesStable, sortFlowNodesStable } from "./determinism";

test("sortFlowNodesStable sorts by id deterministically", () => {
  const nodes = [
    { id: "b", shape: "process", title: "b", x: 0, y: 0 },
    { id: "a", shape: "process", title: "a", x: 0, y: 0 },
    { id: "c", shape: "process", title: "c", x: 0, y: 0 },
  ] as any;
  const out = sortFlowNodesStable(nodes);
  expect(out.map((n: any) => n.id)).toEqual(["a", "b", "c"]);
  expect(sortFlowNodesStable(out).map((n: any) => n.id)).toEqual(["a", "b", "c"]);
});

test("sortFlowEdgesStable sorts by id/from/to/label deterministically", () => {
  const edges = [
    { id: "e2", from: "b", to: "c", style: "straight", label: "x" },
    { id: "e1", from: "a", to: "b", style: "straight", label: "x" },
    { id: "e1", from: "a", to: "b", style: "straight", label: "a" },
    { id: "e1", from: "a", to: "a", style: "straight", label: "x" },
  ] as any;
  const out = sortFlowEdgesStable(edges);
  expect(out.map((e: any) => `${e.id}|${e.from}|${e.to}|${e.label ?? ""}`)).toEqual([
    "e1|a|a|x",
    "e1|a|b|a",
    "e1|a|b|x",
    "e2|b|c|x",
  ]);
  expect(sortFlowEdgesStable(out).map((e: any) => `${e.id}|${e.from}|${e.to}|${e.label ?? ""}`)).toEqual([
    "e1|a|a|x",
    "e1|a|b|a",
    "e1|a|b|x",
    "e2|b|c|x",
  ]);
});
