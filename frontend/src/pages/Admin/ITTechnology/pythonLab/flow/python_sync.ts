import type { FlowEdge, FlowNode } from "./model";
import type { IRBlock, IRIf, IRNode, IRStmt, IRWhile } from "./ir";
import type { FlowNodeShape } from "../types";

type CodeIRBlock = { kind: "block"; items: CodeIRNode[] };
type CodeIRNode = CodeIRStmt | CodeIRIf | CodeIRWhile | CodeIRForRange | CodeIRDef;
type SourceLoc = { line: number };
type CodeIRStmt = { kind: "stmt"; text: string; loc: SourceLoc };
type CodeIRIf = { kind: "if"; cond: string; then: CodeIRBlock; else: CodeIRBlock | null; loc: SourceLoc };
type CodeIRWhile = { kind: "while"; cond: string; body: CodeIRBlock; loc: SourceLoc };
type CodeIRForRange = { kind: "for_range"; v: string; start: string; end: string; step: string | null; body: CodeIRBlock; loc: SourceLoc };
type CodeIRDef = { kind: "def"; name: string; params: string[]; body: CodeIRBlock; loc: SourceLoc };

export type ParsePythonResult =
  | { ok: true; ir: CodeIRBlock; warnings: string[] }
  | { ok: false; warnings: string[] };

const normalize = (code: string) => code.replaceAll("\t", "  ").replaceAll("\r\n", "\n").replaceAll("\r", "\n");

const stripComment = (line: string) => {
  const idx = line.indexOf("#");
  return idx >= 0 ? line.slice(0, idx) : line;
};

const indentOf = (line: string) => {
  let i = 0;
  while (i < line.length && line[i] === " ") i += 1;
  return i;
};

const isBlank = (line: string) => line.trim().length === 0;

const parseHeader = (line: string, prefix: "if" | "while") => {
  const t = line.trim();
  if (!t.startsWith(prefix + " ")) return null;
  if (!t.endsWith(":")) return null;
  const cond = t.slice(prefix.length + 1, -1).trim();
  return cond.length ? cond : null;
};

const splitComma = (src: string) => {
  const out: string[] = [];
  let depth = 0;
  let buf = "";
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "'" || ch === '"') {
      const q = ch;
      buf += ch;
      i += 1;
      while (i < src.length) {
        buf += src[i];
        if (src[i] === "\\" && i + 1 < src.length) {
          i += 1;
          buf += src[i];
          i += 1;
          continue;
        }
        if (src[i] === q) break;
        i += 1;
      }
      continue;
    }
    if (ch === "(") depth += 1;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      out.push(buf.trim());
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim().length) out.push(buf.trim());
  return out;
};

const parseForRange = (line: string) => {
  const t = line.trim();
  const m = /^for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+range\s*\((.*)\)\s*:\s*$/.exec(t);
  if (!m) return null;
  const v = m[1];
  const inside = m[2].trim();
  const parts = inside.length ? splitComma(inside) : [];
  if (parts.length < 1 || parts.length > 3) return null;
  const start = parts.length === 1 ? "0" : parts[0];
  const end = parts.length === 1 ? parts[0] : parts[1];
  const step = parts.length === 3 ? parts[2] : null;
  return { v, start, end, step };
};

const parseDef = (line: string) => {
  const t = line.trim();
  const m = /^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*:\s*$/.exec(t);
  if (!m) return null;
  const name = m[1];
  const params = m[2].trim().length ? m[2].split(",").map((p) => p.trim()).filter(Boolean) : [];
  return { name, params };
};

