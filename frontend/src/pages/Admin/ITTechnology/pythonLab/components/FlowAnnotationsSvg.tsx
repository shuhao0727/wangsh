import React from "react";
import type { FlowNode } from "../flow/model";
import { nodeSizeForTitle } from "../flow/ports";

export const FlowAnnotationsSvg = React.memo(function FlowAnnotationsSvg(props: {
  nodes: FlowNode[];
  scale: number;
  offsetX: number;
  offsetY: number;
  selectedNodeId: string | null;
  onNodePointerDown: (e: React.PointerEvent, nodeId: string) => void;
  onNodeClick: (e: React.MouseEvent, nodeId: string) => void;
  onNodeDoubleClick: (e: React.MouseEvent, nodeId: string) => void;
  onResizeStart?: (e: React.PointerEvent, nodeId: string, handle: string) => void;
  onArrowTargetDragStart?: (e: React.PointerEvent, nodeId: string) => void;
  onArrowRotateStart?: (e: React.PointerEvent, nodeId: string) => void;
  onUpdateNodeTitle?: (nodeId: string, title: string) => void;
}) {
  const {
    nodes,
    scale,
    offsetX,
    offsetY,
    selectedNodeId,
    onNodePointerDown,
    onNodeClick,
    onNodeDoubleClick,
    onResizeStart,
    onArrowTargetDragStart,
    onArrowRotateStart: _onArrowRotateStart,
    onUpdateNodeTitle
  } = props;

  const annotations = nodes.filter(n => n.type === "annotation");
  
  // Local state for editing text
  const [editingNodeId, setEditingNodeId] = React.useState<string | null>(null);
  const [editingText, setEditingText] = React.useState("");

  // Calculate intersection point of line (start -> end) with rect (rx, ry, rw, rh)
  const getIntersectPoint = (start: { x: number; y: number }, end: { x: number; y: number }, rect: { x: number; y: number; w: number; h: number }) => {
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      const dx = end.x - start.x; // Direction from start to end (target)
      const dy = end.y - start.y;
      
      // We want to find intersection with the *start* rect (the annotation box)
      // The arrow starts from the annotation box edge.
      // Line equation: P = C + t * D
      // We need to find t such that P is on the rect boundary.
      // Rect boundaries: x = -w/2, x = w/2, y = -h/2, y = h/2 (relative to center)
      
      if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return start;

      const halfW = rect.w / 2;
      const halfH = rect.h / 2;
      
      // Calculate t for vertical edges
      const tx = dx !== 0 ? (dx > 0 ? halfW : -halfW) / dx : Infinity;
      
      // Calculate t for horizontal edges
      const ty = dy !== 0 ? (dy > 0 ? halfH : -halfH) / dy : Infinity;
      
      // The smallest positive t is the intersection
      const t = Math.min(Math.abs(tx), Math.abs(ty));
      
      return {
          x: cx + t * dx,
          y: cy + t * dy
      };
  };

  const commitEdit = () => {
      if (editingNodeId && onUpdateNodeTitle) {
          onUpdateNodeTitle(editingNodeId, editingText);
      }
      setEditingNodeId(null);
      setEditingText("");
  };

  const minHeight = 24; // Minimum height for one line of text + padding

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 4, // Make sure it is above nodes layer which is zIndex 2/3
      }}
    >
      <g transform={`translate(${offsetX}, ${offsetY}) scale(${scale})`}>
        <g id="layer-annotations" style={{ pointerEvents: "auto" }}>
          {annotations.map(n => {
        const selected = n.id === selectedNodeId;
        const defaultSize = nodeSizeForTitle(n.shape, n.title);
        const w = n.width ?? defaultSize.w;
        const h = Math.max(n.height ?? defaultSize.h, minHeight);
        const isEditing = editingNodeId === n.id;

        // Style
        const bgColor = n.style?.backgroundColor ?? "#FFF9C4";
        const opacity = n.style?.opacity ?? 1;
        const dashed = n.style?.dashed ?? true;
        
        // Arrow
        const arrow = n.arrow;

        return (
          <g
            key={n.id}
            transform={`translate(${n.x}, ${n.y})`}
            onPointerDown={(e) => {
                e.stopPropagation();
                onNodePointerDown(e, n.id);
            }}
            onClick={(e) => {
                e.stopPropagation();
                onNodeClick(e, n.id);
            }}
            onDoubleClick={(e) => {
                e.stopPropagation();
                onNodeDoubleClick(e, n.id);
                setEditingNodeId(n.id);
                setEditingText(n.title);
            }}
            style={{ cursor: "pointer", opacity }}
          >
             {/* Main Note Body */}
             <rect
                width={w}
                height={h}
                rx={12}
                ry={12}
                fill={bgColor}
                stroke="rgba(0, 0, 0, 0.08)"
                strokeWidth={2}
                strokeDasharray={dashed ? "6 4" : undefined}
                style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.1))" }}
             />

             {/* Text Content */}
             {!isEditing && (
                 <foreignObject x={8} y={8} width={w - 16} height={h - 16} className="pointer-events-none">
                     <div style={{ 
                         width: "100%", 
                         height: "100%", 
                         display: "flex", 
                         alignItems: "center", 
                         justifyContent: "center",
                         textAlign: "center",
                         wordBreak: "break-word",
                         fontSize: "14px",
                         color: "#333",
                         fontFamily: "sans-serif"
                     }}>
                         {n.title}
                     </div>
                 </foreignObject>
             )}

             {/* Editing Area */}
             {isEditing && (
                 <foreignObject x={0} y={0} width={w} height={h}>
                     <textarea
                         autoFocus
                         value={editingText}
                         onChange={e => setEditingText(e.target.value)}
                         onBlur={commitEdit}
                         onKeyDown={e => {
                             if (e.key === "Enter" && !e.shiftKey) {
                                 e.preventDefault();
                                 commitEdit();
                             }
                             if (e.key === "Escape") {
                                 setEditingNodeId(null);
                             }
                         }}
                         style={{
                             width: "100%",
                             height: "100%",
                             border: "none",
                             outline: "2px solid #0EA5E9",
                             borderRadius: "12px",
                             background: bgColor,
                             resize: "none",
                             padding: "8px",
                             fontSize: "14px",
                             textAlign: "center",
                             fontFamily: "sans-serif"
                         }}
                         onPointerDown={e => e.stopPropagation()}
                     />
                 </foreignObject>
             )}

             {/* Selection Handles */}
             {selected && !isEditing && (
                 <>
                    {/* Resize Handles */}
                    {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map(handle => {
                        let hx = 0;
                        let hy = 0;
                        let cursor = "default";
                        if (handle.includes("e")) hx = w;
                        if (handle.includes("w")) hx = 0;
                        if (handle.includes("n")) hy = 0; // Top
                        if (handle.includes("s")) hy = h;
                        if (handle === "n" || handle === "s") hx = w / 2;
                        if (handle === "e" || handle === "w") hy = h / 2;

                        switch(handle) {
                            case "nw": cursor = "nwse-resize"; break;
                            case "ne": cursor = "nesw-resize"; break;
                            case "sw": cursor = "nesw-resize"; break;
                            case "se": cursor = "nwse-resize"; break;
                            case "n": cursor = "ns-resize"; break;
                            case "s": cursor = "ns-resize"; break;
                            case "e": cursor = "ew-resize"; break;
                            case "w": cursor = "ew-resize"; break;
                        }

                        return (
                            <rect
                                key={handle}
                                x={hx - 4}
                                y={hy - 4}
                                width={8}
                                height={8}
                                fill="#fff"
                                stroke="#0EA5E9"
                                style={{ cursor }}
                                onPointerDown={(e) => onResizeStart?.(e, n.id, handle)}
                            />
                        );
                    })}
                 </>
             )}
             
             {/* Arrow Rendering */}
             {arrow && (
                 <g>
                     {/* We need to calculate start point based on sourceAnchor */}
                     {/* For now, let's assume center of node */}
                     {/* Actually, if arrow target is absolute, we need to map it to local if we are inside <g translate> */}
                     {/* But arrow target is absolute canvas coordinates. */}
                     {/* The <g> for this node is translated by (n.x, n.y). */}
                     {/* So we need to subtract n.x, n.y from arrow.target to draw inside here. */}
                     
                     {(() => {
                         const targetAbs = { x: arrow.target.x, y: arrow.target.y };
                         // We need to calculate start point on the edge of the rect
                         // Center of the annotation in absolute coords (relative to this group transform is 0,0?)
                         // The group is transformed by translate(n.x, n.y).
                         // So 0,0 in this group is n.x, n.y in canvas space.
                         // The rect is at 0,0 with width w, height h.
                         
                         const rect = { x: 0, y: 0, w, h };
                         const center = { x: w / 2, y: h / 2 };
                         // Target in local space:
                         const localTarget = { x: targetAbs.x - n.x, y: targetAbs.y - n.y };
                         
                         const start = getIntersectPoint(center, localTarget, rect);
                         const end = localTarget;
                         
                         return (
                             <>
                                 <line
                                     x1={start.x}
                                     y1={start.y}
                                     x2={end.x}
                                     y2={end.y}
                                     stroke="#666"
                                     strokeWidth={2}
                                     strokeDasharray="4 4"
                                 />
                                 {/* Arrow Head (Triangle) */}
                                 {/* Calculate angle */}
                                 {(() => {
                                     const angle = Math.atan2(end.y - start.y, end.x - start.x);
                                     const headLen = 12;
                                     const x1 = end.x - headLen * Math.cos(angle - Math.PI / 6);
                                     const y1 = end.y - headLen * Math.sin(angle - Math.PI / 6);
                                     const x2 = end.x - headLen * Math.cos(angle + Math.PI / 6);
                                     const y2 = end.y - headLen * Math.sin(angle + Math.PI / 6);
                                     
                                     return (
                                         <polygon
                                             points={`${end.x},${end.y} ${x1},${y1} ${x2},${y2}`}
                                             fill="#666"
                                         />
                                     );
                                 })()}
                                 
                                 {/* Target Drag Handle */}
                                 {selected && (
                                     <circle
                                         cx={end.x}
                                         cy={end.y}
                                         r={6}
                                         fill="#0EA5E9"
                                         style={{ cursor: "move" }}
                                         onPointerDown={(e) => onArrowTargetDragStart?.(e, n.id)}
                                     />
                                 )}
                             </>
                         );
                     })()}
                 </g>
             )}
          </g>
        );
      })}
        </g>
      </g>
    </svg>
  );
});
