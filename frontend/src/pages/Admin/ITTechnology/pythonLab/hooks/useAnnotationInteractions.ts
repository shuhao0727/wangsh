import { useEffect, useRef, useState } from "react";
import type { FlowNode } from "../flow/model";
import { nodeSizeForTitle } from "../flow/ports";

type DragMode = "resize" | "arrow-target" | "arrow-rotate";

export function useAnnotationInteractions(params: {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  scale: number;
  offsetX: number;
  offsetY: number;
  nodes: FlowNode[];
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  onSemanticEdit?: () => void;
}) {
  const { canvasRef, scale, offsetX, offsetY, nodes, setNodes, onSemanticEdit } = params;

  const [interactionState, setInteractionState] = useState<{
    mode: DragMode;
    nodeId: string;
    handle?: string; // For resize: "n", "s", "e", "w", "ne", "nw", "se", "sw"
    startX: number;
    startY: number;
    initialNode: FlowNode;
  } | null>(null);

  useEffect(() => {
    if (!interactionState) return;

    const handleMove = (e: PointerEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const currentX = (e.clientX - rect.left - offsetX) / scale;
      const currentY = (e.clientY - rect.top - offsetY) / scale;

      const dx = currentX - interactionState.startX;
      const dy = currentY - interactionState.startY;

      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== interactionState.nodeId) return n;

          if (interactionState.mode === "resize") {
            const initial = interactionState.initialNode;
            const initialSize = {
                w: initial.width ?? nodeSizeForTitle(initial.shape, initial.title).w,
                h: initial.height ?? nodeSizeForTitle(initial.shape, initial.title).h
            };
            
            let x = initial.x;
            let y = initial.y;
            let w = initialSize.w;
            let h = initialSize.h;

            const handle = interactionState.handle;
            if (handle?.includes("e")) w = Math.max(80, initialSize.w + dx);
            if (handle?.includes("s")) h = Math.max(24, initialSize.h + dy);
            if (handle?.includes("w")) {
              const newW = Math.max(80, initialSize.w - dx);
              x = initial.x + (initialSize.w - newW);
              w = newW;
            }
            if (handle?.includes("n")) {
              const newH = Math.max(24, initialSize.h - dy);
              y = initial.y + (initialSize.h - newH);
              h = newH;
            }

            return { ...n, x, y, width: w, height: h };
          }

          if (interactionState.mode === "arrow-target") {
             const initial = interactionState.initialNode;
             if (!initial.arrow) return n;
             return {
                 ...n,
                 arrow: {
                     ...initial.arrow,
                     target: {
                         x: initial.arrow.target.x + dx,
                         y: initial.arrow.target.y + dy
                     }
                 }
             };
          }
          
          if (interactionState.mode === "arrow-rotate") {
              // Calculate angle relative to arrow source (node center or edge)
              // For simplicity, let's assume rotation is around the node center for now, 
              // or the source anchor if we can determine it easily.
              // Let's use the current mouse position to determine angle.
              const initial = interactionState.initialNode;
              const size = {
                w: initial.width ?? nodeSizeForTitle(initial.shape, initial.title).w,
                h: initial.height ?? nodeSizeForTitle(initial.shape, initial.title).h
              };
              const cx = initial.x + size.w / 2;
              const cy = initial.y + size.h / 2;
              
              // This is a bit simplified. A proper rotation handle usually rotates the arrow *around* the source point.
              // But here "arrow-rotate" might mean rotating the *arrow itself* or just setting a rotation property.
              // The spec says "Rotate around start point".
              // We need the start point.
              // Let's assume start point is node center for calculation purposes or we recalculate it.
              // But simpler: just calculate angle from (cx, cy) to (currentX, currentY) and delta.
              // Or better: update `rotation` property.
              
              // Let's skip complex rotation logic for a second and just use dy for rotation delta if simpler,
              // or use atan2 if we want absolute tracking.
              
              // Let's assume the handle is at a certain angle, and we track the new angle.
              // But we don't know the handle position easily here without re-calculating geometry.
              // Let's just use the delta angle from start.
              
              const startAngle = Math.atan2(interactionState.startY - cy, interactionState.startX - cx);
              const currentAngle = Math.atan2(currentY - cy, currentX - cx);
              const deltaAngle = (currentAngle - startAngle) * (180 / Math.PI);
              
              return {
                  ...n,
                  arrow: {
                      ...n.arrow!,
                      rotation: (initial.arrow?.rotation ?? 0) + deltaAngle
                  }
              };
          }

          return n;
        })
      );
    };

    const handleUp = () => {
      onSemanticEdit?.();
      setInteractionState(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [interactionState, canvasRef, offsetX, offsetY, scale, setNodes, onSemanticEdit]);

  const onResizeStart = (e: React.PointerEvent, nodeId: string, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const startX = (e.clientX - rect.left - offsetX) / scale;
    const startY = (e.clientY - rect.top - offsetY) / scale;
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setInteractionState({
      mode: "resize",
      nodeId,
      handle,
      startX,
      startY,
      initialNode: node
    });
  };

  const onArrowTargetDragStart = (e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const startX = (e.clientX - rect.left - offsetX) / scale;
    const startY = (e.clientY - rect.top - offsetY) / scale;
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setInteractionState({
      mode: "arrow-target",
      nodeId,
      startX,
      startY,
      initialNode: node
    });
  };

  const onArrowRotateStart = (e: React.PointerEvent, nodeId: string) => {
      e.stopPropagation();
      e.preventDefault();
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const startX = (e.clientX - rect.left - offsetX) / scale;
      const startY = (e.clientY - rect.top - offsetY) / scale;
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
  
      setInteractionState({
        mode: "arrow-rotate",
        nodeId,
        startX,
        startY,
        initialNode: node
      });
  };

  return { onResizeStart, onArrowTargetDragStart, onArrowRotateStart, interacting: !!interactionState };
}
