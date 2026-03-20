import { matchesNodeLine } from "./nodeLineMatch";

test("matchesNodeLine uses sourceRange exclusively when present", () => {
  const n: any = { id: "n1", shape: "process", title: "x=1", x: 0, y: 0, sourceLine: 10, sourceRange: { startLine: 1, endLine: 2 } };
  // sourceRange [1,2] 存在时，行 10 不在范围内，不应匹配
  expect(matchesNodeLine(n, 10)).toBe(false);
  expect(matchesNodeLine(n, 1)).toBe(true);
  expect(matchesNodeLine(n, 2)).toBe(true);
});

test("matchesNodeLine matches by sourceRange when included", () => {
  const n: any = { id: "n1", shape: "process", title: "x=1", x: 0, y: 0, sourceLine: 10, sourceRange: { startLine: 8, endLine: 12 } };
  expect(matchesNodeLine(n, 9)).toBe(true);
});

test("matchesNodeLine falls back to sourceLine when no sourceRange", () => {
  const n: any = { id: "n1", shape: "process", title: "x=1", x: 0, y: 0, sourceLine: 10 };
  expect(matchesNodeLine(n, 10)).toBe(true);
  expect(matchesNodeLine(n, 11)).toBe(false);
});
