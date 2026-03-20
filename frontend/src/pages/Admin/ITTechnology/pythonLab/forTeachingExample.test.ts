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

  // 新区间表示法: i ∈ [1, 10)
  const decisionNode = built.nodes.find((n) => n.shape === "decision" && n.title.includes("∈"));
  expect(decisionNode).toBeTruthy();
  expect(decisionNode!.title).toMatch(/i\s*∈\s*\[1,\s*10\)/);

  expect(built.debugMap.forRanges.length).toBe(1);
  expect(built.debugMap.forRanges[0].var).toBe("i");
  expect(built.debugMap.forRanges[0].headerLine).toBe(2);

  const generated = generatePythonFromFlow(built.nodes as any, built.edges as any);
  expect(generated.python).toContain("for i in range(1, 10):");
  expect(generated.python).toContain("total += i");
});

test("for 教学示例反转回 Python 不引入伪差异", () => {
  const built = buildUnifiedFlowFromPython(FOR_TEACHING_EXAMPLE_CODE);
  expect(built).not.toBeNull();
  if (!built) return;
  const generated = generatePythonFromFlow(built.nodes as any, built.edges as any);
  expect(generated.python).toContain("for i in range(1, 10):");
  expect(generated.python).toContain("total += i");
  expect(generated.python.includes("∈")).toBe(false);
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
