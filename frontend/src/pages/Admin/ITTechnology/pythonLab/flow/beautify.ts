import type { FlowEdge, FlowNode } from "./model";
import { nodeSizeForTitle } from "./ports";
import { renderGraphviz } from "./graphviz";

export type FlowBeautifyRankdir = "TB" | "LR";

export type FlowBeautifyTheme = "light";

export type FlowBeautifyEngine = "dot" | "neato" | "fdp";

export type FlowBeautifySplines = "spline" | "polyline" | "ortho";

export type FlowBeautifyParams = {
  rankdir: FlowBeautifyRankdir;
  nodesep: number;
  ranksep: number;
  theme: FlowBeautifyTheme;
  engine: FlowBeautifyEngine;
  splines: FlowBeautifySplines;
  concentrate: boolean;
  fontSize: number;
  pad: number;
};

export type FlowBeautifyThresholds = {
  maxNodes: number;
  maxCrossings: number;
  minContrast: number;
  maxFlowAngle: number;
};

export type FlowBeautifyMetric = {
  name: string;
  value: number;
  pass: boolean;
  thresholdText: string;
};

export type FlowBeautifyResult = {
  dot: string;
  svg: string;
  plain: string;
  layout: { nodes: FlowNode[]; edges: FlowEdge[] };
  metrics: FlowBeautifyMetric[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    crossings: number;
    contrast: number;
    flowAngle: number;
  };
};

export const DEFAULT_BEAUTIFY_PARAMS: FlowBeautifyParams = {
  rankdir: "TB",
  nodesep: 0.35,
  ranksep: 0.55,
  theme: "light",
  engine: "dot",
  splines: "spline",
  concentrate: true,
  fontSize: 12,
  pad: 0.15,
};

export const DEFAULT_BEAUTIFY_THRESHOLDS: FlowBeautifyThresholds = {
  maxNodes: 25,
  maxCrossings: 3,
  minContrast: 4.5,
  maxFlowAngle: 15,
};

