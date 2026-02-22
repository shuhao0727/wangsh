import ELK from "elkjs/lib/elk.bundled.js";
import type { FlowEdge, FlowNode, PortSide } from "./model";
import { fixedPortForStartEnd, nodeSizeForTitle } from "./ports";

const elk = new ELK();

const GRID = 10;
const snap = (v: number) => Math.round(v / GRID) * GRID;

const CACHE_LIMIT = 12;
const layoutCache = new Map<
  string,
  { nodes: Map<string, { x: number; y: number }>; edges: Map<string, { fromPort: PortSide; toPort: PortSide }> }
>();

function cacheGet(key: string) {
  const v = layoutCache.get(key);
  if (!v) return null;
  layoutCache.delete(key);
  layoutCache.set(key, v);
  return v;
}

function cacheSet(key: string, value: { nodes: Map<string, { x: number; y: number }>; edges: Map<string, { fromPort: PortSide; toPort: PortSide }> }) {
  if (layoutCache.has(key)) layoutCache.delete(key);
  layoutCache.set(key, value);
  while (layoutCache.size > CACHE_LIMIT) {
    const k = layoutCache.keys().next().value as string | undefined;
    if (!k) break;
    layoutCache.delete(k);
  }
}

function hashStr(h: number, s: string) {
  let x = h >>> 0;
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619) >>> 0;
  }
  return x;
}