export function validatePythonLite(code: string): { ok: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const src = normalize(code);
  const lines = src.split("\n");

  const detectIndentStep = () => {
    const deltas: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      if (raw.trim().length === 0) continue;
      const t = raw.trim();
      if (!t.endsWith(":")) continue;
      const ind = indentOf(raw);
      for (let j = i + 1; j < lines.length; j++) {
        const nx = lines[j];
        if (nx.trim().length === 0) continue;
        const nextInd = indentOf(nx);
        if (nextInd > ind) deltas.push(nextInd - ind);
        break;
      }
    }
    const positives = deltas.filter((d) => Number.isFinite(d) && d > 0);
    if (!positives.length) return 2;
    positives.sort((a, b) => a - b);
    return positives[0];
  };

  const indentStep = detectIndentStep();

  const headerKeywords = ["if", "elif", "else", "for", "while", "def", "try", "except", "finally", "with", "class"] as const;
  const isHeaderLine = (t: string) => headerKeywords.some((k) => t === `${k}:` || t.startsWith(k + " "));
  const needsColon = (t: string) => headerKeywords.some((k) => t === k || t.startsWith(k + " "));

  const nextNonBlankIndent = (from: number) => {
    for (let i = from; i < lines.length; i++) {
      const raw = lines[i];
      if (raw.trim().length === 0) continue;
      return indentOf(raw);
    }
    return null;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim().length === 0) continue;
    if (raw.includes("\t")) warnings.push(`第 ${i + 1} 行包含 Tab，建议使用空格缩进`);
    const ind = indentOf(raw);
    if (indentStep > 0 && ind % indentStep !== 0) warnings.push(`第 ${i + 1} 行缩进不是 ${indentStep} 的倍数`);
    const t = raw.trim();

    if (needsColon(t) && isHeaderLine(t) && !t.endsWith(":")) {
      warnings.push(`第 ${i + 1} 行控制语句缺少冒号 ":"`);
    }

    if (t.endsWith(":")) {
      const nextInd = nextNonBlankIndent(i + 1);
      if (nextInd === null) {
        warnings.push(`第 ${i + 1} 行以 ":" 结尾，但后续没有缩进块`);
      } else if (nextInd <= ind) {
        warnings.push(`第 ${i + 1} 行以 ":" 结尾，但下一块缩进未增加`);
      } else if (indentStep > 0 && nextInd - ind !== indentStep) {
        warnings.push(`第 ${i + 1} 行以 ":" 结尾，建议缩进增加 ${indentStep} 个空格`);
      }
    }
  }

  return { ok: warnings.length === 0, warnings };
}