function clamp(v: number, lo: number, hi: number) {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

function escapeDotLabel(s: string) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function dotNodeShape(n: FlowNode): { shape: string; style?: string; peripheries?: number } {
  if (n.shape === "start_end") return { shape: "oval" };
  if (n.shape === "process") return { shape: "box", style: "rounded" };
  if (n.shape === "decision") return { shape: "diamond" };
  if (n.shape === "io") return { shape: "parallelogram" };
  if (n.shape === "connector") return { shape: "circle" };
  if (n.shape === "subroutine") return { shape: "box", style: "rounded", peripheries: 2 };
  return { shape: "box" };
}

function themeColors(theme: FlowBeautifyTheme) {
  if (theme === "light") {
    return {
      bg: "#ffffff",
      text: "#111111",
      edge: "#595959",
      nodeBorder: "#595959",
      nodeFill: "#ffffff",
    };
  }
  return { bg: "#ffffff", text: "#111111", edge: "#595959", nodeBorder: "#595959", nodeFill: "#ffffff" };
}

function buildNameMaps(nodes: FlowNode[], reuse?: Map<string, string>) {
  const idByName = new Map<string, string>();
  const nameById = new Map<string, string>();
  const nodeIds = nodes.map((n) => n.id);
  for (let i = 0; i < nodeIds.length; i++) {
    const id = nodeIds[i];
    const name = reuse?.get(id) || `n_${i + 1}`;
    nameById.set(id, name);
    idByName.set(name, id);
  }
  return { idByName, nameById };
}

function buildDotInternal(params: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  beautify: FlowBeautifyParams;
  reuseNameById?: Map<string, string>;
  mode: "display" | "mapping";
}) {
  const { nodes, edges, beautify, reuseNameById, mode } = params;
  const { idByName, nameById } = buildNameMaps(nodes, reuseNameById);
  const edgeNameById = mode === "mapping" ? new Map<string, string>() : null;

  const colors = themeColors(beautify.theme);
  const rankdir = beautify.rankdir;
  const nodesep = clamp(beautify.nodesep, 0.05, 2.5);
  const ranksep = clamp(beautify.ranksep, 0.05, 3.5);
  const fontSize = clamp(beautify.fontSize, 8, 22);
  const pad = clamp(beautify.pad, 0, 1.5);
  const splines = beautify.splines === "ortho" ? "ortho" : beautify.splines === "polyline" ? "polyline" : "spline";
  const concentrate = !!beautify.concentrate;

  const nodeLines: string[] = [];
  for (const n of nodes) {
    const gv = nameById.get(n.id);
    if (!gv) continue;
    const s = dotNodeShape(n);
    const label = escapeDotLabel((n.title || "").trim()) || n.id;
    const size = nodeSizeForTitle(n.shape, n.title);
    const wIn = clamp(size.w / 72, 0.4, 6);
    const hIn = clamp(size.h / 72, 0.25, 4);
    const attrs: string[] = [];
    attrs.push(`label="${label}"`);
    attrs.push(`shape=${s.shape}`);
    if (s.style) attrs.push(`style="${s.style},filled"`);
    else attrs.push(`style="filled"`);
    if (typeof s.peripheries === "number") attrs.push(`peripheries=${s.peripheries}`);
    attrs.push(`color="${colors.nodeBorder}"`);
    attrs.push(`fillcolor="${colors.nodeFill}"`);
    attrs.push(`fontcolor="${colors.text}"`);
    attrs.push(`fontsize=${fontSize.toFixed(0)}`);
    attrs.push(`fixedsize=true`);
    attrs.push(`width=${wIn.toFixed(3)}`);
    attrs.push(`height=${hIn.toFixed(3)}`);
    nodeLines.push(`  ${gv} [${attrs.join(", ")}];`);
  }

  const edgeBaseAttrs: string[] = [];
  edgeBaseAttrs.push(`color="${colors.edge}"`);
  edgeBaseAttrs.push(`fontcolor="${colors.text}"`);
  edgeBaseAttrs.push(`fontsize=${Math.max(8, Math.round(fontSize - 1))}`);

  const edgeLines: string[] = [];
  const helperNodeLines: string[] = [];
  let edgeSeq = 0;
  for (const e of edges) {
    if (e.toEdge) continue;
    const from = nameById.get(e.from);
    const to = nameById.get(e.to);
    if (!from || !to) continue;
    const label = e.label && String(e.label).trim() ? escapeDotLabel(String(e.label).trim()) : "";

    if (mode === "display") {
      const attrs = edgeBaseAttrs.slice();
      if (label) attrs.push(`label="${label}"`);
      edgeLines.push(`  ${from} -> ${to} [${attrs.join(", ")}];`);
      continue;
    }

    edgeSeq += 1;
    const helper = `e_${edgeSeq}`;
    edgeNameById!.set(e.id, helper);
    helperNodeLines.push(`  ${helper} [shape=point, width=0.01, height=0.01, label="", fixedsize=true, style="invis"];`);
    edgeLines.push(`  ${from} -> ${helper} [${edgeBaseAttrs.concat([`arrowhead=none`]).join(", ")}];`);
    const attrs2 = edgeBaseAttrs.slice();
    if (label) attrs2.push(`label="${label}"`);
    edgeLines.push(`  ${helper} -> ${to} [${attrs2.join(", ")}];`);
  }

  const dot = [
    `digraph G {`,
    `  graph [rankdir=${rankdir}, nodesep=${nodesep.toFixed(3)}, ranksep=${ranksep.toFixed(3)}, bgcolor="${colors.bg}", splines=${splines}, concentrate=${concentrate ? "true" : "false"}, pad=${pad.toFixed(3)}];`,
    `  node [margin="0.10,0.06"];`,
    `  edge [arrowsize=0.8];`,
    ...nodeLines,
    ...helperNodeLines,
    ...edgeLines,
    `}`,
  ].join("\n");

  return { dot, nameById, idByName, edgeNameById };
}

