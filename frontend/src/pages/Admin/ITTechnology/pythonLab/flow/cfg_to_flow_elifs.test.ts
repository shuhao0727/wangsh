import { cfgToFlow } from "./cfg_to_flow";
import { arrangeFromIRElk } from "./ir_layout_elk";

test("cfgToFlow normalizes if/elif/else merges via join connector before shared successor", async () => {
  const cfg: any = {
    sourcePath: "/workspace/main.py",
    version: "test",
    diagnostics: [],
    entryNodeId: "if1",
    nodes: [
      { id: "if1", kind: "If", title: "if score >= 90:", range: { startLine: 3, startCol: 0, endLine: 3, endCol: 14 } },
      { id: "a", kind: "Stmt", title: "grade = 'A'", range: { startLine: 4, startCol: 2, endLine: 4, endCol: 13 } },
      { id: "elif1", kind: "Elif", title: "elif score >= 60:", range: { startLine: 5, startCol: 0, endLine: 5, endCol: 15 } },
      { id: "b", kind: "Stmt", title: "grade = 'B'", range: { startLine: 6, startCol: 2, endLine: 6, endCol: 13 } },
      { id: "c", kind: "Stmt", title: "grade = 'C'", range: { startLine: 8, startCol: 2, endLine: 8, endCol: 13 } },
      { id: "p", kind: "Stmt", title: "print(grade)", range: { startLine: 9, startCol: 0, endLine: 9, endCol: 12 } },
    ],
    edges: [
      { id: "e1", from: "if1", to: "a", kind: "True" },
      { id: "e2", from: "if1", to: "elif1", kind: "False" },
      { id: "e3", from: "elif1", to: "b", kind: "True" },
      { id: "e4", from: "elif1", to: "c", kind: "False" },
      { id: "e5", from: "a", to: "p", kind: "Next" },
      { id: "e6", from: "b", to: "p", kind: "Next" },
      { id: "e7", from: "c", to: "p", kind: "Next" },
    ],
    exitNodeIds: ["p"],
  };

  const flow = cfgToFlow(cfg);
  const join = flow.nodes.find((n) => n.shape === "connector");
  expect(join).toBeTruthy();
  if (!join) return;

  const printNode = flow.nodes.find((n) => n.title.trim() === "print(grade)");
  expect(printNode).toBeTruthy();
  if (!printNode) return;

  const inToPrint = flow.edges.filter((e) => e.to === printNode.id);
  expect(inToPrint.length).toBe(1);
  expect(inToPrint[0].from).toBe(join.id);

  const inToJoin = flow.edges.filter((e) => e.to === join.id).map((e) => e.from).sort();
  expect(inToJoin).toEqual(["a", "b", "c"].sort());

  const laid = await arrangeFromIRElk(flow.nodes as any, flow.edges as any, { width: 800, height: 600 });
  const byId = new Map(laid.nodes.map((n) => [n.id, n] as const));
  const joinL = byId.get(join.id);
  const printL = byId.get(printNode.id);
  expect(joinL).toBeTruthy();
  expect(printL).toBeTruthy();
  if (!joinL || !printL) return;
  expect(printL.y).toBeGreaterThan(joinL.y);
});

