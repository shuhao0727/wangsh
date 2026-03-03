export function clampFinite(v: number, lo: number, hi: number) {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

export function clampBetween(v: number, a: number, b: number) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return clampFinite(v, lo, hi);
}
