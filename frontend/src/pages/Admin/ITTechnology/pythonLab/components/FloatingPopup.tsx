import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Space, Typography } from "antd";
import { CloseOutlined } from "@ant-design/icons";

const { Text } = Typography;

export function FloatingPopup(props: {
  open: boolean;
  title: React.ReactNode;
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
  const sizeRef = useRef(size);
  const posRef = useRef(pos);

  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  const clampSize = useCallback((w: number, h: number) => {
    const maxW = Math.max(minW, window.innerWidth - padding * 2);
    const maxH = Math.max(minH, window.innerHeight - padding * 2);
    const nw = Math.max(minW, Math.min(maxW, w));
    const nh = Math.max(minH, Math.min(maxH, h));
    return { w: nw, h: nh };
  }, []);

  const clampPos = useCallback(
    (x: number, y: number, nextSize?: { w: number; h: number }) => {
      const currentSize = nextSize ?? sizeRef.current;
      const maxX = Math.max(padding, window.innerWidth - currentSize.w - padding);
      const maxY = Math.max(padding, window.innerHeight - currentSize.h - padding);
      const nx = Math.max(padding, Math.min(maxX, x));
      const ny = Math.max(padding, Math.min(maxY, y));
      return { x: nx, y: ny };
    },
    []
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
    if (e.button !== 0) return;
    e.preventDefault();
    const target = e.currentTarget as HTMLElement & { setPointerCapture?: (pointerId: number) => void };
    if (typeof target.setPointerCapture === "function") target.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const baseX = posRef.current.x;
    const baseY = posRef.current.y;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      setPos(clampPos(baseX + dx, baseY + dy));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onResizePointerDown = (e: React.PointerEvent) => {
    if (!resizable) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement & { setPointerCapture?: (pointerId: number) => void };
    if (typeof target.setPointerCapture === "function") target.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const baseW = sizeRef.current.w;
    const baseH = sizeRef.current.h;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const nextSize = clampSize(baseW + dx, baseH + dy);
      setSize(nextSize);
      setPos((p) => clampPos(p.x, p.y, nextSize));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  if (!open) return null;

  return (
    <div
      data-testid="floating-popup"
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        zIndex: 1000,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "var(--ws-shadow-lg)",
        border: "1px solid var(--ws-color-border)",
        background: "var(--ws-color-surface)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        data-testid="floating-popup-header"
        onPointerDown={onHeaderPointerDown}
        className="flex items-center justify-between gap-2 px-3 py-2 select-none"
        style={{
          borderBottom: "1px solid var(--ws-color-border-secondary)",
          background: "var(--ws-color-surface)",
          cursor: draggable ? "move" : "default",
          touchAction: "none",
        }}
      >
        <Text className="font-semibold text-sm">{title}</Text>
        <Button type="text" size="small" icon={<CloseOutlined />} onPointerDown={(e) => e.stopPropagation()} onClick={onClose} />
      </div>
      <div className="flex flex-col gap-2 p-2 flex-1 min-h-0" style={{ overflow: scrollable ? "auto" : "hidden" }}>{children}</div>
      {resizable ? (
        <div
          data-testid="floating-popup-resize-handle"
          onPointerDown={onResizePointerDown}
          style={{
            position: "absolute",
            right: 2,
            bottom: 2,
            width: 16,
            height: 16,
            cursor: "nwse-resize",
            touchAction: "none",
            background:
              "linear-gradient(135deg, transparent 0 55%, rgba(0,0,0,0.16) 55% 62%, transparent 62% 70%, rgba(0,0,0,0.16) 70% 77%, transparent 77% 85%, rgba(0,0,0,0.16) 85% 92%, transparent 92% 100%)",
            borderBottomRightRadius: 12,
          }}
        />
      ) : null}
    </div>
  );
}
