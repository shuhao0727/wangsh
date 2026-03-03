import type { FlowNode } from "./model";

export function matchesNodeLine(n: FlowNode, line: number) {
  const r = (n as any).sourceRange as { startLine: number; endLine: number } | undefined;
  if (r && Number.isFinite(r.startLine) && Number.isFinite(r.endLine)) {
    if (line >= r.startLine && line <= r.endLine) return true;
  }
  return n.sourceLine === line;
}

