import React from "react";
import type { FlowEdge, PortSide } from "../flow/model";
import type { CanvasMetric } from "../hooks/useEdgeGeometries";
import { chooseSide } from "../flow/ports";
import { nearestTOnPolyline, pointAtT } from "../flow/geometry";

export function FlowEdgesSvg(props: {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  canvasMetrics: Map<string, CanvasMetric>;
  edges: FlowEdge[];
  edgeGeometries: { cache: Map<string, any> };
  scale: number;
  offsetX: number;
  offsetY: number;
  selectedEdgeId: string | null;
  setSelectedEdgeId: (id: string | null) => void;
  setSelectedNodeId: (id: string | null) => void;
  connectMode: boolean;
  connectFromId: string | null;
  connectFromPort: PortSide | null;
  setConnectFromId: (id: string | null) => void;
  setConnectFromPort: (p: PortSide | null) => void;
  setEdges: React.Dispatch<React.SetStateAction<FlowEdge[]>>;
  nextId: (prefix: string) => string;
  onSourcePointerDown: (evt: React.PointerEvent, edgeId: string, x: number, y: number) => void;
  onTargetPointerDown: (evt: React.PointerEvent, edgeId: string, x: number, y: number) => void;
  onAnchorPointerDown: (evt: React.PointerEvent, edgeId: string, index: number, x: number, y: number) => void;
}) {
  const {
    canvasRef,
    canvasMetrics,
    edges,
    edgeGeometries,
    scale,
    offsetX,
    offsetY,
    selectedEdgeId,
    setSelectedEdgeId,
    setSelectedNodeId,
    connectMode,
    connectFromId,
    connectFromPort,
    setConnectFromId,
    setConnectFromPort,
    setEdges,
    nextId,
    onSourcePointerDown,
    onTargetPointerDown,
    onAnchorPointerDown,
  } = props;

  return (
    <svg
      width="100%"
      height="100%"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        overflow: "visible",
        transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
        transformOrigin: "0 0",
        transition: "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <defs>
        <marker id="pyLabArrow" markerWidth="12" markerHeight="12" refX="12" refY="5" orient="auto" markerUnits="strokeWidth">
          <path d="M 0 0 L 10 5 L 0 10 L 2 5 z" fill="#595959" />
        </marker>
        <marker
          id="pyLabArrowSelected"
          markerWidth="12"
          markerHeight="12"
          refX="12"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 10 5 L 0 10 L 2 5 z" fill="#1677ff" />
        </marker>
      </defs>
      {edges.map((e) => {
        const geom = edgeGeometries.cache.get(e.id);
        if (!geom) return null;
        const selected = e.id === selectedEdgeId;
        const stroke = selected ? "#1677ff" : "#595959";
        const strokeWidth = selected ? 2.2 : 1.6;
        const anchors = geom.anchors as { x: number; y: number }[];
        return (
          <g key={e.id}>
            <path
              d={geom.hitPath}
              fill="none"
              stroke="rgba(0,0,0,0)"
              strokeWidth={14}
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{ cursor: "pointer", pointerEvents: "stroke" }}
              onClick={(evt) => {
                evt.stopPropagation();
                if (connectMode && connectFromId) {
                  if (!canvasRef.current) return;
                  const rect = canvasRef.current.getBoundingClientRect();
                  const p = { x: (evt.clientX - rect.left - offsetX) / scale, y: (evt.clientY - rect.top - offsetY) / scale };
                  const t = nearestTOnPolyline(geom.poly, p);
                  const targetPoint = pointAtT(geom.poly, t);
                  setEdges((prev) => {
                    const outgoingCount = prev.filter((x) => x.from === connectFromId).length;
                    const fromM = canvasMetrics.get(connectFromId);
                    const label =
                      fromM?.shape === "decision" && outgoingCount === 0
                        ? "是"
                        : fromM?.shape === "decision" && outgoingCount === 1
                          ? "否"
                          : undefined;
                    const fromPort =
                      connectFromPort ??
                      (fromM?.shape === "decision" && outgoingCount === 0
                        ? "bottom"
                        : fromM?.shape === "decision" && outgoingCount === 1
                          ? "right"
                          : fromM
                            ? chooseSide(targetPoint.x - fromM.cx, targetPoint.y - fromM.cy)
                            : undefined);
                    const edge: FlowEdge = {
                      id: nextId("edge"),
                      from: connectFromId,
                      to: e.to,
                      style: "straight",
                      routeMode: "auto",
                      anchor: null,
                      fromPort,
                      label,
                      toEdge: e.id,
                      toEdgeT: t,
                    };
                    setSelectedEdgeId(edge.id);
                    setSelectedNodeId(null);
                    setConnectFromId(null);
                    setConnectFromPort(null);
                    return [...prev, edge];
                  });
                  return;
                }
                setSelectedEdgeId(e.id);
                setSelectedNodeId(null);
              }}
              onDoubleClick={(evt) => {
                evt.stopPropagation();
                if (!canvasRef.current) return;
                const rect = canvasRef.current.getBoundingClientRect();
                const p = { x: (evt.clientX - rect.left - offsetX) / scale, y: (evt.clientY - rect.top - offsetY) / scale };
                setEdges((prev) =>
                  prev.map((ed) => {
                    if (ed.id !== e.id) return ed;
                    const current = (ed.anchors && ed.anchors.length ? ed.anchors : ed.anchor ? [ed.anchor] : []).slice();
                    const tNew = nearestTOnPolyline(geom.poly, p);
                    const withT = current.map((pt) => ({ pt, t: nearestTOnPolyline(geom.poly, pt) }));
                    withT.push({ pt: p, t: tNew });
                    withT.sort((a, b) => a.t - b.t);
                    const nextAnchors = withT.map((x) => x.pt);
                    return { ...ed, style: "polyline", routeMode: "manual", anchors: nextAnchors, anchor: null };
                  })
                );
                setSelectedEdgeId(e.id);
                setSelectedNodeId(null);
              }}
            />
            <path
              d={geom.drawPath}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinejoin="miter"
              strokeLinecap="butt"
              markerEnd={selected ? "url(#pyLabArrowSelected)" : "url(#pyLabArrow)"}
              opacity={0.95}
              style={{ pointerEvents: "none" }}
            />
            {geom.label && geom.labelPos && (
              <text
                x={geom.labelPos.x}
                y={geom.labelPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12"
                fontWeight="700"
                fill={stroke}
                stroke="#fff"
                strokeWidth={4}
                style={{ paintOrder: "stroke", pointerEvents: "none" }}
              >
                {geom.label}
              </text>
            )}
            {selected && (
              <>
                <circle
                  cx={geom.start.x}
                  cy={geom.start.y}
                  r={14}
                  fill="rgba(0,0,0,0)"
                  stroke="rgba(0,0,0,0)"
                  strokeWidth={0}
                  style={{ cursor: "grab", pointerEvents: "all" }}
                  onPointerDown={(evt) => onSourcePointerDown(evt, e.id, geom.start.x, geom.start.y)}
                />
                <circle cx={geom.start.x} cy={geom.start.y} r={6} fill="#fff" stroke="#1677ff" strokeWidth={2} style={{ pointerEvents: "none" }} />
                <circle
                  cx={geom.end.x}
                  cy={geom.end.y}
                  r={14}
                  fill="rgba(0,0,0,0)"
                  stroke="rgba(0,0,0,0)"
                  strokeWidth={0}
                  style={{ cursor: "grab", pointerEvents: "all" }}
                  onPointerDown={(evt) => onTargetPointerDown(evt, e.id, geom.end.x, geom.end.y)}
                />
                <circle cx={geom.end.x} cy={geom.end.y} r={6} fill="#fff" stroke="#1677ff" strokeWidth={2} style={{ pointerEvents: "none" }} />
              </>
            )}
            {selected &&
              e.style === "polyline" &&
              anchors.map((a, idx) => (
                <g
                  key={`${e.id}_a_${idx}`}
                  onDoubleClick={(evt) => {
                    evt.stopPropagation();
                    setEdges((prev) =>
                      prev.map((ed) => {
                        if (ed.id !== e.id) return ed;
                        const list = (ed.anchors && ed.anchors.length ? ed.anchors : ed.anchor ? [ed.anchor] : []).slice();
                        if (idx < 0 || idx >= list.length) return ed;
                        list.splice(idx, 1);
                        return { ...ed, style: "polyline", routeMode: "manual", anchors: list, anchor: null };
                      })
                    );
                  }}
                >
                  <circle
                    cx={a.x}
                    cy={a.y}
                    r={14}
                    fill="rgba(0,0,0,0)"
                    stroke="rgba(0,0,0,0)"
                    strokeWidth={0}
                    style={{ cursor: "grab", pointerEvents: "all" }}
                    onPointerDown={(evt) => onAnchorPointerDown(evt, e.id, idx, a.x, a.y)}
                  />
                  <circle cx={a.x} cy={a.y} r={6} fill="#fff" stroke="#1677ff" strokeWidth={2} style={{ pointerEvents: "none" }} />
                </g>
              ))}
          </g>
        );
      })}
    </svg>
  );
}
