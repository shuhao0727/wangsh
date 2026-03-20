import { useCallback } from "react";
import { logger } from "@services/logger";
import type { FlowEdge, FlowNode, PortSide } from "../flow/model";
import type { IRBlock } from "../flow/ir";
import { nodeSizeForTitle } from "../flow/ports";
import type { FlowBeautifyParams, FlowBeautifyThresholds } from "../flow/beautify";
import { sortFlowGraphStable } from "../flow/determinism";

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
  onSemanticEdit: () => void;
  generatedIr: IRBlock | null;
  codeIr: IRBlock | null;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedEdgeId: React.Dispatch<React.SetStateAction<string | null>>;
  setConnectFromId: React.Dispatch<React.SetStateAction<string | null>>;
  setConnectFromPort: React.Dispatch<React.SetStateAction<PortSide | null>>;
  beautifyParams?: FlowBeautifyParams;
  beautifyThresholds?: FlowBeautifyThresholds;
  beautifyAlignMode?: boolean;
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
    onSemanticEdit,
    setSelectedNodeId,
    setSelectedEdgeId,
    setConnectFromId,
    setConnectFromPort,
    beautifyParams,
    beautifyThresholds,
    beautifyAlignMode,
  } = params;

  const arrangeLayout = useCallback(async () => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const sorted = sortFlowGraphStable({ nodes, edges });

    const { computeBeautify, DEFAULT_BEAUTIFY_PARAMS, DEFAULT_BEAUTIFY_THRESHOLDS } = await import("../flow/beautify");

    try {
        onSemanticEdit();
        const fallbackParams: FlowBeautifyParams = {
            ...(DEFAULT_BEAUTIFY_PARAMS as FlowBeautifyParams),
            rankdir: "TB",
            splines: "spline",
        };
        const result = await Promise.race([
            computeBeautify(
                sorted.nodes,
                sorted.edges,
                beautifyParams ?? fallbackParams,
                beautifyThresholds ?? (DEFAULT_BEAUTIFY_THRESHOLDS as FlowBeautifyThresholds),
                { snapToGrid: !beautifyAlignMode }
            ),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Layout timeout")), 2000))
        ]);

        const nextNodes = result.layout.nodes;
        const nextEdges = result.layout.edges;

        // Calculate bounding box
        const marginScreen = Math.max(16, Math.min(40, Math.round(Math.min(rect.width, rect.height) * 0.04)));
        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
    
        for (const n of nextNodes) {
          const s = nodeSizeForTitle(n.shape, n.title);
          minX = Math.min(minX, n.x);
          minY = Math.min(minY, n.y);
          maxX = Math.max(maxX, n.x + s.w);
          maxY = Math.max(maxY, n.y + s.h);
        }
        
        // Include edges in bounding box
        for (const e of nextEdges) {
            if (e.anchors) {
                for (const p of e.anchors) {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                }
            }
        }
    
        if (!Number.isFinite(minX)) {
             // Fallback or just return if empty
             return;
        }
    
        // Calculate scale and offset to fit view
        const boundsW = maxX - minX;
        const boundsH = maxY - minY;
        const fitScreenW = rect.width - marginScreen * 2;
        const fitScreenH = rect.height - marginScreen * 2;
        
        const fitX = fitScreenW / Math.max(1, boundsW);
        const fitY = fitScreenH / Math.max(1, boundsH);
        const fit = Math.max(0.2, Math.min(1, fitX, fitY));
        const viewScale = fit >= 1 ? 1 : Math.max(0.2, fit);
        
        const contentCenterX = minX + boundsW / 2;
        const contentCenterY = minY + boundsH / 2;
        
        const offsetX = Math.round(rect.width / 2 - contentCenterX * viewScale);
        const offsetY = Math.round(rect.height / 2 - contentCenterY * viewScale);
    
        // Apply updates
        setNodes(nextNodes);
        setEdges(nextEdges);
        setScale(viewScale);
        setOffsetX(offsetX);
        setOffsetY(offsetY);
        
        // Clear selection
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setConnectFromId(null);
        setConnectFromPort(null);

    } catch (error) {
        logger.error("Auto layout failed:", error);
        // Optional: Show toast error here
    }

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
    beautifyParams,
    beautifyThresholds,
    beautifyAlignMode,
    onSemanticEdit,
  ]);

  return { arrangeLayout };
}
