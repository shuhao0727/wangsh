import type { FlowEdge, FlowNode, PortSide } from "./model";
import { DEFAULT_BEAUTIFY_PARAMS, buildDot, applyPlainLayoutToCanvas } from "./beautify";
import { renderGraphviz } from "./graphviz";
import { nodeSizeForTitle } from "./ports";

type CachedLayout = {
  nodes: Map<string, { x: number; y: number }>;
  edges: Map<
    string,
    {
      fromPort?: PortSide;
      toPort?: PortSide;
      style?: FlowEdge["style"];
      routeMode?: FlowEdge["routeMode"];
      routeShape?: FlowEdge["routeShape"];
      anchor?: FlowEdge["anchor"];
      anchors?: FlowEdge["anchors"];
      fromAttach?: FlowEdge["fromAttach"];
      toAttach?: FlowEdge["toAttach"];
      labelPosition?: FlowEdge["labelPosition"];
    }
  >;
};

const CACHE_LIMIT = 24;
const layoutCache = new Map<string, CachedLayout>();

function cacheGet(key: string) {
  const v = layoutCache.get(key);
  if (!v) return null;
  layoutCache.delete(key);
  layoutCache.set(key, v);
  return v;
}

function cacheSet(key: string, value: CachedLayout) {
  if (layoutCache.has(key)) layoutCache.delete(key);
  layoutCache.set(key, value);
  while (layoutCache.size > CACHE_LIMIT) {
    const k = layoutCache.keys().next().value as string | undefined;
    if (!k) break;
    layoutCache.delete(k);
  }
}

function layoutKey(nodes: FlowNode[], edges: FlowEdge[], viewport?: { width: number; height: number }) {
  const ns = nodes
    .map((n) => ({ id: n.id, shape: n.shape, title: n.title }))
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
  const es = edges
    .map((e) => ({ id: e.id, from: e.from, to: e.to, label: e.label ?? "", toEdge: e.toEdge ?? "" }))
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
  const vp = viewport ? { width: Math.round(viewport.width), height: Math.round(viewport.height) } : null;
  return JSON.stringify({ ns, es, vp });
}

function snap(v: number) {
  const GRID = 10;
  return Math.round(v / GRID) * GRID;
}

function cleanLabel(s: string | undefined) {
  return (s ?? "").trim().toLowerCase();
}

function isNoEdge(e: FlowEdge) {
  const l = cleanLabel(e.label);
  return l === "否" || l === "false";
}

function buildComponents(nodeIds: string[], edges: FlowEdge[]) {
  const nodeSet = new Set(nodeIds);
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const e of edges) {
    if (e.toEdge) continue;
    if (!nodeSet.has(e.from) || !nodeSet.has(e.to)) continue;
    adj.get(e.from)!.push(e.to);
    adj.get(e.to)!.push(e.from);
  }
  adj.forEach((arr, k) => {
    adj.set(
      k,
      Array.from(new Set(arr)).sort((a: string, b: string) => a.localeCompare(b))
    );
  });

  const seen = new Set<string>();
  const comps: string[][] = [];
  for (const start of nodeIds) {
    if (seen.has(start)) continue;
    const q: string[] = [start];
    seen.add(start);
    const comp: string[] = [];
    while (q.length) {
      const u = q.shift()!;
      comp.push(u);
      for (const v of adj.get(u) || []) {
        if (!seen.has(v)) {
          seen.add(v);
          q.push(v);
        }
      }
    }
    comps.push(comp.slice().sort((a, b) => a.localeCompare(b)));
  }

  const isMain = (ids: string[]) => ids.some((x) => !x.startsWith("fn_"));
  comps.sort((a, b) => {
    const am = isMain(a);
    const bm = isMain(b);
    if (am !== bm) return am ? -1 : 1;
    return (a[0] || "").localeCompare(b[0] || "");
  });

  return comps;
}

