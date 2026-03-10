import { detectSourceMismatch } from "./sourceSync";

test("detectSourceMismatch returns false when either hash missing", () => {
  expect(detectSourceMismatch({ sessionCodeSha: "", debugMapCodeSha: "abc" })).toEqual({ mismatch: false, message: null });
  expect(detectSourceMismatch({ sessionCodeSha: "abc", debugMapCodeSha: "" })).toEqual({ mismatch: false, message: null });
});

test("detectSourceMismatch returns false when hashes equal", () => {
  expect(detectSourceMismatch({ sessionCodeSha: "same", debugMapCodeSha: "same" })).toEqual({ mismatch: false, message: null });
});

test("detectSourceMismatch returns warning when hashes differ", () => {
  const r = detectSourceMismatch({ sessionCodeSha: "a1", debugMapCodeSha: "b2" });
  expect(r.mismatch).toBe(true);
  expect(r.message).toContain("流程图与运行代码版本不一致");
});
