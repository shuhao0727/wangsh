import { buildUnifiedFlowFromPython } from "./python_sync";

function normPython(s: string) {
  return (s || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trimEnd();
}

function flowToPython(code: string) {
  const { generatePythonFromFlow } = require("./ir");
  const { validatePythonStrict } = require("./python_runtime");
  const built = buildUnifiedFlowFromPython(code);
  expect(built).not.toBeNull();
  if (!built) throw new Error("failed to build flow");
  const gen = generatePythonFromFlow(built.nodes, built.edges);
  const v = validatePythonStrict(gen.python);
  expect(v.ok).toBe(true);
  return { python: gen.python as string, mode: gen.mode as string };
}

test("sync closure reaches a stable python form for if/elif/else", () => {
  const code = [
    "score = 72",
    "if score >= 90:",
    "  grade = 'A'",
    "elif score >= 60:",
    "  grade = 'B'",
    "else:",
    "  grade = 'C'",
    "print(grade)",
    "",
  ].join("\n");

  const a = flowToPython(code);
  const b = flowToPython(a.python);
  expect(normPython(b.python)).toBe(normPython(a.python));
  expect(normPython(a.python).includes("if ")).toBe(true);
  expect(normPython(a.python).includes("print(")).toBe(true);
});

test("sync closure reaches a stable python form for loops", () => {
  const code = ["n = 5", "for i in range(n):", "  print(i)", ""].join("\n");
  const a = flowToPython(code);
  const b = flowToPython(a.python);
  expect(normPython(b.python)).toBe(normPython(a.python));
  expect(normPython(a.python).includes("for ")).toBe(true);
});

test("sync closure reaches a stable python form for functions", () => {
  const code = [
    "def sum_n(n):",
    "  total = 0",
    "  for i in range(n):",
    "    total += i",
    "  return total",
    "",
    "ans = sum_n(10)",
    "print(ans)",
    "",
  ].join("\n");
  const a = flowToPython(code);
  const b = flowToPython(a.python);
  expect(normPython(b.python)).toBe(normPython(a.python));
  expect(normPython(a.python).includes("def sum_n")).toBe(true);
  expect(normPython(a.python).includes("return ")).toBe(true);
});

test("sync closure reaches a stable python form for multi-branch decisions", () => {
  const code = [
    "x = 10",
    "if x > 10:",
    "  msg = 'gt'",
    "elif x == 10:",
    "  msg = 'eq'",
    "elif x > 0:",
    "  msg = 'pos'",
    "else:",
    "  msg = 'neg'",
    "print(msg)",
    "",
  ].join("\n");
  const a = flowToPython(code);
  const b = flowToPython(a.python);
  expect(normPython(b.python)).toBe(normPython(a.python));
  expect(normPython(a.python).includes("if ")).toBe(true);
  expect(normPython(a.python).includes("else")).toBe(true);
});