function layoutComponent(
  nodes: FlowNode[],
  edges: FlowEdge[],
  ids: string[],
  colStep: number,
  rowStep: number
): { posById: Map<string, { x: number; y: number }>; bounds: { minX: number; minY: number; w: number; h: number } } {
  const idSet = new Set(ids);
  const out = new Map<string, string[]>();
  for (const id of ids) out.set(id, []);
  for (const e of edges) {
    if (e.toEdge) continue;
    if (!idSet.has(e.from) || !idSet.has(e.to)) continue;
    out.get(e.from)!.push(e.to);
  }
  out.forEach((arr, k) => {
    out.set(
      k,
      Array.from(new Set(arr)).sort((a: string, b: string) => a.localeCompare(b))
    );
  });

  const dag = new Map<string, string[]>();
  for (const id of ids) dag.set(id, []);
  const color = new Map<string, 0 | 1 | 2>();
  const dfs = (u: string) => {
    color.set(u, 1);
    for (const v of out.get(u) || []) {
      const c = color.get(v) ?? 0;
      if (c === 1) continue;
      dag.get(u)!.push(v);
      if (c === 0) dfs(v);
    }
    color.set(u, 2);
  };
  for (const id of ids) if ((color.get(id) ?? 0) === 0) dfs(id);
  dag.forEach((arr, k) => {
    dag.set(
      k,
      Array.from(new Set(arr)).sort((a: string, b: string) => a.localeCompare(b))
    );
  });

  const indeg = new Map<string, number>();
  for (const id of ids) indeg.set(id, 0);
  dag.forEach((arr) => {
    for (const v of arr) indeg.set(v, (indeg.get(v) || 0) + 1);
  });

  const q = ids.filter((id) => (indeg.get(id) || 0) === 0).slice().sort((a, b) => a.localeCompare(b));
  const level = new Map<string, number>();
  for (const id of ids) level.set(id, 0);
  while (q.length) {
    const u = q.shift()!;
    const base = level.get(u) || 0;
    for (const v of dag.get(u) || []) {
      level.set(v, Math.max(level.get(v) || 0, base + 1));
      indeg.set(v, (indeg.get(v) || 0) - 1);
      if ((indeg.get(v) || 0) === 0) q.push(v);
    }
    q.sort((a, b) => a.localeCompare(b));
  }

  const byLevel = new Map<number, string[]>();
  for (const id of ids) {
    const lv = level.get(id) || 0;
    const arr = byLevel.get(lv) || [];
    arr.push(id);
    byLevel.set(lv, arr);
  }
  byLevel.forEach((arr, k) => byLevel.set(k, arr.slice().sort((a, b) => a.localeCompare(b))));

  const levels = Array.from(byLevel.keys()).sort((a, b) => a - b);
  const posById = new Map<string, { x: number; y: number }>();
  for (const lv of levels) {
    const arr = byLevel.get(lv) || [];
    for (let i = 0; i < arr.length; i++) {
      posById.set(arr[i], { x: snap(i * colStep), y: snap(lv * rowStep) });
    }
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const id of ids) {
    const n = nodes.find((x) => x.id === id);
    const p = posById.get(id);
    if (!n || !p) continue;
    const s = nodeSizeForTitle(n.shape, n.title);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + s.w);
    maxY = Math.max(maxY, p.y + s.h);
  }
  if (!Number.isFinite(minX)) minX = 0;
  if (!Number.isFinite(minY)) minY = 0;
  if (!Number.isFinite(maxX)) maxX = 0;
  if (!Number.isFinite(maxY)) maxY = 0;

  const norm = new Map<string, { x: number; y: number }>();
  posById.forEach((p, id) => norm.set(id, { x: snap(p.x - minX), y: snap(p.y - minY) }));

  return { posById: norm, bounds: { minX: 0, minY: 0, w: snap(maxX - minX), h: snap(maxY - minY) } };
}

function arrangeFallbackLayered(nodes: FlowNode[], edges: FlowEdge[]) {
  const nodeById = new Map(nodes.map((n) => [n.id, n] as const));
  const nodeIds = nodes.map((n) => n.id).slice().sort((a, b) => a.localeCompare(b));

  let maxW = 0;
  let maxH = 0;
  for (const n of nodes) {
    const s = nodeSizeForTitle(n.shape, n.title);
    maxW = Math.max(maxW, s.w);
    maxH = Math.max(maxH, s.h);
  }
  const colStep = snap(maxW + Math.max(140, Math.round(maxW * 0.6)));
  const rowStep = snap(maxH + Math.max(110, Math.round(maxH * 0.8)));

  const comps = buildComponents(nodeIds, edges);
  const posById = new Map<string, { x: number; y: number }>();

  const gapX = snap(maxW + 220);
  const gapY = snap(maxH + 180);
  let mainW = 0;
  let fnCursorY = 0;

  for (let i = 0; i < comps.length; i++) {
    const ids = comps[i];
    const laid = layoutComponent(nodes, edges, ids, colStep, rowStep);
    const isMain = ids.some((x) => !x.startsWith("fn_"));

    let offX = 0;
    let offY = 0;
    if (isMain && i === 0) {
      mainW = laid.bounds.w;
      fnCursorY = 0;
    } else {
      offX = mainW + gapX;
      offY = fnCursorY;
      fnCursorY += laid.bounds.h + gapY;
    }

    laid.posById.forEach((p, id) => {
      posById.set(id, { x: snap(p.x + offX), y: snap(p.y + offY) });
    });
  }

  const nextNodes: FlowNode[] = nodes.map((n) => {
    const p = posById.get(n.id);
    return p ? { ...n, x: p.x, y: p.y } : n;
  });

  const nextNodesById = new Map(nextNodes.map((n) => [n.id, n] as const));
  const nextEdges: FlowEdge[] = edges.map((e) => {
    if (e.toEdge) return e;
    const fromNode = nodeById.get(e.from);
    const toNode = nodeById.get(e.to);
    if (!fromNode || !toNode) return e;

    const fp = nextNodesById.get(e.from);
    const tp = nextNodesById.get(e.to);
    const back = !!fp && !!tp && tp.y <= fp.y;

    let fromPort: PortSide | undefined;
    let toPort: PortSide | undefined;
    if (back) {
      fromPort = "left";
      toPort = "left";
    } else if (fromNode.shape === "decision") {
      fromPort = isNoEdge(e) ? "right" : "bottom";
      toPort = "top";
    } else {
      fromPort = "bottom";
      toPort = "top";
    }

    return {
      ...e,
      style: "straight",
      routeMode: "auto",
      routeShape: undefined,
      anchor: null,
      anchors: undefined,
      fromPort,
      toPort,
      fromDir: undefined,
      toDir: undefined,
      fromFree: null,
      toFree: null,
    };
  });

  return { nodes: nextNodes, edges: nextEdges };
}