export function parsePythonToIR(code: string): ParsePythonResult {
  const warnings: string[] = [];
  const src = normalize(code);
  const rawLines = src.split("\n");
  const lines = rawLines.map((l) => stripComment(l));

  const detectIndentStep = () => {
    const deltas: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      if (isBlank(raw)) continue;
      const t = raw.trim();
      if (!t.endsWith(":")) continue;
      const ind = indentOf(raw);
      for (let j = i + 1; j < lines.length; j++) {
        const nx = lines[j];
        if (isBlank(nx)) continue;
        const nextInd = indentOf(nx);
        if (nextInd > ind) deltas.push(nextInd - ind);
        break;
      }
    }
    const positives = deltas.filter((d) => Number.isFinite(d) && d > 0);
    if (!positives.length) return 2;
    positives.sort((a, b) => a - b);
    const step = positives[0];
    if (step !== 2 && step !== 4) return step;
    return step;
  };

  const indentStep = detectIndentStep();

  const parseBlock = (startIdx: number, baseIndent: number): { block: CodeIRBlock; nextIdx: number; ok: boolean } => {
    const items: CodeIRNode[] = [];
    let i = startIdx;
    let inDoc = false;
    let docDelim: "\"\"\"" | "'''" | null = null;
    while (i < lines.length) {
      const raw = lines[i];
      if (isBlank(raw)) {
        i += 1;
        continue;
      }
      const trimmedRaw = raw.trim();
      if (inDoc) {
        if (docDelim && trimmedRaw.includes(docDelim)) {
          inDoc = false;
          docDelim = null;
        }
        i += 1;
        continue;
      }
      if (trimmedRaw.startsWith('"""') || trimmedRaw.startsWith("'''")) {
        const delim = trimmedRaw.startsWith('"""') ? "\"\"\"" : "'''";
        const hits = trimmedRaw.split(delim).length - 1;
        if (hits >= 2) {
          i += 1;
          continue;
        }
        inDoc = true;
        docDelim = delim as any;
        i += 1;
        continue;
      }
      const ind = indentOf(raw);
      if (ind < baseIndent) break;
      if (ind > baseIndent) return { block: { kind: "block", items }, nextIdx: i, ok: false };

      const trimmed = raw.trim();
      const loc = { line: i + 1 };
      const whileCond = parseHeader(trimmed, "while");
      if (whileCond) {
        const body = parseBlock(i + 1, baseIndent + indentStep);
        if (!body.ok) return { block: { kind: "block", items }, nextIdx: body.nextIdx, ok: false };
        items.push({ kind: "while", cond: whileCond, body: body.block, loc });
        i = body.nextIdx;
        continue;
      }

      const forR = parseForRange(trimmed);
      if (forR) {
        const body = parseBlock(i + 1, baseIndent + indentStep);
        if (!body.ok) return { block: { kind: "block", items }, nextIdx: body.nextIdx, ok: false };
        items.push({ kind: "for_range", v: forR.v, start: forR.start, end: forR.end, step: forR.step, body: body.block, loc });
        i = body.nextIdx;
        continue;
      }

      const defH = parseDef(trimmed);
      if (defH) {
        const body = parseBlock(i + 1, baseIndent + indentStep);
        if (!body.ok) return { block: { kind: "block", items }, nextIdx: body.nextIdx, ok: false };
        items.push({ kind: "def", name: defH.name, params: defH.params, body: body.block, loc });
        i = body.nextIdx;
        continue;
      }

      const ifCond = parseHeader(trimmed, "if");
      if (ifCond) {
        const thenRes = parseBlock(i + 1, baseIndent + indentStep);
        if (!thenRes.ok) return { block: { kind: "block", items }, nextIdx: thenRes.nextIdx, ok: false };
        let j = thenRes.nextIdx;
        while (j < lines.length && isBlank(lines[j])) j += 1;
        let elseBlock: CodeIRBlock | null = null;
        if (j < lines.length) {
          const elseLine = lines[j];
          if (!isBlank(elseLine) && indentOf(elseLine) === baseIndent && elseLine.trim() === "else:") {
            const elseRes = parseBlock(j + 1, baseIndent + indentStep);
            if (!elseRes.ok) return { block: { kind: "block", items }, nextIdx: elseRes.nextIdx, ok: false };
            elseBlock = elseRes.block;
            j = elseRes.nextIdx;
          }
        }
        items.push({ kind: "if", cond: ifCond, then: thenRes.block, else: elseBlock, loc });
        i = j;
        continue;
      }

      items.push({ kind: "stmt", text: trimmed.length ? trimmed : "pass", loc });
      i += 1;
    }
    return { block: { kind: "block", items }, nextIdx: i, ok: true };
  };

  const top = parseBlock(0, 0);
  if (!top.ok) return { ok: false, warnings: ["暂不支持该 Python 结构（缩进/语法不规范）"] };
  if (!top.block.items.length) warnings.push("代码为空或未识别到可转换的语句");
  return { ok: true, ir: top.block, warnings };
}

type BuildResult = { nodes: FlowNode[]; edges: FlowEdge[]; ir: IRBlock; warnings: string[] };
export type FunctionFlowResult = { name: string; params: string[]; nodes: FlowNode[]; edges: FlowEdge[]; ir: IRBlock };
export type BuildFlowsResult = { main: BuildResult; functions: FunctionFlowResult[] };
export type BuildUnifiedFlowResult = BuildResult;

const normalizeCondTitle = (cond: string) => {
  const c = cond.trim().replaceAll("≤", "<=").replaceAll("≥", ">=").replaceAll("≠", "!=");
  return c.endsWith("?") ? c : `${c} ?`;
};

const isIO = (stmt: string) => {
  const t = stmt.trim();
  return t.startsWith("print(") || t.includes("input(");
};

const isSubroutineCall = (stmt: string) => {
  const t = stmt.trim();
  if (t.startsWith("print(") || t.includes("input(")) return false;
  if (t.startsWith("return ")) return false;
  if (t === "return") return false;
  if (t.startsWith("if ") || t.startsWith("while ") || t.startsWith("for ") || t.startsWith("def ")) return false;
  const noAssign = t.replace(/^[A-Za-z_][A-Za-z0-9_]*\s*=\s*/, "");
  return /^[A-Za-z_][A-Za-z0-9_]*\s*\(.*\)\s*$/.test(noAssign);
};

