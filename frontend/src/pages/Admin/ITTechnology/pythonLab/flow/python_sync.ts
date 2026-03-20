import type { FlowEdge, FlowNode } from "./model";
import type { IRBlock, IRIf, IRNode, IRStmt, IRWhile } from "./ir";
import type { FlowNodeShape } from "../types";
import { buildDebugMapFromNodes, type DebugForInEntry, type DebugForRangeEntry, type DebugMap, type DebugWhileEntry } from "./debugMap";
import { splitNodeTitleSemantically } from "./ports";

type CodeIRBlock = { kind: "block"; items: CodeIRNode[] };
type CodeIRNode = CodeIRStmt | CodeIRIf | CodeIRWhile | CodeIRForRange | CodeIRForIn | CodeIRDef;
type SourceLoc = { line: number };
type CodeIRStmt = { kind: "stmt"; text: string; loc: SourceLoc };
type CodeIRIf = { kind: "if"; cond: string; then: CodeIRBlock; else: CodeIRBlock | null; loc: SourceLoc };
type CodeIRWhile = { kind: "while"; cond: string; body: CodeIRBlock; loc: SourceLoc };
type CodeIRForRange = { kind: "for_range"; v: string; start: string; end: string; step: string | null; body: CodeIRBlock; loc: SourceLoc };
type CodeIRForIn = { kind: "for_in"; vars: string[]; iterable: string; isEnumerate: boolean; body: CodeIRBlock; loc: SourceLoc };
type CodeIRDef = { kind: "def"; name: string; params: string[]; body: CodeIRBlock; loc: SourceLoc };

export type ParsePythonResult =
  | { ok: true; ir: CodeIRBlock; warnings: string[] }
  | { ok: false; warnings: string[] };

const normalize = (code: string) => code.replaceAll("\t", "  ").replaceAll("\r\n", "\n").replaceAll("\r", "\n");

