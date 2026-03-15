import { buildUnifiedFlowFromPython } from "./python_sync";

test("学生可读性判据：for-range 具备低跳跃分步结构", () => {
  const code = ["total = 0", "for i in range(1, 10):", "  total += i", "print(total)", ""].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;

  const byTitle = (t: string) => built.nodes.find((n) => n.title.replaceAll(" ", "") === t.replaceAll(" ", ""));
  const initNode = byTitle("range(1,10)");
  const iterNode = byTitle("itinrange(1,10)");
  const checkNode = built.nodes.find((n) => n.shape === "decision" && n.title.replaceAll(" ", "") === "i的值在列表？");
  const bindNode = byTitle("i=next(it)");
  expect(initNode).toBeTruthy();
  expect(iterNode).toBeTruthy();
  expect(checkNode).toBeTruthy();
  expect(bindNode).toBeTruthy();

  const hasEdge = (from?: string, to?: string, label?: string) =>
    built.edges.some((e) => e.from === from && e.to === to && (label ? (e.label ?? "").trim() === label : true));
  expect(hasEdge(initNode?.id, iterNode?.id)).toBe(true);
  expect(hasEdge(iterNode?.id, checkNode?.id)).toBe(true);
  expect(hasEdge(checkNode?.id, bindNode?.id, "是")).toBe(true);
  expect(built.edges.some((e) => e.from === checkNode?.id && (e.label ?? "").trim() === "否")).toBe(true);
});

test("学生可读性判据：循环头映射保留调试角色并可定位", () => {
  const code = ["for i in range(3):", "  print(i)", ""].join("\n");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) return;
  const headerMap = built.debugMap.byLine[1] || [];
  const roles = headerMap.map((x) => x.role);
  expect(roles).toContain("for_init");
  expect(roles).toContain("for_check");
  expect(roles).toContain("for_inc");
});