export function buildFlowFromPython(code: string): BuildResult | null {
  const parsed = parsePythonToIR(code);
  if (!parsed.ok) return null;

  const defs = parsed.ir.items.filter((it) => it.kind === "def") as CodeIRDef[];
  if (defs.length) {
    for (const d of defs) parsed.warnings.push(`已忽略函数定义 def ${d.name}(...):（当前仅展示主流程）`);
  }
  const mainIr: CodeIRBlock = { kind: "block", items: parsed.ir.items.filter((it) => it.kind !== "def") };

  const built = buildFlowFromCodeIR(mainIr, parsed.warnings, { startTitle: "开始", endTitle: "结束" });
  return built;
}

export function buildFlowsFromPython(code: string): BuildFlowsResult | null {
  const parsed = parsePythonToIR(code);
  if (!parsed.ok) return null;

  const defs = parsed.ir.items.filter((it) => it.kind === "def") as CodeIRDef[];
  const mainIr: CodeIRBlock = { kind: "block", items: parsed.ir.items.filter((it) => it.kind !== "def") };
  const main = buildFlowFromCodeIR(mainIr, parsed.warnings, { startTitle: "开始", endTitle: "结束" });
  const functions: FunctionFlowResult[] = defs.map((d) => {
    const title = `def ${d.name}(${d.params.join(", ")})`;
    const f = buildFlowFromCodeIR(d.body, [], { startTitle: title, endTitle: "结束" });
    return { name: d.name, params: d.params, nodes: f.nodes, edges: f.edges, ir: f.ir };
  });
  return { main, functions };
}

export function buildUnifiedFlowFromPython(code: string): BuildUnifiedFlowResult | null {
  const built = buildFlowsFromPython(code);
  if (!built) return null;
  const nodes: FlowNode[] = [...built.main.nodes];
  const edges: FlowEdge[] = [...built.main.edges];

  const remapGraph = (fn: FunctionFlowResult, idx: number) => {
    const prefix = `fn_${fn.name}_${idx}__`;
    const nodeId = (id: string) => prefix + id;
    const edgeId = (id: string) => prefix + id;
    const idMap = new Map<string, string>();
    for (const n of fn.nodes) idMap.set(n.id, nodeId(n.id));
    const mappedNodes = fn.nodes.map((n) => ({ ...n, id: idMap.get(n.id)!, x: 0, y: 0 }));
    const mappedEdges = fn.edges.map((e) => ({
      ...e,
      id: edgeId(e.id),
      from: idMap.get(e.from) ?? e.from,
      to: idMap.get(e.to) ?? e.to,
      toEdge: e.toEdge ? edgeId(e.toEdge) : e.toEdge,
    }));
    return { mappedNodes, mappedEdges };
  };

  built.functions.forEach((fn, i) => {
    const { mappedNodes, mappedEdges } = remapGraph(fn, i);
    nodes.push(...mappedNodes);
    edges.push(...mappedEdges);
  });

  return { nodes, edges, ir: built.main.ir, warnings: built.main.warnings };
}

