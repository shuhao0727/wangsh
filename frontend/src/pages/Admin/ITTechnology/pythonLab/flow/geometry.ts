export function norm(dx: number, dy: number) {
  const len = Math.hypot(dx, dy);
  if (!len) return { ux: 0, uy: 0, len: 0 };
  return { ux: dx / len, uy: dy / len, len };
}

function cross(a: { x: number; y: number }, b: { x: number; y: number }) {
  return a.x * b.y - a.y * b.x;
}

function sub(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: a.x - b.x, y: a.y - b.y };
}

const ALIGN_EPS = 16;
const MIN_SEG = 32;

export function rayIntersectPolygon(dir: { x: number; y: number }, polygon: { x: number; y: number }[]) {
  const p0 = { x: 0, y: 0 };
  let bestT = Number.POSITIVE_INFINITY;
  let hit: { x: number; y: number } | null = null;

  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const v = sub(b, a);
    const denom = cross(dir, v);
    if (Math.abs(denom) < 1e-6) continue;
    const ap = sub(a, p0);
    const t = cross(ap, v) / denom;
    const s = cross(ap, dir) / denom;
    if (t >= 0 && s >= 0 && s <= 1 && t < bestT) {
      bestT = t;
      hit = { x: p0.x + dir.x * t, y: p0.y + dir.y * t };
    }
  }
  return hit;
}

export function pointAtT(poly: { x: number; y: number }[], t: number) {
  const clamped = Math.max(0, Math.min(1, t));
  let total = 0;
  for (let i = 1; i < poly.length; i++) total += Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y);
  if (!total) return { x: poly[0]?.x ?? 0, y: poly[0]?.y ?? 0 };
  const target = total * clamped;
  let acc = 0;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1];
    const b = poly[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (acc + seg >= target) {
      const r = (target - acc) / (seg || 1);
      return { x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r };
    }
    acc += seg;
  }
  return poly[poly.length - 1];
}

export function nearestTOnPolyline(poly: { x: number; y: number }[], p: { x: number; y: number }) {
  let best = { dist: Number.POSITIVE_INFINITY, along: 0, total: 0 };
  let total = 0;
  const segLens: number[] = [];
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1];
    const b = poly[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segLens.push(len);
    total += len;
  }
  let prefix = 0;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1];
    const b = poly[i];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const len2 = vx * vx + vy * vy;
    const t = len2 ? ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2 : 0;
    const clamped = Math.max(0, Math.min(1, t));
    const qx = a.x + vx * clamped;
    const qy = a.y + vy * clamped;
    const d = Math.hypot(p.x - qx, p.y - qy);
    const along = prefix + segLens[i - 1] * clamped;
    if (d < best.dist) best = { dist: d, along, total };
    prefix += segLens[i - 1];
  }
  return best.total ? best.along / best.total : 0.5;
}

function simplifyPolyline(points: { x: number; y: number }[]) {
  const deduped: { x: number; y: number }[] = [];
  for (const p of points) {
    const last = deduped[deduped.length - 1];
    if (last && Math.abs(last.x - p.x) < 1e-6 && Math.abs(last.y - p.y) < 1e-6) continue;
    deduped.push(p);
  }
  if (deduped.length <= 2) return deduped;

  const out: { x: number; y: number }[] = [deduped[0]];
  for (let i = 1; i < deduped.length - 1; i++) {
    const a = out[out.length - 1];
    const b = deduped[i];
    const c = deduped[i + 1];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const bcx = c.x - b.x;
    const bcy = c.y - b.y;
    const colinear = Math.abs(abx * bcy - aby * bcx) < 1e-6;
    if (colinear) {
      const sameAxis = (Math.abs(abx) < 1e-6 && Math.abs(bcx) < 1e-6) || (Math.abs(aby) < 1e-6 && Math.abs(bcy) < 1e-6);
      if (sameAxis) continue;
    }
    out.push(b);
  }
  out.push(deduped[deduped.length - 1]);
  return out;
}

