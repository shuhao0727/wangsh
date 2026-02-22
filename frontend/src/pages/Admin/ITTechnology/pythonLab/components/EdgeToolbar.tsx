import React, { useEffect, useRef, useState } from "react";
import { Button, Input } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import type { FlowEdge } from "../flow/model";

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
      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
      setPos({ x: clamp(x, 12, rect.width - 12), y: clamp(y, 12, rect.height - 12) });
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
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.10)",
        borderRadius: 10,
        boxShadow: "0 12px 28px rgba(0,0,0,0.12)",
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
          background: "rgba(0,0,0,0.04)",
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
      <Button size="small" danger icon={<DeleteOutlined />} onClick={onDelete}>
        删除
      </Button>
      <Button size="small" onClick={onReverse}>
        反向
      </Button>
      <Input
        size="small"
        style={{ width: 90 }}
        placeholder="标注"
        value={selectedEdge.label ?? ""}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onSetLabel(e.target.value)}
      />
      <Button size="small" type={selectedEdge.style === "straight" ? "primary" : "default"} onClick={onSetStraight}>
        直线
      </Button>
      <Button size="small" type={selectedEdge.style === "polyline" ? "primary" : "default"} onClick={onSetPolyline}>
        折线
      </Button>
      {selectedEdge.style === "polyline" && (
        <>
          <Button size="small" onClick={onAddAnchor}>
            加拐点
          </Button>
          <Button size="small" onClick={onClearAnchors}>
            清拐点
          </Button>
        </>
      )}
    </div>
  );
}
