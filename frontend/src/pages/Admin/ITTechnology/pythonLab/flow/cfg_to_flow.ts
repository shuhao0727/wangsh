import type { FlowEdge, FlowNode } from "./model";
import type { PythonLabCfgResponse } from "../services/pythonlabDebugApi";
import type { FlowNodeShape } from "../types";

type SourceRange = {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
};

type FlowLikeNode = FlowNode & { sourceRange?: SourceRange };

function cleanLabel(s: string | undefined) {
  return (s ?? "").trim();
}

function isYesEdgeLabel(s: string | undefined) {
  const t = cleanLabel(s).toLowerCase();
  return t === "是" || t === "true";
}

function isNoEdgeLabel(s: string | undefined) {
  const t = cleanLabel(s).toLowerCase();
  return t === "否" || t === "false";
}

function isElifTitle(title: string) {
  const t = (title || "").trim().toLowerCase();
  return t.startsWith("elif ");
}

function uniqueId(base: string, used: Set<string>) {
  if (!used.has(base)) return base;
  let i = 2;
  while (used.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
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
    for (const v of outs) {
      if (dist.has(v)) continue;
      dist.set(v, du + 1);
      q.push(v);
      if (dist.size >= maxNodes) return dist;
    }
  }
  return dist;
}

function normalizeDecisionChainJoins(input: { nodes: FlowLikeNode[]; edges: FlowEdge[] }): { nodes: FlowLikeNode[]; edges: FlowEdge[] } {
  const nodes = input.nodes.slice();
  const edges = input.edges.slice();
  const nodeById = new Map(nodes.map((n) => [n.id, n] as const));
  const usedIds = new Set(nodes.map((n) => n.id).concat(edges.map((e) => e.id)));

  const out = new Map<string, string[]>();
  const outEdges = new Map<string, FlowEdge[]>();
  const inEdges = new Map<string, FlowEdge[]>();
  for (const n of nodes) {
    out.set(n.id, []);
    outEdges.set(n.id, []);
    inEdges.set(n.id, []);
  }
  for (const e of edges) {
    if (!out.has(e.from) || !out.has(e.to)) continue;
    out.get(e.from)!.push(e.to);
    outEdges.get(e.from)!.push(e);
    inEdges.get(e.to)!.push(e);
  }

  const pickYesNo = (id: string) => {
    const es = (outEdges.get(id) || []).filter((e) => !e.toEdge);
    const yes = es.find((e) => isYesEdgeLabel(e.label));
    const no = es.find((e) => isNoEdgeLabel(e.label));
    if (!yes || !no) return null;
    return { yes, no };
  };

  const canBeChainRoot = (id: string) => {
    const n = nodeById.get(id);
    if (!n || n.shape !== "decision") return false;
    if (isElifTitle(n.title)) return false;
    const yn = pickYesNo(id);
    return !!yn;
  };

  const chainOf = (rootId: string) => {
    const chain: string[] = [];
    let cur = rootId;
    while (true) {
      const yn = pickYesNo(cur);
      if (!yn) break;
      chain.push(cur);
      const nx = nodeById.get(yn.no.to);
      if (!nx || nx.shape !== "decision" || !isElifTitle(nx.title)) break;
      cur = nx.id;
    }
    return chain;
  };

  const isTerminalEntry = (id: string) => {
    const n = nodeById.get(id);
    if (!n) return true;
    const outs = (outEdges.get(id) || []).filter((e) => !e.toEdge);
    if (!outs.length) return true;
    return outs.every((e) => nodeById.get(e.to)?.shape === "start_end");
  };

  const findMergeForChain = (chain: string[]) => {
    const branchEntries: string[] = [];
    for (const dec of chain) {
      const yn = pickYesNo(dec);
      if (!yn) continue;
      if (!isTerminalEntry(yn.yes.to)) branchEntries.push(yn.yes.to);
    }
    const last = chain[chain.length - 1];
    const lastYN = pickYesNo(last);
    if (lastYN && !isTerminalEntry(lastYN.no.to)) branchEntries.push(lastYN.no.to);
    const uniqueEntries = Array.from(new Set(branchEntries)).filter((id) => nodeById.has(id));
    if (uniqueEntries.length < 2) return null;

    const dists = uniqueEntries.map((id) => bfsDistances(id, out, 1200));
    let common: string[] | null = null;
    for (const id of Array.from(dists[0].keys())) {
      if (chain.includes(id)) continue;
      if (nodeById.get(id)?.shape === "start_end") continue;
      if (!dists.every((m) => m.has(id))) continue;
      common = common ? [...common, id] : [id];
    }
    if (!common || !common.length) return null;
    const scored = common
      .map((id) => {
        const maxD = Math.max(...dists.map((m) => m.get(id)!));
        const sumD = dists.reduce((acc, m) => acc + (m.get(id) ?? 0), 0);
        const indeg = (inEdges.get(id) || []).length;
        return { id, maxD, sumD, indeg };
      })
      .filter((x) => x.indeg >= 2)
      .sort((a, b) => (a.maxD !== b.maxD ? a.maxD - b.maxD : a.sumD !== b.sumD ? a.sumD - b.sumD : a.id.localeCompare(b.id)));
    return scored[0]?.id ?? null;
  };

  const rewriteEdgesToJoin = (chain: string[], mergeId: string) => {
    const reachableUnion = (() => {
      const set = new Set<string>();
      const entries: string[] = [];
      for (const dec of chain) {
        const yn = pickYesNo(dec);
        if (yn && !isTerminalEntry(yn.yes.to)) entries.push(yn.yes.to);
      }
      const lastYN = pickYesNo(chain[chain.length - 1]);
      if (lastYN && !isTerminalEntry(lastYN.no.to)) entries.push(lastYN.no.to);
      const uniq = Array.from(new Set(entries)).filter((id) => nodeById.has(id));
      for (const s of uniq) {
        const q: string[] = [s];
        const seen = new Set<string>();
        seen.add(s);
        while (q.length) {
          const u = q.shift()!;
          set.add(u);
          const outs = out.get(u) || [];
          for (const v of outs) {
            if (v === mergeId) continue;
            if (!nodeById.has(v)) continue;
            if (seen.has(v)) continue;
            seen.add(v);
            q.push(v);
            if (seen.size >= 1400) break;
          }
          if (seen.size >= 1400) break;
        }
      }
      return set;
    })();

    const rewritable = edges.filter((e) => !e.toEdge && e.to === mergeId && (reachableUnion.has(e.from) || chain.includes(e.from)));
    if (rewritable.length < 2) return;

    const joinId = uniqueId(`__join__${chain[0]}`, usedIds);
    usedIds.add(joinId);
    nodes.push({ id: joinId, shape: "connector", title: "", x: 0, y: 0, sourceLine: undefined, sourceRole: undefined });

    const joinEdgeId = uniqueId(`${joinId}__to__${mergeId}`, usedIds);
    usedIds.add(joinEdgeId);
    edges.push({ id: joinEdgeId, from: joinId, to: mergeId, style: "straight" });

    for (const e of rewritable) {
      e.to = joinId;
    }
  };

  const roots = nodes.map((n) => n.id).filter(canBeChainRoot);
  for (const rootId of roots) {
    const chain = chainOf(rootId);
    if (chain.length < 1) continue;
    const mergeId = findMergeForChain(chain);
    if (!mergeId) continue;
    rewriteEdgesToJoin(chain, mergeId);
  }

  return { nodes, edges };
}