function layoutKey(nodes: FlowNode[], edges: FlowEdge[], viewport?: { width: number; height: number }) {
  const ns = nodes
    .map((n) => ({ id: n.id, shape: n.shape, title: n.title }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const es = edges
    .filter((e) => !e.toEdge)
    .map((e) => ({ id: e.id, from: e.from, to: e.to, label: e.label ?? "" }))
    .sort((a, b) => a.id.localeCompare(b.id));
  let h = 2166136261 >>> 0;
  for (const n of ns) h = hashStr(h, `${n.id}|${n.shape}|${n.title}`);
  for (const e of es) h = hashStr(h, `${e.id}|${e.from}|${e.to}|${e.label}`);
  const w = viewport ? Math.round(viewport.width) : 0;
  const hh = viewport ? Math.round(viewport.height) : 0;
  return `${ns.length}|${es.length}|${w}|${hh}|${(h >>> 0).toString(16)}`;
}

function elkPortSide(side: PortSide) {
  if (side === "top") return "NORTH";
  if (side === "bottom") return "SOUTH";
  if (side === "left") return "WEST";
  return "EAST";
}

function cleanLabel(s: string | undefined) {
  return (s ?? "").trim().toLowerCase();
}

function isNoEdge(e: FlowEdge) {
  const l = cleanLabel(e.label);
  return l === "否" || l === "false";
}

function isYesEdge(e: FlowEdge) {
  const l = cleanLabel(e.label);
  return l === "是" || l === "true";
}

async function arrangeSingleFromIRElk(
  nodes: FlowNode[],
  edges: FlowEdge[],
  viewport?: { width: number; height: number }
): Promise<{ nodes: FlowNode[]; edges: FlowEdge[] }> {
  if (!nodes.length) return { nodes, edges };

  const nodesSorted = nodes.slice().sort((a, b) => a.id.localeCompare(b.id));
  const nodeById = new Map(nodesSorted.map((n) => [n.id, n] as const));
  const layoutEdges = edges.filter((e) => !e.toEdge && nodeById.has(e.from) && nodeById.has(e.to)).slice().sort((a, b) => a.id.localeCompare(b.id));
  const out = new Map<string, string[]>();
  for (const n of nodesSorted) out.set(n.id, []);
  for (const e of layoutEdges) out.get(e.from)!.push(e.to);
  out.forEach((arr, k) => out.set(k, arr.slice().sort((a, b) => a.localeCompare(b))));
  const inDeg = new Map<string, number>();
  const outDeg = new Map<string, number>();
  for (const n of nodesSorted) {
    inDeg.set(n.id, 0);
    outDeg.set(n.id, 0);
  }
  for (const e of layoutEdges) {
    outDeg.set(e.from, (outDeg.get(e.from) || 0) + 1);
    inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1);
  }
  const startCandidates = nodesSorted
    .filter((n) => n.shape === "start_end")
    .sort((a, b) => a.id.localeCompare(b.id));
  const zeroIn = startCandidates.filter((n) => (inDeg.get(n.id) || 0) === 0 && (outDeg.get(n.id) || 0) > 0);
  const preferMain = (arr: FlowNode[]) => arr.find((n) => n.title.includes("开始") || n.title.toLowerCase().includes("start"));
  const preferDef = (arr: FlowNode[]) => arr.find((n) => n.title.trim().toLowerCase().startsWith("def "));
  const startId =
    preferMain(zeroIn)?.id ??
    preferDef(zeroIn)?.id ??
    zeroIn[0]?.id ??
    preferMain(startCandidates)?.id ??
    preferDef(startCandidates)?.id ??
    startCandidates[0]?.id ??
    nodesSorted[0].id;
  const dist = (() => {
    const m = new Map<string, number>();
    const q: string[] = [];
    m.set(startId, 0);
    q.push(startId);
    while (q.length) {
      const u = q.shift()!;
      const du = m.get(u)!;
      const outs = out.get(u) || [];
      for (let i = 0; i < outs.length; i++) {
        const v = outs[i];
        if (!m.has(v)) {
          m.set(v, du + 1);
          q.push(v);
        }
      }
    }
    return m;
  })();
  const isBackEdge = (e: FlowEdge) => {
    if (e.fromPort === "left" && e.toPort === "left") return true;
    const du = dist.get(e.from);
    const dv = dist.get(e.to);
    if (du === undefined || dv === undefined) return false;
    return dv <= du;
  };

  const portsByNodeId = new Map<string, Record<PortSide, string>>();
  for (const n of nodes) {
    portsByNodeId.set(n.id, {
      top: `${n.id}__p_top`,
      bottom: `${n.id}__p_bottom`,
      left: `${n.id}__p_left`,
      right: `${n.id}__p_right`,
    });
  }
  const edgePortsById = new Map<
    string,
    {
      sourcePortId: string;
      targetPortId: string;
      fromPort: PortSide;
      toPort: PortSide;
    }
  >();
  for (const e of layoutEdges) {
    const fromNode = nodeById.get(e.from)!;
    const toNode = nodeById.get(e.to)!;

    let fromPort: PortSide = "bottom";
    let toPort: PortSide = "top";

    if (fromNode.shape === "start_end") fromPort = fixedPortForStartEnd(fromNode.title);
    if (toNode.shape === "start_end") toPort = fixedPortForStartEnd(toNode.title);

    if (fromNode.shape === "decision") {
      fromPort = isNoEdge(e) ? "right" : isYesEdge(e) ? "bottom" : "bottom";
      if (toNode.shape !== "start_end") toPort = "top";
    } else if (isBackEdge(e)) {
      if (toNode.shape === "decision") {
        fromPort = "left";
        toPort = "left";
      } else {
        if (fromNode.shape !== "start_end") fromPort = "bottom";
        if (toNode.shape !== "start_end") toPort = "top";
      }
    } else {
      if (fromNode.shape !== "start_end") fromPort = "bottom";
      if (toNode.shape !== "start_end") {
        toPort = "top";
      }
    }

    if (toNode.shape === "io") {
      toPort = "top";
    }
    if (fromNode.shape === "io") {
      fromPort = "bottom";
    }

    const fromPorts = portsByNodeId.get(e.from)!;
    const toPorts = portsByNodeId.get(e.to)!;
    edgePortsById.set(e.id, { sourcePortId: fromPorts[fromPort], targetPortId: toPorts[toPort], fromPort, toPort });
  }

  let maxW = 0;
  let maxH = 0;
  for (const n of nodes) {
    const s = nodeSizeForTitle(n.shape, n.title);
    maxW = Math.max(maxW, s.w);
    maxH = Math.max(maxH, s.h);
  }
  const base = Math.max(60, Math.min(maxW, maxH));
  const nodeNode = snap(Math.max(30, Math.round(base * 0.52)));
  const layerSep = snap(Math.max(60, Math.round(base * 0.82)));
  const edgeNodeSep = snap(Math.max(14, Math.round(base * 0.26)));
  const edgeEdge = snap(Math.max(10, Math.round(base * 0.22)));
  const edgeEdgeBetweenLayers = snap(Math.max(12, Math.round(base * 0.24)));

  const graph: any = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.spacing.nodeNode": String(nodeNode),
      "elk.spacing.edgeEdge": String(edgeEdge),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(layerSep),
      "elk.layered.spacing.edgeNodeBetweenLayers": String(edgeNodeSep),
      "elk.layered.spacing.edgeEdgeBetweenLayers": String(edgeEdgeBetweenLayers),
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      "elk.layered.layering.strategy": "NETWORK_SIMPLEX",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.layered.mergeEdges": "true",
      "elk.layered.unnecessaryBendpoints": "false",
      "elk.layered.nodePlacement.favorStraightEdges": "true",
      "elk.layered.nodePlacement.bk.edgeStraightening": "IMPROVE_STRAIGHTNESS",
      "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
      ...(viewport
        ? {
            "elk.layered.cycleBreaking.strategy": "GREEDY",
          }
        : {}),
    },
    children: nodesSorted.map((n) => {
      const s = nodeSizeForTitle(n.shape, n.title);
      const ports = portsByNodeId.get(n.id)!;
      return {
        id: n.id,
        width: s.w,
        height: s.h,
        layoutOptions: { "org.eclipse.elk.portConstraints": "FIXED_POS" },
        ports: (() => {
          const pw = 4;
          const ph = 4;
          const baseX = Math.max(0, Math.round((s.w - pw) / 2));
          const baseY = Math.max(0, Math.round((s.h - ph) / 2));
          const ioSlant = n.shape === "io" ? Math.min(14, Math.max(10, s.w * 0.12)) : 0;
          const ioDx = ioSlant / 2;

          const basePorts = (Object.keys(ports) as PortSide[]).map((side) => {
            const x = (() => {
              if (n.shape !== "io") {
                if (side === "left") return 0;
                if (side === "right") return Math.max(0, s.w - pw);
                return baseX;
              }
              const centerX = baseX;
              if (side === "top") return centerX;
              if (side === "bottom") return centerX;
              if (side === "left") return Math.max(0, Math.round(ioDx - pw / 2));
              return Math.max(0, Math.round(s.w - ioDx - pw / 2));
            })();

            const y = (() => {
              if (side === "top") return 0;
              if (side === "bottom") return Math.max(0, s.h - ph);
              return baseY;
            })();

            return { id: ports[side], width: pw, height: ph, x, y, layoutOptions: { "org.eclipse.elk.port.side": elkPortSide(side) } };
          });

          return basePorts;
        })(),
      };
    }),
    edges: layoutEdges.filter((e) => !isBackEdge(e)).map((e) => {
      const p = edgePortsById.get(e.id);
      return p ? { id: e.id, sources: [p.sourcePortId], targets: [p.targetPortId] } : { id: e.id, sources: [e.from], targets: [e.to] };
    }),
  };

  const res = (await elk.layout(graph)) as any;
  const pos = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const c of res.children ?? []) {
    if (!c.id) continue;
    const original = nodeById.get(c.id);
    if (!original) continue;
    const s = nodeSizeForTitle(original.shape, original.title);
    pos.set(c.id, { x: Math.round(c.x ?? 0), y: Math.round(c.y ?? 0), w: s.w, h: s.h });
  }

  const nextNodes = nodes.map((n) => {
    const p = pos.get(n.id);
    return p ? { ...n, x: p.x, y: p.y } : n;
  });

  const nextEdges = edges.map((e): FlowEdge => {
    if (e.toEdge) return e;
    const picked = edgePortsById.get(e.id);
    const fromNode = nodeById.get(e.from);
    const toNode = nodeById.get(e.to);
    if (!picked || !fromNode || !toNode) return e;
    let fromPort: PortSide | undefined = picked.fromPort;
    let toPort: PortSide | undefined = picked.toPort;
    if (fromNode.shape === "start_end") fromPort = fixedPortForStartEnd(fromNode.title);
    if (toNode.shape === "start_end") toPort = fixedPortForStartEnd(toNode.title);
    if (fromNode.shape === "decision") fromPort = isNoEdge(e) ? "right" : isYesEdge(e) ? "bottom" : fromPort;
    if (toNode.shape !== "start_end") toPort = "top";
    if (toNode.shape === "io") toPort = "top";
    if (fromNode.shape === "io") fromPort = "bottom";
    if (isBackEdge(e)) {
      if (toNode.shape === "decision") {
        fromPort = "left";
        toPort = "left";
      } else {
        if (fromNode.shape !== "start_end") fromPort = "bottom";
        if (toNode.shape !== "start_end") toPort = "top";
      }
    }
    return { ...e, fromPort, toPort, fromDir: undefined, toDir: undefined, fromFree: null, toFree: null, anchor: null, anchors: undefined, routeMode: "auto", style: "straight" };
  });

  return { nodes: nextNodes, edges: nextEdges };
}

