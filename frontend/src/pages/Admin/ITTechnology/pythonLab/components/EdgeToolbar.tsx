import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import type { FlowEdge } from "../flow/model";
import { clampBetween } from "../flow/math";

export function EdgeToolbar(props: {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  selectedEdge: FlowEdge;
  anchorPoint: { x: number; y: number } | null;
  scale: number;
  offsetX: number;
  offsetY: number;
  onDelete: () => void;
  onReverse: () => void;
  onSetLabel: (next: string) => void;
  onSetStraight: () => void;
  onSetPolyline: () => void;
  onAddAnchor: () => void;
  onClearAnchors: () => void;
}) {
  const { canvasRef, selectedEdge, anchorPoint, scale, offsetX, offsetY, onDelete, onReverse, onSetLabel, onSetStraight, onSetPolyline, onAddAnchor, onClearAnchors } =
    props;
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    if (!anchorPoint) {
      setPos(null);
      return;
    }
    setPos({ x: anchorPoint.x * scale + offsetX, y: anchorPoint.y * scale + offsetY - 96 });
  }, [anchorPoint, offsetX, offsetY, scale]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (evt: PointerEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const offset = offsetRef.current;
      if (!offset) return;
      const x = evt.clientX - rect.left - offset.dx;
      const y = evt.clientY - rect.top - offset.dy;
      setPos({ x: clampBetween(x, 12, rect.width - 12), y: clampBetween(y, 12, rect.height - 12) });
    };
    const onUp = () => {
      setDragging(false);
      offsetRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [canvasRef, dragging]);

  if (!pos) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        zIndex: 4,
        background: "var(--ws-color-surface)",
        border: "1px solid var(--ws-color-border)",
        borderRadius: 10,
        boxShadow: "var(--ws-shadow-lg)",
        padding: 8,
        display: "flex",
        gap: 8,
        alignItems: "center",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: 6,
          background: "var(--ws-color-hover-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "grab",
          userSelect: "none",
        }}
        onPointerDown={(evt) => {
          evt.stopPropagation();
          if (!canvasRef.current) return;
          const rect = canvasRef.current.getBoundingClientRect();
          offsetRef.current = { dx: evt.clientX - rect.left - pos.x, dy: evt.clientY - rect.top - pos.y };
          setDragging(true);
        }}
      >
        ⋮
      </div>
      <Button size="sm" variant="destructive" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
        删除
      </Button>
      <Button size="sm" variant="outline" onClick={onReverse}>
        反向
      </Button>
      <Input
        id="pythonlab-edge-label-input"
        name="pythonlab-edge-label-input"
        aria-label="连线标注"
        className="w-[90px] h-[28px] text-xs"
        placeholder="标注"
        value={selectedEdge.label ?? ""}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onSetLabel(e.target.value)}
      />
      <Button size="sm" variant={selectedEdge.style === "straight" ? "default" : "outline"} onClick={onSetStraight}>
        直线
      </Button>
      <Button size="sm" variant={selectedEdge.style === "polyline" ? "default" : "outline"} onClick={onSetPolyline}>
        折线
      </Button>
      {selectedEdge.style === "polyline" && (
        <>
          <Button size="sm" variant="outline" onClick={onAddAnchor}>
            加拐点
          </Button>
          <Button size="sm" variant="outline" onClick={onClearAnchors}>
            清拐点
          </Button>
        </>
      )}
    </div>
  );
}
