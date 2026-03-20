export type PortSide = "top" | "right" | "bottom" | "left";

export type FlowPoint = { x: number; y: number };

export type FlowAttach = FlowPoint;

export type FlowNodeShape =
  | "start_end"
  | "process"
  | "decision"
  | "io"
  | "connector"
  | "subroutine"
  | "list_op"
  | "dict_op"
  | "str_op"
  | "jump"
  | "collection"
  | "note";

export type FlowNodeType = "flow_element" | "annotation";

export type FlowNodeStyle = {
  backgroundColor?: string;
  opacity?: number;
  dashed?: boolean;
};

export type FlowNodeArrow = {
  target: FlowPoint;
  sourceAnchor?: "center" | "edge"; // Defaults to center/auto
  headType?: "triangle";
  rotation?: number; // Rotation in degrees
};

export type FlowNode = {
  id: string;
  type: FlowNodeType;
  shape: FlowNodeShape;
  title: string;
  tooltip?: string;
  emphasis?: "critical";
  x: number;
  y: number;
  width?: number;
  height?: number;
  style?: FlowNodeStyle;
  arrow?: FlowNodeArrow;
  sourceLine?: number;
  sourceRole?: string;
  sourceRange?: { startLine: number; startCol: number; endLine: number; endCol: number };
};

