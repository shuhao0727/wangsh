import type { FlowEdge, FlowNode } from "./model";
import { nodeSizeForTitle } from "./ports";

export type FlowTidyRuleId =
  | "R_TIDY_START_END"
  | "R_TIDY_CONNECT_DEG0"
  | "R_TIDY_JOIN_MERGE"
  | "R_TIDY_COLLAPSE_CONNECTOR"
  | "R_TIDY_MERGE_LINEAR_PROCESS"
  | "R_TIDY_MARK_CRITICAL";

export type FlowTidyLogItem = {
  ruleId: FlowTidyRuleId;
  description: string;
  affectedNodeIds?: string[];
  affectedEdgeIds?: string[];
};

export type FlowTidyStats = {
  nodeCount: number;
  edgeCount: number;
  crossingCount: number;
  approxMaxDecisionDepth: number;
  criticalPathNodeCount: number;
};

export type FlowTidyResult = {
  raw: { nodes: FlowNode[]; edges: FlowEdge[]; stats: FlowTidyStats };
  tidy: { nodes: FlowNode[]; edges: FlowEdge[]; stats: FlowTidyStats };
  log: FlowTidyLogItem[];
};

export type FlowTidyOptions = {
  enabled?: Partial<Record<FlowTidyRuleId, boolean>>;
};

function enabledRule(options: FlowTidyOptions | undefined, id: FlowTidyRuleId) {
  const v = options?.enabled?.[id];
  return typeof v === "boolean" ? v : true;
}

function cleanLabel(s: string | undefined) {
  return (s ?? "").trim().toLowerCase();
}

function isStartNode(n: FlowNode) {
  if (n.shape !== "start_end") return false;
  const t = (n.title || "").trim().toLowerCase();
  return t.includes("开始") || t.includes("start");
}

function isEndNode(n: FlowNode) {
  if (n.shape !== "start_end") return false;
  const t = (n.title || "").trim().toLowerCase();
  return t.includes("结束") || t.includes("end");
}

function centers(nodes: FlowNode[]) {
  const m = new Map<string, { cx: number; cy: number }>();
  for (const n of nodes) {
    const s = nodeSizeForTitle(n.shape, n.title);
    m.set(n.id, { cx: n.x + s.w / 2, cy: n.y + s.h / 2 });
  }
  return m;
}

function segIntersects(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }) {
  const orient = (p: any, q: any, r: any) => {
    const v = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (Math.abs(v) < 1e-9) return 0;
    return v > 0 ? 1 : 2;
  };
  const onSeg = (p: any, q: any, r: any) => {
    return Math.min(p.x, r.x) <= q.x && q.x <= Math.max(p.x, r.x) && Math.min(p.y, r.y) <= q.y && q.y <= Math.max(p.y, r.y);
  };
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSeg(a, c, b)) return true;
  if (o2 === 0 && onSeg(a, d, b)) return true;
  if (o3 === 0 && onSeg(c, a, d)) return true;
  if (o4 === 0 && onSeg(c, b, d)) return true;
  return false;
}

function crossingCount(nodes: FlowNode[], edges: FlowEdge[]) {
  const c = centers(nodes);
  const es = edges.filter((e) => !e.toEdge && c.has(e.from) && c.has(e.to));
  let cnt = 0;
  for (let i = 0; i < es.length; i++) {
    for (let j = i + 1; j < es.length; j++) {
      const a = es[i];
      const b = es[j];
      if (a.from === b.from || a.from === b.to || a.to === b.from || a.to === b.to) continue;
      const p1 = c.get(a.from)!;
      const p2 = c.get(a.to)!;
      const p3 = c.get(b.from)!;
      const p4 = c.get(b.to)!;
      const hit = segIntersects({ x: p1.cx, y: p1.cy }, { x: p2.cx, y: p2.cy }, { x: p3.cx, y: p3.cy }, { x: p4.cx, y: p4.cy });
      if (hit) cnt += 1;
    }
  }
  return cnt;
}