function forceOrthogonal(points: { x: number; y: number }[]) {
  if (points.length <= 2) return points;
  const out: { x: number; y: number }[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = out[out.length - 1];
    let b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) < 1e-6 || Math.abs(dy) < 1e-6) {
      out.push(b);
      continue;
    }
    if (Math.abs(dx) < ALIGN_EPS) {
      b = { ...b, x: a.x };
      out.push(b);
      continue;
    }
    if (Math.abs(dy) < ALIGN_EPS) {
      b = { ...b, y: a.y };
      out.push(b);
      continue;
    }
    const bendHV = { x: b.x, y: a.y };
    const bendVH = { x: a.x, y: b.y };
    const scoreBend = (bend: { x: number; y: number }) => {
      const l1 = Math.hypot(bend.x - a.x, bend.y - a.y);
      const l2 = Math.hypot(b.x - bend.x, b.y - bend.y);
      const tiny = (l1 < MIN_SEG ? 1 : 0) + (l2 < MIN_SEG ? 1 : 0);
      const min = Math.min(l1, l2);
      return { tiny, min };
    };
    const s1 = scoreBend(bendHV);
    const s2 = scoreBend(bendVH);
    const bend = s2.tiny < s1.tiny || (s2.tiny === s1.tiny && s2.min > s1.min) ? bendVH : bendHV;
    out.push(bend, b);
  }
  return out;
}

export type Direction = "top" | "bottom" | "left" | "right";

export type Rect = { minX: number; minY: number; maxX: number; maxY: number };

export function polylineToPath(poly: { x: number; y: number }[]) {
  if (!poly || poly.length === 0) return "";
  let d = `M ${poly[0].x} ${poly[0].y}`;
  for (let i = 1; i < poly.length; i++) d += ` L ${poly[i].x} ${poly[i].y}`;
  return d;
}

export function catmullRomToBezierPath(poly: { x: number; y: number }[]) {
  const pts = poly || [];
  if (pts.length < 2) return "";
  if (pts.length === 2) return polylineToPath(pts);
  const t = 1;
  const p = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  const fmt = (n: number) => (Number.isFinite(n) ? String(Number(n.toFixed(2))) : "0");
  let d = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = p(i - 1);
    const p1 = p(i);
    const p2 = p(i + 1);
    const p3 = p(i + 2);
    const cp1 = { x: p1.x + ((p2.x - p0.x) * t) / 6, y: p1.y + ((p2.y - p0.y) * t) / 6 };
    const cp2 = { x: p2.x - ((p3.x - p1.x) * t) / 6, y: p2.y - ((p3.y - p1.y) * t) / 6 };
    d += ` C ${fmt(cp1.x)} ${fmt(cp1.y)} ${fmt(cp2.x)} ${fmt(cp2.y)} ${fmt(p2.x)} ${fmt(p2.y)}`;
  }
  return d;
}

function rectContains(r: Rect, p: { x: number; y: number }) {
  return p.x > r.minX && p.x < r.maxX && p.y > r.minY && p.y < r.maxY;
}

function segmentHitsRect(a: { x: number; y: number }, b: { x: number; y: number }, r: Rect) {
  if (Math.abs(a.x - b.x) < 1e-6) {
    const x = a.x;
    if (x <= r.minX || x >= r.maxX) return false;
    const y1 = Math.min(a.y, b.y);
    const y2 = Math.max(a.y, b.y);
    return y2 > r.minY && y1 < r.maxY;
  }
  if (Math.abs(a.y - b.y) < 1e-6) {
    const y = a.y;
    if (y <= r.minY || y >= r.maxY) return false;
    const x1 = Math.min(a.x, b.x);
    const x2 = Math.max(a.x, b.x);
    return x2 > r.minX && x1 < r.maxX;
  }
  return true;
}

function segmentBlocked(a: { x: number; y: number }, b: { x: number; y: number }, obstacles: Rect[]) {
  for (let i = 0; i < obstacles.length; i++) if (segmentHitsRect(a, b, obstacles[i])) return true;
  return false;
}

function moveByDir(p: { x: number; y: number }, dir: Direction, dist: number) {
  if (dir === "top") return { x: p.x, y: p.y - dist };
  if (dir === "bottom") return { x: p.x, y: p.y + dist };
  if (dir === "left") return { x: p.x - dist, y: p.y };
  return { x: p.x + dist, y: p.y };
}

