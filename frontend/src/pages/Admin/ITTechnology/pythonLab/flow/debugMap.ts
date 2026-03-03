import type { FlowNode } from "./model";
import type { FlowNodeShape } from "../types";

export type DebugFocusRole = "for_init" | "for_check" | "for_inc";

export type DebugMapCandidate = {
  nodeId: string;
  line: number;
  role: string | null;
  shape: FlowNodeShape;
  priority: number;
};

export type DebugForRangeEntry = {
  headerLine: number;
  var: string;
  initNodeId: string;
  checkNodeId: string;
  incNodeId: string;
  bodyLineRange?: { startLine: number; endLine: number };
};

export type DebugMap = {
  version: 1;
  forRanges: DebugForRangeEntry[];
  byLine: Record<number, DebugMapCandidate[]>;
  lines: number[];
  allNodeIds: string[];
};

export type DebugEmphasis = {
  line: number;
  role: DebugFocusRole | null;
  thenRole?: DebugFocusRole | null;
};

export function buildDebugMapFromNodes(nodes: FlowNode[], forRangesInput?: DebugForRangeEntry[] | null): DebugMap {
  const forRanges = forRangesInput?.length ? forRangesInput.slice() : inferForRangesFromNodes(nodes);

  const byLineMap = new Map<number, Map<string, DebugMapCandidate>>();
  for (const n of nodes) {
    const line = typeof n.sourceLine === "number" && Number.isFinite(n.sourceLine) ? n.sourceLine : null;
    if (!line) continue;
    const role = typeof n.sourceRole === "string" && n.sourceRole.trim() ? n.sourceRole : null;
    const cand: DebugMapCandidate = {
      nodeId: n.id,
      line,
      role,
      shape: n.shape,
      priority: candidatePriority(n.shape, role),
    };
    const forLine = byLineMap.get(line) ?? new Map<string, DebugMapCandidate>();
    const prev = forLine.get(cand.nodeId);
    if (!prev || cand.priority > prev.priority) forLine.set(cand.nodeId, cand);
    byLineMap.set(line, forLine);
  }

  const lines = Array.from(byLineMap.keys()).sort((a, b) => a - b);
  const byLine: Record<number, DebugMapCandidate[]> = {};
  const allNodeIds: string[] = [];
  const seenAll = new Set<string>();

  for (const line of lines) {
    const items = Array.from(byLineMap.get(line)!.values());
    items.sort((a, b) => b.priority - a.priority || a.nodeId.localeCompare(b.nodeId));
    byLine[line] = items;
    for (const it of items) {
      if (seenAll.has(it.nodeId)) continue;
      seenAll.add(it.nodeId);
      allNodeIds.push(it.nodeId);
    }
  }

  const extras = nodes
    .filter((n) => !seenAll.has(n.id))
    .map((n) => ({ nodeId: n.id, priority: candidatePriority(n.shape, typeof n.sourceRole === "string" ? n.sourceRole : null) }));
  extras.sort((a, b) => b.priority - a.priority || a.nodeId.localeCompare(b.nodeId));
  for (const it of extras) {
    if (seenAll.has(it.nodeId)) continue;
    seenAll.add(it.nodeId);
    allNodeIds.push(it.nodeId);
  }

  return { version: 1, forRanges, byLine, lines, allNodeIds };
}

export function inferDebugEmphasisFromDebugMap(params: {
  debugMap: DebugMap | null;
  activeLine: number | null;
  prevActiveLine: number | null;
  prevVars: Map<string, { value: string; type: string }>;
  nextVars: Map<string, { value: string; type: string }>;
}): DebugEmphasis | null {
  const { debugMap, activeLine, prevActiveLine, prevVars, nextVars } = params;
  if (!debugMap || !activeLine) return null;

  const inferAtLine = (line: number, allowBodyTransition: boolean, originalActiveLine: number) => {
    const metas = debugMap.forRanges.filter((x) => x.headerLine === line);
    if (!metas.length) return null;
    let considered = false;
    for (const meta of metas) {
      if (line !== originalActiveLine && meta.bodyLineRange) {
        if (originalActiveLine >= meta.bodyLineRange.startLine && originalActiveLine <= meta.bodyLineRange.endLine) continue;
      }
      considered = true;
      const prev = prevVars.get(meta.var) ?? null;
      const next = nextVars.get(meta.var) ?? null;
      if (prev && next && prev.value !== next.value) return { line, role: "for_inc" as const, thenRole: "for_check" as const };
      if (allowBodyTransition && meta.bodyLineRange && prevActiveLine) {
        if (prevActiveLine >= meta.bodyLineRange.startLine && prevActiveLine <= meta.bodyLineRange.endLine) {
          return { line, role: "for_inc" as const, thenRole: "for_check" as const };
        }
      }
    }
    if (!considered) return null;
    return { line, role: "for_check" as const };
  };

  const direct = inferAtLine(activeLine, true, activeLine);
  if (direct) return direct;

  const offsets = [1, -1, 2, -2];
  for (const d of offsets) {
    const near = inferAtLine(activeLine + d, true, activeLine);
    if (near) return near;
  }

  if (prevActiveLine && prevActiveLine !== activeLine) {
    const shifted = inferAtLine(prevActiveLine, false, prevActiveLine);
    if (shifted && shifted.role !== "for_check") return shifted;
  }

  return null;
}