function buildAdj(nodes: FlowNode[], edges: FlowEdge[]) {
  const nodeById = new Map(nodes.map((n) => [n.id, n] as const));
  const out = new Map<string, string[]>();
  const inc = new Map<string, string[]>();
  for (const n of nodes) {
    out.set(n.id, []);
    inc.set(n.id, []);
  }
  for (const e of edges) {
    if (e.toEdge) continue;
    if (!nodeById.has(e.from) || !nodeById.has(e.to)) continue;
    out.get(e.from)!.push(e.to);
    inc.get(e.to)!.push(e.from);
  }
  return { nodeById, out, inc };
}

function bfsDistances(start: string, out: Map<string, string[]>, maxNodes: number) {
  const dist = new Map<string, number>();
  const q: string[] = [];
  dist.set(start, 0);
  q.push(start);
  while (q.length) {
    const u = q.shift()!;
    const du = dist.get(u)!;
    const outs = out.get(u) || [];
    for (let i = 0; i < outs.length; i++) {
      const v = outs[i];
      if (dist.has(v)) continue;
      dist.set(v, du + 1);
      q.push(v);
      if (dist.size >= maxNodes) return dist;
    }
  }
  return dist;
}

function approxMaxDecisionDepth(nodes: FlowNode[], edges: FlowEdge[], startId: string) {
  const { nodeById, out } = buildAdj(nodes, edges);
  const getForwardOuts = (id: string) => {
    const from = nodeById.get(id);
    if (!from) return [];
    return (out.get(id) || []).filter((toId) => {
      const to = nodeById.get(toId);
      if (!to) return false;
      return to.y >= from.y - 1;
    });
  };
  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  const dfs = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const node = nodeById.get(id);
    const self = node?.shape === "decision" ? 1 : 0;
    let best = 0;
    for (const v of getForwardOuts(id)) {
      best = Math.max(best, dfs(v));
    }
    visiting.delete(id);
    const val = self + best;
    memo.set(id, val);
    return val;
  };
  return dfs(startId);
}

function findCriticalPath(nodes: FlowNode[], edges: FlowEdge[], startId: string, endId: string) {
  const { nodeById, inc } = buildAdj(nodes, edges);
  const forwardIn = new Map<string, string[]>();
  for (const n of nodes) forwardIn.set(n.id, []);
  inc.forEach((ins, to) => {
    const toN = nodeById.get(to);
    if (!toN) return;
    for (let i = 0; i < ins.length; i++) {
      const from = ins[i];
      const fromN = nodeById.get(from);
      if (!fromN) continue;
      if (toN.y >= fromN.y - 1) forwardIn.get(to)!.push(from);
    }
  });
  const order = nodes
    .slice()
    .sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x !== b.x ? a.x - b.x : a.id.localeCompare(b.id)))
    .map((n) => n.id);
  const weight = (id: string) => {
    const n = nodeById.get(id);
    if (!n) return 0;
    if (n.shape === "decision") return 2;
    if (n.shape === "process" || n.shape === "io" || n.shape === "subroutine") return 1;
    return 0;
  };
  const score = new Map<string, number>();
  const prev = new Map<string, string | null>();
  for (const id of order) {
    score.set(id, Number.NEGATIVE_INFINITY);
    prev.set(id, null);
  }
  score.set(startId, weight(startId));
  for (const id of order) {
    const cur = score.get(id)!;
    if (!Number.isFinite(cur)) continue;
    const outs = edges
      .filter((e) => !e.toEdge && e.from === id)
      .map((e) => e.to)
      .filter((to) => {
        const fromN = nodeById.get(id);
        const toN = nodeById.get(to);
        if (!fromN || !toN) return false;
        return toN.y >= fromN.y - 1;
      });
    for (const to of outs) {
      const next = cur + weight(to);
      if (next > (score.get(to) ?? Number.NEGATIVE_INFINITY)) {
        score.set(to, next);
        prev.set(to, id);
      }
    }
  }
  if (!Number.isFinite(score.get(endId) ?? Number.NEGATIVE_INFINITY)) return null;
  const path: string[] = [];
  let cur: string | null = endId;
  const guard = new Set<string>();
  while (cur) {
    if (guard.has(cur)) break;
    guard.add(cur);
    path.push(cur);
    cur = prev.get(cur) ?? null;
  }
  path.reverse();
  if (!path.length || path[0] !== startId) return null;
  return path;
}