export function buildDotDisplay(
  nodes: FlowNode[],
  edges: FlowEdge[],
  params: FlowBeautifyParams,
  reuseNameById?: Map<string, string>
): { dot: string; nameById: Map<string, string>; idByName: Map<string, string> } {
  const res = buildDotInternal({ nodes, edges, beautify: params, reuseNameById, mode: "display" });
  return { dot: res.dot, nameById: res.nameById, idByName: res.idByName };
}

export function buildDot(
  nodes: FlowNode[],
  edges: FlowEdge[],
  params: FlowBeautifyParams
): { dot: string; nameById: Map<string, string>; idByName: Map<string, string>; edgeNameById: Map<string, string> } {
  const res = buildDotInternal({ nodes, edges, beautify: params, mode: "mapping" });
  if (!res.edgeNameById) throw new Error("edgeNameById missing");
  return { dot: res.dot, nameById: res.nameById, idByName: res.idByName, edgeNameById: res.edgeNameById };
}

type PlainGraph = {
  widthIn: number;
  heightIn: number;
  nodes: Map<string, { cxIn: number; cyIn: number; wIn: number; hIn: number }>;
  edges: Map<string, { points: { xIn: number; yIn: number }[] }[]>;
};

export function parsePlain(plain: string): PlainGraph {
  const lines = String(plain || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!lines.length) throw new Error("Graphviz plain 输出为空");
  const head = lines[0].split(/\s+/);
  if (head[0] !== "graph" || head.length < 3) throw new Error("Graphviz plain 头部解析失败");
  const widthIn = Number(head[1]);
  const heightIn = Number(head[2]);
  const nodes = new Map<string, { cxIn: number; cyIn: number; wIn: number; hIn: number }>();
  const edges = new Map<string, { points: { xIn: number; yIn: number }[] }[]>();
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(/\s+/);
    if (!parts.length) continue;
    if (parts[0] !== "node") continue;
    if (parts.length < 6) continue;
    const name = parts[1];
    const cxIn = Number(parts[2]);
    const cyIn = Number(parts[3]);
    const wIn = Number(parts[4]);
    const hIn = Number(parts[5]);
    if (!name || !Number.isFinite(cxIn) || !Number.isFinite(cyIn) || !Number.isFinite(wIn) || !Number.isFinite(hIn)) continue;
    nodes.set(name, { cxIn, cyIn, wIn, hIn });
  }
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(/\s+/);
    if (!parts.length) continue;
    if (parts[0] !== "edge") continue;
    if (parts.length < 4) continue;
    const from = parts[1];
    const to = parts[2];
    const n = Number(parts[3]);
    if (!from || !to || !Number.isFinite(n) || n < 2) continue;
    const need = 4 + n * 2;
    if (parts.length < need) continue;
    const pts: { xIn: number; yIn: number }[] = [];
    for (let k = 0; k < n; k++) {
      const xIn = Number(parts[4 + k * 2]);
      const yIn = Number(parts[4 + k * 2 + 1]);
      if (!Number.isFinite(xIn) || !Number.isFinite(yIn)) continue;
      pts.push({ xIn, yIn });
    }
    if (pts.length >= 2) {
      const key = `${from}__${to}`;
      const arr = edges.get(key) || [];
      arr.push({ points: pts });
      edges.set(key, arr);
    }
  }
  return { widthIn, heightIn, nodes, edges };
}