export async function arrangeFromIRElk(
  nodes: FlowNode[],
  edges: FlowEdge[],
  viewport?: { width: number; height: number }
): Promise<{ nodes: FlowNode[]; edges: FlowEdge[] }> {
  if (!nodes.length) return { nodes, edges };

  const key = layoutKey(nodes, edges, viewport);
  const hit = cacheGet(key);
  if (hit) {
    const nextNodes = nodes.map((n) => {
      const p = hit.nodes.get(n.id);
      return p ? { ...n, x: p.x, y: p.y } : n;
    });
    const nextEdges = edges.map((e): FlowEdge => {
      if (e.toEdge) return e;
      const p = hit.edges.get(e.id);
      if (!p) return e;
      return { ...e, fromPort: p.fromPort, toPort: p.toPort, fromDir: undefined, toDir: undefined, fromFree: null, toFree: null, anchor: null, anchors: undefined, routeMode: "auto", style: "straight" };
    });
    return { nodes: nextNodes, edges: nextEdges };
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n] as const));
  const layoutEdges = edges.filter((e) => !e.toEdge && nodeById.has(e.from) && nodeById.has(e.to));

  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of layoutEdges) {
    adj.get(e.from)!.push(e.to);
    adj.get(e.to)!.push(e.from);
  }

  const components: string[][] = [];
  const seen = new Set<string>();
  for (const n of nodes) {
    if (seen.has(n.id)) continue;
    const q: string[] = [n.id];
    seen.add(n.id);
    const comp: string[] = [];
    while (q.length) {
      const u = q.shift()!;
      comp.push(u);
      const outs = (adj.get(u) || []).slice().sort((a, b) => a.localeCompare(b));
      for (const v of outs) {
        if (!seen.has(v)) {
          seen.add(v);
          q.push(v);
        }
      }
    }
    components.push(comp);
  }

  const computed = components.length <= 1 ? await arrangeSingleFromIRElk(nodes, edges, viewport) : await (async () => {
    const kindOfComponent = (ids: string[]) => {
      const set = new Set(ids);
      const ns = nodes.filter((n) => set.has(n.id));
      const starts = ns.filter((n) => n.shape === "start_end");
      const hasMainStart = starts.some((n) => n.title.includes("开始") || n.title.toLowerCase().includes("start"));
      if (hasMainStart) return "main";
      const hasDefStart = starts.some((n) => n.title.trim().toLowerCase().startsWith("def "));
      const hasReturnStmt = ns.some((n) => n.shape !== "start_end" && n.title.trim().toLowerCase().startsWith("return "));
      const hasSigStart = starts.some((n) => /\w+\s*\(.*\)/.test(n.title.trim()));
      if (hasDefStart || (hasReturnStmt && hasSigStart)) return "function";
      return "other";
    };
    const startOf = (ids: string[]) => {
      const set = new Set(ids);
      const starts = nodes.filter((n) => set.has(n.id) && n.shape === "start_end").slice().sort((a, b) => a.id.localeCompare(b.id));
      const main = starts.find((n) => n.title.includes("开始") || n.title.toLowerCase().includes("start"));
      const fn = starts.find((n) => n.title.trim().toLowerCase().startsWith("def "));
      const zeroInStart = (() => {
        const inDeg = new Map<string, number>();
        const outDeg = new Map<string, number>();
        for (const id of ids) {
          inDeg.set(id, 0);
          outDeg.set(id, 0);
        }
        for (const e of layoutEdges) {
          if (!set.has(e.from) || !set.has(e.to)) continue;
          outDeg.set(e.from, (outDeg.get(e.from) || 0) + 1);
          inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1);
        }
        return starts.find((n) => (inDeg.get(n.id) || 0) === 0 && (outDeg.get(n.id) || 0) > 0);
      })();
      return main ?? fn ?? zeroInStart ?? starts[0] ?? nodes.find((n) => set.has(n.id))!;
    };

    const ordered = components
      .map((ids) => {
        const s = startOf(ids);
        return { ids, start: s, kind: kindOfComponent(ids), title: s.title };
      })
      .sort((a, b) => {
        const rank = (k: string) => (k === "main" ? 0 : k === "function" ? 1 : 2);
        const ra = rank(a.kind);
        const rb = rank(b.kind);
        if (ra !== rb) return ra - rb;
        return a.title.localeCompare(b.title);
      });

    const updatedEdgesById = new Map<string, FlowEdge>();
    const laidNodesById = new Map<string, FlowNode>();

    const boundsOf = (ns: FlowNode[]) => {
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
      if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0, w: 0, h: 0 };
      return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
    };

    let mainBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, w: 0, h: 0 };
    const gapX = snap(Math.max(240, Math.min(520, nodes.reduce((m, n) => Math.max(m, nodeSizeForTitle(n.shape, n.title).w), 0) + 160)));
    const gapY = snap(140);
    let fnCursorY = 0;

    for (const item of ordered) {
      const set = new Set(item.ids);
      const subNodes = nodes.filter((n) => set.has(n.id));
      const subEdges = edges.filter((e) => e.toEdge || (set.has(e.from) && set.has(e.to)));
      const laid = await arrangeSingleFromIRElk(subNodes, subEdges, viewport);
      const b = boundsOf(laid.nodes);

      let offsetX = -b.minX;
      let offsetY = -b.minY;
      if (item.kind !== "main") {
        offsetX = mainBounds.w + gapX - b.minX;
        offsetY = fnCursorY - b.minY;
        fnCursorY += b.h + gapY;
      } else {
        mainBounds = b;
      }

      for (const n of laid.nodes) laidNodesById.set(n.id, { ...n, x: n.x + offsetX, y: n.y + offsetY });
      for (const e of laid.edges) if (!e.toEdge) updatedEdgesById.set(e.id, e);
    }

    const nextNodes = nodes.map((n) => laidNodesById.get(n.id) ?? n);
    const nextEdges = edges.map((e) => (e.toEdge ? e : updatedEdgesById.get(e.id) ?? e));
    return { nodes: nextNodes, edges: nextEdges };
  })();

  const nodesMap = new Map<string, { x: number; y: number }>();
  for (const n of computed.nodes) nodesMap.set(n.id, { x: n.x, y: n.y });
  const edgesMap = new Map<string, { fromPort: PortSide; toPort: PortSide }>();
  for (const e of computed.edges) {
    if (e.toEdge) continue;
    if (!e.fromPort || !e.toPort) continue;
    edgesMap.set(e.id, { fromPort: e.fromPort, toPort: e.toPort });
  }
  cacheSet(key, { nodes: nodesMap, edges: edgesMap });
  return computed;
}

export function __resetIrElkCacheForTest() {
  layoutCache.clear();
}
