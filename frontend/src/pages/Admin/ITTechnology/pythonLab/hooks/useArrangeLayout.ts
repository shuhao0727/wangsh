import { useCallback } from "react";
import type { FlowEdge, FlowNode, PortSide } from "../flow/model";
import type { IRBlock } from "../flow/ir";
import { arrangeFromIRElk } from "../flow/ir_layout_elk";
import { nodeSizeForTitle } from "../flow/ports";

export function useArrangeLayout(params: {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  scale: number;
  setScale: React.Dispatch<React.SetStateAction<number>>;
  setOffsetX: React.Dispatch<React.SetStateAction<number>>;
  setOffsetY: React.Dispatch<React.SetStateAction<number>>;
  nodes: FlowNode[];
  edges: FlowEdge[];
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<FlowEdge[]>>;
  codeMode: "auto" | "manual";
  generatedIr: IRBlock | null;
  codeIr: IRBlock | null;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedEdgeId: React.Dispatch<React.SetStateAction<string | null>>;
  setConnectFromId: React.Dispatch<React.SetStateAction<string | null>>;
  setConnectFromPort: React.Dispatch<React.SetStateAction<PortSide | null>>;
}) {
  const {
    canvasRef,
    scale,
    setScale,
    setOffsetX,
    setOffsetY,
    nodes,
    edges,
    setNodes,
    setEdges,
    codeMode,
    setSelectedNodeId,
    setSelectedEdgeId,
    setConnectFromId,
    setConnectFromPort,
  } = params;

  const arrangeLayout = useCallback(async () => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const next = await arrangeFromIRElk(nodes, edges, { width: rect.width, height: rect.height });
    const marginScreen = Math.max(16, Math.min(40, Math.round(Math.min(rect.width, rect.height) * 0.04)));
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const n of next.nodes) {
      const s = nodeSizeForTitle(n.shape, n.title);
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + s.w);
      maxY = Math.max(maxY, n.y + s.h);
    }
    for (const e of next.edges) {
      const pts = e.style === "polyline" ? (e.anchors && e.anchors.length ? e.anchors : e.anchor ? [e.anchor] : []) : [];
      for (const p of pts) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      if (e.fromFree) {
        minX = Math.min(minX, e.fromFree.x);
        minY = Math.min(minY, e.fromFree.y);
        maxX = Math.max(maxX, e.fromFree.x);
        maxY = Math.max(maxY, e.fromFree.y);
      }
      if (e.toFree) {
        minX = Math.min(minX, e.toFree.x);
        minY = Math.min(minY, e.toFree.y);
        maxX = Math.max(maxX, e.toFree.x);
        maxY = Math.max(maxY, e.toFree.y);
      }
    }

    if (!Number.isFinite(minX)) {
      setNodes(next.nodes);
      setEdges(next.edges);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setConnectFromId(null);
      setConnectFromPort(null);
      return;
    }

    const centersX: number[] = [];
    for (const n of next.nodes) {
      const s = nodeSizeForTitle(n.shape, n.title);
      centersX.push(n.x + s.w / 2);
    }
    centersX.sort((a, b) => a - b);
    const trunkX =
      centersX.length === 0
        ? (minX + maxX) / 2
        : centersX.length % 2
          ? centersX[(centersX.length - 1) / 2]
          : (centersX[centersX.length / 2 - 1] + centersX[centersX.length / 2]) / 2;

    const boundsW = maxX - minX;
    const boundsH = maxY - minY;
    const fitX = (rect.width - marginScreen * 2) / Math.max(1, boundsW);
    const fitY = (rect.height - marginScreen * 2) / Math.max(1, boundsH);
    const fit = Math.max(0.2, Math.min(1, fitX, fitY));
    const viewScale = fit >= 1 ? 1 : Math.max(0.2, fit);
    setScale(viewScale);

    const fitScreenW = rect.width - marginScreen * 2;
    const fitScreenH = rect.height - marginScreen * 2;
    const offsetX = boundsW * viewScale <= fitScreenW ? Math.round(rect.width / 2 - trunkX * viewScale) : Math.round(marginScreen - minX * viewScale);
    const offsetY =
      boundsH * viewScale <= fitScreenH ? Math.round(marginScreen + (fitScreenH - boundsH * viewScale) / 2 - minY * viewScale) : Math.round(marginScreen - minY * viewScale);

    setNodes(next.nodes);
    setEdges(next.edges);
    setOffsetX(offsetX);
    setOffsetY(offsetY);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setConnectFromId(null);
    setConnectFromPort(null);
  }, [
    canvasRef,
    edges,
    nodes,
    setConnectFromId,
    setConnectFromPort,
    setEdges,
    setNodes,
    setOffsetX,
    setOffsetY,
    setScale,
    setSelectedEdgeId,
    setSelectedNodeId,
  ]);

  return { arrangeLayout };
}
