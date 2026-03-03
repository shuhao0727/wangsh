import { useEffect, useRef, useState } from "react";
import type { FlowEdge, FlowNode } from "../flow/model";
import { edgePolylinePoints, nearestTOnPolyline, pointAtT } from "../flow/geometry";
import type { CanvasMetric } from "./useEdgeGeometries";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const fmt = (v: number) => Number(v.toFixed(4));

const toAttachFromAbsPointOnBBox = (m: CanvasMetric, abs: { x: number; y: number }) => {
  const w = m.w || 1;
  const h = m.h || 1;
  const left = m.cx - w / 2;
  const top = m.cy - h / 2;
  return { x: fmt(clamp01((abs.x - left) / w)), y: fmt(clamp01((abs.y - top) / h)) };
};

const closestPointOnBBox = (m: CanvasMetric, p: { x: number; y: number }) => {
  const left = m.cx - m.w / 2;
  const right = m.cx + m.w / 2;
  const top = m.cy - m.h / 2;
  const bottom = m.cy + m.h / 2;

  if (p.x < left) return { x: left, y: Math.max(top, Math.min(bottom, p.y)) };
  if (p.x > right) return { x: right, y: Math.max(top, Math.min(bottom, p.y)) };
  if (p.y < top) return { x: Math.max(left, Math.min(right, p.x)), y: top };
  if (p.y > bottom) return { x: Math.max(left, Math.min(right, p.x)), y: bottom };

  const dl = p.x - left;
  const dr = right - p.x;
  const dt = p.y - top;
  const db = bottom - p.y;
  const min = Math.min(dl, dr, dt, db);
  if (min === dl) return { x: left, y: p.y };
  if (min === dr) return { x: right, y: p.y };
  if (min === dt) return { x: p.x, y: top };
  return { x: p.x, y: bottom };
};

const distToBBox = (m: CanvasMetric, p: { x: number; y: number }) => {
  const dx = Math.max(0, Math.abs(p.x - m.cx) - m.w / 2);
  const dy = Math.max(0, Math.abs(p.y - m.cy) - m.h / 2);
  return Math.hypot(dx, dy);
};

