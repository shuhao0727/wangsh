import { generatePythonFromFlow } from "./ir";

test("infer for-range from init + while + tail step", () => {
  const nodes: any[] = [
    { id: "s", shape: "start_end", title: "开始", x: 0, y: 0 },
    { id: "n", shape: "process", title: "n=10", x: 0, y: 100 },
    { id: "i0", shape: "process", title: "i=0", x: 0, y: 200 },
    { id: "d", shape: "decision", title: "i<n?", x: 0, y: 300 },
    { id: "body", shape: "io", title: "print(i)", x: 0, y: 400 },
    { id: "inc", shape: "process", title: "i+=1", x: 0, y: 500 },
    { id: "e", shape: "start_end", title: "结束", x: 0, y: 600 },
  ];
  const edges: any[] = [
    { id: "e1", from: "s", to: "n", style: "straight" },
    { id: "e2", from: "n", to: "i0", style: "straight" },
    { id: "e3", from: "i0", to: "d", style: "straight" },
    { id: "e4", from: "d", to: "body", style: "straight", label: "是" },
    { id: "e5", from: "body", to: "inc", style: "straight" },
    { id: "e6", from: "inc", to: "d", style: "straight" },
    { id: "e7", from: "d", to: "e", style: "straight", label: "否" },
  ];
  const gen = generatePythonFromFlow(nodes as any, edges as any);
  expect(gen.mode).toBe("structured");
  expect(gen.python.includes("for i in range(")).toBe(true);
  expect(gen.python.includes("while")).toBe(false);
});

test("warn when for inference misses init", () => {
  const nodes: any[] = [
    { id: "s", shape: "start_end", title: "开始", x: 0, y: 0 },
    { id: "d", shape: "decision", title: "i<n?", x: 0, y: 100 },
    { id: "body", shape: "io", title: "print(i)", x: 0, y: 200 },
    { id: "inc", shape: "process", title: "i+=1", x: 0, y: 300 },
    { id: "e", shape: "start_end", title: "结束", x: 0, y: 400 },
  ];
  const edges: any[] = [
    { id: "e1", from: "s", to: "d", style: "straight" },
    { id: "e2", from: "d", to: "body", style: "straight", label: "是" },
    { id: "e3", from: "body", to: "inc", style: "straight" },
    { id: "e4", from: "inc", to: "d", style: "straight" },
    { id: "e5", from: "d", to: "e", style: "straight", label: "否" },
  ];
  const gen = generatePythonFromFlow(nodes as any, edges as any);
  expect(gen.mode).toBe("structured");
  expect(gen.python.includes("while")).toBe(true);
  expect(gen.warnings.some((w) => w.includes("for 归纳失败") && w.includes("初始化"))).toBe(true);
});

test("infer foreach from in-variant iterator prompt", () => {
  const nodes: any[] = [
    { id: "s", shape: "start_end", title: "开始", x: 0, y: 0 },
    { id: "iter", shape: "process", title: "item in students", x: 0, y: 100 },
    { id: "d", shape: "decision", title: "是否还有元素", x: 0, y: 200 },
    { id: "bind", shape: "process", title: "item = next(it)", x: 0, y: 300 },
    { id: "body", shape: "io", title: "print(item)", x: 0, y: 400 },
    { id: "e", shape: "start_end", title: "结束", x: 0, y: 500 },
  ];
  const edges: any[] = [
    { id: "e1", from: "s", to: "iter", style: "straight" },
    { id: "e2", from: "iter", to: "d", style: "straight" },
    { id: "e3", from: "d", to: "bind", style: "straight", label: "是" },
    { id: "e4", from: "bind", to: "body", style: "straight" },
    { id: "e5", from: "body", to: "d", style: "straight" },
    { id: "e6", from: "d", to: "e", style: "straight", label: "否" },
  ];
  const gen = generatePythonFromFlow(nodes as any, edges as any);
  expect(gen.mode).toBe("structured");
  expect(gen.python).toContain("for item in students:");
  expect(gen.python).not.toContain("next(it)");
});

