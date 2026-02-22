import type { FlowEdge, FlowNode, PortSide } from "./model";
import type { IRBlock, IRFor, IRIf, IRWhile } from "./ir";
import { fixedPortForStartEnd, nodeSize } from "./ports";

export function arrangeFromIR(nodes: FlowNode[], edges: FlowEdge[], ir: IRBlock, viewport?: { width: number; height: number }) {
  if (!nodes.length) return { nodes, edges };

  const GRID = 10;
  const snap = (v: number) => Math.round(v / GRID) * GRID;

  let maxW = 0;
  let maxH = 0;
  for (const n of nodes) {
    const s = nodeSize(n.shape);
    maxW = Math.max(maxW, s.w);
    maxH = Math.max(maxH, s.h);
  }

  const placed = new Map<string, { col: number; row: number }>();
  const occupied = new Map<string, string>();
  let maxCol = 0;
  let maxRow = 0;

  const place = (id: string | undefined, col: number, row: number) => {
    if (!id) return;
    if (placed.has(id)) return;
    let r = row;
    while (occupied.has(`${col},${r}`)) r += 1;
    placed.set(id, { col, row: r });
    occupied.set(`${col},${r}`, id);
    maxCol = Math.max(maxCol, col);
    maxRow = Math.max(maxRow, r);
  };

  const layWhileWithExit = (items: IRBlock["items"], idx: number, it: IRWhile, baseCol: number, row: number) => {
    place(it.decisionId, baseCol, row);
    const bodyEnd = layBlock(it.body, baseCol, row + 1);

    const exitCol = baseCol + 1;
    let consumed = 0;
    while (idx + 1 + consumed < items.length && items[idx + 1 + consumed].kind === "stmt") {
      const stmt = items[idx + 1 + consumed] as any;
      place(stmt.nodeId, exitCol, row + consumed);
      consumed += 1;
    }

    const exitEnd = row + consumed;
    const nextRow = Math.max(bodyEnd, exitEnd);
    return { nextRow, consumed };
  };

  const layBlock = (b: IRBlock, baseCol: number, startRow: number): number => {
    let row = startRow;
    for (let i = 0; i < b.items.length; i++) {
      const it = b.items[i];
      if (it.kind === "stmt") {
        place(it.nodeId, baseCol, row);
        row += 1;
        continue;
      }
      if (it.kind === "for") {
        row = layBlock((it as IRFor).body, baseCol, row);
        continue;
      }
      if (it.kind === "if") {
        row = layIf(it, baseCol, row);
        continue;
      }
      const res = layWhileWithExit(b.items, i, it, baseCol, row);
      row = res.nextRow;
      i += res.consumed;
    }
    return row;
  };

  const layIf = (it: IRIf, baseCol: number, row: number): number => {
    place(it.decisionId, baseCol, row);
    const thenStart = row + 1;
    const elseStart = row + 1;

    const thenEnd = layBlock(it.then, baseCol, thenStart);
    const elseEnd = it.else ? layBlock(it.else, baseCol + 1, elseStart) : elseStart;

    const joinRow = Math.max(thenEnd, elseEnd);
    if (it.joinId) {
      place(it.joinId, baseCol, joinRow);
      return joinRow + 1;
    }
    return joinRow;
  };

  const startId =
    nodes.find((n) => n.shape === "start_end" && (n.title.includes("开始") || n.title.toLowerCase().includes("start")))?.id ??
    nodes[0]?.id ??
    null;

  layBlock(ir, 0, 1);
  if (startId) place(startId, 0, 0);
  const endIds = nodes
    .filter((n) => n.shape === "start_end" && (n.title.includes("结束") || n.title.toLowerCase().includes("end")))
    .map((n) => n.id);
  const incoming = new Map<string, string[]>();
  for (const e of edges) {
    if (e.toEdge) continue;
    const arr = incoming.get(e.to) || [];
    arr.push(e.from);
    incoming.set(e.to, arr);
  }
  for (let i = 0; i < endIds.length; i++) {
    const id = endIds[i];
    if (placed.has(id)) continue;
    const ins = incoming.get(id) || [];
    let pickedCol = 0;
    let pickedRow = maxRow + 1;
    for (let k = 0; k < ins.length; k++) {
      const p = placed.get(ins[k]);
      if (!p) continue;
      pickedCol = p.col;
      pickedRow = p.row + 1;
      break;
    }
    place(id, pickedCol, pickedRow);
  }

  const minColStep = snap(maxW + 80);
  const minRowStep = snap(maxH + 60);
  const maxColStep = snap(maxW + 240);
  const maxRowStep = snap(maxH + 200);

  const colStep = (() => {
    if (!viewport || maxCol === 0) return snap(maxW + snap(Math.max(120, Math.round(maxW * 0.75))));
    const targetW = viewport.width * 0.9;
    const ideal = (targetW - maxW) / Math.max(1, maxCol);
    return snap(Math.max(minColStep, Math.min(maxColStep, ideal)));
  })();

  const rowStep = (() => {
    if (!viewport || maxRow === 0) return snap(maxH + snap(Math.max(90, Math.round(maxH * 0.85))));
    const targetH = viewport.height * 0.9;
    const ideal = (targetH - maxH) / Math.max(1, maxRow);
    return snap(Math.max(minRowStep, Math.min(maxRowStep, ideal)));
  })();

  const posById = new Map<string, { x: number; y: number }>();
  placed.forEach((p, id) => {
    posById.set(id, { x: snap(p.col * colStep), y: snap(p.row * rowStep) });
  });

  const unplaced = nodes.filter((n) => !posById.has(n.id));
  if (unplaced.length) {
    const baseCol = maxCol + 1;
    const startRow = 0;
    for (let i = 0; i < unplaced.length; i++) {
      posById.set(unplaced[i].id, { x: snap(baseCol * colStep), y: snap((startRow + i) * rowStep) });
    }
  }

  const nextNodes: FlowNode[] = nodes.map((n) => {
    const p = posById.get(n.id);
    return p ? { ...n, x: p.x, y: p.y } : n;
  });

  const cleanLabel = (s: string | undefined) => (s ?? "").trim().toLowerCase();
  const isNo = (e: FlowEdge) => {
    const l = cleanLabel(e.label);
    return l === "否" || l === "false";
  };

  const loopBackEdgeIds = new Set<string>();
  const walk = (b: IRBlock) => {
    for (const it of b.items) {
      if (it.kind === "if") {
        walk(it.then);
        if (it.else) walk(it.else);
        continue;
      }
      if (it.kind === "while") {
        if (it.backEdgeId) loopBackEdgeIds.add(it.backEdgeId);
        walk(it.body);
      }
    }
  };
  walk(ir);

  const portSide = (side: "N" | "E" | "S" | "W"): PortSide => {
    if (side === "N") return "top";
    if (side === "S") return "bottom";
    if (side === "E") return "right";
    return "left";
  };

  const nodeById = new Map(nodes.map((n) => [n.id, n] as const));
  const nextEdges: FlowEdge[] = edges.map((e): FlowEdge => {
    if (e.toEdge) return e;
    const fromNode = nodeById.get(e.from);
    const toNode = nodeById.get(e.to);
    if (!fromNode || !toNode) return e;

    let fromPort: PortSide | undefined;
    let toPort: PortSide | undefined;
    let label = e.label;
    const fp = placed.get(e.from);
    const tp = placed.get(e.to);

    if (loopBackEdgeIds.has(e.id)) {
      fromPort = portSide("W");
      toPort = portSide("W");
    } else if (fromNode.shape === "decision") {
      fromPort = isNo(e) ? portSide("E") : portSide("S");
      toPort = portSide("N");
      if (!label) label = fromPort === "right" ? "否" : "是";
    } else if (fromNode.shape === "start_end") {
      fromPort = fixedPortForStartEnd(fromNode.title);
      toPort = portSide("N");
    } else if (toNode.shape === "start_end") {
      fromPort = portSide("S");
      toPort = fixedPortForStartEnd(toNode.title);
    } else {
      if (fp && tp && fp.col !== tp.col) {
        if (fp.col < tp.col) {
          fromPort = portSide("E");
          toPort = portSide("W");
        } else {
          fromPort = portSide("W");
          toPort = portSide("E");
        }
      } else {
        fromPort = portSide("S");
        toPort = portSide("N");
      }
    }

    return {
      ...e,
      label,
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
