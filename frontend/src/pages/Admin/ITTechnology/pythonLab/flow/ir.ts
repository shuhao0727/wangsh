import type { FlowEdge, FlowNode } from "./model";

export type IRBlock = { kind: "block"; items: IRNode[] };
export type IRNode = IRStmt | IRIf | IRWhile | IRFor;
export type IRStmt = { kind: "stmt"; text: string; nodeId?: string };
export type IRIf = { kind: "if"; cond: string; then: IRBlock; else: IRBlock | null; decisionId: string; joinId?: string };
export type IRWhile = { kind: "while"; cond: string; body: IRBlock; decisionId: string; backEdgeId?: string };
export type IRFor = { kind: "for"; var: string; start: string; end: string; body: IRBlock };

export type GeneratePythonResult = {
  mode: "structured" | "linear" | "empty";
  ir: IRBlock | null;
  python: string;
  warnings: string[];
  nodeLineMap?: Record<string, number>;
};

const cleanLabel = (s: string | undefined) => (s ?? "").trim().toLowerCase();
const isNo = (e: FlowEdge) => {
  const l = cleanLabel(e.label);
  return l === "否" || l === "false";
};
const isYes = (e: FlowEdge) => {
  const l = cleanLabel(e.label);
  return l === "是" || l === "true";
};

const normalizeCond = (s: string) => {
  const t = s.trim().replace(/[？?]+$/, "").trim();
  return t
    .replaceAll("≤", "<=")
    .replaceAll("≥", ">=")
    .replaceAll("≠", "!=")
    .replaceAll("＝", "=")
    .replaceAll("　", " ");
};

const normalizeStmt = (s: string) => {
  const t = s.trim();
  return t.length ? t.replaceAll("＝", "=").replaceAll("　", " ") : "pass";
};

const findStartId = (nodes: FlowNode[]) => {
  const start =
    nodes.find((n) => n.shape === "start_end" && (n.title.includes("开始") || n.title.toLowerCase().includes("start")))?.id ??
    nodes[0]?.id ??
    null;
  return start;
};

const buildAdj = (nodes: FlowNode[], edges: FlowEdge[]) => {
  const nodeById = new Map(nodes.map((n) => [n.id, n] as const));
  const graphEdges = edges.filter((e) => !e.toEdge && nodeById.has(e.from) && nodeById.has(e.to));
  const out = new Map<string, string[]>();
  const edgesByFrom = new Map<string, FlowEdge[]>();
  for (const n of nodes) out.set(n.id, []);
  for (const e of graphEdges) {
    out.get(e.from)!.push(e.to);
    const arr = edgesByFrom.get(e.from) || [];
    arr.push(e);
    edgesByFrom.set(e.from, arr);
  }
  return { nodeById, graphEdges, out, edgesByFrom };
};

