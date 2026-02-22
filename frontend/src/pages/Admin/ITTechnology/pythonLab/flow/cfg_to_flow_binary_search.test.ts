import { cfgToFlow } from "./cfg_to_flow";

test("cfgToFlow does not insert orphan join or merge into end when a branch returns", () => {
  const cfg: any = {
    sourcePath: "/workspace/main.py",
    version: "test",
    diagnostics: [],
    entryNodeId: "while1",
    nodes: [
      { id: "while1", kind: "While", title: "while left <= right:", range: { startLine: 1, startCol: 0, endLine: 1, endCol: 10 } },
      { id: "if1", kind: "If", title: "if arr[mid] == target:", range: { startLine: 2, startCol: 2, endLine: 2, endCol: 10 } },
      { id: "retMid", kind: "Stmt", title: "return mid", range: { startLine: 3, startCol: 4, endLine: 3, endCol: 10 } },
      { id: "elif1", kind: "Elif", title: "elif arr[mid] < target:", range: { startLine: 4, startCol: 2, endLine: 4, endCol: 10 } },
      { id: "leftInc", kind: "Stmt", title: "left = mid + 1", range: { startLine: 5, startCol: 4, endLine: 5, endCol: 12 } },
      { id: "rightDec", kind: "Stmt", title: "right = mid - 1", range: { startLine: 7, startCol: 4, endLine: 7, endCol: 13 } },
      { id: "retNeg", kind: "Stmt", title: "return -1", range: { startLine: 9, startCol: 0, endLine: 9, endCol: 10 } },
    ],
    edges: [
      { id: "e1", from: "while1", to: "if1", kind: "True" },
      { id: "e2", from: "while1", to: "retNeg", kind: "False" },
      { id: "e3", from: "if1", to: "retMid", kind: "True" },
      { id: "e4", from: "if1", to: "elif1", kind: "False" },
      { id: "e5", from: "elif1", to: "leftInc", kind: "True" },
      { id: "e6", from: "elif1", to: "rightDec", kind: "False" },
      { id: "e7", from: "leftInc", to: "while1", kind: "Next" },
      { id: "e8", from: "rightDec", to: "while1", kind: "Next" },
    ],
    exitNodeIds: ["retMid", "retNeg"],
  };

  const flow = cfgToFlow(cfg);
  const end = flow.nodes.find((n) => n.title === "结束");
  expect(end).toBeTruthy();
  if (!end) return;

  const connectors = flow.nodes.filter((n) => n.shape === "connector");
  for (const c of connectors) {
    const inEdges = flow.edges.filter((e) => e.to === c.id);
    expect(inEdges.length).toBeGreaterThan(0);
  }

  const inToEnd = flow.edges.filter((e) => e.to === end.id);
  expect(inToEnd.some((e) => e.from.startsWith("__join__"))).toBe(false);
});