export type FlowEdge = {
  id: string;
  from: string;
  to: string;
  style: "straight" | "polyline" | "bezier"; // Added bezier support
  emphasis?: "critical";
  routeMode?: "auto" | "manual";
  routeShape?: "orthogonal" | "free" | "bezier"; // Added bezier support
  anchor?: FlowPoint | null;
  fromAttach?: FlowAttach | null;
  fromPort?: PortSide;
  fromDir?: { ux: number; uy: number };
  fromFree?: FlowPoint | null;
  toAttach?: FlowAttach | null;
  toPort?: PortSide;
  toDir?: { ux: number; uy: number };
  toFree?: FlowPoint | null;
  anchors?: FlowPoint[]; // For bezier, these are control points
  label?: string;
  labelPosition?: FlowPoint; // Added explicit label position
  toEdge?: string;
  toEdgeT?: number;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const toStringOrNull = (v: unknown) => (typeof v === "string" ? v : null);

const toNumberOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

const toPointOrNull = (v: unknown): FlowPoint | null => {
  if (!isRecord(v)) return null;
  const x = toNumberOrNull(v.x);
  const y = toNumberOrNull(v.y);
  if (x === null || y === null) return null;
  return { x, y };
};

const toDirOrUndefined = (v: unknown): { ux: number; uy: number } | undefined => {
  if (!isRecord(v)) return undefined;
  const ux = toNumberOrNull(v.ux);
  const uy = toNumberOrNull(v.uy);
  if (ux === null || uy === null) return undefined;
  return { ux, uy };
};

const isPortSide = (v: unknown): v is PortSide => v === "top" || v === "right" || v === "bottom" || v === "left";

const isFlowNodeShape = (v: unknown): v is FlowNodeShape =>
  v === "start_end" ||
  v === "process" ||
  v === "decision" ||
  v === "io" ||
  v === "connector" ||
  v === "subroutine" ||
  v === "list_op" ||
  v === "dict_op" ||
  v === "str_op" ||
  v === "jump" ||
  v === "collection" ||
  v === "note";

const inferCollectionShapeFromTitle = (title: string): FlowNodeShape => {
  const t = title.trim();
  const low = t.toLowerCase();
  if (!t) return "list_op";
  if (/=\s*\{[^}]*\}\s*$/.test(t)) return "dict_op";
  if (/\.\s*(get|setdefault|update|items|keys|values|popitem)\s*\(/.test(low)) return "dict_op";
  if (/\.\s*(append|extend|insert|remove|clear|sort|reverse|pop)\s*\(/.test(low)) return "list_op";
  if (/^[a-z_][a-z0-9_]*\s*\[[^\]]+\]\s*=/.test(low) && low.includes("dict")) return "dict_op";
  if (/=\s*dict\s*\(/.test(low) || /dict\s*\(/.test(low)) return "dict_op";
  return "list_op";
};

const isEdgeStyle = (v: unknown): v is FlowEdge["style"] => v === "straight" || v === "polyline" || v === "bezier";

const isRouteMode = (v: unknown): v is NonNullable<FlowEdge["routeMode"]> => v === "auto" || v === "manual";

const isRouteShape = (v: unknown): v is NonNullable<FlowEdge["routeShape"]> => v === "orthogonal" || v === "free" || v === "bezier";

export function normalizeFlowNode(input: unknown): FlowNode | null {
  if (!isRecord(input)) return null;
  const id = toStringOrNull(input.id);
  const shape = input.shape;
  const title = toStringOrNull(input.title);
  const x = toNumberOrNull(input.x);
  const y = toNumberOrNull(input.y);
  if (!id || !isFlowNodeShape(shape) || title === null || x === null || y === null) return null;
  const normalizedShape: FlowNodeShape = shape === "collection" ? inferCollectionShapeFromTitle(title) : shape;

  const tooltip = toStringOrNull(input.tooltip ?? undefined) ?? undefined;
  const emphasis = input.emphasis === "critical" ? "critical" : undefined;
  const sourceLine = toNumberOrNull(input.sourceLine ?? undefined) ?? undefined;
  const sourceRole = toStringOrNull(input.sourceRole ?? undefined) ?? undefined;
  const sourceRange = (() => {
    const r = input.sourceRange;
    if (!isRecord(r)) return undefined;
    const startLine = toNumberOrNull(r.startLine);
    const startCol = toNumberOrNull(r.startCol);
    const endLine = toNumberOrNull(r.endLine);
    const endCol = toNumberOrNull(r.endCol);
    if (startLine === null || startCol === null || endLine === null || endCol === null) return undefined;
    return { startLine, startCol, endLine, endCol };
  })();

  const type: FlowNodeType = normalizedShape === "note" ? "annotation" : "flow_element";
  const width = toNumberOrNull(input.width ?? undefined) ?? undefined;
  const height = toNumberOrNull(input.height ?? undefined) ?? undefined;

  const style = (() => {
    const s = input.style;
    if (!isRecord(s)) return undefined;
    return {
      backgroundColor: toStringOrNull(s.backgroundColor) ?? undefined,
      opacity: toNumberOrNull(s.opacity) ?? undefined,
      dashed: typeof s.dashed === "boolean" ? s.dashed : undefined,
    };
  })();

  const arrow = (() => {
    const a = input.arrow;
    if (!isRecord(a)) return undefined;
    const target = toPointOrNull(a.target);
    if (!target) return undefined;
    return {
      target,
      sourceAnchor: a.sourceAnchor === "edge" ? ("edge" as const) : ("center" as const),
      headType: a.headType === "triangle" ? ("triangle" as const) : undefined,
      rotation: toNumberOrNull(a.rotation) ?? undefined,
    };
  })();

  return {
    id,
    type,
    shape: normalizedShape,
    title,
    tooltip,
    emphasis,
    x,
    y,
    width,
    height,
    style,
    arrow,
    sourceLine,
    sourceRole,
    sourceRange,
  };
}

export function normalizeFlowEdge(input: unknown): FlowEdge | null {
  if (!isRecord(input)) return null;
  const id = toStringOrNull(input.id);
  const from = toStringOrNull(input.from);
  const to = toStringOrNull(input.to);
  if (!id || !from || !to) return null;

  const style: FlowEdge["style"] = isEdgeStyle(input.style) ? input.style : "straight";
  const emphasis = input.emphasis === "critical" ? "critical" : undefined;
  const routeMode: FlowEdge["routeMode"] = isRouteMode(input.routeMode) ? input.routeMode : undefined;
  const routeShape: FlowEdge["routeShape"] = isRouteShape(input.routeShape) ? input.routeShape : undefined;
  const anchor: FlowEdge["anchor"] = input.anchor === null ? null : toPointOrNull(input.anchor) ?? undefined;

  const fromAttach: FlowEdge["fromAttach"] = input.fromAttach === null ? null : toPointOrNull(input.fromAttach) ?? undefined;
  const toAttach: FlowEdge["toAttach"] = input.toAttach === null ? null : toPointOrNull(input.toAttach) ?? undefined;

  const fromPort: FlowEdge["fromPort"] = isPortSide(input.fromPort) ? input.fromPort : undefined;
  const toPort: FlowEdge["toPort"] = isPortSide(input.toPort) ? input.toPort : undefined;
  const fromDir: FlowEdge["fromDir"] = toDirOrUndefined(input.fromDir);
  const toDir: FlowEdge["toDir"] = toDirOrUndefined(input.toDir);

  const fromFree: FlowEdge["fromFree"] = input.fromFree === null ? null : toPointOrNull(input.fromFree) ?? undefined;
  const toFree: FlowEdge["toFree"] = input.toFree === null ? null : toPointOrNull(input.toFree) ?? undefined;

  const anchors: FlowEdge["anchors"] = Array.isArray(input.anchors)
    ? input.anchors
      .map((p) => toPointOrNull(p))
      .filter((p): p is FlowPoint => !!p)
    : undefined;
  const label = toStringOrNull(input.label ?? undefined) ?? undefined;
  const labelPosition = toPointOrNull(input.labelPosition) ?? undefined;
  const toEdge = toStringOrNull(input.toEdge ?? undefined) ?? undefined;
  const toEdgeT = toNumberOrNull(input.toEdgeT ?? undefined) ?? undefined;

  return {
    id,
    from,
    to,
    style,
    emphasis,
    routeMode,
    routeShape,
    anchor,
    fromAttach,
    fromPort,
    fromDir,
    fromFree,
    toAttach,
    toPort,
    toDir,
    toFree,
    anchors,
    label,
    labelPosition,
    toEdge,
    toEdgeT,
  };
}

export function normalizeFlowImport(input: unknown): { nodes: FlowNode[]; edges: FlowEdge[] } | null {
  if (!isRecord(input)) return null;
  const ns = Array.isArray(input.nodes) ? input.nodes : null;
  const es = Array.isArray(input.edges) ? input.edges : null;
  if (!ns || !es) return null;

  const nodes = ns.map((n) => normalizeFlowNode(n)).filter((n): n is FlowNode => !!n);
  const edges = es.map((e) => normalizeFlowEdge(e)).filter((e): e is FlowEdge => !!e);
  if (!nodes.length) return null;
  return { nodes, edges };
}
