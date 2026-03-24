import { getJoinLockRemainingSeconds, parseJoinLockHint } from "./groupDiscussionJoinLock";

test("parseJoinLockHint extracts locked group and remaining seconds", () => {
  const hint = parseJoinLockHint("组号已锁定为 3，178秒内不可更改", 1_000);
  expect(hint).not.toBeNull();
  expect(hint?.lockedGroupNo).toBe("3");
  expect(hint?.remainingSeconds).toBe(178);
  expect(hint?.expiresAt).toBe(179_000);
});

test("parseJoinLockHint returns null for non-lock errors", () => {
  expect(parseJoinLockHint("组号格式不正确（仅允许数字）")).toBeNull();
  expect(parseJoinLockHint("")).toBeNull();
});

test("getJoinLockRemainingSeconds floors at zero", () => {
  const hint = parseJoinLockHint("组号已锁定为 9，2秒内不可更改", 1_000);
  expect(getJoinLockRemainingSeconds(hint, 2_000)).toBe(1);
  expect(getJoinLockRemainingSeconds(hint, 3_500)).toBe(0);
});
