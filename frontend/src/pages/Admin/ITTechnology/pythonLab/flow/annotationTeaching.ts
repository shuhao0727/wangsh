import type { FlowEdge, FlowNode } from "./model";
import { nodeSizeForTitle } from "./ports";

const isAnnotationNode = (n: FlowNode) => n.type === "annotation" || n.shape === "note";

const rectOverlapArea = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
) => {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x1 || y2 <= y1) return 0;
  return (x2 - x1) * (y2 - y1);
};

export const normalizeAnnotationForTeaching = (nodes: FlowNode[], edges: FlowEdge[]) => {
  const normalizedNodes = nodes.map((n) =>
    n.shape === "note" ? { ...n, type: "annotation" as const, shape: "note" as const } : n
  );
  const flowNodes = normalizedNodes.filter((n) => !isAnnotationNode(n));
  const annotationNodes = normalizedNodes.filter((n) => isAnnotationNode(n));
  const flowIds = new Set(flowNodes.map((n) => n.id));
  const flowNodeMap = new Map(flowNodes.map((n) => [n.id, n]));
  const placedRects = flowNodes.map((n) => {
    const s = nodeSizeForTitle(n.shape, n.title);
    return { x: n.x, y: n.y, w: n.width ?? s.w, h: n.height ?? s.h };
  });

  const placedAnnotations = annotationNodes.map((n) => {
    const size = nodeSizeForTitle("note", n.title || "");
    const width = n.width ?? size.w;
    const height = n.height ?? size.h;
    const linkedEdge =
      edges.find((e) => e.from === n.id && flowIds.has(e.to)) ||
      edges.find((e) => e.to === n.id && flowIds.has(e.from));
    const targetId = linkedEdge ? (flowIds.has(linkedEdge.to) ? linkedEdge.to : linkedEdge.from) : null;
    const target = targetId ? flowNodeMap.get(targetId) : null;
    if (!target) {
      placedRects.push({ x: n.x, y: n.y, w: width, h: height });
      return { ...n, type: "annotation" as const, shape: "note" as const, width, height };
    }
    const ts = nodeSizeForTitle(target.shape, target.title);
    const targetW = target.width ?? ts.w;
    const targetH = target.height ?? ts.h;
    const gap = 42;
    const candidates = [
      { x: target.x + targetW + gap, y: target.y + (targetH - height) / 2 },
      { x: target.x - width - gap, y: target.y + (targetH - height) / 2 },
      { x: target.x + (targetW - width) / 2, y: target.y - height - gap },
      { x: target.x + (targetW - width) / 2, y: target.y + targetH + gap },
    ];
    let best = candidates[0];
    let bestScore = Number.POSITIVE_INFINITY;
    for (const c of candidates) {
      const rect = { x: Math.round(c.x), y: Math.round(c.y), w: width, h: height };
      const overlap = placedRects.reduce((sum, r) => sum + rectOverlapArea(rect, r), 0);
      const dx = rect.x + width / 2 - (target.x + targetW / 2);
      const dy = rect.y + height / 2 - (target.y + targetH / 2);
      const distancePenalty = Math.abs(Math.hypot(dx, dy) - (targetW / 2 + width / 2 + gap));
      const score = overlap * 1000 + distancePenalty;
      if (score < bestScore) {
        bestScore = score;
        best = rect;
      }
    }
    placedRects.push({ x: best.x, y: best.y, w: width, h: height });
    return {
      ...n,
      type: "annotation" as const,
      shape: "note" as const,
      x: best.x,
      y: best.y,
      width,
      height,
      arrow: { target: { x: target.x + targetW / 2, y: target.y + targetH / 2 } },
    };
  });

  const cleanedEdges = edges.filter((e) => !placedAnnotations.some((n) => n.id === e.from || n.id === e.to));
  const outNodes = normalizedNodes.map((n) => {
    const hit = placedAnnotations.find((a) => a.id === n.id);
    return hit ?? n;
  });
  return { nodes: outNodes, edges: cleanedEdges };
};
