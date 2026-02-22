import { validatePythonStrict } from "./python_runtime";

test("validatePythonStrict rejects top-level return", () => {
  const v = validatePythonStrict("return 1\n");
  expect(v.ok).toBe(false);
  if (v.ok) return;
  expect(v.errors.some((e) => e.includes("return"))).toBe(true);
});

test("validatePythonStrict rejects undefined function call", () => {
  const v = validatePythonStrict(["x = add(2, 3)", "print(x)", ""].join("\n"));
  expect(v.ok).toBe(false);
  if (v.ok) return;
  expect(v.errors.some((e) => e.includes("函数未定义"))).toBe(true);
});

test("validatePythonStrict rejects forward call at top-level", () => {
  const code = ["x = add(2, 3)", "def add(x, y):", "  return x + y", ""].join("\n");
  const v = validatePythonStrict(code);
  expect(v.ok).toBe(false);
  if (v.ok) return;
  expect(v.errors.some((e) => e.includes("函数未定义"))).toBe(true);
});