const stripComment = (line: string) => {
  let inStr: "'" | '"' | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inStr) {
      if (ch === "\\" && i + 1 < line.length) { i++; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"') { inStr = ch; continue; }
    if (ch === "#") return line.slice(0, i);
  }
  return line;
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

const parseElifHeader = (line: string) => {
  const t = line.trim();
  if (!t.startsWith("elif ")) return null;
  if (!t.endsWith(":")) return null;
  const cond = t.slice("elif".length + 1, -1).trim();
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

const parseForIn = (line: string) => {
  const t = line.trim();
  const m = /^for\s+(.+?)\s+in\s+(.+?)\s*:\s*$/.exec(t);
  if (!m) return null;
  let target = m[1].trim();
  const iterable = m[2].trim();
  if (!target.length || !iterable.length) return null;
  if (target.startsWith("(") && target.endsWith(")")) target = target.slice(1, -1).trim();
  const vars = splitComma(target).map((s) => s.trim()).filter(Boolean);
  if (!vars.length) return null;
  if (!vars.every((v) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(v))) return null;
  const isEnumerate = /^enumerate\s*\(/.test(iterable);
  return { vars, iterable, isEnumerate };
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

      const forIn = parseForIn(trimmed);
      if (forIn) {
        const body = parseBlock(i + 1, baseIndent + indentStep);
        if (!body.ok) return { block: { kind: "block", items }, nextIdx: body.nextIdx, ok: false };
        items.push({ kind: "for_in", vars: forIn.vars, iterable: forIn.iterable, isEnumerate: forIn.isEnumerate, body: body.block, loc });
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
        const firstThen = parseBlock(i + 1, baseIndent + indentStep);
        if (!firstThen.ok) return { block: { kind: "block", items }, nextIdx: firstThen.nextIdx, ok: false };

        const branches: { cond: string; then: CodeIRBlock; loc: SourceLoc }[] = [{ cond: ifCond, then: firstThen.block, loc }];
        let j = firstThen.nextIdx;
        while (j < lines.length && isBlank(lines[j])) j += 1;

        while (j < lines.length) {
          const line = lines[j];
          if (isBlank(line)) {
            j += 1;
            continue;
          }
          if (indentOf(line) !== baseIndent) break;
          const elifCond = parseElifHeader(line.trim());
          if (!elifCond) break;
          const elifThen = parseBlock(j + 1, baseIndent + indentStep);
          if (!elifThen.ok) return { block: { kind: "block", items }, nextIdx: elifThen.nextIdx, ok: false };
          branches.push({ cond: elifCond, then: elifThen.block, loc: { line: j + 1 } });
          j = elifThen.nextIdx;
          while (j < lines.length && isBlank(lines[j])) j += 1;
        }

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

        let nestedElse: CodeIRBlock | null = elseBlock;
        let nestedIf: CodeIRIf | null = null;
        for (let k = branches.length - 1; k >= 0; k--) {
          const br = branches[k];
          const elseForThis: CodeIRBlock | null = k === branches.length - 1 ? nestedElse : { kind: "block", items: [nestedIf as CodeIRIf] };
          nestedIf = { kind: "if", cond: br.cond, then: br.then, else: elseForThis, loc: br.loc };
        }
        items.push(nestedIf as CodeIRIf);
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

export type FlowSplitDiagnostic = { level: "info" | "warn"; code: string; message: string; line?: number };
type BuildResult = { nodes: FlowNode[]; edges: FlowEdge[]; ir: IRBlock; warnings: string[]; debugMap: DebugMap; splitDiagnostics: FlowSplitDiagnostic[] };
export type FunctionFlowResult = { name: string; params: string[]; nodes: FlowNode[]; edges: FlowEdge[]; ir: IRBlock; debugMap: DebugMap; splitDiagnostics: FlowSplitDiagnostic[] };
export type BuildFlowsResult = { main: BuildResult; functions: FunctionFlowResult[] };
export type BuildUnifiedFlowResult = BuildResult;

const normalizeCondTitle = (cond: string) => {
  return cond.trim().replaceAll("≤", "<=").replaceAll("≥", ">=").replaceAll("≠", "!=");
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

const inferCollectionShape = (stmt: string): FlowNodeShape | null => {
  const t = stmt.trim();
  if (!t) return null;
  const low = t.toLowerCase();
  if (t.startsWith("return ") || t === "return") return null;
  if (t.startsWith("if ") || t.startsWith("while ") || t.startsWith("for ") || t.startsWith("def ")) return null;
  if (/=\s*\{[^}]*\}\s*$/.test(t)) return "dict_op";
  if (/=\s*\[[^\]]*\]\s*$/.test(t)) return "list_op";
  if (/=\s*dict\s*\(/.test(low)) return "dict_op";
  if (/=\s*list\s*\(/.test(low)) return "list_op";
  if (/\.\s*(append|extend|insert|remove|clear|sort|reverse|pop)\s*\(/.test(low)) return "list_op";
  if (/\.\s*(get|setdefault|update|keys|values|items|popitem)\s*\(/.test(low)) return "dict_op";
  if (/^[A-Za-z_][A-Za-z0-9_]*\s*\[\s*(['"]).*?\1\s*\]\s*=/.test(t)) return "dict_op";
  if (/^[A-Za-z_][A-Za-z0-9_]*\s*\[[^\]]+\]\s*=/.test(t)) return "list_op";
  if (/^[A-Za-z_][A-Za-z0-9_]*\s*\[\s*(['"]).*?\1\s*\]\s*$/.test(t)) return "dict_op";
  if (/\.\s*(split|strip|lstrip|rstrip|upper|lower|replace|join|find|rfind|startswith|endswith|format|count|index|title|capitalize|swapcase|center|ljust|rjust|zfill|encode|decode)\s*\(/.test(low)) return "str_op";
  return null;
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
    return { name: d.name, params: d.params, nodes: f.nodes, edges: f.edges, ir: f.ir, debugMap: f.debugMap, splitDiagnostics: f.splitDiagnostics };
  });
  return { main, functions };
}

export function buildUnifiedFlowFromPython(code: string): BuildUnifiedFlowResult | null {
  const built = buildFlowsFromPython(code);
  if (!built) return null;
  const nodes: FlowNode[] = [...built.main.nodes];
  const edges: FlowEdge[] = [...built.main.edges];
  const forRanges: DebugForRangeEntry[] = [...built.main.debugMap.forRanges];
  const forIns: DebugForInEntry[] = [...built.main.debugMap.forIns];
  const whiles: DebugWhileEntry[] = [...built.main.debugMap.whiles];
  const splitDiagnostics: FlowSplitDiagnostic[] = [...built.main.splitDiagnostics];

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
    const mappedForRanges = fn.debugMap.forRanges
      .map((x) => ({
        ...x,
        initNodeId: idMap.get(x.initNodeId) ?? x.initNodeId,
        checkNodeId: idMap.get(x.checkNodeId) ?? x.checkNodeId,
        incNodeId: idMap.get(x.incNodeId) ?? x.incNodeId,
      }))
      .filter((x) => x.initNodeId.startsWith(prefix) && x.checkNodeId.startsWith(prefix) && x.incNodeId.startsWith(prefix));
    const mappedForIns = fn.debugMap.forIns
      .map((x) => ({
        ...x,
        nextNodeId: idMap.get(x.nextNodeId) ?? x.nextNodeId,
        bindNodeId: idMap.get(x.bindNodeId) ?? x.bindNodeId,
      }))
      .filter((x) => x.nextNodeId.startsWith(prefix) && x.bindNodeId.startsWith(prefix));
    const mappedWhiles = fn.debugMap.whiles
      .map((x) => ({
        ...x,
        checkNodeId: idMap.get(x.checkNodeId) ?? x.checkNodeId,
      }))
      .filter((x) => x.checkNodeId.startsWith(prefix));
    return { mappedNodes, mappedEdges, mappedForRanges, mappedForIns, mappedWhiles };
  };

  built.functions.forEach((fn, i) => {
    const { mappedNodes, mappedEdges, mappedForRanges, mappedForIns, mappedWhiles } = remapGraph(fn, i);
    nodes.push(...mappedNodes);
    edges.push(...mappedEdges);
    forRanges.push(...mappedForRanges);
    forIns.push(...mappedForIns);
    whiles.push(...mappedWhiles);
    splitDiagnostics.push(...fn.splitDiagnostics);
  });

  const debugMap = buildDebugMapFromNodes(nodes, forRanges, forIns, whiles);
  return { nodes, edges, ir: built.main.ir, warnings: built.main.warnings, debugMap, splitDiagnostics };
}

function buildFlowFromCodeIR(block: CodeIRBlock, warnings: string[], titles: { startTitle: string; endTitle: string }): BuildResult {
  let idSeq = 0;
  const nextId = (prefix: string) => `${prefix}_${++idSeq}`;

  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const forRanges: DebugForRangeEntry[] = [];
  const forIns: DebugForInEntry[] = [];
  const whiles: DebugWhileEntry[] = [];
  const splitDiagnostics: FlowSplitDiagnostic[] = [];
  const splitDiagnosticSeen = new Set<string>();

  const codeBlockLineRange = (b: CodeIRBlock | null | undefined): { startLine: number; endLine: number } | null => {
    if (!b) return null;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    const walk = (x: CodeIRNode) => {
      min = Math.min(min, x.loc.line);
      max = Math.max(max, x.loc.line);
      if (x.kind === "if") {
        walkBlock(x.then);
        if (x.else) walkBlock(x.else);
      } else if (x.kind === "while") {
        walkBlock(x.body);
      } else if (x.kind === "for_range") {
        walkBlock(x.body);
      } else if (x.kind === "for_in") {
        walkBlock(x.body);
      } else if (x.kind === "def") {
        walkBlock(x.body);
      }
    };
    const walkBlock = (blk: CodeIRBlock) => {
      for (const it of blk.items) walk(it);
    };
    walkBlock(b);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    return { startLine: min, endLine: max };
  };

  const startNode: FlowNode = { type: "flow_element", id: nextId("start"), shape: "start_end", title: titles.startTitle, x: 0, y: 0 };
  nodes.push(startNode);

  const endNode: FlowNode = { type: "flow_element", id: nextId("end"), shape: "start_end", title: titles.endTitle, x: 0, y: 0 };
  const isFunctionFlow = titles.startTitle.trim().toLowerCase().startsWith("def ");
  const isReturnStmt = (text: string) => {
    const t = text.trim();
    return t === "return" || t.startsWith("return ");
  };
  const inferStmtRole = (text: string) => {
    const t = text.trim();
    if (isReturnStmt(t)) return "return_stmt";
    if (/^[A-Za-z_][A-Za-z0-9_]*\s*(\+=|-=|\*=|\/=|\/\/=|%=|\*\*=)\s*/.test(t)) return "aug_assign";
    if (inferCollectionShape(t)) return undefined;
    if (isSubroutineCall(t)) return "call_site";
    return undefined;
  };

  const emitEdge = (from: string, to: string, label?: string) => {
    edges.push({ id: nextId("e"), from, to, style: "straight", routeMode: "auto", anchor: null, label });
  };

  const emitStmtNode = (text: string, sourceLine?: number, sourceRole?: string) => {
    const collectionShape = inferCollectionShape(text);
    const t = text.trim();
    const isJump = t === "break" || t === "continue" || t === "return" || t.startsWith("return ");
    const shape: FlowNodeShape = isJump ? "jump" : isIO(text) ? "io" : collectionShape ?? (isSubroutineCall(text) ? "subroutine" : "process");
    const split = splitNodeTitleSemantically(text, shape);
    if (sourceLine && split.diagnostics.length) {
      for (const d of split.diagnostics) {
        const key = `${sourceLine}:${d.code}:${d.message}`;
        if (splitDiagnosticSeen.has(key)) continue;
        splitDiagnosticSeen.add(key);
        splitDiagnostics.push({ level: d.level, code: d.code, message: d.message, line: sourceLine });
      }
    }
    const n: FlowNode = { type: "flow_element", id: nextId("n"), shape, title: text, x: 0, y: 0, sourceLine, sourceRole };
    nodes.push(n);
    const irStmt: IRStmt = { kind: "stmt", text, nodeId: n.id };
    return { nodeId: n.id, ir: irStmt };
  };

  // Helper: Detect if a block is effectively just a single "if" statement (representing an "elif")
  // We use this to flatten nested else-if chains.
  const isElifBlock = (block: CodeIRBlock) => {
    return block.items.length === 1 && block.items[0].kind === "if";
  };

  const emitIf = (it: CodeIRIf, parentJoinId?: string, loopCtx?: LoopCtx): { entry: string; exit: string | null; irItems: IRNode[]; whileDecisionId: string | null } => {
    const d: FlowNode = { type: "flow_element", id: nextId("dec"), shape: "decision", title: normalizeCondTitle(it.cond), x: 0, y: 0, sourceLine: it.loc.line };
    nodes.push(d);

    // If we are part of an elif chain (parentJoinId provided), we reuse the parent's join node.
    // Otherwise, we create a new join node for this if-else structure.
    const joinId = parentJoinId || nextId("join");

    // Only create the join node if it's new (not passed from parent)
    if (!parentJoinId) {
      const join: FlowNode = { type: "flow_element", id: joinId, shape: "connector", title: "", x: 0, y: 0 };
      nodes.push(join);
    }

    const thenRes = emitBlock(it.then, loopCtx);

    // Check if the else block is an "elif" (single if statement)
    const isElif = it.else && isElifBlock(it.else);

    let elseRes: { entry: string; exit: string | null; irItems: IRNode[]; whileDecisionId: string | null } | null = null;
    let elseEntry: string | null = null;

    if (it.else) {
      if (isElif) {
        // RECURSIVE FLATTENING:
        // Instead of emitting the else block as a standard block, we directly emit the inner IF
        // passing OUR joinId down to it. This effectively merges the exit points.
        elseRes = emitIf(it.else.items[0] as CodeIRIf, joinId, loopCtx);
        elseEntry = elseRes.entry;
      } else {
        // Standard else block
        const blockRes = emitBlock(it.else, loopCtx);
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
    const d: FlowNode = { type: "flow_element", id: nextId("dec"), shape: "decision", title: normalizeCondTitle(it.cond), x: 0, y: 0, sourceLine: it.loc.line, sourceRole: "while_check" };
    nodes.push(d);
    const bodyRes = emitBlock(it.body, { conditionNodeId: d.id });
    const bodyLineRange = codeBlockLineRange(it.body) ?? undefined;
    whiles.push({ headerLine: it.loc.line, checkNodeId: d.id, bodyLineRange });
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
        fromPort: "left",
        toPort: "left",
      });
    }
    // break 节点：连线到循环出口（即 decision 的"否"方向，由外层处理）
    // 这里将 break 节点的出边暂存，等外层 emitBlock 连接到循环后的下一个节点
    // 实际上 break 应该跳出循环，所以我们把 break 节点作为额外出口
    const breakExits = bodyRes.pendingBreaks;
    const irWhile: IRWhile = { kind: "while", cond: it.cond, body: bodyRes.ir, decisionId: d.id, backEdgeId };
    return { entry: d.id, exit: d.id, irItems: [irWhile as IRNode], whileDecisionId: d.id, breakExits };
  };

  const emitForIn = (it: CodeIRForIn) => {
    const cond = `${it.iterable} 未遍历完`;
    const d: FlowNode = { type: "flow_element", id: nextId("dec"), shape: "decision", title: normalizeCondTitle(cond), x: 0, y: 0, sourceLine: it.loc.line, sourceRole: "for_in_next" };
    nodes.push(d);
    const bindText = `${it.vars.join(", ")} = 当前元素`;
    const bind = emitStmtNode(bindText, it.loc.line, "for_in_bind");
    const bodyRes = emitBlock(it.body, { conditionNodeId: d.id });
    const bodyLineRange = codeBlockLineRange(it.body) ?? undefined;
    forIns.push({ headerLine: it.loc.line, vars: it.vars, nextNodeId: d.id, bindNodeId: bind.nodeId, bodyLineRange });

    emitEdge(d.id, bind.nodeId, "是");
    emitEdge(bind.nodeId, bodyRes.entry);
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
        fromPort: "left",
        toPort: "left",
      });
    }

    const breakExits = bodyRes.pendingBreaks;
    const loopBody: IRBlock = { kind: "block", items: [bind.ir, ...bodyRes.ir.items] };
    const irWhile: IRWhile = { kind: "while", cond, body: loopBody, decisionId: d.id, backEdgeId };
    return { entry: d.id, exit: d.id, irItems: [irWhile as IRNode], whileDecisionId: d.id, breakExits };
  };

  const emitForRange = (it: CodeIRForRange) => {
    const stepText = it.step ? it.step.trim() : "1";
    const stepNum = Number(stepText);
    const isNegStep = Number.isFinite(stepNum) && stepNum < 0;

    // 教科书风格：初始化 → 条件判断 → 循环体 → 递增 → 回到条件
    const initNode = emitStmtNode(`${it.v} = ${it.start}`, it.loc.line, "for_init");

    const stepAnnotation = (stepText === "1" || stepText === "-1") ? "" : `, 步长=${stepText}`;
    const condText = isNegStep
      ? `${it.v} ∈ (${it.end}, ${it.start}]${stepAnnotation}`
      : `${it.v} ∈ [${it.start}, ${it.end})${stepAnnotation}`;
    const d: FlowNode = {
      type: "flow_element",
      id: nextId("dec"),
      shape: "decision",
      title: condText,
      x: 0,
      y: 0,
      sourceLine: it.loc.line,
      sourceRole: "for_check",
    };
    nodes.push(d);

    const bodyRes = emitBlock(it.body, { conditionNodeId: d.id });

    const incText = stepText === "1" ? `${it.v} += 1`
      : stepText === "-1" ? `${it.v} -= 1`
      : isNegStep ? `${it.v} -= ${Math.abs(stepNum)}`
      : `${it.v} += ${stepText}`;
    const incNode = emitStmtNode(incText, it.loc.line, "for_inc");

    const bodyLineRange = codeBlockLineRange(it.body) ?? undefined;
    forRanges.push({ headerLine: it.loc.line, var: it.v, initNodeId: initNode.nodeId, checkNodeId: d.id, incNodeId: incNode.nodeId, bodyLineRange });

    emitEdge(initNode.nodeId, d.id);
    emitEdge(d.id, bodyRes.entry, "是");
    if (bodyRes.exit) {
      emitEdge(bodyRes.exit, incNode.nodeId);
    }
    const backEdgeId = nextId("e");
    edges.push({
      id: backEdgeId,
      from: incNode.nodeId,
      to: d.id,
      style: "straight",
      routeMode: "auto",
      anchor: null,
      fromPort: "left",
      toPort: "left",
    });
    const breakExits = bodyRes.pendingBreaks;
    const loopBody: IRBlock = { kind: "block", items: [...bodyRes.ir.items, incNode.ir] };
    const irWhile: IRWhile = { kind: "while", cond: condText, body: loopBody, decisionId: d.id, backEdgeId };
    return { entry: initNode.nodeId, exit: d.id, irItems: [initNode.ir as IRNode, irWhile as IRNode], whileDecisionId: d.id, breakExits };
  };

  type LoopCtx = { conditionNodeId: string };

  const emitNode = (it: CodeIRNode, loopCtx?: LoopCtx): { entry: string; exit: string | null; irItems: IRNode[]; whileDecisionId: string | null; pendingBreaks: string[] } => {
    if (it.kind === "stmt") {
      const text = it.text.trim();
      const s = emitStmtNode(it.text, it.loc.line, inferStmtRole(it.text));

      // break: 终止节点，收集到 pendingBreaks 由外层循环处理
      if (text === "break" && loopCtx) {
        return { entry: s.nodeId, exit: null, irItems: [s.ir as IRNode], whileDecisionId: null, pendingBreaks: [s.nodeId] };
      }
      // continue: 终止节点，直接连线到循环条件
      if (text === "continue" && loopCtx) {
        emitEdge(s.nodeId, loopCtx.conditionNodeId);
        return { entry: s.nodeId, exit: null, irItems: [s.ir as IRNode], whileDecisionId: null, pendingBreaks: [] };
      }

      const terminal = isFunctionFlow && isReturnStmt(it.text);
      return { entry: s.nodeId, exit: terminal ? null : s.nodeId, irItems: [s.ir as IRNode], whileDecisionId: null, pendingBreaks: [] };
    }
    if (it.kind === "if") return { ...emitIf(it, undefined, loopCtx), pendingBreaks: [] };
    if (it.kind === "while") {
      const r = emitWhile(it);
      return { entry: r.entry, exit: r.exit, irItems: r.irItems, whileDecisionId: r.whileDecisionId, pendingBreaks: r.breakExits ?? [] };
    }
    if (it.kind === "for_range") {
      const r = emitForRange(it);
      return { entry: r.entry, exit: r.exit, irItems: r.irItems, whileDecisionId: r.whileDecisionId, pendingBreaks: r.breakExits ?? [] };
    }
    if (it.kind === "for_in") {
      const r = emitForIn(it);
      return { entry: r.entry, exit: r.exit, irItems: r.irItems, whileDecisionId: r.whileDecisionId, pendingBreaks: r.breakExits ?? [] };
    }
    return { entry: null as unknown as string, exit: null as unknown as string | null, irItems: [], whileDecisionId: null, pendingBreaks: [] };
  };

  const emitBlock = (b: CodeIRBlock, loopCtx?: LoopCtx): { entry: string; exit: string | null; ir: IRBlock; pendingBreaks: string[] } => {
    const items: IRNode[] = [];
    let entry: string | null = null;
    let prevExit: string | null = null;
    let pendingWhileDecisionId: string | null = null;
    const pendingBreaks: string[] = [];
    // break exits from loop nodes that need wiring to the next statement
    let deferredBreakExits: string[] = [];

    for (const it of b.items) {
      const res = emitNode(it, loopCtx);
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

      // Wire deferred break exits from previous loop to this node's entry
      for (const bk of deferredBreakExits) {
        emitEdge(bk, res.entry);
      }
      deferredBreakExits = [];

      // If this node is a loop (has whileDecisionId), its pendingBreaks are break exits
      // that should be wired to the next statement after the loop
      if (res.whileDecisionId && res.pendingBreaks.length > 0) {
        deferredBreakExits = res.pendingBreaks;
      } else {
        // Non-loop break/continue: propagate up to the enclosing loop's emitBlock
        pendingBreaks.push(...res.pendingBreaks);
      }

      prevExit = res.exit;
      if (res.whileDecisionId) {
        pendingWhileDecisionId = res.whileDecisionId;
        prevExit = res.whileDecisionId;
      } else {
        pendingWhileDecisionId = null;
      }
    }

    // If there are still deferred break exits at the end of the block,
    // they become additional exit points — merge with normal exit via connector
    if (deferredBreakExits.length > 0) {
      if (prevExit === null) {
        // No normal exit; use first break as exit
        prevExit = deferredBreakExits[0];
        deferredBreakExits = deferredBreakExits.slice(1);
      }
      if (deferredBreakExits.length > 0 && prevExit) {
        const merge: FlowNode = { type: "flow_element", id: nextId("join"), shape: "connector", title: "", x: 0, y: 0 };
        nodes.push(merge);
        emitEdge(prevExit, merge.id);
        for (const bk of deferredBreakExits) {
          emitEdge(bk, merge.id);
        }
        prevExit = merge.id;
      }
    }

    if (!entry) {
      const p = emitStmtNode("pass");
      entry = p.nodeId;
      prevExit = p.nodeId;
      items.push(p.ir);
    }

    return { entry, exit: prevExit!, ir: { kind: "block", items }, pendingBreaks };
  };

  const body = emitBlock(block);
  emitEdge(startNode.id, body.entry);
  const last = block.items.length ? block.items[block.items.length - 1] : null;
  const hasNormalExit = body.exit !== null;
  if (hasNormalExit) {
    emitEdge(body.exit!, endNode.id, last && (last.kind === "while" || last.kind === "for_range" || last.kind === "for_in") ? "否" : undefined);
  }

  // 收集所有 return 节点（没有出边的 return_stmt），连接到结束节点
  const outDegree = new Set(edges.map(e => e.from));
  const returnNodes = nodes.filter(n => n.sourceRole === "return_stmt" && !outDegree.has(n.id));
  if (hasNormalExit || returnNodes.length > 0) {
    nodes.push(endNode);
    for (const rn of returnNodes) {
      emitEdge(rn.id, endNode.id);
    }
  }

  const ir: IRBlock = {
    kind: "block",
    items: body.ir.items,
  };

  const debugMap = buildDebugMapFromNodes(nodes, forRanges, forIns, whiles);
  return { nodes, edges, ir, warnings, debugMap, splitDiagnostics };
}
