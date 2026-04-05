import React from "react";
import type { FlowEdge, FlowNode, PortSide } from "../flow/model";
import { allowedPortsForShape, fixedPortForStartEnd, nodePortLocal, nodeSizeForTitle, shapeColor, wrapNodeTitle } from "../flow/ports";
import { matchesNodeLine } from "../flow/nodeLineMatch";

export const FlowNodesLayer = React.memo(function FlowNodesLayer(props: {
  nodes: FlowNode[];
  scale: number;
  offsetX: number;
  offsetY: number;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedEdge: FlowEdge | null;
  activeNodeId?: string | null;
  activeLine?: number | null;
  activeFocusRole?: string | null;
  activeEnabled?: boolean;
  followMode?: boolean;
  followTick?: number;
  connectMode: boolean;
  connectFromId: string | null;
  connectFromPort: PortSide | null;
  onNodePointerDown: (e: React.PointerEvent, nodeId: string) => void;
  onNodeClick: (e: React.MouseEvent, nodeId: string) => void;
  onPortClick: (nodeId: string, port: PortSide) => void;
  onUpdateNodeTitle?: (nodeId: string, title: string) => void;
}) {
  const {
    nodes,
    scale,
    offsetX,
    offsetY,
    selectedNodeId,
    selectedEdgeId,
    selectedEdge,
    activeNodeId,
    activeLine,
    activeFocusRole,
    activeEnabled = true,
    followMode,
    followTick,
    connectMode,
    connectFromId,
    connectFromPort,
    onNodePointerDown,
    onNodeClick,
    onPortClick,
    onUpdateNodeTitle,
  } = props;
  const [editingNodeId, setEditingNodeId] = React.useState<string | null>(null);
  const [editingText, setEditingText] = React.useState("");

  const canUseActiveNodeId = !!activeNodeId && nodes.some((n) => n.id === activeNodeId && n.type !== "annotation");
  const commitNoteEdit = React.useCallback(
    (nodeId: string, value: string) => {
      const next = value.trim();
      if (onUpdateNodeTitle) onUpdateNodeTitle(nodeId, next || "注释");
      setEditingNodeId(null);
      setEditingText("");
    },
    [onUpdateNodeTitle]
  );

  React.useEffect(() => {
    if (!editingNodeId) return;
    if (!nodes.some((n) => n.id === editingNodeId && n.shape === "note")) {
      setEditingNodeId(null);
      setEditingText("");
    }
  }, [editingNodeId, nodes]);

  const defaultRoleForLine = (line: number): string | null => {
    const roles = new Set<string>();
    for (const n of nodes) {
      if (n.type === "annotation") continue;
      if (!matchesNodeLine(n, line)) continue;
      const r = n.sourceRole;
      if (typeof r === "string" && r.trim()) roles.add(r);
    }
    const order = ["for_check", "for_inc", "for_init", "for_in_next", "for_in_bind", "while_check", "aug_assign", "call_site", "return_stmt"];
    for (const r of order) if (roles.has(r)) return r;
    return null;
  };

  const effectiveFocusRole = activeLine && !activeFocusRole ? defaultRoleForLine(activeLine) : activeFocusRole ?? null;
  const hasRoleTarget = !!activeLine && !!effectiveFocusRole && nodes.some((n) => matchesNodeLine(n, activeLine) && n.sourceRole === effectiveFocusRole);

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
      {nodes.filter(n => n.type !== "annotation").map((n) => {
        const selected = n.id === selectedNodeId;
        const active = !activeEnabled
          ? false
          : canUseActiveNodeId
          ? !!activeNodeId && n.id === activeNodeId
          : !!activeLine &&
            matchesNodeLine(n, activeLine) &&
            (!hasRoleTarget || !effectiveFocusRole || n.sourceRole === effectiveFocusRole);
        const pulse = !!followMode && !!active && typeof followTick === "number";
        const size = nodeSizeForTitle(n.shape, n.title);
        const borderColor = selected ? "var(--ws-color-primary)" : active ? "var(--ws-color-primary)" : shapeColor(n.shape);
        const bgColor = active ? "rgba(22,119,255,0.08)" : "var(--ws-color-surface)";
        const strokeWidth = selected ? 2.5 : active ? 3 : 2;
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
        const editingNote = n.shape === "note" && editingNodeId === n.id;
        return (
          <div
            key={n.id}
            style={{
              position: "absolute",
              left: n.x,
              top: n.y,
              width: w,
              height: h,
              cursor: editingNote ? "text" : "pointer",
              userSelect: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: selected ? 3 : 2,
              pointerEvents: "auto",
            }}
            onPointerDown={(e) => {
              if (editingNote) return;
              e.stopPropagation();
              onNodePointerDown(e, n.id);
            }}
            onClick={(e) => {
              e.stopPropagation();
              onNodeClick(e, n.id);
            }}
            onDoubleClick={(e) => {
              if (n.shape !== "note") return;
              e.stopPropagation();
              setEditingNodeId(n.id);
              setEditingText(n.title);
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
                  fill={bgColor}
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
                  fill={bgColor}
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
                    fill={bgColor}
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
              {(n.shape === "list_op" || n.shape === "collection") && (
                <>
                  <rect
                    x={pad}
                    y={pad}
                    width={w - pad * 2}
                    height={h - pad * 2}
                    rx={10}
                    ry={10}
                    fill={bgColor}
                    stroke={borderColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dashed ? "6 4" : undefined}
                  />
                  <path
                    d={`M ${pad + 8} ${pad + 8} H ${w - pad - 8}`}
                    stroke={borderColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dashed ? "6 4" : undefined}
                  />
                  <path
                    d={`M ${pad + 8} ${h - pad - 8} H ${w - pad - 8}`}
                    stroke={borderColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dashed ? "6 4" : undefined}
                  />
                </>
              )}
              {n.shape === "dict_op" && (
                <>
                  <rect
                    x={pad}
                    y={pad}
                    width={w - pad * 2}
                    height={h - pad * 2}
                    rx={10}
                    ry={10}
                    fill={bgColor}
                    stroke={borderColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dashed ? "6 4" : undefined}
                  />
                  <path
                    d={`M ${w / 2} ${pad + 6} V ${h - pad - 6}`}
                    stroke={borderColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dashed ? "6 4" : undefined}
                  />
                  <path
                    d={`M ${pad + 8} ${h / 2} H ${w - pad - 8}`}
                    stroke={borderColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dashed ? "6 4" : undefined}
                  />
                </>
              )}
              {n.shape === "str_op" && (
                <>
                  <rect
                    x={pad}
                    y={pad}
                    width={w - pad * 2}
                    height={h - pad * 2}
                    rx={10}
                    ry={10}
                    fill={bgColor}
                    stroke={borderColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dashed ? "6 4" : undefined}
                  />
                  <path
                    d={`M ${pad + 8} ${h - pad - 6} q 6 -5 12 0 t 12 0 t 12 0`}
                    stroke={borderColor}
                    strokeWidth={1.5}
                    fill="none"
                  />
                </>
              )}
              {n.shape === "jump" && (
                <>
                  <polygon
                    points={`${pad + 12},${pad} ${w - pad},${pad} ${w - pad - 12},${h - pad} ${pad},${h - pad}`}
                    fill={bgColor}
                    stroke={borderColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dashed ? "6 4" : undefined}
                  />
                </>
              )}
              {n.shape === "note" && (
                <>
                  <ellipse
                    cx={w / 2}
                    cy={h * 0.42}
                    rx={(w - pad * 2) * 0.48}
                    ry={(h - pad * 2) * 0.32}
                    fill="#fff9c4"
                    stroke={borderColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dashed ? "6 4" : undefined}
                  />
                  <path
                    d={`M ${w * 0.58} ${h * 0.64} Q ${w * 0.62} ${h * 0.83} ${w * 0.48} ${h * 0.72} Z`}
                    fill="#fff9c4"
                    stroke={borderColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dashed ? "6 4" : undefined}
                    strokeLinejoin="round"
                  />
                </>
              )}
              {n.shape === "decision" && (
                <polygon points={diamond} fill={bgColor} stroke={borderColor} strokeWidth={strokeWidth} strokeDasharray={dashed ? "6 4" : undefined} />
              )}
              {n.shape === "io" && (
                <polygon points={para} fill={bgColor} stroke={borderColor} strokeWidth={strokeWidth} strokeDasharray={dashed ? "6 4" : undefined} />
              )}
              {n.shape === "connector" && (
                <circle
                  cx={w / 2}
                  cy={h / 2}
                  r={Math.min(w, h) / 2 - pad}
                  fill={bgColor}
                  stroke={borderColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashed ? "6 4" : undefined}
                />
              )}
              {!editingNote &&
                (() => {
                  const lines = wrapNodeTitle(n.title, n.shape);
                  const lineH = 16;
                  const centerY = n.shape === "note" ? h * 0.42 : h / 2;
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
            {editingNote ? (
              <textarea
                value={editingText}
                autoFocus
                onChange={(e) => setEditingText(e.target.value)}
                onBlur={() => commitNoteEdit(n.id, editingText)}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setEditingNodeId(null);
                    setEditingText("");
                    return;
                  }
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    commitNoteEdit(n.id, editingText);
                  }
                }}
                className="text-xs"
                style={{
                  position: "absolute",
                  left: "15%",
                  top: "19%",
                  width: "70%",
                  height: "48%",
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  resize: "none",
                  textAlign: "center",
                  fontWeight: 700,
                  color: "#262626",
                  lineHeight: 1.25,
                }}
              />
            ) : null}
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
                  const stroke = active ? "var(--ws-color-primary)" : "var(--ws-color-text-tertiary)";
                  return (
                    <g
                      key={`${n.id}_${side}`}
                      onClick={(evt) => {
                        evt.stopPropagation();
                        onPortClick(n.id, side);
                      }}
                    >
                      <circle cx={cx} cy={cy} r={12} fill="rgba(0,0,0,0)" />
                      <circle cx={cx} cy={cy} r={5} fill="var(--ws-color-surface)" stroke={stroke} strokeWidth={2} />
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
});
