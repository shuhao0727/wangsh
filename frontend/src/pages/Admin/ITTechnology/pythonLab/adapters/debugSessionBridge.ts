type AnyRecord = Record<string, any>;

function toArray<T = any>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function toInt(v: unknown, fallback = 0) {
  return Number.isInteger(v) ? (v as number) : fallback;
}

export function normalizeDebugSessionView<T extends AnyRecord>(runner: T): T {
  const frames = toArray(runner?.frames).filter((f) => f && typeof f === "object");
  const frameCount = frames.length;
  const selectedFrameIndex = (() => {
    const raw = toInt(runner?.selectedFrameIndex, 0);
    if (frameCount <= 0) return 0;
    if (raw < 0) return 0;
    if (raw >= frameCount) return frameCount - 1;
    return raw;
  })();
  const variables = toArray(runner?.variables).filter((v) => v && typeof v === "object");
  const watchResults = toArray(runner?.watchResults).filter((v) => v && typeof v === "object");
  const watchExprs = toArray(runner?.watchExprs).filter((v) => typeof v === "string");
  const callStack = toArray(runner?.callStack).filter((v) => typeof v === "string");
  const frame = typeof runner?.frame === "string" ? runner.frame : "";

  return {
    ...runner,
    frames,
    selectedFrameIndex,
    variables,
    watchResults,
    watchExprs,
    callStack,
    frame,
  } as T;
}
