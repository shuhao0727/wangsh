export type JoinLockHint = {
  lockedGroupNo: string;
  remainingSeconds: number;
  expiresAt: number;
  rawMessage: string;
};

const JOIN_LOCK_PATTERN = /组号已锁定为\s*([^\s，,]+)\s*[，,]\s*(\d+)\s*秒内不可更改/;

export const parseJoinLockHint = (
  message?: string | null,
  nowMs: number = Date.now(),
): JoinLockHint | null => {
  const text = (message || "").trim();
  if (!text) return null;
  const match = text.match(JOIN_LOCK_PATTERN);
  if (!match) return null;
  const lockedGroupNo = String(match[1] || "").trim();
  const remainingSeconds = Math.max(0, Number(match[2] || 0));
  if (!lockedGroupNo || remainingSeconds <= 0) {
    return null;
  }
  return {
    lockedGroupNo,
    remainingSeconds,
    expiresAt: nowMs + remainingSeconds * 1000,
    rawMessage: text,
  };
};

export const getJoinLockRemainingSeconds = (
  hint: JoinLockHint | null,
  nowMs: number = Date.now(),
): number => {
  if (!hint) return 0;
  return Math.max(0, Math.ceil((hint.expiresAt - nowMs) / 1000));
};