export function cleanupOrthogonalPolyline(params: {
  points: { x: number; y: number }[];
  obstacles?: Rect[];
  grid?: number;
  minSeg?: number;
}) {
  const grid = params.grid ?? 10;
  const minSeg = params.minSeg ?? MIN_SEG;
  const obstacles = params.obstacles ?? [];

  const snap = (v: number) => Math.round(v / grid) * grid;
  let poly = params.points.map((p) => ({ x: snap(p.x), y: snap(p.y) }));
  poly = simplifyPolyline(forceOrthogonal(poly));

  const okPoint = (p: { x: number; y: number }) => {
    for (let i = 0; i < obstacles.length; i++) if (rectContains(obstacles[i], p)) return false;
    return true;
  };
  const okSeg = (a: { x: number; y: number }, b: { x: number; y: number }) => !segmentBlocked(a, b, obstacles);
  const segLen = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(b.x - a.x, b.y - a.y);

  const scoreCandidate = (a: { x: number; y: number }, mid: { x: number; y: number }, c: { x: number; y: number }) => {
    const l1 = segLen(a, mid);
    const l2 = segLen(mid, c);
    const tiny = (l1 < minSeg ? 1 : 0) + (l2 < minSeg ? 1 : 0);
    return { tiny, min: Math.min(l1, l2) };
  };

  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (let i = 1; i < poly.length - 1; i++) {
      const a = poly[i - 1];
      const b = poly[i];
      const c = poly[i + 1];
      const l1 = segLen(a, b);
      const l2 = segLen(b, c);
      if (l1 >= minSeg && l2 >= minSeg) continue;

      const cand1 = { x: a.x, y: c.y };
      const cand2 = { x: c.x, y: a.y };
      const candidates: { p: { x: number; y: number }; s: { tiny: number; min: number } }[] = [];

      if (okPoint(cand1) && okSeg(a, cand1) && okSeg(cand1, c)) candidates.push({ p: cand1, s: scoreCandidate(a, cand1, c) });
      if (okPoint(cand2) && okSeg(a, cand2) && okSeg(cand2, c)) candidates.push({ p: cand2, s: scoreCandidate(a, cand2, c) });

      if (!candidates.length) continue;
      candidates.sort((x, y) => x.s.tiny - y.s.tiny || y.s.min - x.s.min);
      const best = candidates[0].p;

      if (Math.abs(best.x - a.x) < 1e-6 && Math.abs(best.y - a.y) < 1e-6) {
        poly.splice(i, 1);
        i -= 1;
        changed = true;
        continue;
      }
      if (Math.abs(best.x - c.x) < 1e-6 && Math.abs(best.y - c.y) < 1e-6) {
        poly.splice(i, 1);
        i -= 1;
        changed = true;
        continue;
      }
      if (Math.abs(best.x - b.x) > 1e-6 || Math.abs(best.y - b.y) > 1e-6) {
        poly[i] = best;
        changed = true;
      }
    }
    if (!changed) break;
    poly = simplifyPolyline(forceOrthogonal(poly));
  }

  return poly;
}

export function polylineClear(poly: { x: number; y: number }[], obstacles: Rect[]) {
  for (let i = 0; i < poly.length; i++) {
    for (let k = 0; k < obstacles.length; k++) if (rectContains(obstacles[k], poly[i])) return false;
  }
  for (let i = 1; i < poly.length; i++) if (segmentBlocked(poly[i - 1], poly[i], obstacles)) return false;
  return true;
}