export function selectActiveNodeId(params: { debugMap: DebugMap | null; activeLine: number | null; preferredLine?: number | null; preferredRole?: string | null }) {
  const { debugMap, activeLine, preferredLine, preferredRole } = params;
  if (!debugMap) return { nodeId: null as string | null, usedLine: null as number | null, usedRole: null as string | null, reason: "no_debug_map" as const };

  const baseLine = (typeof preferredLine === "number" ? preferredLine : activeLine) ?? null;
  const role = typeof preferredRole === "string" && preferredRole.trim() ? preferredRole : null;
  const offsets = [0, 1, -1, 2, -2, 3, -3, 4, -4];

  const pickAt = (line: number, r: string | null) => {
    const list = debugMap.byLine[line];
    if (!list?.length) return null;
    if (r) {
      const hit = list.find((c) => c.role === r);
      if (hit) return hit;
    }
    return list[0] ?? null;
  };

  if (baseLine) {
    for (const d of offsets) {
      const cand = pickAt(baseLine + d, role);
      if (cand) return { nodeId: cand.nodeId, usedLine: cand.line, usedRole: cand.role, reason: d === 0 ? "exact_or_role" : "nearby" as const };
    }
  }

  if (typeof activeLine === "number") {
    for (const d of offsets) {
      const cand = pickAt(activeLine + d, role);
      if (cand) return { nodeId: cand.nodeId, usedLine: cand.line, usedRole: cand.role, reason: d === 0 ? "fallback_active_line" : "fallback_nearby" as const };
    }
  }

  const any = debugMap.allNodeIds[0] ?? null;
  return { nodeId: any, usedLine: null, usedRole: null, reason: any ? "any" : "empty" as const };
}

export function computeDebugNodeSelection(params: {
  debugMap: DebugMap | null;
  activeLine: number | null;
  prevActiveLine: number | null;
  prevVars: Map<string, { value: string; type: string }>;
  nextVars: Map<string, { value: string; type: string }>;
}) {
  const inferred = inferDebugEmphasisFromDebugMap(params);

  const primary = selectActiveNodeId({
    debugMap: params.debugMap,
    activeLine: params.activeLine,
    preferredLine: inferred?.line ?? null,
    preferredRole: inferred?.role ?? null,
  });

  const transitionQueue: string[] = [];
  if (primary.nodeId) transitionQueue.push(primary.nodeId);

  let thenNodeId: string | null = null;
  if (inferred?.thenRole) {
    const thenPicked = selectActiveNodeId({
      debugMap: params.debugMap,
      activeLine: params.activeLine,
      preferredLine: inferred.line,
      preferredRole: inferred.thenRole,
    });
    thenNodeId = thenPicked.nodeId;
    if (thenNodeId && thenNodeId !== primary.nodeId) transitionQueue.push(thenNodeId);
  }

  return {
    inferred,
    primary,
    activeNodeId: primary.nodeId,
    activeFlowLine: inferred?.line ?? params.activeLine ?? null,
    activeFocusRole: (inferred?.role ?? null) as string | null,
    transitionQueue,
  };
}

function candidatePriority(shape: FlowNodeShape, role: string | null) {
  const roleP = role === "for_check" ? 300 : role === "for_inc" ? 290 : role === "for_init" ? 280 : 0;
  const shapeP =
    shape === "decision"
      ? 200
      : shape === "io"
        ? 170
        : shape === "process"
          ? 160
          : shape === "subroutine"
            ? 150
            : shape === "start_end"
              ? 60
              : 30;
  return roleP + shapeP;
}

function inferForRangesFromNodes(nodes: FlowNode[]): DebugForRangeEntry[] {
  const byLine = new Map<number, FlowNode[]>();
  for (const n of nodes) {
    const line = typeof n.sourceLine === "number" && Number.isFinite(n.sourceLine) ? n.sourceLine : null;
    if (!line) continue;
    const r = typeof n.sourceRole === "string" ? n.sourceRole : "";
    if (r !== "for_init" && r !== "for_check" && r !== "for_inc") continue;
    const arr = byLine.get(line) ?? [];
    arr.push(n);
    byLine.set(line, arr);
  }

  const out: DebugForRangeEntry[] = [];
  for (const [headerLine, items] of Array.from(byLine.entries())) {
    const init = items.find((n: FlowNode) => n.sourceRole === "for_init") ?? null;
    const check = items.find((n: FlowNode) => n.sourceRole === "for_check") ?? null;
    const inc = items.find((n: FlowNode) => n.sourceRole === "for_inc") ?? null;
    if (!init || !check || !inc) continue;
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(String(init.title || "").trim());
    const v = m?.[1] ?? "";
    if (!v) continue;
    out.push({ headerLine, var: v, initNodeId: init.id, checkNodeId: check.id, incNodeId: inc.id });
  }
  out.sort((a, b) => a.headerLine - b.headerLine || a.var.localeCompare(b.var));
  return out;
}