export function cfgToFlow(cfg: PythonLabCfgResponse): { nodes: (FlowNode & { sourceRange?: SourceRange })[]; edges: FlowEdge[] } {
  const kindToShape = (kind: string): FlowNodeShape => {
    const k = (kind || "").toLowerCase();
    if (k === "module") return "start_end";
    if (k === "if" || k === "elif" || k === "while" || k === "for" || k === "foreach") return "decision";
    if (k === "function") return "start_end";
    if (k === "functionend") return "start_end";
    if (k === "moduleend") return "start_end";
    return "process";
  };

  const moduleIds = new Set(cfg.nodes.filter((n) => n.kind === "Module").map((n) => n.id));
  const startId = "__cfg_start__";
  const endId = "__cfg_end__";
  const entryTarget = (cfg as any)?.entryNodeId ?? (cfg.edges.find((e) => e.kind === "Entry")?.to ?? null);

  const nodes: (FlowNode & { sourceRange?: SourceRange })[] = cfg.nodes
    .filter((n) => !moduleIds.has(n.id))
    .map((n) => {
    const shape = kindToShape(n.kind);
    const title = (n.title || "").trim() || n.kind;
    const tooltip = (n.fullTitle || n.title || "").trim() || undefined;
    const sourceLine = Number.isFinite(n.range?.startLine) ? n.range.startLine : undefined;
    return {
      id: n.id,
      shape,
      title,
      tooltip,
      x: 0,
      y: 0,
      sourceLine,
      sourceRole: undefined,
      sourceRange: n.range,
    };
  });

  const edges: FlowEdge[] = [];
  for (const e of cfg.edges) {
    if (e.kind === "Entry" && moduleIds.has(e.from)) continue;
    if (moduleIds.has(e.from) || moduleIds.has(e.to)) continue;
    const label = e.kind === "True" ? "是" : e.kind === "False" ? "否" : e.label;
    edges.push({ id: e.id, from: e.from, to: e.to, style: "straight", label });
  }

  nodes.unshift({ id: startId, shape: "start_end", title: "开始", x: 0, y: 0, sourceLine: undefined, sourceRole: undefined });
  nodes.push({ id: endId, shape: "start_end", title: "结束", x: 0, y: 0, sourceLine: undefined, sourceRole: undefined });

  if (entryTarget && !moduleIds.has(entryTarget)) {
    edges.unshift({ id: `${startId}__entry`, from: startId, to: entryTarget, style: "straight" });
  }

  const exitEdgesRaw: Array<{ from: string; kind: string; label?: string }> = Array.isArray((cfg as any)?.exitEdges) ? ((cfg as any).exitEdges as any) : [];
  const exitEdges = exitEdgesRaw.filter((e) => nodes.some((n) => n.id === e.from));
  if (exitEdges.length) {
    exitEdges.forEach((e, idx) =>
      edges.push({ id: `${e.from}__to_end__${e.kind}_${idx}`, from: e.from, to: endId, style: "straight", label: e.kind === "False" ? "否" : e.label })
    );
  } else {
    const exitNodeIds: string[] = Array.isArray((cfg as any)?.exitNodeIds) ? ((cfg as any).exitNodeIds as string[]) : [];
    const exits = exitNodeIds.filter((id) => nodes.some((n) => n.id === id));
    if (exits.length) {
      exits.forEach((id) => edges.push({ id: `${id}__to_end`, from: id, to: endId, style: "straight" }));
      return normalizeDecisionChainJoins({ nodes, edges });
    }
    const reachable = (() => {
      if (!entryTarget) return new Set<string>();
      const set = new Set<string>();
      const adj = new Map<string, string[]>();
      for (const n of nodes) adj.set(n.id, []);
      for (const e of edges) {
        if (!adj.has(e.from)) continue;
        adj.get(e.from)!.push(e.to);
      }
      const q: string[] = [entryTarget];
      set.add(entryTarget);
      while (q.length) {
        const u = q.shift()!;
        const outs = adj.get(u) || [];
        for (const v of outs) {
          if (!set.has(v)) {
            set.add(v);
            q.push(v);
          }
        }
      }
      return set;
    })();

    const outDeg = new Map<string, number>();
    for (const n of nodes) outDeg.set(n.id, 0);
    for (const e of edges) {
      if (!reachable.size || (reachable.has(e.from) && reachable.has(e.to))) {
        outDeg.set(e.from, (outDeg.get(e.from) || 0) + 1);
      }
    }
    const tailNodes = nodes.filter(
      (n) => n.id !== endId && n.id !== startId && (!reachable.size || reachable.has(n.id)) && (outDeg.get(n.id) || 0) === 0
    );
    if (tailNodes.length) {
      for (const n of tailNodes) {
        edges.push({ id: `${n.id}__to_end`, from: n.id, to: endId, style: "straight" });
      }
    } else {
      edges.push({ id: `${startId}__to_end_fallback`, from: startId, to: endId, style: "straight" });
    }
  }

  return normalizeDecisionChainJoins({ nodes, edges });
}