const bfsDistances = (out: Map<string, string[]>, src: string) => {
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

const shortestPath = (out: Map<string, string[]>, src: string, dst: string) => {
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

const pickDecisionEdges = (outs: FlowEdge[], decisionId: string, nodeById: Map<string, FlowNode>) => {
  const yesByLabel = outs.find(isYes) || null;
  const noByLabel = outs.find(isNo) || null;
  if (yesByLabel && noByLabel && yesByLabel !== noByLabel) return { yesE: yesByLabel, noE: noByLabel };
  if (outs.length < 2) return { yesE: outs[0] || null, noE: null };
  const d = nodeById.get(decisionId);
  const dcx = d ? d.x : 0;
  const dcy = d ? d.y : 0;
  const scored = outs
    .map((e) => {
      const t = nodeById.get(e.to);
      const dx = (t ? t.x : 0) - dcx;
      const dy = (t ? t.y : 0) - dcy;
      const score = dy * 2 + dx;
      return { e, score };
    })
    .sort((a, b) => b.score - a.score);
  const yesE = yesByLabel || scored[0].e;
  const noE = noByLabel || scored.find((x) => x.e !== yesE)?.e || null;
  return { yesE, noE };
};

const explainUnstructured = (nodes: FlowNode[], edges: FlowEdge[]) => {
  const { nodeById, graphEdges, edgesByFrom } = buildAdj(nodes, edges);
  const out: string[] = [];
  if (!nodes.length) return out;
  const startId = findStartId(nodes);
  if (!startId) out.push("缺少开始节点（start）");
  for (const n of nodes) {
    const outs = (edgesByFrom.get(n.id) || []).filter((e) => nodeById.has(e.to));
    if (n.shape === "decision") {
      if (outs.length !== 2) out.push(`条件节点出边不为2：${n.title || n.id}`);
      if (outs.length >= 2) {
        const hasYes = outs.some(isYes);
        const hasNo = outs.some(isNo);
        if (!hasYes || !hasNo) out.push(`条件分支缺少“是/否”标签：${n.title || n.id}`);
      }
    } else if (n.shape === "start_end") {
      if (outs.length > 1) out.push(`开始/结束节点出边过多：${n.title || n.id}`);
    } else {
      if (outs.length !== 1) out.push(`非条件节点出边不为1：${n.title || n.id}`);
    }
  }
  if (!graphEdges.length) out.push("没有有效连线（边）");
  return Array.from(new Set(out)).slice(0, 6);
};

const emitLinear = (nodes: FlowNode[], edges: FlowEdge[]): GeneratePythonResult => {
  if (!nodes.length) return { mode: "empty", ir: null, python: "", warnings: [] };
  const { nodeById, edgesByFrom } = buildAdj(nodes, edges);
  const startId = findStartId(nodes);
  if (!startId) return { mode: "empty", ir: null, python: "", warnings: [] };

  const visited = new Set<string>();
  const lines: string[] = [];
  let cur: string | null = startId;
  while (cur && !visited.has(cur)) {
    visited.add(cur);
    const n = nodeById.get(cur);
    if (n && n.shape !== "start_end") lines.push(normalizeStmt(n.title));
    const outs: FlowEdge[] = edgesByFrom.get(cur) || [];
    if (!outs.length) break;
    const next: FlowEdge = outs.length === 1 ? outs[0] : outs.find(isYes) || outs[0];
    cur = next.to;
  }
  const python = lines.length ? lines.join("\n") + "\n" : "pass\n";
  return { mode: "linear", ir: null, python, warnings: ["结构化识别失败，已降级为线性代码"], nodeLineMap: {} };
};

export function generatePythonFromFlow(nodes: FlowNode[], edges: FlowEdge[]): GeneratePythonResult {
  if (!nodes.length) return { mode: "empty", ir: null, python: "", warnings: [] };
  const startId = findStartId(nodes);
  if (!startId) return { mode: "empty", ir: null, python: "", warnings: [] };

  const { nodeById, graphEdges, out, edgesByFrom } = buildAdj(nodes, edges);
  const warnings: string[] = [];

  const parseDefHeader = (title: string) => {
    const t = title.trim();
    const m = /^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*$/.exec(t);
    if (!m) return null;
    return { name: m[1], params: m[2].trim() };
  };

  const parseBlock = (entry: string, stop: Set<string>, guard: Map<string, number>): { block: IRBlock; exit: string | null; ok: boolean } => {
    const items: IRNode[] = [];
    let cur: string | null = entry;
    while (cur && !stop.has(cur)) {
      const k = guard.get(cur) || 0;
      if (k > 2) return { block: { kind: "block", items }, exit: cur, ok: false };
      guard.set(cur, k + 1);

      const n = nodeById.get(cur);
      if (!n) return { block: { kind: "block", items }, exit: cur, ok: false };

      const outs: FlowEdge[] = (edgesByFrom.get(cur) || []).filter((e: FlowEdge) => nodeById.has(e.to));

      if (n.shape === "start_end") {
        if (!outs.length) return { block: { kind: "block", items }, exit: null, ok: true };
        if (outs.length !== 1) return { block: { kind: "block", items }, exit: cur, ok: false };
        cur = outs[0].to;
        continue;
      }

      if (n.shape !== "decision") {
        items.push({ kind: "stmt", text: normalizeStmt(n.title), nodeId: n.id });
        if (!outs.length) return { block: { kind: "block", items }, exit: null, ok: true };
        if (outs.length !== 1) return { block: { kind: "block", items }, exit: cur, ok: false };
        cur = outs[0].to;
        continue;
      }

      const { yesE, noE } = pickDecisionEdges(outs, n.id, nodeById);
      if (!yesE || !noE) return { block: { kind: "block", items }, exit: cur, ok: false };

      const cond = normalizeCond(n.title);
      const loopYes = shortestPath(out, yesE.to, n.id);
      const loopNo = shortestPath(out, noE.to, n.id);
      const loopPath = loopYes || loopNo;
      if (loopPath && loopPath.length >= 2) {
        const bodyEntry = loopYes ? yesE.to : noE.to;
        const afterLoop = loopYes ? noE.to : yesE.to;
        const bodyStop = new Set<string>([n.id, afterLoop]);
        const bodyRes = parseBlock(bodyEntry, bodyStop, new Map(guard));
        if (!bodyRes.ok) return { block: { kind: "block", items }, exit: cur, ok: false };
        const backFrom = loopPath[loopPath.length - 2];
        const backEdge = graphEdges.find((e) => e.from === backFrom && e.to === n.id);
        if (!backEdge) return { block: { kind: "block", items }, exit: cur, ok: false };
        items.push({ kind: "while", cond, body: bodyRes.block, decisionId: n.id, backEdgeId: backEdge?.id });
        cur = afterLoop;
        continue;
      }

      const distYes = bfsDistances(out, yesE.to);
      const distNo = bfsDistances(out, noE.to);
      let join: string | null = null;
      let best = Number.POSITIVE_INFINITY;
      distYes.forEach((dy, id) => {
        const dn = distNo.get(id);
        if (dn === undefined) return;
        if (id === n.id) return;
        const score = dy + dn;
        if (score < best) {
          best = score;
          join = id;
        }
      });
      if (!join) return { block: { kind: "block", items }, exit: cur, ok: false };

      const thenStop = new Set<string>([join]);
      const elseStop = new Set<string>([join]);
      const thenRes = parseBlock(yesE.to, thenStop, new Map(guard));
      const elseRes = parseBlock(noE.to, elseStop, new Map(guard));
      if (!thenRes.ok || !elseRes.ok) return { block: { kind: "block", items }, exit: cur, ok: false };

      items.push({
        kind: "if",
        cond,
        then: thenRes.block,
        else: elseRes.block.items.length ? elseRes.block : null,
        decisionId: n.id,
        joinId: join,
      });
      cur = join;
    }
    return { block: { kind: "block", items }, exit: cur, ok: true };
  };

  const top = parseBlock(startId, new Set<string>(), new Map());
  if (!top.ok) {
    const reasons = explainUnstructured(nodes, edges);
    const linear = emitLinear(nodes, edges);
    return { ...linear, warnings: linear.warnings.concat(reasons.length ? reasons.map((r) => `原因：${r}`) : []) };
  }

  const toFor = (block: IRBlock, warningsOut: string[]): IRBlock => {
    const out: IRNode[] = [];
    const initRe = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)\s*$/;
    const condRe = (v: string) => new RegExp(`^${v}\\s*(<=|<|>=|>)\\s*(.+)\\s*$`);

    const stripSpaces = (s: string) => s.replace(/\s+/g, "");
    const parseStepDelta = (raw: string, v: string): { delta: number; sign: 1 | -1 } | null => {
      const s = stripSpaces(raw);
      const p1 = new RegExp(`^${v}\\+=([0-9]+)$`);
      const p2 = new RegExp(`^${v}-=([0-9]+)$`);
      const p3 = new RegExp(`^${v}=${v}\\+([0-9]+)$`);
      const p4 = new RegExp(`^${v}=${v}-([0-9]+)$`);
      const m1 = p1.exec(s);
      if (m1) return { delta: Number(m1[1]), sign: 1 };
      const m2 = p2.exec(s);
      if (m2) return { delta: Number(m2[1]), sign: -1 };
      const m3 = p3.exec(s);
      if (m3) return { delta: Number(m3[1]), sign: 1 };
      const m4 = p4.exec(s);
      if (m4) return { delta: Number(m4[1]), sign: -1 };
      return null;
    };
    const isAssignToVar = (raw: string, v: string) => {
      const s = stripSpaces(raw);
      return s.startsWith(`${v}=`) && !s.startsWith(`${v}==`);
    };

    const endExclusiveFor = (op: string, endToken: string) => {
      const t = endToken.trim();
      if (op === "<") return t;
      if (op === "<=") {
        if (/^\\d+$/.test(t)) return String(Number(t) + 1);
        return `(${t} + 1)`;
      }
      if (op === ">") return t;
      if (op === ">=") {
        if (/^\\d+$/.test(t)) return String(Number(t) - 1);
        return `(${t} - 1)`;
      }
      return t;
    };

    for (let i = 0; i < block.items.length; i++) {
      const cur = block.items[i];

      if (cur.kind === "if") {
        out.push({ ...cur, then: toFor(cur.then, warningsOut), else: cur.else ? toFor(cur.else, warningsOut) : null });
        continue;
      }
      if (cur.kind === "while") {
        const condM = /^([A-Za-z_][A-Za-z0-9_]*)\\s*(<=|<|>=|>)\\s*(.+)$/.exec(cur.cond.trim());
        if (!condM) {
          out.push({ ...cur, body: toFor(cur.body, warningsOut) });
          continue;
        }
        const v = condM[1];
        const op = condM[2];
        const endToken = condM[3].trim();

        let initToken: string | null = null;
        let initWasImmediatePrev = false;
        for (let j = out.length - 1; j >= 0; j--) {
          const it = out[j];
          if (it.kind !== "stmt") break;
          const m = initRe.exec(it.text.trim());
          if (m && m[1] === v) {
            initToken = m[2].trim();
            initWasImmediatePrev = j === out.length - 1;
            break;
          }
        }

        const bodyItems = cur.body.items.slice();
        let step: number | null = null;
        let stepSign: 1 | -1 | null = null;
        let stepIndex = -1;
        for (let k = bodyItems.length - 1; k >= 0; k--) {
          const it = bodyItems[k];
          if (it.kind !== "stmt") continue;
          const s = it.text.trim();
          const parsed = parseStepDelta(s, v);
          if (parsed && Number.isFinite(parsed.delta) && parsed.delta > 0) {
            step = parsed.delta;
            stepSign = parsed.sign;
            stepIndex = k;
            break;
          }
        }

        const hasStepLike = bodyItems.some((it) => it.kind === "stmt" && !!parseStepDelta(it.text.trim(), v));
        if (!initToken && hasStepLike) warningsOut.push(`for 归纳失败：缺少 ${v} 的循环前初始化（如 ${v}=0）`);

        if (step !== null && stepIndex >= 0) {
          if (stepIndex !== bodyItems.length - 1) {
            warningsOut.push(`for 归纳失败：未找到 ${v} 的必经步进（建议将 ${v}+=${step} 放在循环体末尾）`);
            out.push({ ...cur, body: toFor(cur.body, warningsOut) });
            continue;
          }
          const bodyAssigns = bodyItems.filter((x) => x.kind === "stmt" && isAssignToVar(x.text.trim(), v));
          const stepStmt = bodyItems[stepIndex];
          if (bodyAssigns.length > 1 || (bodyAssigns.length === 1 && stepStmt && stepStmt.kind === "stmt" && bodyAssigns[0] !== stepStmt)) {
            warningsOut.push(`for 归纳失败：循环体内对 ${v} 存在多处赋值写入`);
            out.push({ ...cur, body: toFor(cur.body, warningsOut) });
            continue;
          }

          const wantSign: 1 | -1 = op === "<" || op === "<=" ? 1 : -1;
          if (stepSign !== wantSign) {
            warningsOut.push(`for 归纳失败：${v} 的步进方向与条件不一致`);
            out.push({ ...cur, body: toFor(cur.body, warningsOut) });
            continue;
          }
          if (!initToken) {
            out.push({ ...cur, body: toFor(cur.body, warningsOut) });
            continue;
          }

          bodyItems.pop();
          const endExclusive = endExclusiveFor(op, endToken);
          const startToken = initToken;
          const rangeExpr = (() => {
            if (wantSign === 1) {
              if (startToken.trim() === "0" && step === 1) return `range(${endExclusive})`;
              if (step === 1) return `range(${startToken}, ${endExclusive})`;
              return `range(${startToken}, ${endExclusive}, ${step})`;
            }
            const stepText = `-${step}`;
            if (step === 1) return `range(${startToken}, ${endExclusive}, -1)`;
            return `range(${startToken}, ${endExclusive}, ${stepText})`;
          })();

          if (initWasImmediatePrev) out.pop();
          out.push({ kind: "for", var: v, start: startToken, end: endExclusive, body: toFor({ kind: "block", items: bodyItems }, warningsOut) });
          continue;
        }

        out.push({ ...cur, body: toFor(cur.body, warningsOut) });
        continue;
      }

      if (cur.kind === "stmt" && i + 1 < block.items.length) {
        const next = block.items[i + 1];
        if (next.kind === "while") {
          const mInit = initRe.exec(cur.text.trim());
          if (mInit) {
            const v = mInit[1];
            const startToken = mInit[2].trim();
            const mCond = condRe(v).exec(next.cond.trim());
            if (mCond) {
              const op = mCond[1];
              const endToken = mCond[2].trim();
              const bodyItems = next.body.items.slice();
              const last = bodyItems[bodyItems.length - 1];
              const parsed = last && last.kind === "stmt" ? parseStepDelta(last.text.trim(), v) : null;
              if (parsed) {
                const step = parsed.delta;
                const wantSign: 1 | -1 = op === "<" || op === "<=" ? 1 : -1;
                if (parsed.sign !== wantSign) {
                  warningsOut.push(`for 归纳失败：${v} 的步进方向与条件不一致`);
                } else {
                  bodyItems.pop();
                  const endExclusive = endExclusiveFor(op, endToken);
                  out.push({ kind: "for", var: v, start: startToken, end: endExclusive, body: toFor({ kind: "block", items: bodyItems }, warningsOut) });
                  i += 1;
                  continue;
                }
              }
            }
          }
        }
      }

      out.push(cur);
    }
    return { kind: "block", items: out };
  };

  const normalizedTop = { ...top, block: toFor(top.block, warnings) };

  const ensureForWarnings = (block: IRBlock, warningsOut: string[]) => {
    const stripSpaces = (s: string) => s.replace(/\s+/g, "");
    const parseStepLike = (raw: string, v: string) => {
      const s = stripSpaces(raw);
      return (
        new RegExp(`^${v}\\+=([0-9]+)$`).test(s) ||
        new RegExp(`^${v}-=([0-9]+)$`).test(s) ||
        new RegExp(`^${v}=${v}\\+([0-9]+)$`).test(s) ||
        new RegExp(`^${v}=${v}-([0-9]+)$`).test(s)
      );
    };
    const initRe = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)\s*$/;
    const condRe = /^([A-Za-z_][A-Za-z0-9_]*)\s*(<=|<|>=|>)\s*(.+)$/;
    const lastInit = new Map<string, string>();
    for (const it of block.items) {
      if (it.kind === "stmt") {
        const m = initRe.exec(it.text.trim());
        if (m) lastInit.set(m[1], m[2].trim());
        continue;
      }
      if (it.kind === "if") {
        ensureForWarnings(it.then, warningsOut);
        if (it.else) ensureForWarnings(it.else, warningsOut);
        continue;
      }
      if (it.kind === "for") {
        ensureForWarnings(it.body, warningsOut);
        continue;
      }
      const m = condRe.exec(it.cond.trim());
      if (!m) {
        ensureForWarnings(it.body, warningsOut);
        continue;
      }
      const v = m[1];
      const hasStepLike = it.body.items.some((x) => x.kind === "stmt" && parseStepLike(x.text.trim(), v));
      if (hasStepLike && !lastInit.has(v)) {
        warningsOut.push(`for 归纳失败：缺少 ${v} 的循环前初始化（如 ${v}=0）`);
      }
      ensureForWarnings(it.body, warningsOut);
    }
  };
  ensureForWarnings(normalizedTop.block, warnings);

  const functionStarts = nodes
    .filter((n) => n.shape === "start_end" && !!parseDefHeader(n.title) && n.id !== startId)
    .map((n) => ({ id: n.id, def: parseDefHeader(n.title)! }));

  const emitPython = (block: IRBlock, indent: number, startLine: number, nodeLineMap: Record<string, number>): { lines: string[]; nextLine: number } => {
    const pad = (n: number) => " ".repeat(n);
    const outLines: string[] = [];
    let lineNo = startLine;
    for (const it of block.items) {
      if (it.kind === "stmt") {
        outLines.push(pad(indent) + (it.text || "pass"));
        if (it.nodeId) nodeLineMap[it.nodeId] = lineNo;
        lineNo += 1;
        continue;
      }
      if (it.kind === "for") {
        const rangeExpr = it.start.trim() === "0" ? `range(${it.end})` : `range(${it.start}, ${it.end})`;
        outLines.push(pad(indent) + `for ${it.var} in ${rangeExpr}:`);
        lineNo += 1;
        const bodyRes = emitPython(it.body, indent + 2, lineNo, nodeLineMap);
        const bodyLines = bodyRes.lines;
        outLines.push(...(bodyLines.length ? bodyLines : [pad(indent + 2) + "pass"]));
        lineNo = bodyRes.nextLine + (bodyLines.length ? 0 : 1);
        continue;
      }
      if (it.kind === "if") {
        outLines.push(pad(indent) + `if ${it.cond}:`);
        nodeLineMap[it.decisionId] = lineNo;
        lineNo += 1;
        const thenRes = emitPython(it.then, indent + 2, lineNo, nodeLineMap);
        const thenLines = thenRes.lines;
        outLines.push(...(thenLines.length ? thenLines : [pad(indent + 2) + "pass"]));
        lineNo = thenRes.nextLine + (thenLines.length ? 0 : 1);
        if (it.else && it.else.items.length) {
          outLines.push(pad(indent) + "else:");
          lineNo += 1;
          const elseRes = emitPython(it.else, indent + 2, lineNo, nodeLineMap);
          const elseLines = elseRes.lines;
          outLines.push(...(elseLines.length ? elseLines : [pad(indent + 2) + "pass"]));
          lineNo = elseRes.nextLine + (elseLines.length ? 0 : 1);
        }
        continue;
      }
      outLines.push(pad(indent) + `while ${it.cond}:`);
      nodeLineMap[it.decisionId] = lineNo;
      lineNo += 1;
      const bodyRes = emitPython(it.body, indent + 2, lineNo, nodeLineMap);
      const bodyLines = bodyRes.lines;
      outLines.push(...(bodyLines.length ? bodyLines : [pad(indent + 2) + "pass"]));
      lineNo = bodyRes.nextLine + (bodyLines.length ? 0 : 1);
    }
    return { lines: outLines, nextLine: lineNo };
  };

  const nodeLineMap: Record<string, number> = {};
  const funcLines: string[] = [];
  let lineNo = 1;
  for (const fs of functionStarts) {
    const res = parseBlock(fs.id, new Set<string>(), new Map());
    if (!res.ok) {
      warnings.push(`函数结构化识别失败: ${fs.def.name}`);
      continue;
    }
    const b = toFor(res.block, warnings);
    funcLines.push(`def ${fs.def.name}(${fs.def.params}):`);
    nodeLineMap[fs.id] = lineNo;
    lineNo += 1;
    const bodyRes = emitPython(b, 2, lineNo, nodeLineMap);
    const bodyLines = bodyRes.lines;
    funcLines.push(...(bodyLines.length ? bodyLines : ["  pass"]));
    lineNo = bodyRes.nextLine + (bodyLines.length ? 0 : 1);
    funcLines.push("");
    lineNo += 1;
  }

  const mainRes = emitPython(normalizedTop.block, 0, lineNo, nodeLineMap);
  const lines = [...funcLines, ...mainRes.lines];
  const python = lines.length ? lines.join("\n") + "\n" : "pass\n";
  if (!normalizedTop.block.items.length) warnings.push("未识别到可生成的语句");
  return { mode: "structured", ir: normalizedTop.block, python, warnings, nodeLineMap };
}