export function applyPlainLayoutToCanvas(
  nodes: FlowNode[],
  edges: FlowEdge[],
  plain: string,
  nameById: Map<string, string>,
  edgeNameById: Map<string, string>
) {
  const simplifyFree = (pts: { x: number; y: number }[]) => {
    const minDist = 8;
    const out1: { x: number; y: number }[] = [];
    for (const p of pts) {
      const last = out1[out1.length - 1];
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < minDist) continue;
      out1.push(p);
    }
    if (out1.length <= 2) return out1;
    const out2: { x: number; y: number }[] = [out1[0]];
    for (let i = 1; i < out1.length - 1; i++) {
      const a = out2[out2.length - 1];
      const b = out1[i];
      const c = out1[i + 1];
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const bcx = c.x - b.x;
      const bcy = c.y - b.y;
      const cross = Math.abs(abx * bcy - aby * bcx);
      const dot = abx * bcx + aby * bcy;
      const ab = Math.hypot(abx, aby);
      const bc = Math.hypot(bcx, bcy);
      const nearColinear = ab > 1e-6 && bc > 1e-6 ? cross / (ab * bc) < 0.02 : true;
      if (nearColinear && dot > 0) continue;
      out2.push(b);
    }
    out2.push(out1[out1.length - 1]);
    if (out2.length <= 14) return out2;
    const first = out2[0];
    const last = out2[out2.length - 1];
    const keep: { x: number; y: number }[] = [first];
    const k = 12;
    for (let i = 1; i < k - 1; i++) {
      const idx = Math.round((i * (out2.length - 1)) / (k - 1));
      keep.push(out2[Math.max(1, Math.min(out2.length - 2, idx))]);
    }
    keep.push(last);
    return keep;
  };

  const parsed = parsePlain(plain);
  const pxPerIn = 72;
  const graphH = parsed.heightIn * pxPerIn;

  const nextNodes: FlowNode[] = nodes.map((n) => {
    const gv = nameById.get(n.id);
    if (!gv) return { ...(n as any) };
    const p = parsed.nodes.get(gv);
    if (!p) return { ...(n as any) };
    const size = nodeSizeForTitle(n.shape, n.title);
    const cx = p.cxIn * pxPerIn;
    const cy = (parsed.heightIn - p.cyIn) * pxPerIn;
    const x = cx - size.w / 2;
    const y = cy - size.h / 2;
    return { ...(n as any), x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10 };
  });

  const nextEdges: FlowEdge[] = edges.map((e) => {
    if (e.toEdge) return e;
    const from = nameById.get(e.from);
    const to = nameById.get(e.to);
    const helper = edgeNameById.get(e.id);
    if (!from || !to || !helper) return { ...e, style: "straight", routeMode: "auto", anchor: null, anchors: undefined };
    const p1 = parsed.edges.get(`${from}__${helper}`)?.[0]?.points ?? null;
    const p2 = parsed.edges.get(`${helper}__${to}`)?.[0]?.points ?? null;
    if (!p1 || !p2) return { ...e, style: "straight", routeMode: "auto", anchor: null, anchors: undefined };
    const merged = p1.concat(p2.slice(1));
    const poly0 = merged
      .map((p) => ({ x: p.xIn * pxPerIn, y: (parsed.heightIn - p.yIn) * pxPerIn }))
      .map((p) => ({ x: Number(p.x.toFixed(1)), y: Number(p.y.toFixed(1)) }));
    const poly = simplifyFree(poly0);
    if (poly.length <= 2) return { ...e, style: "straight", routeMode: "auto", anchor: null, anchors: undefined };
    const dir0 = { dx: poly[1].x - poly[0].x, dy: poly[1].y - poly[0].y };
    const dir1 = { dx: poly[poly.length - 1].x - poly[poly.length - 2].x, dy: poly[poly.length - 1].y - poly[poly.length - 2].y };
    const abs0x = Math.abs(dir0.dx);
    const abs0y = Math.abs(dir0.dy);
    const abs1x = Math.abs(dir1.dx);
    const abs1y = Math.abs(dir1.dy);
    const fromPort = abs0x >= abs0y ? (dir0.dx >= 0 ? "right" : "left") : dir0.dy >= 0 ? "bottom" : "top";
    const toPort = abs1x >= abs1y ? (dir1.dx >= 0 ? "left" : "right") : dir1.dy >= 0 ? "top" : "bottom";
    const middle = poly.slice(1, poly.length - 1);
    return { ...e, style: "polyline", routeMode: "manual", routeShape: "free", fromPort, toPort, anchor: null, anchors: middle };
  });

  return { nodes: nextNodes, edges: nextEdges, graphHeightPx: graphH };
}

