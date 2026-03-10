import type { FlowNode } from "./model";
import type { FlowNodeShape } from "../types";

export type DebugFocusRole =
  | "for_init"
  | "for_check"
  | "for_inc"
  | "while_check"
  | "for_in_next"
  | "for_in_bind"
  | "aug_assign"
  | "call_site"
  | "return_stmt";

export type DebugMapCandidate = {
  nodeId: string;
  line: number;
  role: string | null;
  title?: string;
  vars?: string[];
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

export type DebugForInEntry = {
  headerLine: number;
  vars: string[];
  nextNodeId: string;
  bindNodeId: string;
  bodyLineRange?: { startLine: number; endLine: number };
};

export type DebugWhileEntry = {
  headerLine: number;
  checkNodeId: string;
  bodyLineRange?: { startLine: number; endLine: number };
};

export type DebugMap = {
  version: 1;
  codeSha256?: string;
  forRanges: DebugForRangeEntry[];
  forIns: DebugForInEntry[];
  whiles: DebugWhileEntry[];
  byLine: Record<number, DebugMapCandidate[]>;
  lines: number[];
  allNodeIds: string[];
};

export type DebugEmphasis = {
  line: number;
  role: DebugFocusRole | null;
  thenRole?: DebugFocusRole | null;
};

export function buildDebugMapFromNodes(
  nodes: FlowNode[],
  forRangesInput?: DebugForRangeEntry[] | null,
  forInsInput?: DebugForInEntry[] | null,
  whileInput?: DebugWhileEntry[] | null
): DebugMap {
  const forRanges = forRangesInput?.length ? forRangesInput.slice() : inferForRangesFromNodes(nodes);
  const forIns = forInsInput?.length ? forInsInput.slice() : inferForInsFromNodes(nodes);
  const whiles = whileInput?.length ? whileInput.slice() : inferWhileEntriesFromNodes(nodes);

  const byLineMap = new Map<number, Map<string, DebugMapCandidate>>();
  for (const n of nodes) {
    const line = typeof n.sourceLine === "number" && Number.isFinite(n.sourceLine) ? n.sourceLine : null;
    if (!line) continue;
    const role = typeof n.sourceRole === "string" && n.sourceRole.trim() ? n.sourceRole : null;
    const vars = roleVarsFromNode(n, role);
    const cand: DebugMapCandidate = {
      nodeId: n.id,
      line,
      role,
      title: typeof n.title === "string" ? n.title : "",
      vars,
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

  return { version: 1, forRanges, forIns, whiles, byLine, lines, allNodeIds };
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

  const changedVars = new Set<string>();
  const keys = new Set<string>([...Array.from(prevVars.keys()), ...Array.from(nextVars.keys())]);
  keys.forEach((k) => {
    const a = prevVars.get(k);
    const b = nextVars.get(k);
    if (!a && b) changedVars.add(k);
    else if (a && !b) changedVars.add(k);
    else if (a && b && (a.value !== b.value || a.type !== b.type)) changedVars.add(k);
  });

  const inferAtLine = (line: number, allowBodyTransition: boolean, originalActiveLine: number) => {
    const forRanges = debugMap.forRanges.filter((x) => x.headerLine === line);
    if (forRanges.length) {
      let considered = false;
      for (const meta of forRanges) {
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
    }

    const forIns = debugMap.forIns.filter((x) => x.headerLine === line);
    if (forIns.length) {
      let considered = false;
      for (const meta of forIns) {
        if (line !== originalActiveLine && meta.bodyLineRange) {
          if (originalActiveLine >= meta.bodyLineRange.startLine && originalActiveLine <= meta.bodyLineRange.endLine) continue;
        }
        considered = true;
        const hitChanged = meta.vars.some((v) => changedVars.has(v));
        if (hitChanged) return { line, role: "for_in_bind" as const, thenRole: "for_in_next" as const };
        if (allowBodyTransition && meta.bodyLineRange && prevActiveLine) {
          if (prevActiveLine >= meta.bodyLineRange.startLine && prevActiveLine <= meta.bodyLineRange.endLine) {
            return { line, role: "for_in_next" as const };
          }
        }
      }
      if (!considered) return null;
      return { line, role: "for_in_next" as const };
    }

    const byLine = debugMap.byLine[line];
    const whileCheck = byLine?.find((c) => c.role === "while_check") ?? null;
    if (whileCheck) return { line, role: "while_check" as const };

    const aug = byLine?.find((c) => c.role === "aug_assign" && (c.vars?.some((v) => changedVars.has(v)) ?? changedVars.size > 0)) ?? null;
    if (aug) return { line, role: "aug_assign" as const };

    return null;
  };

  const direct = inferAtLine(activeLine, true, activeLine);
  if (direct) return direct;

  const whileBackEdge = inferWhileBackEdge({
    debugMap,
    activeLine,
    prevActiveLine,
    nextVars,
  });
  if (whileBackEdge) return whileBackEdge;

  const hasDirectMappedNode = !!(activeLine && debugMap.byLine[activeLine]?.length);
  if (hasDirectMappedNode) return null;

  const offsets = [-1, 1, -2, 2];
  for (const d of offsets) {
    const near = inferAtLine(activeLine + d, true, activeLine);
    if (near) return near;
  }

  if (prevActiveLine && prevActiveLine !== activeLine) {
    const shifted = inferAtLine(prevActiveLine, false, prevActiveLine);
    if (shifted && shifted.role !== "for_check") return shifted;
  }

  if (activeLine && prevActiveLine && activeLine !== prevActiveLine) {
    const forBackEdge = debugMap.forRanges.find((meta) => {
      if (!meta.bodyLineRange) return false;
      const inBody = prevActiveLine >= meta.bodyLineRange.startLine && prevActiveLine <= meta.bodyLineRange.endLine;
      const nearHeader = Math.abs(activeLine - meta.headerLine) <= 1;
      return inBody && nearHeader;
    });
    if (forBackEdge) {
      return { line: forBackEdge.headerLine, role: "for_inc" as const, thenRole: "for_check" as const };
    }
  }

  return null;
}

function inferWhileBackEdge(params: {
  debugMap: DebugMap;
  activeLine: number;
  prevActiveLine: number | null;
  nextVars: Map<string, { value: string; type: string }>;
}): DebugEmphasis | null {
  const { debugMap, activeLine, prevActiveLine, nextVars } = params;
  if (!prevActiveLine || activeLine <= prevActiveLine) return null;
  for (const meta of debugMap.whiles) {
    const range = meta.bodyLineRange;
    if (!range) continue;
    const prevInBody = prevActiveLine >= range.startLine && prevActiveLine <= range.endLine;
    if (!prevInBody) continue;
    const activeInBody = activeLine >= range.startLine && activeLine <= range.endLine;
    if (activeInBody || activeLine === meta.headerLine || activeLine < meta.headerLine) continue;
    const check = debugMap.byLine[meta.headerLine]?.find((c) => c.nodeId === meta.checkNodeId) ?? null;
    const ok = evalWhileCondition(check?.title, nextVars);
    if (ok === true) return { line: meta.headerLine, role: "while_check" as const };
  }
  return null;
}

function evalWhileCondition(title: string | undefined, vars: Map<string, { value: string; type: string }>) {
  const raw = String(title ?? "").trim();
  if (!raw) return null;
  const cond = raw.endsWith("?") ? raw.slice(0, -1).trim() : raw;
  const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*(<=|>=|==|!=|<|>)\s*([A-Za-z_][A-Za-z0-9_]*|-?\d+(?:\.\d+)?)$/.exec(cond);
  if (!m) return null;
  const left = readNumericValue(m[1], vars);
  const right = readNumericValue(m[3], vars);
  if (left == null || right == null) return null;
  if (m[2] === "<") return left < right;
  if (m[2] === "<=") return left <= right;
  if (m[2] === ">") return left > right;
  if (m[2] === ">=") return left >= right;
  if (m[2] === "==") return left === right;
  return left !== right;
}

function readNumericValue(token: string, vars: Map<string, { value: string; type: string }>) {
  const fromVars = vars.get(token);
  if (fromVars) {
    const n = Number(String(fromVars.value).trim());
    if (Number.isFinite(n)) return n;
  }
  const direct = Number(token);
  if (Number.isFinite(direct)) return direct;
  return null;
}

export function selectActiveNodeId(params: { debugMap: DebugMap | null; activeLine: number | null; preferredLine?: number | null; preferredRole?: string | null }) {
  const { debugMap, activeLine, preferredLine, preferredRole } = params;
  if (!debugMap) return { nodeId: null as string | null, usedLine: null as number | null, usedRole: null as string | null, reason: "no_debug_map" as const };

  const baseLine = (typeof preferredLine === "number" ? preferredLine : activeLine) ?? null;
  const role = typeof preferredRole === "string" && preferredRole.trim() ? preferredRole : null;
  const offsets = [0, -1, 1, -2, 2, -3, 3, -4, 4];

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
  prevStackDepth?: number | null;
  nextStackDepth?: number | null;
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

  const prevDepth = typeof params.prevStackDepth === "number" ? params.prevStackDepth : null;
  const nextDepth = typeof params.nextStackDepth === "number" ? params.nextStackDepth : null;
  const canUseCallTransition = !!params.debugMap && prevDepth != null && nextDepth != null && prevDepth !== nextDepth;
  if (canUseCallTransition && params.prevActiveLine && primary.nodeId) {
    if (nextDepth > prevDepth) {
      const callSite = selectActiveNodeId({
        debugMap: params.debugMap,
        activeLine: params.prevActiveLine,
        preferredLine: params.prevActiveLine,
        preferredRole: "call_site",
      });
      if (callSite.nodeId && callSite.nodeId !== primary.nodeId) {
        return {
          inferred: { line: params.prevActiveLine, role: "call_site" as const },
          primary: callSite,
          activeNodeId: callSite.nodeId,
          activeFlowLine: params.prevActiveLine,
          activeFocusRole: "call_site",
          transitionQueue: [callSite.nodeId, primary.nodeId],
        };
      }
    } else if (prevDepth > nextDepth) {
      const ret = selectActiveNodeId({
        debugMap: params.debugMap,
        activeLine: params.prevActiveLine,
        preferredLine: params.prevActiveLine,
        preferredRole: "return_stmt",
      });
      const fromId = ret.nodeId || selectActiveNodeId({ debugMap: params.debugMap, activeLine: params.prevActiveLine }).nodeId;
      if (fromId && fromId !== primary.nodeId) {
        return {
          inferred: { line: params.prevActiveLine, role: ret.nodeId ? ("return_stmt" as const) : null },
          primary: ret.nodeId ? ret : primary,
          activeNodeId: fromId,
          activeFlowLine: params.prevActiveLine,
          activeFocusRole: ret.nodeId ? "return_stmt" : null,
          transitionQueue: [fromId, primary.nodeId],
        };
      }
    }
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
  const roleP =
    role === "for_check"
      ? 300
      : role === "for_inc"
        ? 290
        : role === "for_init"
          ? 280
          : role === "for_in_next"
            ? 275
            : role === "for_in_bind"
              ? 270
              : role === "while_check"
                ? 260
                : role === "aug_assign"
                  ? 210
                  : role === "call_site"
                    ? 200
                    : role === "return_stmt"
                      ? 190
                      : 0;
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

function inferForInsFromNodes(nodes: FlowNode[]): DebugForInEntry[] {
  const byLine = new Map<number, FlowNode[]>();
  for (const n of nodes) {
    const line = typeof n.sourceLine === "number" && Number.isFinite(n.sourceLine) ? n.sourceLine : null;
    if (!line) continue;
    const r = typeof n.sourceRole === "string" ? n.sourceRole : "";
    if (r !== "for_in_next" && r !== "for_in_bind") continue;
    const arr = byLine.get(line) ?? [];
    arr.push(n);
    byLine.set(line, arr);
  }

  const out: DebugForInEntry[] = [];
  for (const [headerLine, items] of Array.from(byLine.entries())) {
    const next = items.find((n: FlowNode) => n.sourceRole === "for_in_next") ?? null;
    const bind = items.find((n: FlowNode) => n.sourceRole === "for_in_bind") ?? null;
    if (!next || !bind) continue;
    const vars = roleVarsFromNode(bind, "for_in_bind") ?? [];
    if (!vars.length) continue;
    out.push({ headerLine, vars, nextNodeId: next.id, bindNodeId: bind.id });
  }
  out.sort((a, b) => a.headerLine - b.headerLine || a.vars.join(",").localeCompare(b.vars.join(",")));
  return out;
}

function inferWhileEntriesFromNodes(nodes: FlowNode[]): DebugWhileEntry[] {
  const out: DebugWhileEntry[] = [];
  for (const n of nodes) {
    const line = typeof n.sourceLine === "number" && Number.isFinite(n.sourceLine) ? n.sourceLine : null;
    if (!line) continue;
    const role = typeof n.sourceRole === "string" ? n.sourceRole : "";
    if (role !== "while_check") continue;
    out.push({ headerLine: line, checkNodeId: n.id });
  }
  out.sort((a, b) => a.headerLine - b.headerLine || a.checkNodeId.localeCompare(b.checkNodeId));
  return out;
}

function roleVarsFromNode(node: FlowNode, role: string | null): string[] | undefined {
  if (!role) return undefined;
  const title = String((node as any).title ?? "").trim();
  const takeIdents = (src: string) =>
    src
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s));

  if (role === "for_init" || role === "for_inc") {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|\+=)\s*/.exec(title);
    return m?.[1] ? [m[1]] : undefined;
  }
  if (role === "aug_assign") {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*(\+=|-=|\*=|\/=|\/\/=|%=|\*\*=)\s*/.exec(title);
    return m?.[1] ? [m[1]] : undefined;
  }
  if (role === "for_in_bind") {
    const m = /^([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)\s*=/.exec(title);
    if (m?.[1]) return takeIdents(m[1]);
    return undefined;
  }
  return undefined;
}
