import { generatePythonFromFlow } from "./flow/ir";
import { buildUnifiedFlowFromPython } from "./flow/python_sync";
import { FOR_TEACHING_EXAMPLE_CODE, FOR_TEACHING_EXAMPLE_HEADER } from "./forTeachingExample";
import { loadPythonLabExperiments } from "./storage";

test("循环默认示例统一为 for i in range(1, 10)", () => {
  localStorage.clear();
  const experiments = loadPythonLabExperiments();
  const loops = experiments.find((x) => x.id === "loops");
  const seq = experiments.find((x) => x.id === "seq_basic");
  expect(loops).toBeTruthy();
  expect(seq).toBeTruthy();
  expect(loops?.starterCode).toBe(FOR_TEACHING_EXAMPLE_CODE);
  expect(loops?.starterCode.includes(FOR_TEACHING_EXAMPLE_HEADER)).toBe(true);
  expect(loops?.starterCode.includes("#")).toBe(false);
  expect(seq?.starterCode.includes("for ")).toBe(false);
  expect(seq?.starterCode.includes("print(")).toBe(true);
});

test("for 教学示例在代码与流程图间保持一致", () => {
  const built = buildUnifiedFlowFromPython(FOR_TEACHING_EXAMPLE_CODE);
  expect(built).not.toBeNull();
  if (!built) return;

  expect(built.nodes.some((n) => n.title.replaceAll(" ", "") === "range(1,10)")).toBe(true);
  expect(built.nodes.some((n) => n.title.replaceAll(" ", "") === "itinrange(1,10)")).toBe(true);
  const seqNode = built.nodes.find((n) => n.title.replaceAll(" ", "") === "range(1,10)") ?? null;
  const iterNode = built.nodes.find((n) => n.title.replaceAll(" ", "") === "itinrange(1,10)") ?? null;
  expect(seqNode).toBeTruthy();
  expect(iterNode).toBeTruthy();
  expect(built.edges.some((e) => e.from === seqNode?.id && e.to === iterNode?.id)).toBe(true);
  expect(built.nodes.some((n) => n.shape === "decision" && n.title.replaceAll(" ", "") === "i的值在列表？")).toBe(true);
  expect(built.nodes.some((n) => n.title.replaceAll(" ", "") === "i=next(it)")).toBe(true);
  expect(built.debugMap.forRanges.length).toBe(1);
  expect(built.debugMap.forRanges[0].var).toBe("i");
  expect(built.debugMap.forRanges[0].headerLine).toBe(2);

  const generated = generatePythonFromFlow(built.nodes as any, built.edges as any);
  expect(generated.python.replaceAll(" ", "").includes("range(1,11)")).toBe(false);
});

test("for 教学示例标题含说明性文本时不引入伪差异", () => {
  const built = buildUnifiedFlowFromPython(FOR_TEACHING_EXAMPLE_CODE);
  expect(built).not.toBeNull();
  if (!built) return;
  const decoratedNodes = built.nodes.map((n) => {
    const noSpace = n.title.replaceAll(" ", "");
    if (noSpace === "range(1,10)") return { ...n, title: "range步骤：_seq_i = list(range(1, 10))（循环开始）" };
    if (noSpace === "itinrange(1,10)") return { ...n, title: "i取第一个元素：_it_i = iter(_seq_i)" };
    if (noSpace === "i=next(it)") return { ...n, title: "i获取下一个元素：i = next(_it_i)（获取下一个元素）" };
    return n;
  });
  const generated = generatePythonFromFlow(decoratedNodes as any, built.edges as any);
  expect(generated.python).toContain("for i in range(1, 10):");
  expect(generated.python).toContain("total += i");
  expect(generated.python.includes("循环开始")).toBe(false);
  expect(generated.python.includes("获取下一个元素")).toBe(false);
});

test("教学示例覆盖课堂核心场景并保持由浅入深", () => {
  localStorage.clear();
  const items = loadPythonLabExperiments();
  const byId = new Map(items.map((x) => [x.id, x] as const));
  expect(byId.get("seq_basic")?.level).toBe("入门");
  expect(byId.get("loops")?.level).toBe("基础");
  expect(byId.get("nested_if")?.scenario).toBe("条件分支");
  expect(byId.get("functions")?.scenario).toBe("函数调用");
  expect(byId.get("list_basics")?.scenario).toBe("数据结构");
});