export function routeOrthogonalVisioLike(params: {
  start: { x: number; y: number };
  end: { x: number; y: number };
  sourceDir?: Direction;
  targetDir?: Direction;
  obstacles: Rect[];
  corridorX?: number;
  sourceOffset?: number;
  targetOffset?: number;
  stub?: number;
  grid?: number;
  minSeg?: number;
}) {
  const grid = params.grid ?? 10;
  const stub = params.stub ?? 24;
  const minSeg = params.minSeg ?? 60;
  const corridorX = params.corridorX;
  const sourceOffset = params.sourceOffset ?? 0;
  const targetOffset = params.targetOffset ?? 0;
  const obstacles = params.obstacles;
  const snap = (v: number) => Math.round(v / grid) * grid;

  const s0 = { x: snap(params.start.x), y: snap(params.start.y) };
  const e0 = { x: snap(params.end.x), y: snap(params.end.y) };

  const s1raw = params.sourceDir ? moveByDir(s0, params.sourceDir, stub) : s0;
  const e1raw = params.targetDir ? moveByDir(e0, params.targetDir, stub) : e0;

  const okPoint = (p: { x: number; y: number }) => {
    for (let i = 0; i < obstacles.length; i++) if (rectContains(obstacles[i], p)) return false;
    return true;
  };
  const okSeg = (a: { x: number; y: number }, b: { x: number; y: number }) => !segmentBlocked(a, b, obstacles);
  const validate = (poly: { x: number; y: number }[]) => {
    for (let i = 0; i < poly.length; i++) if (!okPoint(poly[i])) return false;
    for (let i = 1; i < poly.length; i++) if (!okSeg(poly[i - 1], poly[i])) return false;
    return true;
  };

  const withCleanup = (poly: { x: number; y: number }[]) => cleanupOrthogonalPolyline({ points: poly, obstacles, grid, minSeg });

  const buildStartChain = () => {
    const pts: { x: number; y: number }[] = [s0];
    if (!params.sourceDir) return { pts, pivot: s0 };
    const stubPt =
      params.sourceDir === "top" || params.sourceDir === "bottom"
        ? { x: s0.x, y: snap(s1raw.y) }
        : { x: snap(s1raw.x), y: s0.y };
    pts.push(stubPt);
    if (sourceOffset) {
      const off = snap(sourceOffset);
      const shifted =
        params.sourceDir === "top" || params.sourceDir === "bottom" ? { x: snap(stubPt.x + off), y: stubPt.y } : { x: stubPt.x, y: snap(stubPt.y + off) };
      pts.push(shifted);
      return { pts, pivot: shifted };
    }
    return { pts, pivot: stubPt };
  };

  const buildEndChain = () => {
    if (!params.targetDir) return { pts: [e0], pivot: e0, tail: [e0] };
    const stubPt =
      params.targetDir === "top" || params.targetDir === "bottom"
        ? { x: e0.x, y: snap(e1raw.y) }
        : { x: snap(e1raw.x), y: e0.y };
    if (targetOffset) {
      const off = snap(targetOffset);
      const shifted =
        params.targetDir === "top" || params.targetDir === "bottom" ? { x: snap(stubPt.x + off), y: stubPt.y } : { x: stubPt.x, y: snap(stubPt.y + off) };
      return { pts: [shifted, stubPt, e0], pivot: shifted, tail: [shifted, stubPt, e0] };
    }
    return { pts: [stubPt, e0], pivot: stubPt, tail: [stubPt, e0] };
  };

  const startChain = buildStartChain();
  const endChain = buildEndChain();

  const stitch = (mid: { x: number; y: number }[]) => {
    const poly = [...startChain.pts, ...mid.slice(1, mid.length - 1), ...endChain.tail];
    return withCleanup(poly);
  };

  const directMidVH = [startChain.pivot, { x: startChain.pivot.x, y: endChain.pivot.y }, endChain.pivot];
  const directMidHV = [startChain.pivot, { x: endChain.pivot.x, y: startChain.pivot.y }, endChain.pivot];
  const dx = endChain.pivot.x - startChain.pivot.x;
  const dy = endChain.pivot.y - startChain.pivot.y;
  const dxAbs = Math.abs(dx);
  const dyAbs = Math.abs(dy);
  const preferHV = dyAbs >= minSeg / 2 ? false : dxAbs >= minSeg / 2 ? true : dxAbs > dyAbs;
  const firstMid = preferHV ? directMidHV : directMidVH;
  const secondMid = preferHV ? directMidVH : directMidHV;
  const direct1 = stitch(firstMid);
  if (validate(direct1)) return direct1;
  const direct2 = stitch(secondMid);
  if (validate(direct2)) return direct2;

  const tryCorridor = (x0: number) => {
    const poly = stitch([startChain.pivot, { x: snap(x0), y: startChain.pivot.y }, { x: snap(x0), y: endChain.pivot.y }, endChain.pivot]);
    return validate(poly) ? poly : null;
  };

  if (corridorX !== undefined) {
    const baseX = snap(corridorX);
    const wantsLeft = baseX < startChain.pivot.x - grid;
    const step = Math.max(grid * 6, snap(minSeg));

    const fitsBase = Math.abs(baseX - startChain.pivot.x) >= minSeg || Math.abs(baseX - endChain.pivot.x) >= minSeg;
    const first = tryCorridor(fitsBase ? baseX : baseX + (wantsLeft ? -step : step));
    if (first) return first;

    for (let k = 1; k <= 8; k++) {
      const dx = step * k;
      const cand1 = tryCorridor(baseX + (wantsLeft ? -dx : dx));
      if (cand1) return cand1;
      const cand2 = tryCorridor(baseX + (wantsLeft ? dx : -dx));
      if (cand2) return cand2;
    }
  }

  return direct1;
}