function buildFlowFromCodeIR(block: CodeIRBlock, warnings: string[], titles: { startTitle: string; endTitle: string }): BuildResult {
  let idSeq = 0;
  const nextId = (prefix: string) => `${prefix}_${++idSeq}`;

  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  const startNode: FlowNode = { id: nextId("start"), shape: "start_end", title: titles.startTitle, x: 0, y: 0 };
  nodes.push(startNode);

  const endNode: FlowNode = { id: nextId("end"), shape: "start_end", title: titles.endTitle, x: 0, y: 0 };
  const isFunctionFlow = titles.startTitle.trim().toLowerCase().startsWith("def ");
  const isReturnStmt = (text: string) => {
    const t = text.trim();
    return t === "return" || t.startsWith("return ");
  };

  const emitEdge = (from: string, to: string, label?: string) => {
    edges.push({ id: nextId("e"), from, to, style: "straight", routeMode: "auto", anchor: null, label });
  };

  const emitStmtNode = (text: string, sourceLine?: number, sourceRole?: string) => {
    const shape: FlowNodeShape = isIO(text) ? "io" : isSubroutineCall(text) ? "subroutine" : "process";
    const n: FlowNode = { id: nextId("n"), shape, title: text, x: 0, y: 0, sourceLine, sourceRole };
    nodes.push(n);
    const irStmt: IRStmt = { kind: "stmt", text, nodeId: n.id };
    return { nodeId: n.id, ir: irStmt };
  };

  // Helper: Detect if a block is effectively just a single "if" statement (representing an "elif")
  // We use this to flatten nested else-if chains.
  const isElifBlock = (block: CodeIRBlock) => {
      return block.items.length === 1 && block.items[0].kind === "if";
  };

  const emitIf = (it: CodeIRIf, parentJoinId?: string): { entry: string; exit: string | null; irItems: IRNode[]; whileDecisionId: string | null } => {
    const d: FlowNode = { id: nextId("dec"), shape: "decision", title: normalizeCondTitle(it.cond), x: 0, y: 0, sourceLine: it.loc.line };
    nodes.push(d);
    
    // If we are part of an elif chain (parentJoinId provided), we reuse the parent's join node.
    // Otherwise, we create a new join node for this if-else structure.
    const joinId = parentJoinId || nextId("join");
    
    // Only create the join node if it's new (not passed from parent)
    if (!parentJoinId) {
        const join: FlowNode = { id: joinId, shape: "connector", title: "", x: 0, y: 0 };
        nodes.push(join);
    }

    const thenRes = emitBlock(it.then);
    
    // Check if the else block is an "elif" (single if statement)
    const isElif = it.else && isElifBlock(it.else);
    
    let elseRes: { entry: string; exit: string | null; irItems: IRNode[]; whileDecisionId: string | null } | null = null;
    let elseEntry: string | null = null;

    if (it.else) {
        if (isElif) {
            // RECURSIVE FLATTENING:
            // Instead of emitting the else block as a standard block, we directly emit the inner IF
            // passing OUR joinId down to it. This effectively merges the exit points.
            elseRes = emitIf(it.else.items[0] as CodeIRIf, joinId);
            elseEntry = elseRes.entry;
        } else {
            // Standard else block
            const blockRes = emitBlock(it.else);
            elseRes = { 
                entry: blockRes.entry, 
                exit: blockRes.exit, 
                irItems: blockRes.ir.items, 
                whileDecisionId: null 
            };
            elseEntry = blockRes.entry;
        }
    }

    // Edge: Decision -> Then
    emitEdge(d.id, thenRes.entry, "是");
    // Edge: Then -> Join (if it doesn't return/break)
    if (thenRes.exit) emitEdge(thenRes.exit, joinId);

    if (elseEntry) {
      // Edge: Decision -> Else/Elif
      emitEdge(d.id, elseEntry, "否");
      
      // Edge: Else/Elif -> Join
      // If it was an Elif, its exit is already wired to joinId by the recursive call (or it's the joinId itself)
      // So we only need to wire if it's a standard else block and has an exit.
      if (!isElif && elseRes && elseRes.exit) {
          emitEdge(elseRes.exit, joinId);
      }
    } else {
      // No else branch: Decision -> Join (False path)
      emitEdge(d.id, joinId, "否");
    }

    const irIf: IRIf = {
      kind: "if",
      cond: it.cond,
      then: thenRes.ir,
      else: it.else ? { kind: "block", items: elseRes?.irItems || [] } : null, // Simplified IR reconstruction
      decisionId: d.id,
      joinId: joinId,
    };
    
    // If we are in an elif chain (parentJoinId exists), our "exit" is the shared joinId.
    // But strictly speaking, emitIf returns the entry/exit of this structure.
    // If we flattened, the "exit" of this whole structure IS the joinId (or whatever leads to it).
    // For standard block composition, we return joinId as the single exit point.
    
    return { entry: d.id, exit: joinId, irItems: [irIf as IRNode], whileDecisionId: null as string | null };
  };

  const emitWhile = (it: CodeIRWhile) => {
    const d: FlowNode = { id: nextId("dec"), shape: "decision", title: normalizeCondTitle(it.cond), x: 0, y: 0, sourceLine: it.loc.line };
    nodes.push(d);
    const bodyRes = emitBlock(it.body);
    emitEdge(d.id, bodyRes.entry, "是");
    let backEdgeId: string | undefined;
    if (bodyRes.exit) {
      backEdgeId = nextId("e");
      edges.push({
        id: backEdgeId,
        from: bodyRes.exit,
        to: d.id,
        style: "straight",
        routeMode: "auto",
        anchor: null,
        label: "是",
        fromPort: "left",
        toPort: "left",
      });
    }
    const irWhile: IRWhile = { kind: "while", cond: it.cond, body: bodyRes.ir, decisionId: d.id, backEdgeId };
    return { entry: d.id, exit: d.id, irItems: [irWhile as IRNode], whileDecisionId: d.id };
  };

  const emitForRange = (it: CodeIRForRange) => {
    const init = emitStmtNode(`${it.v} = ${it.start}`, it.loc.line, "for_init");
    const stepText = it.step ? it.step.trim() : "1";
    const stepNum = Number(stepText);
    const isNeg = Number.isFinite(stepNum) ? stepNum < 0 : false;
    const cond = `${it.v} ${isNeg ? ">" : "<"} ${it.end}`;
    const d: FlowNode = { id: nextId("dec"), shape: "decision", title: normalizeCondTitle(cond), x: 0, y: 0, sourceLine: it.loc.line, sourceRole: "for_check" };
    nodes.push(d);
    const bodyRes = emitBlock(it.body);
    const inc = emitStmtNode(`${it.v} += ${stepText}`, it.loc.line, "for_inc");

    emitEdge(init.nodeId, d.id);
    emitEdge(d.id, bodyRes.entry, "是");
    if (bodyRes.exit) emitEdge(bodyRes.exit, inc.nodeId);
    const backEdgeId = nextId("e");
    edges.push({ id: backEdgeId, from: inc.nodeId, to: d.id, style: "straight", routeMode: "auto", anchor: null, label: "是", fromPort: "left", toPort: "left" });
    const loopBody: IRBlock = { kind: "block", items: [...bodyRes.ir.items, inc.ir] };
    const irWhile: IRWhile = { kind: "while", cond, body: loopBody, decisionId: d.id, backEdgeId };
    return { entry: init.nodeId, exit: d.id, irItems: [init.ir as IRNode, irWhile as IRNode], whileDecisionId: d.id };
  };

  const emitNode = (it: CodeIRNode): { entry: string; exit: string | null; irItems: IRNode[]; whileDecisionId: string | null } => {
    if (it.kind === "stmt") {
      const s = emitStmtNode(it.text, it.loc.line);
      const terminal = isFunctionFlow && isReturnStmt(it.text);
      return { entry: s.nodeId, exit: terminal ? null : s.nodeId, irItems: [s.ir as IRNode], whileDecisionId: null as string | null };
    }
    if (it.kind === "if") return emitIf(it);
    if (it.kind === "while") return emitWhile(it);
    if (it.kind === "for_range") return emitForRange(it);
    return { entry: null as unknown as string, exit: null as unknown as string | null, irItems: [], whileDecisionId: null as string | null };
  };

  const emitBlock = (b: CodeIRBlock): { entry: string; exit: string | null; ir: IRBlock } => {
    const items: IRNode[] = [];
    let entry: string | null = null;
    let prevExit: string | null = null;
    let pendingWhileDecisionId: string | null = null;

    for (const it of b.items) {
      const res = emitNode(it);
      for (const ir of res.irItems) items.push(ir);
      if (!entry && res.entry) entry = res.entry;

      if (prevExit) {
        if (pendingWhileDecisionId && prevExit === pendingWhileDecisionId && res.entry !== pendingWhileDecisionId) {
          emitEdge(prevExit, res.entry, "否");
          pendingWhileDecisionId = null;
        } else {
          emitEdge(prevExit, res.entry);
        }
      }

      prevExit = res.exit;
      if (res.whileDecisionId) {
        pendingWhileDecisionId = res.whileDecisionId;
        prevExit = res.whileDecisionId;
      } else {
        pendingWhileDecisionId = null;
      }
    }

    if (!entry) {
      const p = emitStmtNode("pass");
      entry = p.nodeId;
      prevExit = p.nodeId;
      items.push(p.ir);
    }

    return { entry, exit: prevExit!, ir: { kind: "block", items } };
  };

  const body = emitBlock(block);
  emitEdge(startNode.id, body.entry);
  const last = block.items.length ? block.items[block.items.length - 1] : null;
  if (body.exit !== null) {
    emitEdge(body.exit, endNode.id, last && (last.kind === "while" || last.kind === "for_range") ? "否" : undefined);
    nodes.push(endNode);
  }

  const ir: IRBlock = {
    kind: "block",
    items: body.ir.items,
  };

  return { nodes, edges, ir, warnings };
}
