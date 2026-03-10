import { summarizeDapBreakpointReport } from "./dapBreakpointReport";

test("summarizeDapBreakpointReport returns null when requested <= 0", () => {
  expect(summarizeDapBreakpointReport({ requested: 0, sourcePath: "/workspace/main.py", resp: {} })).toBeNull();
});

test("summarizeDapBreakpointReport counts verified breakpoints", () => {
  const r = summarizeDapBreakpointReport({
    requested: 2,
    sourcePath: "/workspace/main.py",
    resp: { body: { breakpoints: [{ verified: true }, { verified: false, line: 4, message: "not executable" }] } },
  });
  expect(r).toEqual({
    requested: 2,
    verified: 1,
    unverified: 1,
    sourcePath: "/workspace/main.py",
    unverifiedLines: [4],
    unverifiedMessages: ["not executable"],
  });
});

test("summarizeDapBreakpointReport treats missing response as all unverified", () => {
  const r = summarizeDapBreakpointReport({ requested: 3, sourcePath: "/workspace/main.py", resp: null });
  expect(r).toEqual({
    requested: 3,
    verified: 0,
    unverified: 3,
    sourcePath: "/workspace/main.py",
    unverifiedLines: [],
    unverifiedMessages: [],
  });
});