export function routeOrthogonalLoopTemplate(params: {
  start: { x: number; y: number };
  end: { x: number; y: number };
  sourceDir?: Direction;
  targetDir?: Direction;
  corridorX: number;
  trackY: number;
  sourceOffset?: number;
  targetOffset?: number;
  stub?: number;
  grid?: number;
}) {
  const grid = params.grid ?? 10;
  const stub = params.stub ?? 24;
  const snap = (v: number) => Math.round(v / grid) * grid;
  const sourceOffset = params.sourceOffset ?? 0;
  const targetOffset = params.targetOffset ?? 0;

  const s0 = { x: snap(params.start.x), y: snap(params.start.y) };
  const e0 = { x: snap(params.end.x), y: snap(params.end.y) };
  const s1raw = params.sourceDir ? moveByDir(s0, params.sourceDir, stub) : s0;
  const e1raw = params.targetDir ? moveByDir(e0, params.targetDir, stub) : e0;
  const s1 = params.sourceDir
    ? params.sourceDir === "top" || params.sourceDir === "bottom"
      ? { x: s0.x, y: snap(s1raw.y) }
      : { x: snap(s1raw.x), y: s0.y }
    : s0;
  const e1 = params.targetDir
    ? params.targetDir === "top" || params.targetDir === "bottom"
      ? { x: e0.x, y: snap(e1raw.y) }
      : { x: snap(e1raw.x), y: e0.y }
    : e0;

  const loopX = snap(params.corridorX);
  const loopY = snap(params.trackY);

  const poly: { x: number; y: number }[] = [s0];
  if (Math.abs(s1.x - s0.x) > 1e-6 || Math.abs(s1.y - s0.y) > 1e-6) poly.push(s1);
  let sPivot = s1;
  if (sourceOffset) {
    const off = snap(sourceOffset);
    sPivot = params.sourceDir === "top" || params.sourceDir === "bottom" ? { x: snap(s1.x + off), y: s1.y } : { x: s1.x, y: snap(s1.y + off) };
    poly.push(sPivot);
  }

  const eStub = e1;
  let ePivot = eStub;
  const endTail: { x: number; y: number }[] = [];
  if (targetOffset) {
    const off = snap(targetOffset);
    ePivot = params.targetDir === "top" || params.targetDir === "bottom" ? { x: snap(eStub.x + off), y: eStub.y } : { x: eStub.x, y: snap(eStub.y + off) };
    endTail.push(ePivot, eStub, e0);
  } else if (Math.abs(eStub.x - e0.x) > 1e-6 || Math.abs(eStub.y - e0.y) > 1e-6) {
    endTail.push(eStub, e0);
  } else {
    endTail.push(e0);
  }

  poly.push({ x: loopX, y: sPivot.y });
  poly.push({ x: loopX, y: loopY });
  poly.push({ x: ePivot.x, y: loopY });
  poly.push(...endTail);
  return poly;
}

type HeapItem = { key: number; state: number };

class MinHeap {
  data: HeapItem[] = [];
  push(it: HeapItem) {
    const a = this.data;
    a.push(it);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].key <= a[i].key) break;
      const t = a[p];
      a[p] = a[i];
      a[i] = t;
      i = p;
    }
  }
  pop() {
    const a = this.data;
    if (a.length === 0) return null;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      while (true) {
        const l = i * 2 + 1;
        const r = l + 1;
        if (l >= a.length) break;
        let m = l;
        if (r < a.length && a[r].key < a[l].key) m = r;
        if (a[i].key <= a[m].key) break;
        const t = a[i];
        a[i] = a[m];
        a[m] = t;
        i = m;
      }
    }
    return top;
  }
  get size() {
    return this.data.length;
  }
}

