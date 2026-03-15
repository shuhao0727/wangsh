import { isSemanticallySameTitle, normalizeTitleForEditInput, normalizeTitleForMapping, normalizeTitleForSemanticCompare } from "./titleSemantics";

test("normalizeTitleForMapping strips teaching prefixes and descriptive suffixes", () => {
  expect(normalizeTitleForMapping("range步骤：_seq_i = list(range(1, 10))（循环开始）")).toBe("_seq_i = list(range(1, 10))");
  expect(normalizeTitleForMapping("i获取下一个元素：i = next(_it_i)（获取下一个元素）")).toBe("i = next(_it_i)");
});

test("normalizeTitleForSemanticCompare ignores explanatory pseudo differences", () => {
  const a = "range步骤：_seq_i = list(range(1, 10))（循环开始）";
  const b = "_seq_i=list(range(1,10))";
  expect(normalizeTitleForSemanticCompare(a)).toBe(normalizeTitleForSemanticCompare(b));
  expect(isSemanticallySameTitle(a, b)).toBe(true);
});

test("normalizeTitleForEditInput keeps structure but trims trailing spaces", () => {
  const raw = "for i in range(1, 10):  \r\n    total += i　\r\n";
  expect(normalizeTitleForEditInput(raw)).toBe("for i in range(1, 10):\n    total += i");
});