export function useFlowCanvasInteractions(params: {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  scale: number;
  offsetX: number;
  offsetY: number;
  setOffsetX: React.Dispatch<React.SetStateAction<number>>;
  setOffsetY: React.Dispatch<React.SetStateAction<number>>;
  connectMode: boolean;
  panMode: boolean;
  nodes: FlowNode[];
  edges: FlowEdge[];
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<FlowEdge[]>>;
  canvasMetricsRef: React.MutableRefObject<Map<string, CanvasMetric>>;
  edgeGeometryCacheRef: React.MutableRefObject<Map<string, any>>;
  onSemanticEdit?: () => void;
}) {
  const { canvasRef, scale, offsetX, offsetY, setOffsetX, setOffsetY, connectMode, panMode, nodes, setNodes, setEdges, canvasMetricsRef, edgeGeometryCacheRef, onSemanticEdit } = params;

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const nodeOffsetRef = useRef<{ dx: number; dy: number } | null>(null);

  const [draggingAnchor, setDraggingAnchor] = useState<{ edgeId: string; index: number } | null>(null);
  const anchorOffsetRef = useRef<{ dx: number; dy: number } | null>(null);

  const [draggingTargetEdgeId, setDraggingTargetEdgeId] = useState<string | null>(null);
  const targetOffsetRef = useRef<{ dx: number; dy: number } | null>(null);

  const [draggingSourceEdgeId, setDraggingSourceEdgeId] = useState<string | null>(null);
  const sourceOffsetRef = useRef<{ dx: number; dy: number } | null>(null);

  const [panning, setPanning] = useState(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; offsetX: number; offsetY: number } | null>(null);
  const panSuppressClickRef = useRef(false);

  useEffect(() => {
    if (!draggingNodeId) return;
    const handleMove = (e: PointerEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const offset = nodeOffsetRef.current;
      if (!offset) return;
      const snap = (v: number) => Math.round(v / 10) * 10;
      const x = snap((e.clientX - rect.left - offsetX) / scale - offset.dx);
      const y = snap((e.clientY - rect.top - offsetY) / scale - offset.dy);
      setNodes((prev) => prev.map((n) => (n.id === draggingNodeId ? { ...n, x, y } : n)));
    };
    const handleUp = () => {
      setDraggingNodeId(null);
      nodeOffsetRef.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [canvasRef, draggingNodeId, offsetX, offsetY, scale, setNodes]);

  useEffect(() => {
    if (!draggingAnchor) return;
    const handleMove = (e: PointerEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const offset = anchorOffsetRef.current;
      if (!offset) return;
      const snap = (v: number) => Math.round(v / 10) * 10;
      const rawX = (e.clientX - rect.left - offsetX) / scale - offset.dx;
      const rawY = (e.clientY - rect.top - offsetY) / scale - offset.dy;
      setEdges((prev) =>
        prev.map((ed) => {
          if (ed.id !== draggingAnchor.edgeId) return ed;
          const list = (ed.anchors && ed.anchors.length ? ed.anchors : ed.anchor ? [ed.anchor] : []).slice();
          if (draggingAnchor.index < 0 || draggingAnchor.index >= list.length) return ed;
          const geom = edgeGeometryCacheRef.current.get(ed.id);
          let x = snap(rawX);
          let y = snap(rawY);
          if (geom) {
            const margin = 220;
            const minX = Math.min(geom.start.x, geom.end.x) - margin;
            const maxX = Math.max(geom.start.x, geom.end.x) + margin;
            const minY = Math.min(geom.start.y, geom.end.y) - margin;
            const maxY = Math.max(geom.start.y, geom.end.y) + margin;
            x = Math.max(minX, Math.min(maxX, x));
            y = Math.max(minY, Math.min(maxY, y));
          }
          list[draggingAnchor.index] = { x, y };
          if (geom) {
            const provisional = edgePolylinePoints({ start: geom.start, end: geom.end, style: "polyline", anchors: list });
            const withT = list.map((pt) => ({ pt, t: nearestTOnPolyline(provisional, pt) }));
            withT.sort((a, b) => a.t - b.t);
            const sorted = withT.map((v) => v.pt);
            return { ...ed, style: "polyline", routeMode: "manual", anchors: sorted, anchor: null };
          }
          return { ...ed, style: "polyline", routeMode: "manual", anchors: list, anchor: null };
        })
      );
    };
    const handleUp = () => {
      setDraggingAnchor(null);
      anchorOffsetRef.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [canvasRef, draggingAnchor, edgeGeometryCacheRef, offsetX, offsetY, scale, setEdges]);

  useEffect(() => {
    if (!draggingTargetEdgeId) return;
    const handleMove = (e: PointerEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const offset = targetOffsetRef.current;
      if (!offset) return;
      const px = (e.clientX - rect.left - offsetX) / scale - offset.dx;
      const py = (e.clientY - rect.top - offsetY) / scale - offset.dy;

      setEdges((prev) =>
        prev.map((ed) => {
          if (ed.id !== draggingTargetEdgeId) return ed;
          const snapDist = 24;
          let best: { id: string; dist: number; m: CanvasMetric } | null = null;
          for (const n of nodes) {
            const m = canvasMetricsRef.current.get(n.id);
            if (!m) continue;
            const dist = distToBBox(m, { x: px, y: py });
            if (!best || dist < best.dist) best = { id: n.id, dist, m };
          }
          if (best && best.dist <= snapDist) {
            const snapPoint = closestPointOnBBox(best.m, { x: px, y: py });
            const attach = toAttachFromAbsPointOnBBox(best.m, snapPoint);
            return { ...ed, to: best.id, toAttach: attach, toPort: undefined, toDir: undefined, toFree: null, toEdge: undefined, toEdgeT: undefined };
          }
          if (ed.toEdge) {
            const targetGeom = edgeGeometryCacheRef.current.get(ed.toEdge);
            if (!targetGeom) {
              return { ...ed, toAttach: null, toPort: undefined, toDir: undefined, toFree: { x: px, y: py }, toEdge: undefined, toEdgeT: undefined };
            }
            const t = nearestTOnPolyline(targetGeom.poly, { x: px, y: py });
            const tp = pointAtT(targetGeom.poly, t);
            const detachDist = 28;
            if (Math.hypot(px - tp.x, py - tp.y) > detachDist) {
              return { ...ed, toAttach: null, toPort: undefined, toDir: undefined, toFree: { x: px, y: py }, toEdge: undefined, toEdgeT: undefined };
            }
            return { ...ed, toAttach: null, toPort: undefined, toDir: undefined, toEdgeT: t, toFree: null };
          }
          return { ...ed, toAttach: null, toPort: undefined, toDir: undefined, toFree: { x: px, y: py }, toEdge: undefined, toEdgeT: undefined };
        })
      );
    };
    const handleUp = () => {
      setDraggingTargetEdgeId(null);
      targetOffsetRef.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [canvasMetricsRef, canvasRef, draggingTargetEdgeId, edgeGeometryCacheRef, nodes, offsetX, offsetY, scale, setEdges]);

  useEffect(() => {
    if (!draggingSourceEdgeId) return;
    const handleMove = (e: PointerEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const offset = sourceOffsetRef.current;
      if (!offset) return;
      const px = (e.clientX - rect.left - offsetX) / scale - offset.dx;
      const py = (e.clientY - rect.top - offsetY) / scale - offset.dy;

      setEdges((prev) =>
        prev.map((ed) => {
          if (ed.id !== draggingSourceEdgeId) return ed;
          const snapDist = 24;
          let best: { id: string; dist: number; m: CanvasMetric } | null = null;
          for (const n of nodes) {
            const m = canvasMetricsRef.current.get(n.id);
            if (!m) continue;
            const dist = distToBBox(m, { x: px, y: py });
            if (!best || dist < best.dist) best = { id: n.id, dist, m };
          }
          if (best && best.dist <= snapDist) {
            const snapPoint = closestPointOnBBox(best.m, { x: px, y: py });
            const attach = toAttachFromAbsPointOnBBox(best.m, snapPoint);
            return { ...ed, from: best.id, fromAttach: attach, fromPort: undefined, fromDir: undefined, fromFree: null, routeMode: "manual" };
          }
          return { ...ed, fromAttach: null, fromPort: undefined, fromDir: undefined, fromFree: { x: px, y: py }, routeMode: "manual" };
        })
      );
    };
    const handleUp = () => {
      setDraggingSourceEdgeId(null);
      sourceOffsetRef.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [canvasMetricsRef, canvasRef, draggingSourceEdgeId, nodes, offsetX, offsetY, scale, setEdges]);

  useEffect(() => {
    if (!panning) return;
    const handleMove = (e: PointerEvent) => {
      const start = panStartRef.current;
      if (!start) return;
      const dx = e.clientX - start.clientX;
      const dy = e.clientY - start.clientY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) panSuppressClickRef.current = true;
      setOffsetX(start.offsetX + dx);
      setOffsetY(start.offsetY + dy);
    };
    const handleUp = () => {
      setPanning(false);
      panStartRef.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [panning, setOffsetX, setOffsetY]);

  const onNodePointerDown = (e: React.PointerEvent, nodeId: string) => {
    if (connectMode) return;
    if (!canvasRef.current) return;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const rect = canvasRef.current.getBoundingClientRect();
    nodeOffsetRef.current = { dx: (e.clientX - rect.left - offsetX) / scale - node.x, dy: (e.clientY - rect.top - offsetY) / scale - node.y };
    setDraggingNodeId(nodeId);
  };

  const onAnchorPointerDown = (evt: React.PointerEvent, edgeId: string, index: number, x: number, y: number) => {
    evt.stopPropagation();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    anchorOffsetRef.current = { dx: (evt.clientX - rect.left - offsetX) / scale - x, dy: (evt.clientY - rect.top - offsetY) / scale - y };
    setDraggingAnchor({ edgeId, index });
  };

  const onSourcePointerDown = (evt: React.PointerEvent, edgeId: string, x: number, y: number) => {
    evt.stopPropagation();
    onSemanticEdit?.();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    sourceOffsetRef.current = { dx: (evt.clientX - rect.left - offsetX) / scale - x, dy: (evt.clientY - rect.top - offsetY) / scale - y };
    setDraggingSourceEdgeId(edgeId);
  };

  const onTargetPointerDown = (evt: React.PointerEvent, edgeId: string, x: number, y: number) => {
    evt.stopPropagation();
    onSemanticEdit?.();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    targetOffsetRef.current = { dx: (evt.clientX - rect.left - offsetX) / scale - x, dy: (evt.clientY - rect.top - offsetY) / scale - y };
    setDraggingTargetEdgeId(edgeId);
  };

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (!panMode) return;
    if (connectMode) return;
    if (e.button !== 0) return;
    panSuppressClickRef.current = false;
    panStartRef.current = { clientX: e.clientX, clientY: e.clientY, offsetX, offsetY };
    setPanning(true);
  };

  const consumePanClick = () => {
    if (!panSuppressClickRef.current) return false;
    panSuppressClickRef.current = false;
    return true;
  };

  const interacting = !!draggingNodeId || !!draggingAnchor || !!draggingTargetEdgeId || !!draggingSourceEdgeId || panning;

  return { onNodePointerDown, onAnchorPointerDown, onSourcePointerDown, onTargetPointerDown, onCanvasPointerDown, consumePanClick, panning, interacting };
}