export function routeOrthogonalAvoiding(params: {
  start: { x: number; y: number };
  end: { x: number; y: number };
  sourceDir?: Direction;
  targetDir?: Direction;
  obstacles: Rect[];
  stub?: number;
  grid?: number;
  turnPenalty?: number;
  corridorX?: number;
  corridorWeight?: number;
}) {
  const grid = params.grid ?? 10;
  const stub = params.stub ?? 20;
  const turnPenalty = params.turnPenalty ?? 120;
  const corridorX = params.corridorX;
  const corridorWeight = params.corridorWeight ?? 0;

  const snap = (v: number, g: number) => Math.round(v / g) * g;

  const s0 = params.start;
  const e0 = params.end;
  const s1raw = params.sourceDir ? moveByDir(s0, params.sourceDir, stub) : s0;
  const e1raw = params.targetDir ? moveByDir(e0, params.targetDir, stub) : e0;
  const s1 = params.sourceDir
    ? params.sourceDir === "top" || params.sourceDir === "bottom"
      ? { x: s0.x, y: snap(s1raw.y, grid) }
      : { x: snap(s1raw.x, grid), y: s0.y }
    : { x: s0.x, y: s0.y };
  const e1 = params.targetDir
    ? params.targetDir === "top" || params.targetDir === "bottom"
      ? { x: e0.x, y: snap(e1raw.y, grid) }
      : { x: snap(e1raw.x, grid), y: e0.y }
    : { x: e0.x, y: e0.y };

  const obstacles = params.obstacles;

  const xs: number[] = [s1.x, e1.x];
  const ys: number[] = [s1.y, e1.y];
  for (let i = 0; i < obstacles.length; i++) {
    const r = obstacles[i];
    xs.push(r.minX - grid, r.minX, r.maxX, r.maxX + grid);
    ys.push(r.minY - grid, r.minY, r.maxY, r.maxY + grid);
  }

  const uniq = (arr: number[]) => {
    const m = new Map<number, true>();
    for (let i = 0; i < arr.length; i++) m.set(snap(arr[i], grid), true);
    return Array.from(m.keys()).sort((a, b) => a - b);
  };
  const X = uniq(xs);
  const Y = uniq(ys);

  const nodes: { x: number; y: number }[] = [];
  const idx = new Map<string, number>();
  const keyOf = (x: number, y: number) => `${x},${y}`;

  for (let yi = 0; yi < Y.length; yi++) {
    const y = Y[yi];
    for (let xi = 0; xi < X.length; xi++) {
      const x = X[xi];
      const p = { x, y };
      let blocked = false;
      for (let k = 0; k < obstacles.length; k++) {
        if (rectContains(obstacles[k], p)) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      const k = keyOf(x, y);
      idx.set(k, nodes.length);
      nodes.push(p);
    }
  }

  const startIdx = idx.get(keyOf(snap(s1.x, grid), snap(s1.y, grid)));
  const goalIdx = idx.get(keyOf(snap(e1.x, grid), snap(e1.y, grid)));
  if (startIdx === undefined || goalIdx === undefined) {
    const fallback = getOrthogonalPath(s0, params.sourceDir, e0, params.targetDir, stub);
    return simplifyPolyline(forceOrthogonal(fallback));
  }

  const neigh: { to: number; dir: number; cost: number }[][] = Array.from({ length: nodes.length }, () => []);

  const rowMap = new Map<number, { x: number; idx: number }[]>();
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i];
    const arr = rowMap.get(p.y) || [];
    arr.push({ x: p.x, idx: i });
    rowMap.set(p.y, arr);
  }
  rowMap.forEach((arr, y) => {
    arr.sort((a, b) => a.x - b.x);
    for (let i = 1; i < arr.length; i++) {
      const a = nodes[arr[i - 1].idx];
      const b = nodes[arr[i].idx];
      if (segmentBlocked(a, b, obstacles)) continue;
      const cost = Math.abs(b.x - a.x) + (corridorX === undefined ? 0 : Math.abs(b.x - corridorX) * corridorWeight);
      neigh[arr[i - 1].idx].push({ to: arr[i].idx, dir: 0, cost });
      const backCost = Math.abs(b.x - a.x) + (corridorX === undefined ? 0 : Math.abs(a.x - corridorX) * corridorWeight);
      neigh[arr[i].idx].push({ to: arr[i - 1].idx, dir: 1, cost: backCost });
    }
  });

  const colMap = new Map<number, { y: number; idx: number }[]>();
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i];
    const arr = colMap.get(p.x) || [];
    arr.push({ y: p.y, idx: i });
    colMap.set(p.x, arr);
  }
  colMap.forEach((arr, x) => {
    arr.sort((a, b) => a.y - b.y);
    for (let i = 1; i < arr.length; i++) {
      const a = nodes[arr[i - 1].idx];
      const b = nodes[arr[i].idx];
      if (segmentBlocked(a, b, obstacles)) continue;
      const cost = Math.abs(b.y - a.y) + (corridorX === undefined ? 0 : Math.abs(b.x - corridorX) * corridorWeight);
      neigh[arr[i - 1].idx].push({ to: arr[i].idx, dir: 2, cost });
      const backCost = Math.abs(b.y - a.y) + (corridorX === undefined ? 0 : Math.abs(a.x - corridorX) * corridorWeight);
      neigh[arr[i].idx].push({ to: arr[i - 1].idx, dir: 3, cost: backCost });
    }
  });

  const dirCount = 5;
  const noneDir = 4;
  const dirIndex = (d: Direction) => {
    if (d === "right") return 0;
    if (d === "left") return 1;
    if (d === "bottom") return 2;
    return 3;
  };
  const stateCount = nodes.length * dirCount;
  const gScore = new Float64Array(stateCount);
  const fScore = new Float64Array(stateCount);
  const parent = new Int32Array(stateCount);
  const closed = new Uint8Array(stateCount);
  for (let i = 0; i < stateCount; i++) {
    gScore[i] = Number.POSITIVE_INFINITY;
    fScore[i] = Number.POSITIVE_INFINITY;
    parent[i] = -1;
  }

  const h = (i: number) => Math.abs(nodes[i].x - nodes[goalIdx].x) + Math.abs(nodes[i].y - nodes[goalIdx].y);
  const startPrev = params.sourceDir ? dirIndex(params.sourceDir) : noneDir;
  const startState = startIdx * dirCount + startPrev;
  gScore[startState] = 0;
  fScore[startState] = h(startIdx);
  const heap = new MinHeap();
  heap.push({ key: fScore[startState], state: startState });

  const goalApproachPenalty = (prevDir: number) => {
    if (!params.targetDir || prevDir === noneDir) return 0;
    const wantVertical = params.targetDir === "top" || params.targetDir === "bottom";
    const isVertical = prevDir === 2 || prevDir === 3;
    return wantVertical === isVertical ? 0 : Math.round(turnPenalty * 0.6);
  };

  let bestGoal = -1;
  let bestGoalCost = Number.POSITIVE_INFINITY;
  while (heap.size) {
    const it = heap.pop();
    if (!it) break;
    const state = it.state;
    if (bestGoal >= 0 && it.key >= bestGoalCost) break;
    if (closed[state]) continue;
    closed[state] = 1;
    const node = Math.floor(state / dirCount);
    const prevDir = state % dirCount;
    if (node === goalIdx) {
      const cost = gScore[state] + goalApproachPenalty(prevDir);
      if (cost < bestGoalCost) {
        bestGoalCost = cost;
        bestGoal = state;
      }
      continue;
    }
    const ns = neigh[node];
    for (let i = 0; i < ns.length; i++) {
      const e = ns[i];
      const nextState = e.to * dirCount + e.dir;
      if (closed[nextState]) continue;
      let cost = e.cost;
      if (prevDir !== noneDir && prevDir !== e.dir) cost += turnPenalty;
      const tentative = gScore[state] + cost;
      if (tentative < gScore[nextState]) {
        gScore[nextState] = tentative;
        const f = tentative + h(e.to);
        fScore[nextState] = f;
        parent[nextState] = state;
        heap.push({ key: f, state: nextState });
      }
    }
  }

  if (bestGoal < 0) {
    const fallback = getOrthogonalPath(s0, params.sourceDir, e0, params.targetDir, stub);
    return simplifyPolyline(forceOrthogonal(fallback));
  }

  const rev: number[] = [];
  let cur = bestGoal;
  while (cur >= 0) {
    const node = Math.floor(cur / dirCount);
    rev.push(node);
    cur = parent[cur];
  }
  rev.reverse();
  const mid: { x: number; y: number }[] = [];
  for (let i = 0; i < rev.length; i++) mid.push(nodes[rev[i]]);

  const full: { x: number; y: number }[] = [s0];
  if (Math.abs(s1.x - s0.x) > 1e-6 || Math.abs(s1.y - s0.y) > 1e-6) full.push(s1);
  for (let i = 1; i < mid.length; i++) full.push(mid[i]);
  if (params.targetDir) {
    if (mid.length === 0 || Math.abs(mid[mid.length - 1].x - e1.x) > 1e-6 || Math.abs(mid[mid.length - 1].y - e1.y) > 1e-6) full.push(e1);
    full.push(e0);
  } else {
    if (Math.abs(full[full.length - 1].x - e0.x) > 1e-6 || Math.abs(full[full.length - 1].y - e0.y) > 1e-6) full.push(e0);
  }
  return simplifyPolyline(forceOrthogonal(full));
}

