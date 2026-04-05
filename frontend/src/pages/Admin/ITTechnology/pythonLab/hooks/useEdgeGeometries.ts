import { useMemo, useRef } from "react";
import type { FlowEdge, FlowNode } from "../flow/model";
import type { FlowNodeShape } from "../types";
import { chooseSide, fixedPortForStartEnd, nodePortLocal, nodeSizeForTitle, shapePolygonForAttach } from "../flow/ports";
import { edgePointsToSmoothPath, type Direction, type Rect, cleanupOrthogonalPolyline, edgePolylinePoints, norm, pointAtT, polylineClear, polylineToPath, rayIntersectPolygon, routeOrthogonalLoopTemplate, routeOrthogonalVisioLike, smoothPointsToPolyline } from "../flow/geometry";
import { routeWithPolicy } from "../flow/routingPolicy";

export type CanvasMetric = { cx: number; cy: number; w: number; h: number; shape: FlowNodeShape };

export type EdgeGeometry =
  | {
      start: { x: number; y: number };
      end: { x: number; y: number };
      anchors: { x: number; y: number }[];
      style: "straight" | "polyline" | "bezier";
      poly: { x: number; y: number }[];
      hitPath: string;
      drawPath: string;
      label?: string;
      labelPos?: { x: number; y: number };
    }
  | null;

export function useCanvasMetrics(nodes: FlowNode[]) {
  return useMemo(() => {
    const map = new Map<string, CanvasMetric>();
    for (const n of nodes) {
      const s = nodeSizeForTitle(n.shape, n.title);
      map.set(n.id, { cx: n.x + s.w / 2, cy: n.y + s.h / 2, w: s.w, h: s.h, shape: n.shape });
    }
    return map;
  }, [nodes]);
}

export function cheapAutoRoute(params: { start: { x: number; y: number }; end: { x: number; y: number }; startDir?: Direction; endDir?: Direction; routingStyle: "orthogonal" | "direct" }) {
  if (params.routingStyle === "direct") return [params.start, params.end];
  return edgePolylinePoints({ start: params.start, end: params.end, style: "polyline", anchors: [], sourceDir: params.startDir, targetDir: params.endDir });
}

export function shortenEndForArrow(poly: { x: number; y: number }[], amount: number, opts?: { preserveBezierTangent?: boolean }) {
  if (poly.length < 2) return poly;
  const out = poly.slice();
  if (opts?.preserveBezierTangent && out.length >= 4 && (out.length - 1) % 3 === 0) {
    const cp2Idx = out.length - 2;
    const endIdx = out.length - 1;
    const a = out[cp2Idx];
    const b = out[endIdx];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len >= 1e-6) {
      const retreat = Math.min(amount, Math.max(0, len - 2));
      const rx = (dx / len) * retreat;
      const ry = (dy / len) * retreat;
      out[endIdx] = { x: b.x - rx, y: b.y - ry };
      out[cp2Idx] = { x: a.x - rx, y: a.y - ry };
      return out;
    }
  }
  for (let i = out.length - 1; i >= 1; i--) {
    const a = out[i - 1];
    const b = out[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const retreat = Math.min(amount, Math.max(0, len - 2));
    out[i] = { x: b.x - (dx / len) * retreat, y: b.y - (dy / len) * retreat };
    break;
  }
  return out;
}