function srgbToLin(c: number) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminance(hex: string) {
  const s = String(hex || "").trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(s);
  if (!m) return 1;
  const v = m[1];
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  const R = srgbToLin(r);
  const G = srgbToLin(g);
  const B = srgbToLin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(fg: string, bg: string) {
  const L1 = luminance(fg);
  const L2 = luminance(bg);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
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

function centers(nodes: FlowNode[]) {
  const m = new Map<string, { cx: number; cy: number }>();
  for (const n of nodes) {
    const s = nodeSizeForTitle(n.shape, n.title);
    m.set(n.id, { cx: n.x + s.w / 2, cy: n.y + s.h / 2 });
  }
  return m;
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

function flowAngle(nodes: FlowNode[], edges: FlowEdge[], rankdir: FlowBeautifyRankdir) {
  const c = centers(nodes);
  const es = edges.filter((e) => !e.toEdge && c.has(e.from) && c.has(e.to));
  const angles: number[] = [];
  for (const e of es) {
    const a = c.get(e.from)!;
    const b = c.get(e.to)!;
    const dx = b.cx - a.cx;
    const dy = b.cy - a.cy;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) continue;
    if (Math.abs(dx) + Math.abs(dy) < 1e-6) continue;
    const deg = (Math.atan2(rankdir === "TB" ? dx : dy, rankdir === "TB" ? dy : dx) * 180) / Math.PI;
    angles.push(Math.abs(deg));
  }
  if (!angles.length) return 0;
  angles.sort((a, b) => a - b);
  const p95 = angles[Math.min(angles.length - 1, Math.floor(angles.length * 0.95))];
  return p95;
}

export async function computeBeautify(nodes: FlowNode[], edges: FlowEdge[], params: FlowBeautifyParams, thresholds: FlowBeautifyThresholds = DEFAULT_BEAUTIFY_THRESHOLDS): Promise<FlowBeautifyResult> {
  const mapping = buildDot(nodes, edges, params);
  const display = buildDotDisplay(nodes, edges, params, mapping.nameById);
  const renderedDisplay = await renderGraphviz(display.dot, params.engine ?? "dot", ["svg"]);
  const renderedMapping = await renderGraphviz(mapping.dot, params.engine ?? "dot", ["plain"]);
  const applied = applyPlainLayoutToCanvas(nodes, edges, renderedMapping.plain || "", mapping.nameById, mapping.edgeNameById);
  const afterNodes = applied.nodes;
  const afterEdges = applied.edges;

  const colors = themeColors(params.theme);
  const nodeCount = afterNodes.length;
  const edgeCount = afterEdges.length;
  const crossings = crossingCount(afterNodes, afterEdges);
  const contrast = contrastRatio(colors.text, colors.nodeFill);
  const angle = flowAngle(afterNodes, afterEdges, params.rankdir);

  const metrics: FlowBeautifyMetric[] = [
    { name: "nodes", value: nodeCount, pass: nodeCount <= thresholds.maxNodes, thresholdText: `≤${thresholds.maxNodes}` },
    { name: "crossings", value: crossings, pass: crossings <= thresholds.maxCrossings, thresholdText: `≤${thresholds.maxCrossings}` },
    { name: "contrast", value: Number(contrast.toFixed(2)), pass: contrast >= thresholds.minContrast, thresholdText: `≥${thresholds.minContrast}` },
    { name: "flowAngle", value: Number(angle.toFixed(1)), pass: angle <= thresholds.maxFlowAngle, thresholdText: `≤${thresholds.maxFlowAngle}°` },
  ];

  return {
    dot: display.dot,
    svg: renderedDisplay.svg || "",
    plain: renderedMapping.plain || "",
    layout: { nodes: afterNodes, edges: afterEdges },
    metrics,
    stats: { nodeCount, edgeCount, crossings, contrast: Number(contrast.toFixed(2)), flowAngle: Number(angle.toFixed(1)) },
  };
}
