import type { FlowNode } from "./model";

export function matchesNodeLine(n: FlowNode, line: number) {
  const r = n.sourceRange;
  if (r && Number.isFinite(r.startLine) && Number.isFinite(r.endLine)) {
    return line >= r.startLine && line <= r.endLine;
  }
  return n.sourceLine === line;
}
