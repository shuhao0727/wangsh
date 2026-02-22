import { computeTidy } from "./tidy";

test("computeTidy inserts join before shared successor for simple if merge", () => {
  const nodes: any[] = [
    { id: "start", shape: "start_end", title: "开始", x: 0, y: 0 },
    { id: "if1", shape: "decision", title: "if x>0", x: 0, y: 100 },
    { id: "a", shape: "process", title: "a=1", x: 0, y: 200 },
    { id: "b", shape: "process", title: "a=2", x: 200, y: 200 },
    { id: "p", shape: "process", title: "print(a)", x: 0, y: 320 },
    { id: "end", shape: "start_end", title: "结束", x: 0, y: 420 },
  ];
  const edges: any[] = [
    { id: "e_s", from: "start", to: "if1", style: "straight" },
    { id: "e_y", from: "if1", to: "a", style: "straight", label: "是" },
    { id: "e_n", from: "if1", to: "b", style: "straight", label: "否" },
    { id: "e_a", from: "a", to: "p", style: "straight" },
    { id: "e_b", from: "b", to: "p", style: "straight" },
    { id: "e_e", from: "p", to: "end", style: "straight" },
  ];
  const res = computeTidy(nodes, edges);
  const join = res.tidy.nodes.find((n) => n.shape === "connector");
  expect(join).toBeTruthy();
  if (!join) return;
  const toP = res.tidy.edges.filter((e) => e.to === "p");
  expect(toP.length).toBe(1);
  expect(toP[0].from).toBe(join.id);
  const intoJoin = res.tidy.edges.filter((e) => e.to === join.id).map((e) => e.from).sort();
  expect(intoJoin).toEqual(["a", "b"].sort());
});

test("computeTidy collapses empty connector with single in/out", () => {
  const nodes: any[] = [
    { id: "start", shape: "start_end", title: "开始", x: 0, y: 0 },
    { id: "a", shape: "process", title: "a=1", x: 0, y: 100 },
    { id: "c", shape: "connector", title: "", x: 0, y: 200 },
    { id: "b", shape: "process", title: "b=2", x: 0, y: 300 },
    { id: "end", shape: "start_end", title: "结束", x: 0, y: 420 },
  ];
  const edges: any[] = [
    { id: "e_s", from: "start", to: "a", style: "straight" },
    { id: "e1", from: "a", to: "c", style: "straight" },
    { id: "e2", from: "c", to: "b", style: "straight" },
    { id: "e_e", from: "b", to: "end", style: "straight" },
  ];
  const res = computeTidy(nodes, edges);
  expect(res.tidy.nodes.some((n) => n.id === "c")).toBe(false);
  const hasB = res.tidy.nodes.some((n) => n.id === "b");
  if (hasB) {
    expect(res.tidy.edges.some((e) => e.from === "a" && e.to === "b")).toBe(true);
  } else {
    const aNode = res.tidy.nodes.find((n) => n.id === "a");
    expect(aNode).toBeTruthy();
    expect(String(aNode?.title || "")).toContain("a=1");
    expect(String(aNode?.title || "")).toContain("b=2");
  }
});
