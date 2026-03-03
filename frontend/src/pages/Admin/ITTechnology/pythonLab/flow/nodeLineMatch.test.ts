import { matchesNodeLine } from "./nodeLineMatch";

test("matchesNodeLine falls back to sourceLine when sourceRange exists but doesn't include line", () => {
  const n: any = { id: "n1", shape: "process", title: "x=1", x: 0, y: 0, sourceLine: 10, sourceRange: { startLine: 1, endLine: 2 } };
  expect(matchesNodeLine(n, 10)).toBe(true);
});

test("matchesNodeLine matches by sourceRange when included", () => {
  const n: any = { id: "n1", shape: "process", title: "x=1", x: 0, y: 0, sourceLine: 10, sourceRange: { startLine: 8, endLine: 12 } };
  expect(matchesNodeLine(n, 9)).toBe(true);
});

