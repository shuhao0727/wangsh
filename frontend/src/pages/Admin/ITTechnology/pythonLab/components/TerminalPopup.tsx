import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Space, Tabs, Tag, Typography } from "antd";
import { CloseOutlined, ReloadOutlined } from "@ant-design/icons";
import XtermTerminal from "./XtermTerminal";

const { Text } = Typography;

export function TerminalPopup(props: {
  open: boolean;
  stdout: string[];
  trace?: string[];
  error: string | null;
  onClose: () => void;
  onClear: () => void;
}) {
  const { open, stdout, trace, error, onClose, onClear } = props;
  const padding = 16;
  const minW = 360;
  const minH = 200;
  const maxW = 980;
  const maxH = 720;

  const [size, setSize] = useState({ w: 440, h: 240 });

  const defaultPos = useMemo(
    () => ({ x: Math.max(padding, window.innerWidth - size.w - padding), y: Math.max(padding, window.innerHeight - size.h - padding) }),
    [size.h, size.w]
  );
  const [pos, setPos] = useState(defaultPos);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; baseW: number; baseH: number } | null>(null);

  const clampSize = useCallback((w: number, h: number) => {
    const nw = Math.max(minW, Math.min(maxW, w));
    const nh = Math.max(minH, Math.min(maxH, h));
    return { w: nw, h: nh };
  }, []);

  const clamp = useCallback((x: number, y: number) => {
    const maxX = Math.max(padding, window.innerWidth - size.w - padding);
    const maxY = Math.max(padding, window.innerHeight - size.h - padding);
    const nx = Math.max(padding, Math.min(maxX, x));
    const ny = Math.max(padding, Math.min(maxY, y));
    return { x: nx, y: ny };
  }, [size.h, size.w]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      setSize((s) => clampSize(s.w, s.h));
      setPos((p) => clamp(p.x, p.y));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp, clampSize, open]);

  const onHeaderPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onHeaderPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    setPos(clamp(d.baseX + dx, d.baseY + dy));
  };

  const onHeaderPointerUp = () => {
    dragRef.current = null;
  };

  const onResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, baseW: size.w, baseH: size.h };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onResizePointerMove = (e: React.PointerEvent) => {
    const r = resizeRef.current;
    if (!r) return;
    const dx = e.clientX - r.startX;
    const dy = e.clientY - r.startY;
    setSize(clampSize(r.baseW + dx, r.baseH + dy));
  };

  const onResizePointerUp = () => {
    resizeRef.current = null;
    setPos((p) => clamp(p.x, p.y));
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
        zIndex: 1200,
        borderRadius: "var(--ws-radius-lg)",
        background: "var(--ws-color-surface)",
        border: "1px solid rgba(0,0,0,0.10)",
        boxShadow: "var(--ws-shadow-sm)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          background: "var(--ws-color-surface)",
          cursor: "move",
          userSelect: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Space size={8}>
          <Text style={{ fontWeight: 600 }}>终端</Text>
          <Tag color="cyan" style={{ marginInlineEnd: 0 }}>
            输出
          </Tag>
        </Space>
        <Space size={8}>
          <Button size="small" shape="circle" icon={<ReloadOutlined />} onPointerDown={(e) => e.stopPropagation()} onClick={onClear} />
          <Button size="small" shape="circle" icon={<CloseOutlined />} onPointerDown={(e) => e.stopPropagation()} onClick={onClose} />
        </Space>
      </div>
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0 }}>
        {error ? <Text type="danger">{error}</Text> : null}
        <Tabs
          size="small"
          items={[
            {
              key: "stdout",
              label: `输出(${stdout.length})`,
              children: (
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    padding: 4,
                    borderRadius: "var(--ws-radius-md)",
                    background: "#1e1e1e",
                    overflow: "hidden",
                  }}
                >
                  <XtermTerminal output={stdout} onClear={onClear} />
                </div>
              ),
            },
            {
              key: "trace",
              label: `变量(${trace?.length ?? 0})`,
              children: (
                <pre
                  style={{
                    margin: 0,
                    flex: 1,
                    minHeight: 0,
                    padding: 12,
                    borderRadius: "var(--ws-radius-md)",
                    background: "var(--ws-color-surface-2)",
                    overflow: "auto",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    fontSize: 12,
                    lineHeight: "18px",
                  }}
                >
                  {trace?.length ? trace.join("\n") : "（无变量变化记录）"}
                </pre>
              ),
            },
          ]}
          style={{ flex: 1, minHeight: 0 }}
        />
      </div>
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
          borderBottomRightRadius: "var(--ws-radius-lg)",
        }}
      />
    </div>
  );
}
