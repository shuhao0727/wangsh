import { normalizeMarkdown } from "./normalizeMarkdown";

test("normalizeMarkdown converts bracketed LaTeX block into $$", () => {
  const input = ["before", "[", "\\frac{a}{b}", "]", "after"].join("\n");
  const out = normalizeMarkdown(input);
  expect(out).toContain(["before", "", "$$", "\\frac{a}{b}", "$$", "", "after"].join("\n"));
});

test("normalizeMarkdown converts ```latex fenced code block into $$", () => {
  const input = ["before", "```latex", "\\sum_{n=0}^{\\infty}", "```", "after"].join("\n");
  const out = normalizeMarkdown(input);
  expect(out).toBe(["before", "", "$$", "\\sum_{n=0}^{\\infty}", "$$", "", "after"].join("\n"));
});

test("normalizeMarkdown does not break lists, links, or task list items", () => {
  const input = [
    "这里是列表：",
    "",
    "- 列表项 1",
    "- [链接](https://example.com/path?a=1&b=2)",
    "- [ ] 未完成",
    "- [x] 已完成",
    "",
    "以及行内代码：`[not-math]`",
    "",
    "```ts",
    "const s = '[', t = ']';",
    "```",
  ].join("\n");
  const out = normalizeMarkdown(input);
  expect(out).toBe(input);
});

test("normalizeMarkdown keeps non-LaTeX [ ] blocks unchanged", () => {
  const input = ["[", "a", "b", "]"].join("\n");
  const out = normalizeMarkdown(input);
  expect(out).toBe(input);
});

test("normalizeMarkdown does not touch [ ] markers inside code fences", () => {
  const input = ["```ts", "[", "const x = 1;", "]", "```"].join("\n");
  const out = normalizeMarkdown(input);
  expect(out).toBe(input);
});

test("normalizeMarkdown converts \\[ \\] blocks into $$", () => {
  const input = ["\\[", "x^2 + y^2 = z^2", "\\]"].join("\n");
  const out = normalizeMarkdown(input);
  expect(out).toBe(["$$", "x^2 + y^2 = z^2", "$$", ""].join("\n").trimEnd());
});

test("normalizeMarkdown converts \\(inline\\) math to $inline$", () => {
  const input = "平均每个盒子有 \\(\\frac{N}{k}\\) 个物体";
  const out = normalizeMarkdown(input);
  expect(out).toBe("平均每个盒子有 $\\frac{N}{k}$ 个物体");
});

test("normalizeMarkdown converts (latex) inline group to $\\left(\\cdot\\right)$", () => {
  const input = "平均每个盒子有 (\\frac{N}{k}) 个物体，至少 (\\lceil N/k \\rceil) 个";
  const out = normalizeMarkdown(input);
  expect(out).toContain("$\\left(\\frac{N}{k}\\right)$");
  expect(out).toContain("$\\left(\\lceil N/k \\rceil\\right)$");
});
