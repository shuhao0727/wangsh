import type { FlowNodeShape } from "../types";

export type PortSide = "top" | "right" | "bottom" | "left";

export type FlowNode = {
  id: string;
  shape: FlowNodeShape;
  title: string;
  tooltip?: string;
  emphasis?: "critical";
  x: number;
  y: number;
  sourceLine?: number;
  sourceRole?: string;
  sourceRange?: { startLine: number; startCol: number; endLine: number; endCol: number };
};

export type FlowEdge = {
  id: string;
  from: string;
  to: string;
  style: "straight" | "polyline";
  emphasis?: "critical";
  routeMode?: "auto" | "manual";
  routeShape?: "orthogonal" | "free";
  anchor?: { x: number; y: number } | null;
  fromPort?: PortSide;
  fromDir?: { ux: number; uy: number };
  fromFree?: { x: number; y: number } | null;
  toPort?: PortSide;
  toDir?: { ux: number; uy: number };
  toFree?: { x: number; y: number } | null;
  anchors?: { x: number; y: number }[];
  label?: string;
  toEdge?: string;
  toEdgeT?: number;
};
