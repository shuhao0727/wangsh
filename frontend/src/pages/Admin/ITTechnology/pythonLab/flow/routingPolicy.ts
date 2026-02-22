import type { Direction, Rect } from "./geometry";
import { cleanupOrthogonalPolyline, polylineClear, routeOrthogonalVisioLike } from "./geometry";

export type Point = { x: number; y: number };

export type FanInIncoming = {
  start: Point;
  stub: number;
  obstacles: Rect[];
};

export type RoutePolicyInput = {
  start: Point;
  end: Point;
  startDir?: Direction;
  endDir?: Direction;
  obstacles: Rect[];
  corridorX?: number;
  sourceOffset?: number;
  targetOffset?: number;
  stub?: number;
  grid?: number;
  minSeg?: number;
  fanIn?: {
    incomings: FanInIncoming[];
  };
};

export type RoutingRuleId =
  | "manual"
  | "loop"
  | "target_first_leg"
  | "avoid_overlap"
  | "min_bends"
  | "min_length"
  | "maximize_shared_trunk";

export const routingRulePriority: RoutingRuleId[] = [
  "manual",
  "loop",
  "target_first_leg",
  "avoid_overlap",
  "min_bends",
  "min_length",
  "maximize_shared_trunk",
];

export function routeWithPolicy(input: RoutePolicyInput) {
  const grid = input.grid ?? 10;
  const minSeg = input.minSeg ?? 60;
  const base = routeOrthogonalVisioLike({ ...input, grid, minSeg, obstacles: input.obstacles });
  const fanIn = input.fanIn?.incomings?.length ? tryFanInMerge({ ...input, grid, minSeg }) : null;
  if (!fanIn) return base;
  return chooseByPriority({ base, fanIn, end: input.end, minSeg });
}

export function chooseByPriority(params: { base: Point[]; fanIn: Point[]; end: Point; minSeg: number }) {
  const { base, fanIn, end, minSeg } = params;
  const baseFirst = firstLegDir(base);
  const fanFirst = firstLegDir(fanIn);
  if (baseFirst !== "none" && fanFirst !== "none" && baseFirst !== fanFirst) return base;

  const baseLen = pathLen(base);
  const fanLen = pathLen(fanIn);
  const baseBends = bendCount(base);
  const fanBends = bendCount(fanIn);
  const baseTrunk = trunkLenIntoEnd(base, end);
  const fanTrunk = trunkLenIntoEnd(fanIn, end);

  const improvesShared = fanTrunk >= baseTrunk + 20;
  const okComplexity = fanBends <= baseBends + 1;
  const okLength = fanLen <= baseLen * 1.15 + 20;

  if (improvesShared && okComplexity && okLength) return fanIn;

  const basePriorityScore = priorityScore(base, end, minSeg);
  const fanPriorityScore = priorityScore(fanIn, end, minSeg);
  return lexicographicLess(fanPriorityScore, basePriorityScore) ? fanIn : base;
}

export function tryFanInMerge(input: RoutePolicyInput & { grid: number; minSeg: number }) {
  const endDir = input.endDir;
  if (!endDir || endDir !== "top") return null;
  const startDir = input.startDir;
  if (!startDir || startDir !== "bottom") return null;
  const incomings = input.fanIn?.incomings ?? [];
  if (incomings.length < 2) return null;

  const grid = input.grid;
  const minSeg = input.minSeg;
  const snap = (v: number) => Math.round(v / grid) * grid;

  const targetTopY = input.end.y;
  const maxStubEndY = incomings.reduce((m, it) => Math.max(m, it.start.y + it.stub), Number.NEGATIVE_INFINITY);
  const maxStub = incomings.reduce((m, it) => Math.max(m, it.stub), 0);
  if (!Number.isFinite(maxStubEndY)) return null;

  const minEndGap = Math.max(20, Math.round(maxStub * 0.6));
  const lower = snap(maxStubEndY);
  const upper = snap(targetTopY - minEndGap);
  if (lower >= upper) return null;

  const canUseY = (mergeY: number) => {
    for (let i = 0; i < incomings.length; i++) {
      const info = incomings[i];
      const cand = cleanupOrthogonalPolyline({
        points: [info.start, { x: info.start.x, y: mergeY }, { x: input.end.x, y: mergeY }, input.end],
        obstacles: info.obstacles,
        grid,
        minSeg,
      });
      if (!polylineClear(cand, info.obstacles)) return false;
    }
    return true;
  };

  let mergeY: number | null = null;
  for (let y = lower; y <= upper; y += grid) {
    if (canUseY(y)) {
      mergeY = y;
      break;
    }
  }
  if (mergeY === null) return null;

  const candidate = cleanupOrthogonalPolyline({
    points: [input.start, { x: input.start.x, y: mergeY }, { x: input.end.x, y: mergeY }, input.end],
    obstacles: input.obstacles,
    grid,
    minSeg,
  });
  return polylineClear(candidate, input.obstacles) ? candidate : null;
}

export function pathLen(poly: Point[]) {
  let s = 0;
  for (let i = 1; i < poly.length; i++) s += Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y);
  return s;
}

export function bendCount(poly: Point[]) {
  return Math.max(0, poly.length - 2);
}

export function firstLegDir(poly: Point[]) {
  if (poly.length < 2) return "none" as "none" | "v" | "h";
  const dx = Math.abs(poly[1].x - poly[0].x);
  const dy = Math.abs(poly[1].y - poly[0].y);
  if (dx < 1e-6 && dy < 1e-6) return "none" as "none" | "v" | "h";
  return dy >= dx ? ("v" as "none" | "v" | "h") : ("h" as "none" | "v" | "h");
}

export function trunkLenIntoEnd(poly: Point[], endP: Point) {
  if (poly.length < 2) return 0;
  const eps = 1e-6;
  let i = poly.length - 1;
  if (Math.abs(poly[i].x - endP.x) > eps || Math.abs(poly[i].y - endP.y) > eps) return 0;
  let j = i - 1;
  if (j < 0) return 0;
  if (Math.abs(poly[j].x - endP.x) > eps) return 0;
  let topY = poly[j].y;
  while (j - 1 >= 0 && Math.abs(poly[j - 1].x - endP.x) < eps) {
    topY = poly[j - 1].y;
    j -= 1;
  }
  return Math.abs(endP.y - topY);
}

export function priorityScore(poly: Point[], endP: Point, minSeg: number) {
  const len = pathLen(poly);
  const bends = bendCount(poly);
  const trunk = trunkLenIntoEnd(poly, endP);
  const tiny = tinySegments(poly, minSeg);
  return [tiny, bends, len, -trunk] as const;
}

function tinySegments(poly: Point[], minSeg: number) {
  let t = 0;
  for (let i = 1; i < poly.length; i++) if (Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y) < minSeg) t += 1;
  return t;
}

function lexicographicLess(a: readonly number[], b: readonly number[]) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return a.length < b.length;
}