export async function arrangeWithGraphviz(
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
    const nextEdges = edges.map((e) => {
      if (e.toEdge) return e;
      const p = hit.edges.get(e.id);
      if (!p) return e;
      return {
        ...e,
        fromPort: p.fromPort ?? e.fromPort,
        toPort: p.toPort ?? e.toPort,
        style: p.style ?? e.style,
        routeMode: p.routeMode ?? e.routeMode,
        routeShape: p.routeShape ?? e.routeShape,
        anchor: p.anchor ?? e.anchor,
        anchors: p.anchors ?? e.anchors,
        fromAttach: p.fromAttach === undefined ? e.fromAttach : p.fromAttach,
        toAttach: p.toAttach === undefined ? e.toAttach : p.toAttach,
        labelPosition: p.labelPosition === undefined ? e.labelPosition : p.labelPosition,
        fromDir: undefined,
        toDir: undefined,
        fromFree: null,
        toFree: null,
      };
    });
    return { nodes: nextNodes, edges: nextEdges };
  }

  const sortedNodes = nodes.slice().sort((a, b) => a.id.localeCompare(b.id));
  const sortedEdges = edges.slice().sort((a, b) => a.id.localeCompare(b.id));

  let applied: { nodes: FlowNode[]; edges: FlowEdge[] };
  try {
    const params = { ...DEFAULT_BEAUTIFY_PARAMS, rankdir: "TB" as const, splines: "spline" as const, engine: "dot" as const };
    const mapping = buildDot(sortedNodes, sortedEdges, params);
    const rendered = await renderGraphviz(mapping.dot, params.engine, ["plain"]);
    applied = applyPlainLayoutToCanvas(sortedNodes, sortedEdges, rendered.plain || "", mapping.nameById);
  } catch {
    applied = arrangeFallbackLayered(sortedNodes, sortedEdges);
  }

  const nodesMap = new Map<string, { x: number; y: number }>();
  for (const n of applied.nodes) nodesMap.set(n.id, { x: n.x, y: n.y });
  const edgesMap: CachedLayout["edges"] = new Map();
  for (const e of applied.edges) {
    if (e.toEdge) continue;
    edgesMap.set(e.id, {
      fromPort: e.fromPort,
      toPort: e.toPort,
      style: e.style,
      routeMode: e.routeMode,
      routeShape: e.routeShape,
      anchor: e.anchor,
      anchors: e.anchors,
      fromAttach: e.fromAttach,
      toAttach: e.toAttach,
      labelPosition: e.labelPosition,
    });
  }
  cacheSet(key, { nodes: nodesMap, edges: edgesMap });

  const appliedNodeById = new Map(applied.nodes.map((n) => [n.id, n] as const));
  const appliedEdgeById = new Map(applied.edges.map((e) => [e.id, e] as const));

  const outNodes = nodes.map((n) => {
    const a = appliedNodeById.get(n.id);
    return a ? { ...n, x: a.x, y: a.y } : n;
  });
  const outEdges = edges.map((e) => {
    if (e.toEdge) return e;
    const a = appliedEdgeById.get(e.id);
    if (!a) return e;
    return {
      ...e,
      style: a.style,
      routeMode: a.routeMode,
      routeShape: a.routeShape,
      anchor: a.anchor,
      anchors: a.anchors,
      fromPort: a.fromPort,
      toPort: a.toPort,
      fromAttach: a.fromAttach,
      toAttach: a.toAttach,
      labelPosition: a.labelPosition,
      fromDir: undefined,
      toDir: undefined,
      fromFree: null,
      toFree: null,
    };
  });

  return { nodes: outNodes, edges: outEdges };
}

export function __resetGraphvizLayoutCacheForTest() {
  layoutCache.clear();
}
