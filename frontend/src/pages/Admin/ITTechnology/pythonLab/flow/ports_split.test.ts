import { splitNodeTitleForMapping, splitNodeTitleSemantically, wrapNodeTitle } from "./ports";

test("语义分块：复合语句按顶层分号分段", () => {
  const res = splitNodeTitleSemantically("items = [1, 2, 3]; total = sum(items)", "process");
  expect(res.statements).toEqual(["items = [1, 2, 3]", "total = sum(items)"]);
  expect(res.diagnostics.some((d) => d.code === "I_SPLIT_COMPOUND")).toBe(true);
});

test("语义分块：未闭合括号产生诊断", () => {
  const res = splitNodeTitleSemantically("for i in range(1, n:", "decision");
  expect(res.diagnostics.some((d) => d.code === "W_SPLIT_UNBALANCED")).toBe(true);
});

test("语义分块：超长标题自动换行且不截断", () => {
  const raw = "counter = alpha + beta + gamma + delta + epsilon + zeta + eta + theta + iota + kappa + lambda + mu + nu";
  const res = splitNodeTitleSemantically(raw, "decision");
  expect(res.lines.length).toBeGreaterThan(4);
  expect(res.lines.some((line) => line.includes("…"))).toBe(false);
  expect(res.lines.join(" ")).toContain("kappa");
  expect(res.lines.join(" ")).toContain("nu");
});

test("映射切分与展示切分复用同一语义规则", () => {
  const title = "x, y = next(it); print(x, y)";
  const mapping = splitNodeTitleForMapping(title);
  const wrapped = wrapNodeTitle(title, "process");
  expect(mapping).toEqual(["x, y = next(it)", "print(x, y)"]);
  expect(wrapped.join(" ")).toContain("next(it)");
});
