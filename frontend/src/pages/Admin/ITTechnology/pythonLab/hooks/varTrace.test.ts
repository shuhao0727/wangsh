import { diffVarTrace } from "./varTrace";

test("diffVarTrace records changes across steps", () => {
  const prev = new Map<string, { value: string; type: string }>();
  const r1 = diffVarTrace(1, prev, [
    { name: "i", value: "10", type: "int" },
    { name: "total", value: "0", type: "int" },
  ]);
  expect(r1.lines.length).toBeGreaterThan(0);
  const r2 = diffVarTrace(2, r1.next, [
    { name: "i", value: "9", type: "int" },
    { name: "total", value: "10", type: "int" },
  ]);
  expect(r2.lines.join("\n")).toContain("i: 10 -> 9");
  expect(r2.lines.join("\n")).toContain("total: 0 -> 10");
});

