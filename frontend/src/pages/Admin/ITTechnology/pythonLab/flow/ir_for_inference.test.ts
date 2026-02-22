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