test("infer for-range from legacy teaching copy titles", () => {
  const nodes: any[] = [
    { id: "s", shape: "start_end", title: "开始", x: 0, y: 0 },
    { id: "init1", shape: "process", title: "range步骤：_seq_i = list(range(0, n))（循环开始）", x: 0, y: 100 },
    { id: "init2", shape: "process", title: "i取第一个元素：_it_i = iter(_seq_i)", x: 0, y: 200 },
    { id: "d", shape: "decision", title: "i的值在列表？", x: 0, y: 300 },
    { id: "step", shape: "process", title: "i获取下一个元素：i = next(_it_i)（获取下一个元素）", x: 0, y: 400 },
    { id: "body", shape: "io", title: "print(i)", x: 0, y: 500 },
    { id: "e", shape: "start_end", title: "结束", x: 0, y: 600 },
  ];
  const edges: any[] = [
    { id: "e1", from: "s", to: "init1", style: "straight" },
    { id: "e2", from: "init1", to: "init2", style: "straight" },
    { id: "e3", from: "init2", to: "d", style: "straight" },
    { id: "e4", from: "d", to: "step", style: "straight", label: "是" },
    { id: "e5", from: "step", to: "body", style: "straight" },
    { id: "e6", from: "body", to: "d", style: "straight" },
    { id: "e7", from: "d", to: "e", style: "straight", label: "否" },
  ];
  const gen = generatePythonFromFlow(nodes as any, edges as any);
  expect(gen.mode).toBe("structured");
  expect(gen.python).toContain("for i in range(0, n):");
  expect(gen.python).not.toContain("next(_it_i)");
});

test("infer for-range from concise iterator copy titles", () => {
  const nodes: any[] = [
    { id: "s", shape: "start_end", title: "开始", x: 0, y: 0 },
    { id: "init1", shape: "process", title: "range(0, n)", x: 0, y: 100 },
    { id: "init2", shape: "process", title: "it in range(0, n)", x: 0, y: 200 },
    { id: "d", shape: "decision", title: "i的值在列表？", x: 0, y: 300 },
    { id: "step", shape: "process", title: "i = next(it)", x: 0, y: 400 },
    { id: "body", shape: "io", title: "print(i)", x: 0, y: 500 },
    { id: "e", shape: "start_end", title: "结束", x: 0, y: 600 },
  ];
  const edges: any[] = [
    { id: "e1", from: "s", to: "init1", style: "straight" },
    { id: "e2", from: "init1", to: "init2", style: "straight" },
    { id: "e3", from: "init2", to: "d", style: "straight" },
    { id: "e4", from: "d", to: "step", style: "straight", label: "是" },
    { id: "e5", from: "step", to: "body", style: "straight" },
    { id: "e6", from: "body", to: "d", style: "straight" },
    { id: "e7", from: "d", to: "e", style: "straight", label: "否" },
  ];
  const gen = generatePythonFromFlow(nodes as any, edges as any);
  expect(gen.mode).toBe("structured");
  expect(gen.python).toContain("for i in range(0, n):");
  expect(gen.python).not.toContain("next(it)");
});

test("infer for-range from 注释型解释路径（i对应序列元素）", () => {
  const nodes: any[] = [
    { id: "s", shape: "start_end", title: "开始", x: 0, y: 0 },
    { id: "init1", shape: "process", title: "range步骤：_seq_i = list(range(0, n))（循环开始）", x: 0, y: 100 },
    { id: "init2", shape: "process", title: "i取第一个元素：_it_i = iter(_seq_i)（取第一个元素）", x: 0, y: 200 },
    { id: "d", shape: "decision", title: "循环判断：i对应序列元素？", x: 0, y: 300 },
    { id: "step", shape: "process", title: "i获取下一个元素：i = next(_it_i)（获取下一个元素）", x: 0, y: 400 },
    { id: "body", shape: "io", title: "print(i)", x: 0, y: 500 },
    { id: "e", shape: "start_end", title: "结束", x: 0, y: 600 },
  ];
  const edges: any[] = [
    { id: "e1", from: "s", to: "init1", style: "straight" },
    { id: "e2", from: "init1", to: "init2", style: "straight" },
    { id: "e3", from: "init2", to: "d", style: "straight" },
    { id: "e4", from: "d", to: "step", style: "straight", label: "是" },
    { id: "e5", from: "step", to: "body", style: "straight" },
    { id: "e6", from: "body", to: "d", style: "straight" },
    { id: "e7", from: "d", to: "e", style: "straight", label: "否" },
  ];
  const gen = generatePythonFromFlow(nodes as any, edges as any);
  expect(gen.mode).toBe("structured");
  expect(gen.python).toContain("for i in range(0, n):");
  expect(gen.python).not.toContain("next(_it_i)");
});