export function useEdgeGeometries(nodes: FlowNode[], edges: FlowEdge[], routingStyle: "orthogonal" | "direct" = "orthogonal", interactive = false) {
  const canvasMetrics = useCanvasMetrics(nodes);
  const cacheRef = useRef(new Map<string, EdgeGeometry>());
  const keyRef = useRef(new Map<string, string>());

  const edgeGeometries = useMemo(() => {
    const qualityMode = interactive ? "interactive" : "final";
    const byId = new Map<string, FlowEdge>();
    for (const e of edges) byId.set(e.id, e);
    const incomingByTo = new Map<string, FlowEdge[]>();
    for (const e of edges) {
      if (e.toEdge) continue;
      const arr = incomingByTo.get(e.to) || [];
      arr.push(e);
      incomingByTo.set(e.to, arr);
    }
    const nodeMeta = new Map(nodes.map((n) => [n.id, { shape: n.shape, title: n.title }] as const));

    const cache = cacheRef.current;
    const keyById = keyRef.current;

    const expandRect = (r: Rect, pad: number): Rect => ({ minX: r.minX - pad, minY: r.minY - pad, maxX: r.maxX + pad, maxY: r.maxY + pad });
    const rectIntersects = (a: Rect, b: Rect) => !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
    const rectDistance = (r: Rect, p: { x: number; y: number }) => {
      const dx = p.x < r.minX ? r.minX - p.x : p.x > r.maxX ? p.x - r.maxX : 0;
      const dy = p.y < r.minY ? r.minY - p.y : p.y > r.maxY ? p.y - r.maxY : 0;
      return Math.hypot(dx, dy);
    };
    const bestLabelPos = (poly: { x: number; y: number }[], label: string, obstacles: Rect[]) => {
      const text = label.trim();
      if (!text) return undefined;
      const fontSize = 12;
      const pad = 6;
      const hasWide = Array.from(text).some((ch) => ch.charCodeAt(0) > 255);
      const estCharW = hasWide ? 12 : 8;
      const w = Math.max(18, text.length * estCharW) + pad * 2;
      const h = fontSize + pad * 2;
      const safe = obstacles.map((r) => expandRect(r, 8));
      let best: { x: number; y: number } | undefined;
      let bestHits = Number.POSITIVE_INFINITY;
      let bestScore = Number.POSITIVE_INFINITY;

      const tryCandidate = (p: { x: number; y: number }) => {
        const box: Rect = { minX: p.x - w / 2, minY: p.y - h / 2, maxX: p.x + w / 2, maxY: p.y + h / 2 };
        let hits = 0;
        let minD = Number.POSITIVE_INFINITY;
        for (const r of safe) {
          if (rectIntersects(box, r)) hits += 1;
          minD = Math.min(minD, rectDistance(r, p));
        }
        const score = hits * 1_000_000 - minD;
        if (hits < bestHits || (hits === bestHits && score < bestScore)) {
          bestHits = hits;
          bestScore = score;
          best = p;
        }
      };

      for (let i = 0; i < poly.length - 1; i++) {
        const a = poly[i];
        const b = poly[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        if (len < 40) continue;
        const d = norm(dx, dy);
        const nx = -d.uy;
        const ny = d.ux;
        const ts = [0.35, 0.5, 0.65];
        for (const t of ts) {
          const x = a.x + dx * t;
          const y = a.y + dy * t;
          const off = 16;
          tryCandidate({ x: x + nx * off, y: y + ny * off });
          tryCandidate({ x: x - nx * off, y: y - ny * off });
        }
      }

      return best;
    };

    const q1 = (v: number) => Math.round(v * 10) / 10;
    const hashStr = (h: number, s: string) => {
      let x = h >>> 0;
      for (let i = 0; i < s.length; i++) {
        x ^= s.charCodeAt(i);
        x = Math.imul(x, 16777619) >>> 0;
      }
      return x;
    };
    const hashRect = (h: number, tag: string, r: Rect) =>
      hashStr(h, `${tag}|${q1(r.minX)}|${q1(r.minY)}|${q1(r.maxX)}|${q1(r.maxY)}`);

    const nodePortAbs = (m: CanvasMetric, side: "top" | "right" | "bottom" | "left") => {
      const p = nodePortLocal(m.shape, m.w, m.h, side);
      return { x: m.cx + p.x, y: m.cy + p.y };
    };

    const nodeAttachAbs = (m: CanvasMetric, attach: { x: number; y: number }) => {
      const ax = attach?.x;
      const ay = attach?.y;
      if (!Number.isFinite(ax) || !Number.isFinite(ay)) return null;
      const isNorm = ax >= 0 && ax <= 1 && ay >= 0 && ay <= 1;
      const lx = isNorm ? (Math.max(0, Math.min(1, ax)) - 0.5) * m.w : ax;
      const ly = isNorm ? (Math.max(0, Math.min(1, ay)) - 0.5) * m.h : ay;
      const d = norm(lx, ly);
      if (Math.abs(d.ux) < 1e-6 && Math.abs(d.uy) < 1e-6) return null;
      const poly = shapePolygonForAttach(m.shape, m.w, m.h);
      const hit = rayIntersectPolygon({ x: d.ux, y: d.uy }, poly);
      if (hit) return { x: m.cx + hit.x, y: m.cy + hit.y };
      const hw = m.w / 2;
      const hh = m.h / 2;
      const side = chooseSide(lx, ly);
      if (side === "left") return { x: m.cx - hw, y: m.cy + Math.max(-hh, Math.min(hh, ly)) };
      if (side === "right") return { x: m.cx + hw, y: m.cy + Math.max(-hh, Math.min(hh, ly)) };
      if (side === "top") return { x: m.cx + Math.max(-hw, Math.min(hw, lx)), y: m.cy - hh };
      return { x: m.cx + Math.max(-hw, Math.min(hw, lx)), y: m.cy + hh };
    };

    const obstacleRectById = new Map<string, Rect>();
    const obstacleRects: { id: string; rect: Rect }[] = [];
    const centersX: number[] = [];
    let maxNodeW = 0;
    let maxNodeH = 0;
    canvasMetrics.forEach((m, id) => {
      const obstaclePad = Math.max(10, Math.min(28, Math.round(Math.min(m.w, m.h) * 0.35)));
      centersX.push(m.cx);
      maxNodeW = Math.max(maxNodeW, m.w);
      maxNodeH = Math.max(maxNodeH, m.h);
      const rect = {
        minX: m.cx - m.w / 2 - obstaclePad,
        minY: m.cy - m.h / 2 - obstaclePad,
        maxX: m.cx + m.w / 2 + obstaclePad,
        maxY: m.cy + m.h / 2 + obstaclePad,
      };
      obstacleRectById.set(id, rect);
      obstacleRects.push({ id, rect });
    });
    centersX.sort((a, b) => a - b);
    const medianSorted = (arr: number[]) => {
      if (!arr.length) return 0;
      return arr.length % 2 ? arr[(arr.length - 1) / 2] : (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2;
    };

    const trunkNodeIds = (() => {
      const out = new Map<string, FlowEdge[]>();
      for (const e of edges) {
        if (e.toEdge) continue;
        const arr = out.get(e.from) || [];
        arr.push(e);
        out.set(e.from, arr);
      }
      const start =
        nodes.find((n) => n.shape === "start_end" && (n.title.includes("开始") || n.title.toLowerCase().includes("start")))?.id ??
        nodes[0]?.id ??
        null;
      if (!start) return [];
      const visited = new Set<string>();
      const chain: string[] = [];
      let cur: string | null = start;
      const clean = (s: string | undefined) => (s ?? "").trim().toLowerCase();
      const isYes = (e: FlowEdge) => {
        const l = clean(e.label);
        return l === "是" || l === "true";
      };
      const isNo = (e: FlowEdge) => {
        const l = clean(e.label);
        return l === "否" || l === "false";
      };
      while (cur && !visited.has(cur)) {
        visited.add(cur);
        chain.push(cur);
        const outs: FlowEdge[] = (out.get(cur) || []).filter((e: FlowEdge) => !e.toEdge && canvasMetrics.has(e.to));
        if (!outs.length) break;
        const meta = nodeMeta.get(cur);
        let chosen: FlowEdge | undefined;
        if (meta?.shape === "decision") chosen = outs.find(isYes) || outs.find((e: FlowEdge) => !isNo(e)) || outs[0];
        else chosen = outs[0];
        cur = chosen?.to ?? null;
      }
      return chain;
    })();

    const trunkCenters = trunkNodeIds.map((id) => canvasMetrics.get(id)?.cx).filter((v): v is number => typeof v === "number");
    trunkCenters.sort((a, b) => a - b);
    const trunkX = trunkCenters.length ? medianSorted(trunkCenters) : medianSorted(centersX);

    let step = Math.max(220, maxNodeW + 140);
    if (centersX.length >= 3) {
      const diffs: number[] = [];
      for (let i = 1; i < centersX.length; i++) {
        const d = centersX[i] - centersX[i - 1];
        if (d > 40) diffs.push(d);
      }
      diffs.sort((a, b) => a - b);
      if (diffs.length) step = diffs.length % 2 ? diffs[(diffs.length - 1) / 2] : (diffs[diffs.length / 2 - 1] + diffs[diffs.length / 2]) / 2;
    }
    step = Math.max(180, Math.min(520, step));
    const rightX = trunkX + step;
    const snap10 = (v: number) => Math.round(v / 10) * 10;
    const loopMarginX = Math.max(90, Math.round(maxNodeW * 0.9));
    const loopCorridorX = (fromM: CanvasMetric, toM: CanvasMetric | null) => {
      const fromLeft = fromM.cx - fromM.w / 2;
      const toLeft = toM ? toM.cx - toM.w / 2 : fromLeft;
      return snap10(Math.min(fromLeft, toLeft) - loopMarginX);
    };

    const laneGap = Math.round(Math.max(18, Math.min(34, maxNodeW * 0.18)) / 10) * 10;
    const laneOffsetByEdgeId = new Map<string, number>();
    {
      const groups = new Map<string, { id: string; fromY: number; toY: number }[]>();
      for (const e of edges) {
        if (e.toEdge) continue;
        const fm = canvasMetrics.get(e.from);
        const tm = canvasMetrics.get(e.to);
        if (!fm || !tm) continue;
        const label = (e.label ?? "").trim().toLowerCase();
        const isLoop = e.fromPort === "left" && e.toPort === "left";
        const baseX = isLoop ? loopCorridorX(fm, tm) : label === "否" || label === "false" ? rightX : trunkX;
        const key = `${Math.round(baseX)}|${isLoop ? "left" : label === "否" || label === "false" ? "right" : "trunk"}`;
        const arr = groups.get(key) || [];
        arr.push({ id: e.id, fromY: fm.cy, toY: tm.cy });
        groups.set(key, arr);
      }
      groups.forEach((arr) => {
        if (arr.length <= 1) return;
        arr.sort((a, b) => a.fromY - b.fromY || a.toY - b.toY || a.id.localeCompare(b.id));
        const mid = (arr.length - 1) / 2;
        for (let i = 0; i < arr.length; i++) laneOffsetByEdgeId.set(arr[i].id, Math.round((i - mid) * laneGap));
      });
    }

    const bundleOffsetFromByEdgeId = new Map<string, number>();
    const bundleOffsetToByEdgeId = new Map<string, number>();
    {
      const bundleGap = 10;
      const fromGroups = new Map<string, { id: string; otherY: number }[]>();
      const toGroups = new Map<string, { id: string; otherY: number }[]>();
      for (const e of edges) {
        if (e.toEdge) continue;
        const fm = canvasMetrics.get(e.from);
        const tm = canvasMetrics.get(e.to);
        if (!fm || !tm) continue;
        if (e.fromPort) {
          const key = `${e.from}|${e.fromPort}`;
          const arr = fromGroups.get(key) || [];
          arr.push({ id: e.id, otherY: tm.cy });
          fromGroups.set(key, arr);
        }
        if (e.toPort) {
          const key = `${e.to}|${e.toPort}`;
          const arr = toGroups.get(key) || [];
          arr.push({ id: e.id, otherY: fm.cy });
          toGroups.set(key, arr);
        }
      }
      const applyBundle = (groups: Map<string, { id: string; otherY: number }[]>, out: Map<string, number>) => {
        groups.forEach((arr) => {
          if (arr.length <= 1) return;
          arr.sort((a, b) => a.otherY - b.otherY || a.id.localeCompare(b.id));
          const mid = (arr.length - 1) / 2;
          for (let i = 0; i < arr.length; i++) out.set(arr[i].id, Math.round((i - mid) * bundleGap));
        });
      };
      applyBundle(fromGroups, bundleOffsetFromByEdgeId);
      applyBundle(toGroups, bundleOffsetToByEdgeId);
    }

    const loopTrackYByEdgeId = new Map<string, number>();
    {
      const backThreshold = Math.max(40, Math.round(maxNodeH * 0.35));
      const loopEdges = edges
        .filter((e) => !e.toEdge && e.fromPort === "left" && e.toPort === "left" && canvasMetrics.has(e.from) && canvasMetrics.has(e.to))
        .map((e) => ({ id: e.id, to: e.to, fromY: canvasMetrics.get(e.from)!.cy, toY: canvasMetrics.get(e.to)!.cy }))
        .filter((x) => x.fromY >= x.toY + backThreshold);

      const snapY = (v: number) => Math.round(v / 10) * 10;
      for (let i = 0; i < loopEdges.length; i++) {
        const le = loopEdges[i];
        loopTrackYByEdgeId.set(le.id, snapY(le.toY));
      }
    }

    const compute = (edgeId: string): EdgeGeometry => {
      const e = byId.get(edgeId);
      if (!e) {
        cache.set(edgeId, null);
        keyById.set(edgeId, "missing");
        return null;
      }
      const fromM = canvasMetrics.get(e.from);
      if (!fromM) {
        cache.set(edgeId, null);
        keyById.set(edgeId, `missingFrom|${e.from}`);
        return null;
      }
      const fromMeta = nodeMeta.get(e.from) || { shape: fromM.shape, title: "" };

      let targetPoint: { x: number; y: number } | null = null;
      let toM: CanvasMetric | null = null;
      let toMeta: { shape: FlowNodeShape; title: string } | null = null;

      if (e.toEdge) {
        const targetGeom = compute(e.toEdge);
        if (targetGeom) targetPoint = pointAtT(targetGeom.poly, e.toEdgeT ?? 0.5);
      } else {
        toM = canvasMetrics.get(e.to) || null;
        if (toM) toMeta = nodeMeta.get(e.to) || { shape: toM.shape, title: "" };
      }

      const fallbackTarget = targetPoint ?? (toM ? { x: toM.cx, y: toM.cy } : { x: fromM.cx, y: fromM.cy });

      let start: { x: number; y: number };
      let startDir: Direction | undefined;
      if (e.fromFree) {
        start = e.fromFree;
        startDir = undefined;
      } else if (e.fromAttach) {
        const p = nodeAttachAbs(fromM, e.fromAttach);
        start = p ?? nodePortAbs(fromM, "bottom");
        startDir = p ? chooseSide(p.x - fromM.cx, p.y - fromM.cy) : "bottom";
      } else {
        const fixedFrom = fromMeta.shape === "start_end" ? fixedPortForStartEnd(fromMeta.title) : null;
        const resolvedFromPort = fixedFrom ?? e.fromPort ?? null;
        if (resolvedFromPort) {
          start = nodePortAbs(fromM, resolvedFromPort);
          startDir = resolvedFromPort;
        } else if (fromMeta.shape !== "decision" && fromMeta.shape !== "io") {
          start = nodePortAbs(fromM, "bottom");
          startDir = "bottom";
        } else if (e.fromDir && (Math.abs(e.fromDir.ux) > 1e-6 || Math.abs(e.fromDir.uy) > 1e-6)) {
          const poly = shapePolygonForAttach(fromM.shape, fromM.w, fromM.h);
          const hit = rayIntersectPolygon({ x: e.fromDir.ux, y: e.fromDir.uy }, poly);
          if (hit) {
            start = { x: fromM.cx + hit.x, y: fromM.cy + hit.y };
            startDir = Math.abs(e.fromDir.ux) >= Math.abs(e.fromDir.uy) ? (e.fromDir.ux > 0 ? "right" : "left") : e.fromDir.uy > 0 ? "bottom" : "top";
          } else {
            const fromSide =
              fromM.shape === "decision" && e.label === "是"
                ? "bottom"
                : fromM.shape === "decision" && e.label === "否"
                  ? "right"
                  : chooseSide(fallbackTarget.x - fromM.cx, fallbackTarget.y - fromM.cy);
            start = nodePortAbs(fromM, fromSide);
            startDir = fromSide;
          }
        } else {
          const fromSide =
            fromM.shape === "decision" && e.label === "是"
              ? "bottom"
              : fromM.shape === "decision" && e.label === "否"
                ? "right"
                : chooseSide(fallbackTarget.x - fromM.cx, fallbackTarget.y - fromM.cy);
          start = nodePortAbs(fromM, fromSide);
          startDir = fromSide;
        }
      }

      let end: { x: number; y: number };
      let endDir: Direction | undefined;
      if (e.toFree) {
        end = e.toFree;
        endDir = undefined;
      } else if (targetPoint) {
        end = targetPoint;
        endDir = undefined;
      } else if (toM) {
        if (e.toAttach) {
          const p = nodeAttachAbs(toM, e.toAttach);
          end = p ?? nodePortAbs(toM, "top");
          endDir = p ? chooseSide(p.x - toM.cx, p.y - toM.cy) : "top";
        } else {
          const fixedTo = toMeta?.shape === "start_end" ? fixedPortForStartEnd(toMeta.title) : null;
          const resolvedToPort = fixedTo ?? e.toPort ?? null;
          if (resolvedToPort) {
            end = nodePortAbs(toM, resolvedToPort);
            endDir = resolvedToPort;
          } else if (toMeta?.shape === "decision") {
            end = nodePortAbs(toM, "top");
            endDir = "top";
          } else if (toMeta && toMeta.shape !== "io") {
            end = nodePortAbs(toM, "top");
            endDir = "top";
          } else if (e.toDir && (Math.abs(e.toDir.ux) > 1e-6 || Math.abs(e.toDir.uy) > 1e-6)) {
            const poly = shapePolygonForAttach(toM.shape, toM.w, toM.h);
            const hit = rayIntersectPolygon({ x: e.toDir.ux, y: e.toDir.uy }, poly);
            if (hit) {
              end = { x: toM.cx + hit.x, y: toM.cy + hit.y };
              endDir = Math.abs(e.toDir.ux) >= Math.abs(e.toDir.uy) ? (e.toDir.ux > 0 ? "right" : "left") : e.toDir.uy > 0 ? "bottom" : "top";
            } else {
              const toSide = chooseSide(fromM.cx - toM.cx, fromM.cy - toM.cy);
              end = nodePortAbs(toM, toSide);
              endDir = toSide;
            }
          } else {
            const toSide = chooseSide(fromM.cx - toM.cx, fromM.cy - toM.cy);
            end = nodePortAbs(toM, toSide);
            endDir = toSide;
          }
        }
      } else {
        end = { x: start.x, y: start.y };
        endDir = undefined;
      }

      const label = (e.label ?? "").trim().toLowerCase();
      const loopTrackY = loopTrackYByEdgeId.get(edgeId);
      const isLoop = e.fromPort === "left" && e.toPort === "left";
      const baseCorridorX = isLoop ? loopCorridorX(fromM, toM) : label === "否" || label === "false" ? rightX : trunkX;
      const corridorX = baseCorridorX + (laneOffsetByEdgeId.get(edgeId) ?? 0);
      const minSeg = Math.max(60, Math.min(180, Math.round(Math.max(fromM.w, fromM.h) * 0.7)));
      const stub = (() => {
        const fromPad = Math.max(10, Math.min(28, Math.round(Math.min(fromM.w, fromM.h) * 0.35)));
        const toPad = toM ? Math.max(10, Math.min(28, Math.round(Math.min(toM.w, toM.h) * 0.35))) : 0;
        const baseFrom = Math.round(Math.min(fromM.w, fromM.h) * 0.6);
        const baseTo = toM ? Math.round(Math.min(toM.w, toM.h) * 0.6) : 0;
        const minExit = Math.max(fromPad, toPad) + 20;
        return Math.max(18, Math.min(120, Math.max(baseFrom, baseTo, minExit, Math.round(minSeg * 0.85))));
      })();

      const anchors = e.style === "polyline" || e.style === "bezier" ? (e.anchors && e.anchors.length ? e.anchors : e.anchor ? [e.anchor] : []) : [];
      const isManual = e.routeMode === "manual";
      const isFreeManual = isManual && e.style === "polyline" && anchors.length > 0 && e.routeShape === "free";
      const isBezier = e.style === "bezier" && anchors.length > 0;

      const obstacles: Rect[] = [];
      let obstaclesHash = 0;

      const addTargetObstacleExceptEntry = (out: Rect[], r: Rect, entryDir: Direction, entryPt: { x: number; y: number }, offset: number) => {
        const push = (rr: Rect) => {
          if (!Number.isFinite(rr.minX) || !Number.isFinite(rr.minY) || !Number.isFinite(rr.maxX) || !Number.isFinite(rr.maxY)) return;
          if (rr.maxX - rr.minX < 1 || rr.maxY - rr.minY < 1) return;
          out.push(rr);
          obstaclesHash = hashRect(obstaclesHash, "t", rr);
        };
        const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
        const gapHalf = 18;
        const gapDepth = 28;
        const pt =
          entryDir === "top" || entryDir === "bottom"
            ? { x: entryPt.x + offset, y: entryPt.y }
            : { x: entryPt.x, y: entryPt.y + offset };

        if (entryDir === "top") {
          const x1 = clamp(pt.x - gapHalf, r.minX, r.maxX);
          const x2 = clamp(pt.x + gapHalf, r.minX, r.maxX);
          push({ minX: r.minX, minY: r.minY, maxX: x1, maxY: r.maxY });
          push({ minX: x2, minY: r.minY, maxX: r.maxX, maxY: r.maxY });
          push({ minX: x1, minY: clamp(pt.y + gapDepth, r.minY, r.maxY), maxX: x2, maxY: r.maxY });
          return;
        }
        if (entryDir === "bottom") {
          const x1 = clamp(pt.x - gapHalf, r.minX, r.maxX);
          const x2 = clamp(pt.x + gapHalf, r.minX, r.maxX);
          push({ minX: r.minX, minY: r.minY, maxX: x1, maxY: r.maxY });
          push({ minX: x2, minY: r.minY, maxX: r.maxX, maxY: r.maxY });
          push({ minX: x1, minY: r.minY, maxX: x2, maxY: clamp(pt.y - gapDepth, r.minY, r.maxY) });
          return;
        }
        if (entryDir === "left") {
          const y1 = clamp(pt.y - gapHalf, r.minY, r.maxY);
          const y2 = clamp(pt.y + gapHalf, r.minY, r.maxY);
          push({ minX: r.minX, minY: r.minY, maxX: r.maxX, maxY: y1 });
          push({ minX: r.minX, minY: y2, maxX: r.maxX, maxY: r.maxY });
          push({ minX: clamp(pt.x + gapDepth, r.minX, r.maxX), minY: y1, maxX: r.maxX, maxY: y2 });
          return;
        }
        const y1 = clamp(pt.y - gapHalf, r.minY, r.maxY);
        const y2 = clamp(pt.y + gapHalf, r.minY, r.maxY);
        push({ minX: r.minX, minY: r.minY, maxX: r.maxX, maxY: y1 });
        push({ minX: r.minX, minY: y2, maxX: r.maxX, maxY: r.maxY });
        push({ minX: r.minX, minY: y1, maxX: clamp(pt.x - gapDepth, r.minX, r.maxX), maxY: y2 });
      };

      obstacleRectById.forEach((r, id) => {
        if (id === e.from || id === e.to) return;
        obstacles.push(r);
        obstaclesHash = hashRect(obstaclesHash, id, r);
      });

      const key =
        `${qualityMode}|${routingStyle}|${e.id}|${e.style}|${e.routeMode || ""}|${e.routeShape || ""}|` +
        `${e.from}|${e.to}|${e.toEdge || ""}|${q1(e.toEdgeT ?? 0)}|` +
        `${fromMeta.shape}|${fromMeta.title}|${toMeta?.shape || ""}|${toMeta?.title || ""}|` +
        `${q1(start.x)}|${q1(start.y)}|${startDir || ""}|${q1(end.x)}|${q1(end.y)}|${endDir || ""}|` +
        `${q1(corridorX)}|${q1(loopTrackY ?? -1)}|${q1(stub)}|${q1(minSeg)}|` +
        `${q1(bundleOffsetFromByEdgeId.get(edgeId) ?? 0)}|${q1(bundleOffsetToByEdgeId.get(edgeId) ?? 0)}|` +
        `${anchors.map((p) => `${q1(p.x)}:${q1(p.y)}`).join(";")}|` +
        `${obstaclesHash >>> 0}|${label}`;
      const prevKey = keyById.get(edgeId);
      if (prevKey === key && cache.has(edgeId)) return cache.get(edgeId) ?? null;

      let poly: { x: number; y: number }[] = [];
      let smoothInput: "bezier" | "polyline" | null = null;

      if (isBezier) {
        const pts = anchors.slice();
        if (pts.length >= 2) {
          const first = pts[0];
          const last = pts[pts.length - 1];
          const dsx = start.x - first.x;
          const dsy = start.y - first.y;
          const dex = end.x - last.x;
          const dey = end.y - last.y;
          const tol = 40;
          const nearStart = Math.hypot(dsx, dsy) <= tol;
          const nearEnd = Math.hypot(dex, dey) <= tol;

          if (nearStart) {
            pts[0] = start;
            if (pts.length >= 2) pts[1] = { x: pts[1].x + dsx, y: pts[1].y + dsy };
          } else {
            pts.unshift(start);
          }

          if (nearEnd) {
            const li = pts.length - 1;
            pts[li] = end;
            if (li - 1 >= 0) pts[li - 1] = { x: pts[li - 1].x + dex, y: pts[li - 1].y + dey };
          } else {
            pts.push(end);
          }
        }
        poly = pts.length ? pts : [start, end];
        smoothInput = "bezier";
      } else {
          const orthogonalizeWaypoints = (pts: { x: number; y: number }[]) => {
            const out: { x: number; y: number }[] = [];
            const push = (p: { x: number; y: number }) => {
              const last = out[out.length - 1];
              if (last && Math.abs(last.x - p.x) < 1e-6 && Math.abs(last.y - p.y) < 1e-6) return;
              out.push(p);
            };
            for (let i = 0; i < pts.length; i++) {
              if (i === 0) {
                push(pts[i]);
                continue;
              }
              const a = out[out.length - 1];
              const b = pts[i];
              if (Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.y - b.y) < 1e-6) {
                push(b);
                continue;
              }
              const c1 = [{ x: a.x, y: b.y }, b];
              const c2 = [{ x: b.x, y: a.y }, b];
              const p1 = cleanupOrthogonalPolyline({ points: [a, c1[0], c1[1]], obstacles, grid: 10, minSeg: 0 });
              const p2 = cleanupOrthogonalPolyline({ points: [a, c2[0], c2[1]], obstacles, grid: 10, minSeg: 0 });
              const ok1 = polylineClear(p1, obstacles);
              const ok2 = polylineClear(p2, obstacles);
              const len = (p: { x: number; y: number }[]) => {
                let s = 0;
                for (let k = 1; k < p.length; k++) s += Math.hypot(p[k].x - p[k - 1].x, p[k].y - p[k - 1].y);
                return s;
              };
              const pick = ok1 && ok2 ? (len(p1) <= len(p2) ? c1 : c2) : ok1 ? c1 : c2;
              push(pick[0]);
              push(pick[1]);
            }
            return out;
          };

          const isGraphvizLayoutEdge = !isManual && !e.toEdge && (!!e.fromAttach || !!e.toAttach || !!e.labelPosition);
          const isInteractiveLite = interactive && !isGraphvizLayoutEdge && !isManual && !e.toEdge;
          const rawPoly =
            e.style === "polyline" && anchors.length > 0 && isManual
              ? isFreeManual
                ? [start, ...anchors, end]
                : orthogonalizeWaypoints([start, ...anchors, end])
              : isGraphvizLayoutEdge && e.style === "straight"
                ? [start, end]
              : isGraphvizLayoutEdge && e.style === "polyline" && anchors.length > 0
                ? [start, ...anchors, end]
              : isInteractiveLite
                ? cheapAutoRoute({ start, end, startDir, endDir, routingStyle })
              : routingStyle === "direct" && !isManual && e.style === "straight" && !e.toEdge
                ? [start, end]
              : loopTrackY !== undefined
                ? routeOrthogonalLoopTemplate({
                    start,
                    end,
                    sourceDir: startDir,
                    targetDir: endDir,
                    corridorX,
                    trackY: loopTrackY,
                    sourceOffset: bundleOffsetFromByEdgeId.get(edgeId) ?? 0,
                    targetOffset: bundleOffsetToByEdgeId.get(edgeId) ?? 0,
                    stub,
                    grid: 10,
                  })
                : routeWithPolicy({
                    start,
                    end,
                    startDir,
                    endDir,
                    obstacles,
                    corridorX,
                    sourceOffset: bundleOffsetFromByEdgeId.get(edgeId) ?? 0,
                    targetOffset: bundleOffsetToByEdgeId.get(edgeId) ?? 0,
                    stub,
                    grid: 10,
                    minSeg,
                    fanIn: (() => {
                      if (isManual) return undefined;
                      if (e.toEdge) return undefined;
                      if (!toM) return undefined;
                      if (!endDir || endDir !== "top") return undefined;
                      if (!startDir || startDir !== "bottom") return undefined;
                      if (loopTrackY !== undefined) return undefined;
                      const incomings = incomingByTo.get(e.to) || [];
                      if (incomings.length < 2) return undefined;
    
                      const stubFor = (fm: CanvasMetric) => {
                        const fromPad = Math.max(10, Math.min(28, Math.round(Math.min(fm.w, fm.h) * 0.35)));
                        const toPad = Math.max(10, Math.min(28, Math.round(Math.min(toM.w, toM.h) * 0.35)));
                        const baseFrom = Math.round(Math.min(fm.w, fm.h) * 0.6);
                        const baseTo = Math.round(Math.min(toM.w, toM.h) * 0.6);
                        const minExit = Math.max(fromPad, toPad) + 20;
                        return Math.max(18, Math.min(120, Math.max(baseFrom, baseTo, minExit, Math.round(minSeg * 0.85))));
                      };
    
                      const buildObstaclesForIncoming = (fromId: string) => {
                        const obs: Rect[] = [];
                        const targetOffset = bundleOffsetToByEdgeId.get(edgeId) ?? 0;
                        obstacleRectById.forEach((r, id) => {
                          if (id === fromId) return;
                          if (id === e.to) {
                            addTargetObstacleExceptEntry(obs, r, endDir, end, targetOffset);
                            return;
                          }
                          obs.push(r);
                        });
                        return obs;
                      };
    
                      const incomingInfo: { start: { x: number; y: number }; stub: number; obstacles: Rect[] }[] = [];
                      for (const ie of incomings) {
                        if (ie.toEdge) return undefined;
                        const fm = canvasMetrics.get(ie.from);
                        if (!fm) return undefined;
                        const meta = nodeMeta.get(ie.from) || { shape: fm.shape, title: "" };
                        const fixed = meta.shape === "start_end" ? fixedPortForStartEnd(meta.title) : null;
                        const fromPort = fixed ?? ie.fromPort ?? null;
                        if (fromPort !== "bottom") return undefined;
                        incomingInfo.push({ start: nodePortAbs(fm, "bottom"), stub: stubFor(fm), obstacles: buildObstaclesForIncoming(ie.from) });
                      }
                      return { incomings: incomingInfo };
                    })(),
                  });
    
          poly = isGraphvizLayoutEdge || isInteractiveLite || isFreeManual ? rawPoly : cleanupOrthogonalPolyline({ points: rawPoly, obstacles, grid: 10, minSeg });
          if (!isGraphvizLayoutEdge && !isInteractiveLite && !isFreeManual) {
            if (!polylineClear(poly, obstacles)) {
              const fallback = routeOrthogonalVisioLike({
                start,
                end,
                sourceDir: startDir,
                targetDir: endDir,
                obstacles,
                corridorX,
                stub,
                grid: 10,
                minSeg,
              });
              poly = cleanupOrthogonalPolyline({ points: fallback, obstacles, grid: 10, minSeg });
            }
          }
    
          if (!isGraphvizLayoutEdge && !isInteractiveLite && !isFreeManual && poly.length >= 2) {
            const next = poly.slice();
            const dedup = (pts: { x: number; y: number }[]) => {
              const out: { x: number; y: number }[] = [];
              for (const p of pts) {
                const last = out[out.length - 1];
                if (last && Math.abs(last.x - p.x) < 1e-6 && Math.abs(last.y - p.y) < 1e-6) continue;
                out.push(p);
              }
              if (out.length <= 2) return out;
              const slim: { x: number; y: number }[] = [out[0]];
              for (let i = 1; i < out.length - 1; i++) {
                const a = slim[slim.length - 1];
                const b = out[i];
                const c = out[i + 1];
                const collinearX = Math.abs(a.x - b.x) < 1e-6 && Math.abs(b.x - c.x) < 1e-6;
                const collinearY = Math.abs(a.y - b.y) < 1e-6 && Math.abs(b.y - c.y) < 1e-6;
                if (collinearX || collinearY) continue;
                slim.push(b);
              }
              slim.push(out[out.length - 1]);
              return slim;
            };
    
            const ensureOrthogonalEnd = () => {
              if (!endDir) return;
              if (next.length < 2) return;
              const endP = next[next.length - 1];
              const prev = next[next.length - 2];
              const prev2 = next.length >= 3 ? next[next.length - 3] : null;
              const minEndSeg = 10;
              if (endDir === "top" || endDir === "bottom") {
                const desiredY = endDir === "top" ? Math.min(prev.y, endP.y - minEndSeg) : Math.max(prev.y, endP.y + minEndSeg);
                const newPrev = { x: endP.x, y: desiredY };
                next[next.length - 2] = newPrev;
                if (prev2 && Math.abs(prev2.x - newPrev.x) > 1e-6 && Math.abs(prev2.y - newPrev.y) > 1e-6) {
                  const mid = { x: prev2.x, y: newPrev.y };
                  next.splice(next.length - 2, 0, mid);
                }
              } else {
                const desiredX = endDir === "left" ? Math.min(prev.x, endP.x - minEndSeg) : Math.max(prev.x, endP.x + minEndSeg);
                const newPrev = { x: desiredX, y: endP.y };
                next[next.length - 2] = newPrev;
                if (prev2 && Math.abs(prev2.x - newPrev.x) > 1e-6 && Math.abs(prev2.y - newPrev.y) > 1e-6) {
                  const mid = { x: newPrev.x, y: prev2.y };
                  next.splice(next.length - 2, 0, mid);
                }
              }
            };
    
            const ensureOrthogonalStart = () => {
              if (!startDir) return;
              if (next.length < 2) return;
              const startP = next[0];
              const p1 = next[1];
              const p2 = next.length >= 3 ? next[2] : null;
              if (startDir === "top" || startDir === "bottom") {
                const newP1 = { x: startP.x, y: p1.y };
                next[1] = newP1;
                if (p2 && Math.abs(p2.x - newP1.x) > 1e-6 && Math.abs(p2.y - newP1.y) > 1e-6) {
                  const mid = { x: newP1.x, y: p2.y };
                  next.splice(2, 0, mid);
                }
              } else {
                const newP1 = { x: p1.x, y: startP.y };
                next[1] = newP1;
                if (p2 && Math.abs(p2.x - newP1.x) > 1e-6 && Math.abs(p2.y - newP1.y) > 1e-6) {
                  const mid = { x: p2.x, y: newP1.y };
                  next.splice(2, 0, mid);
                }
              }
            };
    
            ensureOrthogonalStart();
            ensureOrthogonalEnd();
            poly = dedup(next);
          }
      }

      if (!smoothInput && e.style === "polyline" && poly.length >= 3 && e.routeShape === "free") smoothInput = "polyline";

      const polyWithArrow = shortenEndForArrow(poly, 3, { preserveBezierTangent: smoothInput === "bezier" });
      const shouldSmooth = !!smoothInput && (smoothInput === "bezier" || polyWithArrow.length >= 3);
      const smoothKind = smoothInput ?? "auto";
      const drawPath = shouldSmooth ? edgePointsToSmoothPath(polyWithArrow, { input: smoothKind }) : polylineToPath(polyWithArrow);
      const polyForHit = shouldSmooth ? smoothPointsToPolyline(polyWithArrow, { input: smoothKind, stepsPerSegment: 14 }) : polyWithArrow;
      const hitPath = shouldSmooth ? drawPath : polylineToPath(polyForHit);

      let labelPos: { x: number; y: number } | undefined = e.labelPosition;
      if (!interactive && e.label && !labelPos && polyForHit.length >= 2) {
        labelPos = bestLabelPos(polyForHit, e.label, obstacles);
      }

      const geom: EdgeGeometry = { start, end, anchors, style: e.style, poly: polyForHit, hitPath, drawPath, label: e.label, labelPos };
      cache.set(edgeId, geom);
      keyById.set(edgeId, key);
      return geom;
    };

    for (const e of edges) compute(e.id);
    const alive = new Set<string>();
    byId.forEach((_, id) => alive.add(id));
    Array.from(cache.keys()).forEach((id) => {
      if (!alive.has(id)) cache.delete(id);
    });
    Array.from(keyById.keys()).forEach((id) => {
      if (!alive.has(id)) keyById.delete(id);
    });
    return { byId, cache, compute };
  }, [canvasMetrics, edges, nodes, routingStyle, interactive]);

  return { canvasMetrics, edgeGeometries };
}