function getOrthogonalPath(
  start: { x: number; y: number },
  startDir: Direction | undefined,
  end: { x: number; y: number },
  endDir: Direction | undefined,
  margin: number = 20
) {
  const points: { x: number; y: number }[] = [start];
  let curr = { ...start };
  let target = { ...end };

  if (startDir) {
    switch (startDir) {
      case "top":
        curr.y -= margin;
        break;
      case "bottom":
        curr.y += margin;
        break;
      case "left":
        curr.x -= margin;
        break;
      case "right":
        curr.x += margin;
        break;
    }
    points.push({ ...curr });
  }

  if (endDir) {
    switch (endDir) {
      case "top":
        target.y -= margin;
        break;
      case "bottom":
        target.y += margin;
        break;
      case "left":
        target.x -= margin;
        break;
      case "right":
        target.x += margin;
        break;
    }
  }

  if (Math.abs(curr.x - target.x) < ALIGN_EPS) curr.x = target.x;
  if (Math.abs(curr.y - target.y) < ALIGN_EPS) curr.y = target.y;

  const isSamePoint = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;

  const finalize = (base: { x: number; y: number }[]) => {
    const out = base.slice();
    if (endDir) {
      out.push({ ...end });
    } else if (!isSamePoint(target, end)) {
      out.push({ ...end });
    }
    return simplifyPolyline(forceOrthogonal(out));
  };

  const score = (poly: { x: number; y: number }[]) => {
    let tiny = 0;
    let min = Number.POSITIVE_INFINITY;
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1];
      const b = poly[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len > 1e-6) {
        if (len < MIN_SEG) tiny += 1;
        min = Math.min(min, len);
      }
    }
    if (!Number.isFinite(min)) min = 0;
    return { tiny, min };
  };

  const base = points.slice();

  if (!isSamePoint(curr, target)) {
    const build = (prefer: "hv" | "vh") => {
      const p = base.slice();
      if (prefer === "hv") p.push({ x: target.x, y: curr.y });
      else p.push({ x: curr.x, y: target.y });
      p.push({ ...target });
      return finalize(p);
    };

    const hv = build("hv");
    const vh = build("vh");
    const s1 = score(hv);
    const s2 = score(vh);
    if (s2.tiny < s1.tiny || (s2.tiny === s1.tiny && s2.min > s1.min)) return vh;
    return hv;
  }

  return finalize(base);
}

