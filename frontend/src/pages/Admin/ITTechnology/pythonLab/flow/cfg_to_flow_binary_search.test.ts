import { cfgToFlow } from "./cfg_to_flow";
import { generatePythonFromFlow } from "./ir";

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

test("cfgToFlow maps collection statements to list_op/dict_op instead of subroutine", () => {
  const cfg: any = {
    sourcePath: "/workspace/main.py",
    version: "test",
    diagnostics: [],
    entryNodeId: "n1",
    nodes: [
      { id: "n1", kind: "Stmt", title: "nums = [1, 2, 3]" },
      { id: "n2", kind: "Stmt", title: "nums.append(4)" },
      { id: "n3", kind: "Stmt", title: "counter = {}" },
      { id: "n4", kind: "Stmt", title: "counter.get('a', 0)" },
    ],
    edges: [
      { id: "e1", from: "n1", to: "n2", kind: "Next" },
      { id: "e2", from: "n2", to: "n3", kind: "Next" },
      { id: "e3", from: "n3", to: "n4", kind: "Next" },
    ],
    exitNodeIds: ["n4"],
  };
  const flow = cfgToFlow(cfg);
  const byId = (id: string) => flow.nodes.find((n) => n.id === id);
  expect(byId("n1")?.shape).toBe("list_op");
  expect(byId("n2")?.shape).toBe("list_op");
  expect(byId("n3")?.shape).toBe("dict_op");
  expect(byId("n4")?.shape).toBe("dict_op");
  expect(byId("n2")?.sourceRole).not.toBe("call_site");
  expect(byId("n4")?.sourceRole).not.toBe("call_site");
});

test("cfgToFlow 支持教学分步标题并保持图码双向可还原", () => {
  const cfg: any = {
    sourcePath: "/workspace/main.py",
    version: "test",
    diagnostics: [],
    entryNodeId: "n1",
    nodes: [
      { id: "n1", kind: "ForInit", title: "range步骤：_seq_i = list(range(1, 10))（循环开始）", range: { startLine: 2, startCol: 0, endLine: 2, endCol: 20 } },
      { id: "n2", kind: "ForInit", title: "i取第一个元素：_it_i = iter(_seq_i)", range: { startLine: 2, startCol: 0, endLine: 2, endCol: 24 } },
      { id: "n3", kind: "For", title: "i的值在列表？", range: { startLine: 2, startCol: 0, endLine: 2, endCol: 12 } },
      { id: "n4", kind: "ForStep", title: "i获取下一个元素：i = next(_it_i)（获取下一个元素）", range: { startLine: 2, startCol: 0, endLine: 2, endCol: 22 } },
      { id: "n5", kind: "AugAssign", title: "更新步骤：total += i", range: { startLine: 3, startCol: 4, endLine: 3, endCol: 14 } },
    ],
    edges: [
      { id: "e1", from: "n1", to: "n2", kind: "Next" },
      { id: "e2", from: "n2", to: "n3", kind: "Next" },
      { id: "e3", from: "n3", to: "n4", kind: "True" },
      { id: "e4", from: "n4", to: "n5", kind: "Next" },
      { id: "e5", from: "n5", to: "n3", kind: "Back" },
    ],
    exitEdges: [{ from: "n3", kind: "False", label: "否" }],
  };

  const flow = cfgToFlow(cfg);
  const byId = (id: string) => flow.nodes.find((n) => n.id === id);
  expect(byId("n1")?.sourceRole).toBe("for_init");
  expect(byId("n3")?.sourceRole).toBe("for_check");
  expect(byId("n4")?.sourceRole).toBe("for_inc");
  expect(byId("n5")?.sourceRole).toBe("aug_assign");

  const generated = generatePythonFromFlow(flow.nodes as any, flow.edges as any).python;
  expect(generated).toContain("for i in range(1, 10):");
  expect(generated).toContain("total += i");
  expect(generated.includes("获取下一个元素")).toBe(false);
  expect(generated.includes("循环开始")).toBe(false);
});