function edgeIdBetween(edges: FlowEdge[], from: string, to: string) {
  return edges.find((e) => !e.toEdge && e.from === from && e.to === to)?.id ?? null;
}

function computeStats(nodes: FlowNode[], edges: FlowEdge[], startId: string, endId: string) {
  const crit = findCriticalPath(nodes, edges, startId, endId);
  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    crossingCount: crossingCount(nodes, edges),
    approxMaxDecisionDepth: approxMaxDecisionDepth(nodes, edges, startId),
    criticalPathNodeCount: crit?.length ?? 0,
  };
}

export function computeTidy(nodes: FlowNode[], edges: FlowEdge[], options?: FlowTidyOptions): FlowTidyResult {
  const rawNodes = nodes.slice();
  const rawEdges = edges.slice();
  const usedIds = new Set<string>(rawNodes.map((n) => n.id).concat(rawEdges.map((e) => e.id)));
  const log: FlowTidyLogItem[] = [];
  const nextId = (prefix: string) => {
    let i = 1;
    let id = `${prefix}_${i}`;
    while (usedIds.has(id)) {
      i += 1;
      id = `${prefix}_${i}`;
    }
    usedIds.add(id);
    return id;
  };

  let ns: FlowNode[] = rawNodes.map((n) => ({ ...(n as any) }));
  let es: FlowEdge[] = rawEdges.map((e) => ({ ...(e as any) }));

  const ensureStartEnd = () => {
    const start = ns.find(isStartNode) ?? null;
    const end = ns.find(isEndNode) ?? null;
    let startId = start?.id ?? null;
    let endId = end?.id ?? null;
    const allowInsert = enabledRule(options, "R_TIDY_START_END");
    const bounds = (() => {
      if (!ns.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      for (const n of ns) {
        const s = nodeSizeForTitle(n.shape, n.title);
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + s.w);
        maxY = Math.max(maxY, n.y + s.h);
      }
      return { minX: Number.isFinite(minX) ? minX : 0, minY: Number.isFinite(minY) ? minY : 0, maxX: Number.isFinite(maxX) ? maxX : 0, maxY: Number.isFinite(maxY) ? maxY : 0 };
    })();
    if (!startId && allowInsert) {
      startId = nextId("__start");
      ns.unshift({ id: startId, shape: "start_end", title: "开始", x: bounds.minX, y: bounds.minY - 120 });
    }
    if (!endId && allowInsert) {
      endId = nextId("__end");
      ns.push({ id: endId, shape: "start_end", title: "结束", x: bounds.minX, y: bounds.maxY + 120 });
    }
    if ((!start || !end) && allowInsert && startId && endId) {
      log.push({ ruleId: "R_TIDY_START_END", description: "补齐统一入口出口", affectedNodeIds: [startId, endId] });
    }
    if (!startId) startId = ns[0]?.id ?? "__start_fallback";
    if (!endId) endId = ns[ns.length - 1]?.id ?? "__end_fallback";
    return { startId, endId };
  };

  const { startId, endId } = ensureStartEnd();

  const connectDeg0 = () => {
    const { out, inc } = buildAdj(ns, es);
    const incoming0: string[] = [];
    const outgoing0: string[] = [];
    for (const n of ns) {
      if (n.id === startId || n.id === endId) continue;
      const indeg = (inc.get(n.id) || []).length;
      const outdeg = (out.get(n.id) || []).length;
      if (indeg === 0) incoming0.push(n.id);
      if (outdeg === 0) outgoing0.push(n.id);
    }
    const newEdges: FlowEdge[] = [];
    for (const id of incoming0) newEdges.push({ id: nextId(`e_${startId}_to_${id}`), from: startId, to: id, style: "straight" });
    for (const id of outgoing0) newEdges.push({ id: nextId(`e_${id}_to_${endId}`), from: id, to: endId, style: "straight" });
    if (newEdges.length) {
      es = es.concat(newEdges);
      log.push({
        ruleId: "R_TIDY_CONNECT_DEG0",
        description: `连接入度/出度为0的节点（新增边 ${newEdges.length} 条）`,
        affectedNodeIds: incoming0.concat(outgoing0),
        affectedEdgeIds: newEdges.map((e) => e.id),
      });
    }
  };

  if (enabledRule(options, "R_TIDY_CONNECT_DEG0")) connectDeg0();

  const insertJoinForDecisionMerges = () => {
    const { nodeById, out, inc } = buildAdj(ns, es);
    const outEdgesByFrom = new Map<string, FlowEdge[]>();
    for (const n of ns) outEdgesByFrom.set(n.id, []);
    for (const e of es) {
      if (e.toEdge) continue;
      if (!nodeById.has(e.from) || !nodeById.has(e.to)) continue;
      outEdgesByFrom.get(e.from)!.push(e);
    }
    const pickYesNo = (id: string) => {
      const outs = (outEdgesByFrom.get(id) || []).filter((e) => !e.toEdge);
      if (outs.length < 2) return null;
      const yes = outs.find((e) => cleanLabel(e.label) === "是" || cleanLabel(e.label) === "true") || null;
      const no = outs.find((e) => cleanLabel(e.label) === "否" || cleanLabel(e.label) === "false") || null;
      if (!yes || !no) return null;
      return { yes, no };
    };
    const reachableUnion = (entries: string[], stopId: string) => {
      const set = new Set<string>();
      for (const s of Array.from(new Set(entries)).filter((x) => nodeById.has(x))) {
        const q: string[] = [s];
        const seen = new Set<string>();
        seen.add(s);
        while (q.length) {
          const u = q.shift()!;
          set.add(u);
          const outs = out.get(u) || [];
          for (let i = 0; i < outs.length; i++) {
            const v = outs[i];
            if (v === stopId) continue;
            if (!nodeById.has(v)) continue;
            if (seen.has(v)) continue;
            seen.add(v);
            q.push(v);
            if (seen.size >= 1600) break;
          }
          if (seen.size >= 1600) break;
        }
      }
      return set;
    };
    const rewriteToJoin = (mergeId: string, branchEntries: string[], union: Set<string>) => {
      const joinId = nextId("__join");
      ns.push({ id: joinId, shape: "connector", title: "", x: nodeById.get(mergeId)?.x ?? 0, y: (nodeById.get(mergeId)?.y ?? 0) - 80 });
      es.push({ id: nextId(`${joinId}__to__${mergeId}`), from: joinId, to: mergeId, style: "straight" });
      const rewritable = es.filter((e) => !e.toEdge && e.to === mergeId && (union.has(e.from) || branchEntries.includes(e.from)));
      if (rewritable.length < 2) return null;
      for (const e of rewritable) {
        e.to = joinId;
      }
      return { joinId, rewiredEdgeIds: rewritable.map((e) => e.id) };
    };
    let applied = 0;
    const affectedNodes: string[] = [];
    const affectedEdges: string[] = [];
    for (const n of ns.slice()) {
      if (n.shape !== "decision") continue;
      const yn = pickYesNo(n.id);
      if (!yn) continue;
      const yesEntry = yn.yes.to;
      const noEntry = yn.no.to;
      const dy = bfsDistances(yesEntry, out, 1400);
      const dn = bfsDistances(noEntry, out, 1400);
      let mergeId: string | null = null;
      let best = Number.POSITIVE_INFINITY;
      dy.forEach((d1, id) => {
        const d2 = dn.get(id);
        if (d2 === undefined) return;
        if (id === n.id) return;
        if (id === startId) return;
        const indeg = (inc.get(id) || []).length;
        if (indeg < 2) return;
        const score = Math.max(d1, d2) * 1000 + (d1 + d2);
        if (score < best) {
          best = score;
          mergeId = id;
        }
      });
      if (!mergeId) continue;
      const union = reachableUnion([yesEntry, noEntry], mergeId);
      const rew = rewriteToJoin(mergeId, [yesEntry, noEntry], union);
      if (!rew) continue;
      applied += 1;
      affectedNodes.push(mergeId, rew.joinId);
      affectedEdges.push(...rew.rewiredEdgeIds);
    }
    if (applied) {
      log.push({
        ruleId: "R_TIDY_JOIN_MERGE",
        description: `决策分支合流显式化（插入 join ${applied} 个）`,
        affectedNodeIds: Array.from(new Set(affectedNodes)),
        affectedEdgeIds: Array.from(new Set(affectedEdges)),
      });
    }
  };

  if (enabledRule(options, "R_TIDY_JOIN_MERGE")) insertJoinForDecisionMerges();

  const collapseConnectors = () => {
    const nodeById = new Map(ns.map((n) => [n.id, n] as const));
    const inEdges = new Map<string, FlowEdge[]>();
    const outEdges = new Map<string, FlowEdge[]>();
    for (const n of ns) {
      inEdges.set(n.id, []);
      outEdges.set(n.id, []);
    }
    for (const e of es) {
      if (e.toEdge) continue;
      if (!nodeById.has(e.from) || !nodeById.has(e.to)) continue;
      outEdges.get(e.from)!.push(e);
      inEdges.get(e.to)!.push(e);
    }
    const toRemoveNodes = new Set<string>();
    const toRemoveEdges = new Set<string>();
    const toAddEdges: FlowEdge[] = [];
    for (const n of ns) {
      if (n.shape !== "connector") continue;
      if ((n.title || "").trim()) continue;
      if (n.id === startId || n.id === endId) continue;
      const ins = (inEdges.get(n.id) || []).filter((e) => !e.label);
      const outs = (outEdges.get(n.id) || []).filter((e) => !e.label);
      if (ins.length !== 1 || outs.length !== 1) continue;
      const inE = ins[0];
      const outE = outs[0];
      if (inE.from === outE.to) continue;
      const newE: FlowEdge = { id: nextId(`e_${inE.from}_to_${outE.to}`), from: inE.from, to: outE.to, style: "straight" };
      toAddEdges.push(newE);
      toRemoveNodes.add(n.id);
      toRemoveEdges.add(inE.id);
      toRemoveEdges.add(outE.id);
    }
    if (!toRemoveNodes.size) return;
    ns = ns.filter((n) => !toRemoveNodes.has(n.id));
    es = es.filter((e) => !toRemoveEdges.has(e.id)).concat(toAddEdges);
    log.push({
      ruleId: "R_TIDY_COLLAPSE_CONNECTOR",
      description: `折叠冗余连接点（删除节点 ${toRemoveNodes.size} 个）`,
      affectedNodeIds: Array.from(toRemoveNodes),
      affectedEdgeIds: Array.from(toRemoveEdges).concat(toAddEdges.map((e) => e.id)),
    });
  };

  if (enabledRule(options, "R_TIDY_COLLAPSE_CONNECTOR")) collapseConnectors();

  const mergeLinearProcess = () => {
    const nodeById = new Map(ns.map((n) => [n.id, n] as const));
    const inEdges = new Map<string, FlowEdge[]>();
    const outEdges = new Map<string, FlowEdge[]>();
    for (const n of ns) {
      inEdges.set(n.id, []);
      outEdges.set(n.id, []);
    }
    for (const e of es) {
      if (e.toEdge) continue;
      if (!nodeById.has(e.from) || !nodeById.has(e.to)) continue;
      outEdges.get(e.from)!.push(e);
      inEdges.get(e.to)!.push(e);
    }
    let merged = 0;
    const removedNodes = new Set<string>();
    const removedEdges = new Set<string>();
    const replacedEdges: FlowEdge[] = [];
    for (const e of es) {
      if (e.toEdge) continue;
      if (e.label && cleanLabel(e.label)) continue;
      const a = nodeById.get(e.from);
      const b = nodeById.get(e.to);
      if (!a || !b) continue;
      if (a.id === startId || a.id === endId || b.id === startId || b.id === endId) continue;
      if (a.shape !== "process" || b.shape !== "process") continue;
      const outsA = (outEdges.get(a.id) || []).filter((x) => !x.toEdge);
      const insB = (inEdges.get(b.id) || []).filter((x) => !x.toEdge);
      if (outsA.length !== 1 || insB.length !== 1) continue;
      if (removedNodes.has(a.id) || removedNodes.has(b.id)) continue;
      const nextTitle = [a.title, b.title].map((x) => (x || "").trim()).filter(Boolean).join("\n");
      const nextTooltip = [a.tooltip, b.tooltip].map((x) => (x || "").trim()).filter(Boolean).join("\n");
      (a as any).title = nextTitle || a.title;
      (a as any).tooltip = nextTooltip || a.tooltip;
      const outsB = (outEdges.get(b.id) || []).filter((x) => !x.toEdge);
      for (const oe of outsB) {
        replacedEdges.push({ ...oe, id: nextId(`e_${a.id}_to_${oe.to}`), from: a.id });
        removedEdges.add(oe.id);
      }
      removedEdges.add(e.id);
      removedNodes.add(b.id);
      merged += 1;
    }
    if (!merged) return;
    ns = ns.filter((n) => !removedNodes.has(n.id));
    es = es.filter((e) => !removedEdges.has(e.id)).concat(replacedEdges);
    log.push({
      ruleId: "R_TIDY_MERGE_LINEAR_PROCESS",
      description: `合并线性处理节点链（合并次数 ${merged}）`,
      affectedNodeIds: Array.from(removedNodes),
      affectedEdgeIds: Array.from(removedEdges).concat(replacedEdges.map((e) => e.id)),
    });
  };

  if (enabledRule(options, "R_TIDY_MERGE_LINEAR_PROCESS")) mergeLinearProcess();

  const markCritical = () => {
    const crit = findCriticalPath(ns, es, startId, endId);
    if (!crit || crit.length < 2) return;
    const critSet = new Set(crit);
    const critEdges = new Set<string>();
    for (let i = 0; i < crit.length - 1; i++) {
      const id = edgeIdBetween(es, crit[i], crit[i + 1]);
      if (id) critEdges.add(id);
    }
    ns = ns.map((n) => (critSet.has(n.id) ? ({ ...n, emphasis: "critical" } as any) : n));
    es = es.map((e) => (critEdges.has(e.id) ? ({ ...e, emphasis: "critical" } as any) : e));
    log.push({
      ruleId: "R_TIDY_MARK_CRITICAL",
      description: `标注关键路径（节点 ${critSet.size} 个，边 ${critEdges.size} 条）`,
      affectedNodeIds: Array.from(critSet),
      affectedEdgeIds: Array.from(critEdges),
    });
  };

  if (enabledRule(options, "R_TIDY_MARK_CRITICAL")) markCritical();

  const rawStats = computeStats(rawNodes, rawEdges, startId, endId);
  const tidyStats = computeStats(ns, es, startId, endId);
  const tidyEdges: FlowEdge[] = es.map((e) => {
    if (e.toEdge) return e;
    return { ...e, style: "straight", routeMode: "auto", routeShape: undefined, anchor: null, anchors: undefined };
  });

  return {
    raw: { nodes: rawNodes, edges: rawEdges, stats: rawStats },
    tidy: { nodes: ns, edges: tidyEdges, stats: tidyStats },
    log,
  };
}
