import ELK from "elkjs/lib/elk.bundled.js";
import type { FlowEdge, FlowNode, PortSide } from "./model";
import { nodeSize } from "./ports";

const elk = new ELK();

export async function arrangeFlow(nodes: FlowNode[], edges: FlowEdge[], canvas: { width: number; height: number }) {
  if (nodes.length === 0) return { nodes, edges };

  const GRID = 10;
  const snap = (v: number) => Math.round(v / GRID) * GRID;

  let maxW = 0;
  let maxH = 0;
  for (const n of nodes) {
    const s = nodeSize(n.shape);
    maxW = Math.max(maxW, s.w);
    maxH = Math.max(maxH, s.h);
  }

  const base = Math.max(60, Math.min(maxW, maxH));
  const nodeNode = snap(Math.max(30, Math.round(base * 0.45)));
  const layerSep = snap(Math.max(60, Math.round(base * 0.85)));
  const compSep = snap(Math.max(80, Math.round(base * 1.2)));

  const nodeById = new Map(nodes.map((n) => [n.id, n] as const));

  const cleanLabel = (s: string | undefined) => (s ?? "").trim().toLowerCase();
  const isNo = (e: FlowEdge) => {
    const l = cleanLabel(e.label);
    return l === "否" || l === "false";
  };
  const isYes = (e: FlowEdge) => {
    const l = cleanLabel(e.label);
    return l === "是" || l === "true";
  };

  const graphEdges = edges.filter((e) => !e.toEdge && nodeById.has(e.from) && nodeById.has(e.to));

  const out = new Map<string, string[]>();
  for (const n of nodes) out.set(n.id, []);
  for (const e of graphEdges) out.get(e.from)!.push(e.to);

  const edgesByFrom = new Map<string, FlowEdge[]>();
  for (const e of graphEdges) {
    const arr = edgesByFrom.get(e.from) || [];
    arr.push(e);
    edgesByFrom.set(e.from, arr);
  }

  const startId =
    nodes.find((n) => n.shape === "start_end" && (n.title.includes("开始") || n.title.toLowerCase().includes("start")))?.id ??
    nodes[0].id;

  const bfsDistances = (src: string) => {
    const dist = new Map<string, number>();
    const q: string[] = [];
    dist.set(src, 0);
    q.push(src);
    while (q.length) {
      const u = q.shift()!;
      const du = dist.get(u)!;
      const outs = out.get(u) || [];
      for (let i = 0; i < outs.length; i++) {
        const v = outs[i];
        if (!dist.has(v)) {
          dist.set(v, du + 1);
          q.push(v);
        }
      }
    }
    return dist;
  };

  const shortestPath = (src: string, dst: string) => {
    if (src === dst) return [src];
    const prev = new Map<string, string>();
    const q: string[] = [];
    const seen = new Set<string>();
    q.push(src);
    seen.add(src);
    while (q.length) {
      const u = q.shift()!;
      const outs = out.get(u) || [];
      for (let i = 0; i < outs.length; i++) {
        const v = outs[i];
        if (seen.has(v)) continue;
        seen.add(v);
        prev.set(v, u);
        if (v === dst) {
          const path: string[] = [dst];
          let cur = dst;
          while (cur !== src) {
            cur = prev.get(cur)!;
            path.push(cur);
          }
          path.reverse();
          return path;
        }
        q.push(v);
      }
    }
    return null;
  };

  const tryStructured = () => {
    const placed = new Map<string, { col: number; row: number }>();
    const loopBackEdgeIds = new Set<string>();

    let row = 0;
    let cur: string | null = startId;
    const seen = new Set<string>();

    const place = (id: string, col: number, r: number) => {
      if (!placed.has(id)) placed.set(id, { col, row: r });
    };

    while (cur && !seen.has(cur)) {
      const curId = cur;
      seen.add(curId);
      place(curId, 0, row);

      const node = nodeById.get(curId);
      const outsE: FlowEdge[] = (edgesByFrom.get(curId) || []).filter((e: FlowEdge) => nodeById.has(e.to));
      if (!outsE.length || !node) break;

      if (node.shape === "decision") {
        const yesE = outsE.find(isYes) || outsE[0] || null;
        const noE = outsE.find(isNo) || outsE.find((e: FlowEdge) => e !== yesE) || null;
        if (!yesE || !noE) {
          if (outsE.length !== 1) return null;
          row += 1;
          cur = outsE[0].to;
          continue;
        }

        const loopPath = shortestPath(yesE.to, curId);
        if (loopPath && loopPath.length >= 2) {
          const body = loopPath.slice(0, loopPath.length - 1);
          for (let i = 0; i < body.length; i++) {
            row += 1;
            place(body[i], 0, row);
          }
          const backFrom = loopPath[loopPath.length - 2];
          const backEdge = graphEdges.find((e) => e.from === backFrom && e.to === curId);
          if (backEdge) loopBackEdgeIds.add(backEdge.id);

          row += 1;
          cur = noE.to;
          continue;
        }

        const distYes = bfsDistances(yesE.to);
        const distNo = bfsDistances(noE.to);
        let join: string | null = null;
        let best = Number.POSITIVE_INFINITY;
        distYes.forEach((dy, id) => {
          const dn = distNo.get(id);
          if (dn === undefined) return;
          if (id === curId) return;
          const score = dy + dn;
          if (score < best) {
            best = score;
            join = id;
          }
        });

        const yesPath = join ? shortestPath(yesE.to, join) : [yesE.to];
        const noPath = join ? shortestPath(noE.to, join) : [noE.to];
        if (!yesPath || !noPath) return null;

        let yesRow = row;
        for (let i = 0; i < yesPath.length; i++) {
          const id = yesPath[i];
          if (join && id === join) break;
          yesRow += 1;
          place(id, 0, yesRow);
        }

        let noRow = row;
        for (let i = 0; i < noPath.length; i++) {
          const id = noPath[i];
          if (join && id === join) break;
          noRow += 1;
          place(id, 1, noRow);
        }

        row = Math.max(yesRow, noRow);
        if (join) {
          row += 1;
          place(join, 0, row);
          cur = join;
          continue;
        }

        cur = yesE.to;
        row += 1;
        continue;
      }

      if (outsE.length !== 1) return null;
      row += 1;
      cur = outsE[0].to;
    }

    if (placed.size < Math.max(1, nodes.length * 0.6)) return null;

    const posById = new Map<string, { x: number; y: number }>();
    const colStep = snap(maxW + Math.max(180, Math.round(maxW * 1.1)));
    const rowStep = snap(maxH + Math.max(120, Math.round(maxH * 1.3)));
    placed.forEach((p, id) => {
      posById.set(id, { x: snap(p.col * colStep), y: snap(p.row * rowStep) });
    });

    return { posById, loopBackEdgeIds };
  };

  const structured = tryStructured();
  if (structured) {
    const nextNodes: FlowNode[] = nodes.map((n) => {
      const p = structured.posById.get(n.id);
      if (!p) return n;
      return { ...n, x: p.x, y: p.y };
    });

    const loopBackEdgeIds = structured.loopBackEdgeIds;
    const nextEdges: FlowEdge[] = edges.map((e): FlowEdge => {
      if (e.toEdge) return e;
      if (!nodeById.has(e.from) || !nodeById.has(e.to)) return e;
      const fromNode = nodeById.get(e.from)!;

      let fromPort: PortSide | undefined;
      let toPort: PortSide | undefined;
      if (loopBackEdgeIds.has(e.id)) {
        fromPort = "left";
        toPort = "left";
      } else if (fromNode.shape === "decision") {
        fromPort = isNo(e) ? "right" : "bottom";
        toPort = "top";
      } else {
        fromPort = "bottom";
        toPort = "top";
      }

      return {
        ...e,
        style: "straight" as const,
        anchors: [],
        anchor: null,
        fromPort,
        toPort,
        fromDir: undefined,
        toDir: undefined,
        fromFree: null,
        toFree: null,
      };
    });

    return { nodes: nextNodes, edges: nextEdges };
  }

  const sccId = new Map<string, number>();
  const sccSize = new Map<number, number>();
  {
    let idx = 0;
    const index = new Map<string, number>();
    const low = new Map<string, number>();
    const stack: string[] = [];
    const onStack = new Set<string>();
    let comp = 0;

    const strongConnect = (v: string) => {
      index.set(v, idx);
      low.set(v, idx);
      idx += 1;
      stack.push(v);
      onStack.add(v);

      const outs = out.get(v) || [];
      for (let i = 0; i < outs.length; i++) {
        const w = outs[i];
        if (!index.has(w)) {
          strongConnect(w);
          low.set(v, Math.min(low.get(v)!, low.get(w)!));
        } else if (onStack.has(w)) {
          low.set(v, Math.min(low.get(v)!, index.get(w)!));
        }
      }

      if (low.get(v) === index.get(v)) {
        let size = 0;
        while (stack.length) {
          const w = stack.pop()!;
          onStack.delete(w);
          sccId.set(w, comp);
          size += 1;
          if (w === v) break;
        }
        sccSize.set(comp, size);
        comp += 1;
      }
    };

    for (const n of nodes) if (!index.has(n.id)) strongConnect(n.id);
  }

  const portId = (nodeId: string, side: "N" | "E" | "S" | "W") => `${nodeId}:${side}`;
  const portSide = (side: "N" | "E" | "S" | "W"): PortSide => {
    if (side === "N") return "top";
    if (side === "S") return "bottom";
    if (side === "E") return "right";
    return "left";
  };
  const elkPortSide = (side: "N" | "E" | "S" | "W") => {
    if (side === "N") return "NORTH";
    if (side === "S") return "SOUTH";
    if (side === "E") return "EAST";
    return "WEST";
  };

  const elkGraph: any = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.layered.cycleBreaking.strategy": "GREEDY",
      "elk.layered.mergeEdges": "true",
      "elk.spacing.nodeNode": String(nodeNode),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(layerSep),
      "elk.spacing.componentComponent": String(compSep),
      "elk.edgeRouting": "ORTHOGONAL",
    },
    children: nodes.map((n) => {
      const s = nodeSize(n.shape);
      return {
        id: n.id,
        width: s.w,
        height: s.h,
        layoutOptions: { "elk.portConstraints": "FIXED_SIDE" },
        ports: [
          { id: portId(n.id, "N"), layoutOptions: { "elk.port.side": elkPortSide("N") } },
          { id: portId(n.id, "E"), layoutOptions: { "elk.port.side": elkPortSide("E") } },
          { id: portId(n.id, "S"), layoutOptions: { "elk.port.side": elkPortSide("S") } },
          { id: portId(n.id, "W"), layoutOptions: { "elk.port.side": elkPortSide("W") } },
        ],
      };
    }),
    edges: graphEdges.map((e) => {
      const fromNode = nodeById.get(e.from)!;
      let src: "N" | "E" | "S" | "W" = "S";
      let dst: "N" | "E" | "S" | "W" = "N";
      if (fromNode.shape === "decision") {
        if (isNo(e)) src = "E";
        else if (isYes(e)) src = "S";
        else src = "S";
      }

      return { id: e.id, sources: [portId(e.from, src)], targets: [portId(e.to, dst)] };
    }),
  };

  let laid: any;
  try {
    laid = await elk.layout(elkGraph);
  } catch {
    return { nodes, edges };
  }

  const posById = new Map<string, { x: number; y: number }>();
  const children: any[] = laid.children || [];
  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    if (!c || typeof c.id !== "string") continue;
    posById.set(c.id, { x: snap(c.x || 0), y: snap(c.y || 0) });
  }

  const nextNodes: FlowNode[] = nodes.map((n) => {
    const p = posById.get(n.id);
    if (!p) return n;
    return { ...n, x: p.x, y: p.y };
  });

  const nextEdges: FlowEdge[] = edges.map((e): FlowEdge => {
    if (e.toEdge) return e;
    if (!nodeById.has(e.from) || !nodeById.has(e.to)) return e;

    const fromNode = nodeById.get(e.from)!;
    const inCycle =
      (sccId.get(e.from) ?? -1) === (sccId.get(e.to) ?? -2) && (sccSize.get(sccId.get(e.from) ?? -1) ?? 0) > 1;

    let fromPort: PortSide | undefined;
    let toPort: PortSide | undefined;
    const fp = posById.get(e.from);
    const tp = posById.get(e.to);
    const fs = nodeSize(fromNode.shape);
    const ts = nodeSize(nodeById.get(e.to)!.shape);
    const fromCy = fp ? fp.y + fs.h / 2 : 0;
    const toCy = tp ? tp.y + ts.h / 2 : 0;
    const backThreshold = Math.max(30, Math.round(maxH * 0.25));
    const isBackEdge = inCycle && fromCy > toCy + backThreshold;

    if (isBackEdge) {
      fromPort = portSide("W");
      toPort = portSide("W");
    } else if (fromNode.shape === "decision") {
      if (isNo(e)) fromPort = portSide("E");
      else fromPort = portSide("S");
      toPort = portSide("N");
    } else {
      fromPort = portSide("S");
      toPort = portSide("N");
    }

    return {
      ...e,
      style: "straight" as const,
      anchors: [],
      anchor: null,
      fromPort,
      toPort,
      fromDir: undefined,
      toDir: undefined,
      fromFree: null,
      toFree: null,
    };
  });

  return { nodes: nextNodes, edges: nextEdges };
}
