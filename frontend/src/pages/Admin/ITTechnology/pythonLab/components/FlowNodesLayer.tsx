import React from "react";
import type { FlowEdge, FlowNode, PortSide } from "../flow/model";
import { allowedPortsForShape, fixedPortForStartEnd, nodePortLocal, nodeScale, nodeSizeForTitle, shapeColor, wrapNodeTitle } from "../flow/ports";

export function FlowNodesLayer(props: {
  nodes: FlowNode[];
  scale: number;
  offsetX: number;
  offsetY: number;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedEdge: FlowEdge | null;
  activeLine?: number | null;
  activeFocusRole?: string | null;
  followMode?: boolean;
  followTick?: number;
  connectMode: boolean;
  connectFromId: string | null;
  connectFromPort: PortSide | null;
  onNodePointerDown: (e: React.PointerEvent, nodeId: string) => void;
  onNodeClick: (e: React.MouseEvent, nodeId: string) => void;
  onPortClick: (nodeId: string, port: PortSide) => void;
}) {
  const {
    nodes,
    scale,
    offsetX,
    offsetY,
    selectedNodeId,
    selectedEdgeId,
    selectedEdge,
    activeLine,
    activeFocusRole,
    followMode,
    followTick,
    connectMode,
    connectFromId,
    connectFromPort,
    onNodePointerDown,
    onNodeClick,
    onPortClick,
  } = props;

  const matchesLine = (n: FlowNode, line: number) => {
    const r = (n as any).sourceRange as { startLine: number; endLine: number } | undefined;
    if (r && Number.isFinite(r.startLine) && Number.isFinite(r.endLine)) {
      return line >= r.startLine && line <= r.endLine;
    }
    return n.sourceLine === line;
  };

  const hasRoleTarget = !!activeLine && !!activeFocusRole && nodes.some((n) => matchesLine(n, activeLine) && n.sourceRole === activeFocusRole);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 2,
        transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
        transformOrigin: "0 0",
        transition: "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
        pointerEvents: "none",
      }}
    >
      <style>{`
        @keyframes wsFollowPulseA {
          0% { opacity: 0.95; transform: scale(0.92); box-shadow: 0 0 0 0 rgba(22,119,255,0.0); }
          35% { opacity: 0.85; transform: scale(1.02); box-shadow: 0 0 0 8px rgba(22,119,255,0.10); }
          100% { opacity: 0; transform: scale(1.28); box-shadow: 0 0 0 18px rgba(22,119,255,0.0); }
        }
        @keyframes wsFollowPulseB {
          0% { opacity: 0.95; transform: scale(0.92); box-shadow: 0 0 0 0 rgba(22,119,255,0.0); }
          35% { opacity: 0.85; transform: scale(1.02); box-shadow: 0 0 0 8px rgba(22,119,255,0.10); }
          100% { opacity: 0; transform: scale(1.28); box-shadow: 0 0 0 18px rgba(22,119,255,0.0); }
        }
      `}</style>
      {nodes.map((n) => {
        if (n.shape === "connector" && !String(n.title || "").trim()) return null;
        const selected = n.id === selectedNodeId;
        const active =
          !!activeLine &&
          matchesLine(n, activeLine) &&
          (!hasRoleTarget || !activeFocusRole || n.sourceRole === activeFocusRole) &&
          !selected;
        const pulse = !!followMode && !!active && typeof followTick === "number";
        const size = nodeSizeForTitle(n.shape, n.title);
        const borderColor = selected ? "#1677ff" : active ? "#1677ff" : shapeColor(n.shape);
        const strokeWidth = selected ? 2.5 : active ? 2.5 : 2;
        const dashed = connectMode && connectFromId === n.id;
        const w = size.w;
        const h = size.h;
        const pad = strokeWidth / 2;
        const diamond = `${w / 2},${pad} ${w - pad},${h / 2} ${w / 2},${h - pad} ${pad},${h / 2}`;
        const slant = Math.min(14, Math.max(10, w * 0.12));
        const para = `${pad + slant},${pad} ${w - pad},${pad} ${w - pad - slant},${h - pad} ${pad},${h - pad}`;
        const ports = allowedPortsForShape(n.shape, n.title);
        const showPorts =
          connectMode ||
          (!!selectedEdgeId && !!selectedEdge && (selectedEdge.from === n.id || (!selectedEdge.toEdge && selectedEdge.to === n.id)));
        return (
          <div
            key={n.id}
            style={{
              position: "absolute",
              left: n.x,
              top: n.y,
              width: w,
              height: h,
              cursor: "pointer",
              userSelect: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: selected ? 3 : 2,
              pointerEvents: "auto",
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onNodePointerDown(e, n.id);
            }}
            onClick={(e) => {
              e.stopPropagation();
              onNodeClick(e, n.id);
            }}
          >
            {pulse ? (
              <div
                style={{
                  position: "absolute",
                  inset: -10,
                  borderRadius: 16,
                  border: "2px solid rgba(22,119,255,0.55)",
                  pointerEvents: "none",
                  animation: `${(followTick ?? 0) % 2 ? "wsFollowPulseA" : "wsFollowPulseB"} 760ms ease-out`,
                }}
              />
            ) : null}
            <svg
              width={w}
              height={h}
              style={{
                display: "block",
                filter: selected || active ? "drop-shadow(0 16px 32px rgba(0,0,0,0.18))" : "drop-shadow(0 12px 24px rgba(0,0,0,0.12))",
              }}
            >
              <title>{(n.tooltip || n.title || "").trim()}</title>
              {n.shape === "start_end" && (
                <rect
                  x={pad}
                  y={pad}
                  width={w - pad * 2}
                  height={h - pad * 2}
                  rx={(h - pad * 2) / 2}
                  ry={(h - pad * 2) / 2}
                  fill="#fff"
                  stroke={borderColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashed ? "6 4" : undefined}
                />
              )}
              {n.shape === "process" && (
                <rect
                  x={pad}
                  y={pad}
                  width={w - pad * 2}
                  height={h - pad * 2}
                  rx={10}
                  ry={10}
                  fill="#fff"
                  stroke={borderColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashed ? "6 4" : undefined}
                />
              )}
              {n.shape === "subroutine" && (
                <>
                  <rect
                    x={pad}
                    y={pad}
                    width={w - pad * 2}
                    height={h - pad * 2}
                    rx={10}
                    ry={10}
                    fill="#fff"
                    stroke={borderColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dashed ? "6 4" : undefined}
                  />
                  <path
                    d={`M ${pad + 12} ${pad + 4} V ${h - pad - 4}`}
                    stroke={borderColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dashed ? "6 4" : undefined}
                  />
                  <path
                    d={`M ${w - pad - 12} ${pad + 4} V ${h - pad - 4}`}
                    stroke={borderColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dashed ? "6 4" : undefined}
                  />
                </>
              )}
              {n.shape === "decision" && (
                <polygon points={diamond} fill="#fff" stroke={borderColor} strokeWidth={strokeWidth} strokeDasharray={dashed ? "6 4" : undefined} />
              )}
              {n.shape === "io" && (
                <polygon points={para} fill="#fff" stroke={borderColor} strokeWidth={strokeWidth} strokeDasharray={dashed ? "6 4" : undefined} />
              )}
              {n.shape === "connector" && (
                <circle
                  cx={w / 2}
                  cy={h / 2}
                  r={Math.min(w, h) / 2 - pad}
                  fill="#fff"
                  stroke={borderColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashed ? "6 4" : undefined}
                />
              )}
              {(() => {
                const lines = wrapNodeTitle(n.title, n.shape);
                const lineH = 16;
                const centerY = h / 2;
                const topY = centerY - ((lines.length - 1) * lineH) / 2;
                return (
                  <text textAnchor="middle" fontSize="12" fontWeight="700" fill="#262626">
                    {lines.map((t, i) => (
                      <tspan key={i} x="50%" y={topY + i * lineH} dominantBaseline="middle">
                        {t}
                      </tspan>
                    ))}
                  </text>
                );
              })()}
            </svg>
            {showPorts && (
              <svg width={w} height={h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
                {ports.map((side) => {
                  const p = nodePortLocal(n.shape, w, h, side);
                  const cx = w / 2 + p.x;
                  const cy = h / 2 + p.y;
                  const edge = selectedEdgeId && selectedEdge ? selectedEdge : null;
                  const fixed = n.shape === "start_end" ? fixedPortForStartEnd(n.title) : null;
                  const current =
                    fixed ??
                    (edge && edge.from === n.id
                      ? edge.fromPort ?? null
                      : edge && edge.to === n.id && !edge.toEdge
                        ? edge.toPort ?? null
                        : null);
                  const active = (connectMode && connectFromId === n.id && connectFromPort === side) || (!!current && current === side);
                  const stroke = active ? "#1677ff" : "rgba(0,0,0,0.35)";
                  return (
                    <g
                      key={`${n.id}_${side}`}
                      onClick={(evt) => {
                        evt.stopPropagation();
                        onPortClick(n.id, side);
                      }}
                    >
                      <circle cx={cx} cy={cy} r={12} fill="rgba(0,0,0,0)" />
                      <circle cx={cx} cy={cy} r={5} fill="#fff" stroke={stroke} strokeWidth={2} />
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}
