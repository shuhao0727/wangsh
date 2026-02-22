import type { FlowNodeShape } from "../types";
import type { PortSide } from "./model";

export const nodeScale = 0.5;

export function shapeColor(shape: FlowNodeShape) {
  if (shape === "start_end") return "#1677ff";
  if (shape === "process") return "#13c2c2";
  if (shape === "subroutine") return "#52c41a";
  if (shape === "decision") return "#722ed1";
  if (shape === "io") return "#fa8c16";
  return "#2f54eb";
}

export function nodeSize(shape: FlowNodeShape) {
  if (shape === "decision") return { w: Math.round(220 * nodeScale), h: Math.round(140 * nodeScale) };
  if (shape === "connector") return { w: Math.round(110 * nodeScale), h: Math.round(110 * nodeScale) };
  if (shape === "subroutine") return { w: Math.round(260 * nodeScale), h: Math.round(90 * nodeScale) };
  return { w: Math.round(240 * nodeScale), h: Math.round(90 * nodeScale) };
}

export function wrapNodeTitle(title: string, shape: FlowNodeShape): string[] {
  const raw = (title || "").trim();
  if (!raw) return [""];
  const baseMax = shape === "decision" ? 18 : shape === "subroutine" ? 24 : 26;
  const max = Math.max(12, Math.min(40, baseMax));
  const chunks: string[] = [];
  let s = raw;
  while (s.length) {
    chunks.push(s.slice(0, max));
    s = s.slice(max);
    if (chunks.length >= 4) {
      if (s.length) chunks[chunks.length - 1] = `${chunks[chunks.length - 1]}…`;
      break;
    }
  }
  return chunks;
}

export function nodeSizeForTitle(shape: FlowNodeShape, title: string) {
  const base = nodeSize(shape);
  const lines = wrapNodeTitle(title, shape);
  const maxChars = lines.reduce((m, x) => Math.max(m, x.length), 0);
  const charW = shape === "decision" ? 7 : 7.2;
  const padW = shape === "decision" ? 70 : 56;
  const desiredW = Math.round((maxChars * charW + padW) * nodeScale);
  const minW = base.w;
  const maxW = Math.round(460 * nodeScale);
  const w = Math.max(minW, Math.min(maxW, desiredW));
  const lineH = 16 * nodeScale;
  const desiredH = Math.round((Math.max(1, lines.length) * lineH + 44 * nodeScale) * 1);
  const minH = base.h;
  const maxH = Math.round(220 * nodeScale);
  const h = Math.max(minH, Math.min(maxH, desiredH));
  return { w, h };
}

export function chooseSide(dx: number, dy: number): PortSide {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

export function fixedPortForStartEnd(title: string): PortSide {
  const t = title.trim().toLowerCase();
  if (t.includes("结束") || t.includes("end")) return "top";
  return "bottom";
}

export function allowedPortsForShape(shape: FlowNodeShape, title: string): PortSide[] {
  if (shape === "start_end") return [fixedPortForStartEnd(title)];
  return ["top", "right", "bottom", "left"];
}

export function nodePortLocal(shape: FlowNodeShape, w: number, h: number, side: PortSide) {
  const hw = w / 2;
  const hh = h / 2;
  if (shape === "io") {
    const slant = Math.min(14, Math.max(10, w * 0.12));
    if (side === "top") return { x: 0, y: -hh };
    if (side === "bottom") return { x: 0, y: hh };
    if (side === "left") return { x: -hw + slant / 2, y: 0 };
    return { x: hw - slant / 2, y: 0 };
  }
  if (side === "top") return { x: 0, y: -hh };
  if (side === "bottom") return { x: 0, y: hh };
  if (side === "left") return { x: -hw, y: 0 };
  return { x: hw, y: 0 };
}

export function shapePolygonForAttach(shape: FlowNodeShape, w: number, h: number) {
  const hw = w / 2;
  const hh = h / 2;
  if (shape === "decision") {
    return [
      { x: 0, y: -hh },
      { x: hw, y: 0 },
      { x: 0, y: hh },
      { x: -hw, y: 0 },
    ];
  }
  if (shape === "io") {
    const slant = Math.min(14, Math.max(10, w * 0.12));
    return [
      { x: -hw + slant, y: -hh },
      { x: hw, y: -hh },
      { x: hw - slant, y: hh },
      { x: -hw, y: hh },
    ];
  }
  return [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
}