export function edgePolylinePoints(points: {
  start: { x: number; y: number };
  end: { x: number; y: number };
  style: "straight" | "polyline";
  anchors: { x: number; y: number }[];
  prefer?: "hv" | "vh";
  sourceDir?: Direction;
  targetDir?: Direction;
}) {
  const s = points.start;
  const e = points.end;

  const routeVia = (from: { x: number; y: number }, to: { x: number; y: number }, prefer: "hv" | "vh") => {
    if (Math.abs(from.x - to.x) < 1e-6 || Math.abs(from.y - to.y) < 1e-6) return [to];
    if (prefer === "vh") return [{ x: from.x, y: to.y }, to];
    return [{ x: to.x, y: from.y }, to];
  };

  const routeViaSmart = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    if (Math.abs(from.x - to.x) < 1e-6 || Math.abs(from.y - to.y) < 1e-6) return [to];
    const dx = Math.abs(from.x - to.x);
    const dy = Math.abs(from.y - to.y);
    const prefer: "hv" | "vh" = dx >= dy ? "hv" : "vh";
    return routeVia(from, to, prefer);
  };

  if ((points.sourceDir || points.targetDir) && (!points.anchors || points.anchors.length === 0)) {
     const ortho = getOrthogonalPath(s, points.sourceDir, e, points.targetDir, 20);
     return simplifyPolyline(forceOrthogonal(ortho));
  }

  if (points.anchors && points.anchors.length > 0) {
      const out: { x: number; y: number }[] = [s];
      let cur = s;
      const vias = points.anchors;
      
      const firstPath = getOrthogonalPath(cur, points.sourceDir, vias[0], undefined, 20);
      for (let i = 1; i < firstPath.length; i++) out.push(firstPath[i]);
      
      cur = vias[0];
      
      for (let i = 1; i < vias.length; i++) {
        const seg = routeViaSmart(cur, vias[i]);
        for (const p of seg) out.push(p);
        cur = vias[i];
      }
      
      const lastPath = getOrthogonalPath(cur, undefined, e, points.targetDir, 20);
      for (let i = 1; i < lastPath.length; i++) out.push(lastPath[i]);
      
      return simplifyPolyline(forceOrthogonal(out));
  }

  if (points.style === "straight") {
    const prefer = points.prefer ?? "hv";
    const out = [s, ...routeVia(s, e, prefer)];
    return simplifyPolyline(forceOrthogonal(out));
  }

  const out: { x: number; y: number }[] = [s];
  const vias = points.anchors;
  let cur = s;
  for (const v of vias) {
    const seg = routeViaSmart(cur, v);
    for (const p of seg) out.push(p);
    cur = v;
  }
  for (const p of routeViaSmart(cur, e)) out.push(p);
  return simplifyPolyline(forceOrthogonal(out));
}

export function edgePath(points: {
  start: { x: number; y: number };
  end: { x: number; y: number };
  style: "straight" | "polyline";
  anchors: { x: number; y: number }[];
  prefer?: "hv" | "vh";
  sourceDir?: Direction;
  targetDir?: Direction;
}) {
  const poly = edgePolylinePoints(points);
  if (!poly || poly.length === 0) return "";
  let d = `M ${poly[0].x} ${poly[0].y}`;
  for (let i = 1; i < poly.length; i++) d += ` L ${poly[i].x} ${poly[i].y}`;
  return d;
}
