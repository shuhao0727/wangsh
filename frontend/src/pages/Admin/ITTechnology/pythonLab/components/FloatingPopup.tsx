import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Space, Typography } from "antd";
import { CloseOutlined } from "@ant-design/icons";

const { Text } = Typography;

export function FloatingPopup(props: {
  open: boolean;
  title: string;
  anchorRect?: DOMRect | null;
  initialSize?: { w: number; h: number };
  draggable?: boolean;
  resizable?: boolean;
  scrollable?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { open, title, anchorRect, initialSize, draggable = true, resizable = true, scrollable = true, onClose, children } = props;
  const padding = 16;
  const minW = 260;
  const minH = 140;

  const [size, setSize] = useState(() => ({ w: initialSize?.w ?? 520, h: initialSize?.h ?? 360 }));
  const [pos, setPos] = useState({ x: padding, y: padding });
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; baseW: number; baseH: number } | null>(null);

  const clampSize = useCallback((w: number, h: number) => {
    const maxW = Math.max(minW, window.innerWidth - padding * 2);
    const maxH = Math.max(minH, window.innerHeight - padding * 2);
    const nw = Math.max(minW, Math.min(maxW, w));
    const nh = Math.max(minH, Math.min(maxH, h));
    return { w: nw, h: nh };
  }, []);

  const clampPos = useCallback(
    (x: number, y: number) => {
      const maxX = Math.max(padding, window.innerWidth - size.w - padding);
      const maxY = Math.max(padding, window.innerHeight - size.h - padding);
      const nx = Math.max(padding, Math.min(maxX, x));
      const ny = Math.max(padding, Math.min(maxY, y));
      return { x: nx, y: ny };
    },
    [size.h, size.w]
  );

  const anchorKey = useMemo(() => {
    if (!anchorRect) return "";
    return `${Math.round(anchorRect.left)}:${Math.round(anchorRect.top)}:${Math.round(anchorRect.width)}:${Math.round(anchorRect.height)}`;
  }, [anchorRect]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      setSize((s) => clampSize(s.w, s.h));
      setPos((p) => clampPos(p.x, p.y));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampPos, clampSize, open]);

  useEffect(() => {
    if (!open) return;
    if (!anchorRect) return;
    const s = clampSize(size.w, size.h);
    setSize(s);
    const preferRight = anchorRect.right + 12 + s.w + padding <= window.innerWidth;
    const x = preferRight ? anchorRect.right + 12 : anchorRect.left - 12 - s.w;
    const y = anchorRect.top;
    setPos(clampPos(x, y));
  }, [anchorKey, clampPos, clampSize, open]);

  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if (!draggable) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onHeaderPointerMove = (e: React.PointerEvent) => {
    if (!draggable) return;
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    setPos(clampPos(d.baseX + dx, d.baseY + dy));
  };

  const onHeaderPointerUp = () => {
    if (!draggable) return;
    dragRef.current = null;
  };

  const onResizePointerDown = (e: React.PointerEvent) => {
    if (!resizable) return;
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, baseW: size.w, baseH: size.h };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onResizePointerMove = (e: React.PointerEvent) => {
    if (!resizable) return;
    const r = resizeRef.current;
    if (!r) return;
    const dx = e.clientX - r.startX;
    const dy = e.clientY - r.startY;
    setSize(clampSize(r.baseW + dx, r.baseH + dy));
  };

  const onResizePointerUp = () => {
    if (!resizable) return;
    resizeRef.current = null;
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        zIndex: 1000,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "none",
        border: "1px solid var(--ws-color-border)",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        style={{
          padding: "6px 8px",
          borderBottom: "1px solid var(--ws-color-border)",
          background: "#ffffff",
          cursor: draggable ? "move" : "default",
          userSelect: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Space size={8}>
          <Text style={{ fontWeight: 600, fontSize: 12 }}>{title}</Text>
        </Space>
        <Space size={8}>
          <Button size="small" shape="circle" icon={<CloseOutlined />} onPointerDown={(e) => e.stopPropagation()} onClick={onClose} />
        </Space>
      </div>
      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0, overflow: scrollable ? "auto" : "hidden" }}>{children}</div>
      {resizable ? (
        <div
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          style={{
            position: "absolute",
            right: 2,
            bottom: 2,
            width: 16,
            height: 16,
            cursor: "nwse-resize",
            background:
              "linear-gradient(135deg, transparent 0 55%, rgba(0,0,0,0.16) 55% 62%, transparent 62% 70%, rgba(0,0,0,0.16) 70% 77%, transparent 77% 85%, rgba(0,0,0,0.16) 85% 92%, transparent 92% 100%)",
            borderBottomRightRadius: 12,
          }}
        />
      ) : null}
    </div>
  );
}