test("infer for-range from 拆分型解释路径（i对应序列元素）", () => {
  const nodes: any[] = [
    { id: "s", shape: "start_end", title: "开始", x: 0, y: 0 },
    { id: "init1", shape: "process", title: "range(0, n)", x: 0, y: 100 },
    { id: "init2", shape: "process", title: "it in range(0, n)", x: 0, y: 200 },
    { id: "d", shape: "decision", title: "i对应序列元素？", x: 0, y: 300 },
    { id: "step", shape: "process", title: "i = next(it)", x: 0, y: 400 },
    { id: "body", shape: "io", title: "print(i)", x: 0, y: 500 },
    { id: "e", shape: "start_end", title: "结束", x: 0, y: 600 },
  ];
  const edges: any[] = [
    { id: "e1", from: "s", to: "init1", style: "straight" },
    { id: "e2", from: "init1", to: "init2", style: "straight" },
    { id: "e3", from: "init2", to: "d", style: "straight" },
    { id: "e4", from: "d", to: "step", style: "straight", label: "是" },
    { id: "e5", from: "step", to: "body", style: "straight" },
    { id: "e6", from: "body", to: "d", style: "straight" },
    { id: "e7", from: "d", to: "e", style: "straight", label: "否" },
  ];
  const gen = generatePythonFromFlow(nodes as any, edges as any);
  expect(gen.mode).toBe("structured");
  expect(gen.python).toContain("for i in range(0, n):");
  expect(gen.python).not.toContain("next(it)");
});

test("sanitize leaked pseudo statements at emit stage", () => {
  const nodes: any[] = [
    { id: "s", shape: "start_end", title: "开始", x: 0, y: 0 },
    { id: "x", shape: "process", title: "it in students", x: 0, y: 100 },
    { id: "y", shape: "process", title: "has_next(it)", x: 0, y: 200 },
    { id: "z", shape: "process", title: "print('ok')", x: 0, y: 300 },
    { id: "e", shape: "start_end", title: "结束", x: 0, y: 400 },
  ];
  const edges: any[] = [
    { id: "e1", from: "s", to: "x", style: "straight" },
    { id: "e2", from: "x", to: "y", style: "straight" },
    { id: "e3", from: "y", to: "z", style: "straight" },
    { id: "e4", from: "z", to: "e", style: "straight" },
  ];
  const gen = generatePythonFromFlow(nodes as any, edges as any);
  expect(gen.python).toContain("pass");
  expect(gen.python).toContain("print('ok')");
  expect(gen.python).not.toContain("it in students");
});

test("infer foreach from Chinese 未遍历完/当前元素 format", () => {
  const nodes: any[] = [
    { id: "s", shape: "start_end", title: "开始", x: 0, y: 0 },
    { id: "d", shape: "decision", title: "students 未遍历完?", x: 0, y: 100 },
    { id: "bind", shape: "process", title: "item = 当前元素", x: 0, y: 200 },
    { id: "body", shape: "io", title: "print(item)", x: 0, y: 300 },
    { id: "e", shape: "start_end", title: "结束", x: 0, y: 400 },
  ];
  const edges: any[] = [
    { id: "e1", from: "s", to: "d", style: "straight" },
    { id: "e2", from: "d", to: "bind", style: "straight", label: "是" },
    { id: "e3", from: "bind", to: "body", style: "straight" },
    { id: "e4", from: "body", to: "d", style: "straight" },
    { id: "e5", from: "d", to: "e", style: "straight", label: "否" },
  ];
  const gen = generatePythonFromFlow(nodes as any, edges as any);
  expect(gen.mode).toBe("structured");
  expect(gen.python).toContain("for item in students:");
  expect(gen.python).not.toContain("当前元素");
  expect(gen.python).not.toContain("未遍历完");
});
