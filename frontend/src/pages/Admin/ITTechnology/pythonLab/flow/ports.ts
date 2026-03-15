import type { FlowNodeShape } from "../types";
import type { PortSide } from "./model";

export const nodeScale = 0.5;

export type TitleSplitDiagnostic = {
  level: "info" | "warn";
  code: "I_SPLIT_COMPOUND" | "W_SPLIT_UNBALANCED" | "W_SPLIT_EMPTY_SEGMENT" | "W_SPLIT_TRUNCATED";
  message: string;
};

export function shapeColor(shape: FlowNodeShape) {
  if (shape === "start_end") return "#2563eb"; // Blue 600
  if (shape === "process") return "#0891b2"; // Cyan 600
  if (shape === "subroutine") return "#10b981"; // Emerald 500
  if (shape === "list_op" || shape === "collection") return "#0ea5a4"; // Teal 500
  if (shape === "dict_op") return "#14b8a6"; // Teal 400
  if (shape === "note") return "#d4b106";
  if (shape === "decision") return "#7c3aed"; // Violet 600
  if (shape === "io") return "#f59e0b"; // Amber 500
  return "#3b82f6"; // Blue 500
}

export function nodeSize(shape: FlowNodeShape) {
  if (shape === "decision") return { w: Math.round(220 * nodeScale), h: Math.round(140 * nodeScale) };
  if (shape === "connector") return { w: Math.round(110 * nodeScale), h: Math.round(110 * nodeScale) };
  if (shape === "subroutine") return { w: Math.round(260 * nodeScale), h: Math.round(90 * nodeScale) };
  if (shape === "list_op" || shape === "dict_op" || shape === "collection") return { w: Math.round(260 * nodeScale), h: Math.round(90 * nodeScale) };
  if (shape === "note") return { w: Math.round(320 * nodeScale), h: Math.round(120 * nodeScale) };
  return { w: Math.round(240 * nodeScale), h: Math.round(90 * nodeScale) };
}

const maxCharsByShape = (shape: FlowNodeShape) => {
  const baseMax = shape === "decision" ? 18 : shape === "subroutine" || shape === "list_op" || shape === "dict_op" || shape === "collection" ? 24 : shape === "note" ? 28 : 26;
  return Math.max(12, Math.min(40, baseMax));
};

const splitTopLevelSemicolon = (raw: string) => {
  const segments: string[] = [];
  let buf = "";
  let round = 0;
  let square = 0;
  let curly = 0;
  let quote: "'" | '"' | null = null;
  let escaped = false;
  let sawEmpty = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (quote) {
      buf += ch;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === "(") round += 1;
    else if (ch === ")") round = Math.max(0, round - 1);
    else if (ch === "[") square += 1;
    else if (ch === "]") square = Math.max(0, square - 1);
    else if (ch === "{") curly += 1;
    else if (ch === "}") curly = Math.max(0, curly - 1);
    if (ch === ";" && round === 0 && square === 0 && curly === 0) {
      const seg = buf.trim();
      if (seg) segments.push(seg);
      else sawEmpty = true;
      buf = "";
      continue;
    }
    buf += ch;
  }
  const tail = buf.trim();
  if (tail) segments.push(tail);
  else if (raw.trim()) sawEmpty = true;
  const balanced = round === 0 && square === 0 && curly === 0 && !quote;
  return { segments: segments.length ? segments : [raw.trim()], balanced, sawEmpty };
};

const tokenizeForWrap = (s: string) => {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === " ") {
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const q = ch;
      let buf = ch;
      i += 1;
      let escaped = false;
      while (i < s.length) {
        const c = s[i];
        buf += c;
        if (escaped) {
          escaped = false;
          i += 1;
          continue;
        }
        if (c === "\\") {
          escaped = true;
          i += 1;
          continue;
        }
        if (c === q) {
          i += 1;
          break;
        }
        i += 1;
      }
      out.push(buf);
      continue;
    }
    if (/[A-Za-z0-9_]/.test(ch)) {
      let j = i + 1;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j += 1;
      out.push(s.slice(i, j));
      i = j;
      continue;
    }
    if ("()[]{}.,:+-*/%=<>!?".includes(ch)) {
      out.push(ch);
      i += 1;
      continue;
    }
    out.push(ch);
    i += 1;
  }
  return out.filter((x) => x.length > 0);
};

const joinTokens = (tokens: string[]) => {
  let out = "";
  for (const tk of tokens) {
    const noSpaceBefore = /^[)\]}",.:;!?([{]$/.test(tk);
    const noSpaceAfterPrev = /^[([{"]$/.test(out.slice(-1));
    const operator = /^(\+|-|\*|\/|%|=|<|>|!|\?)$/.test(tk) || /^(\+|-|\*|\/|%|=|<|>|!|\?)$/.test(out.slice(-1));
    if (!out) out = tk;
    else if (noSpaceBefore || noSpaceAfterPrev) out += tk;
    else if (operator) out += ` ${tk}`;
    else out += ` ${tk}`;
  }
  return out.trim();
};

export function splitNodeTitleSemantically(
  title: string,
  shape: FlowNodeShape
): { lines: string[]; statements: string[]; diagnostics: TitleSplitDiagnostic[] } {
  const raw = (title || "").trim();
  if (!raw) return { lines: [""], statements: [], diagnostics: [] };
  const max = maxCharsByShape(shape);
  const split = splitTopLevelSemicolon(raw);
  const diagnostics: TitleSplitDiagnostic[] = [];
  if (split.segments.length > 1) diagnostics.push({ level: "info", code: "I_SPLIT_COMPOUND", message: `检测到复合语句，按 ${split.segments.length} 个语义段处理` });
  if (!split.balanced) diagnostics.push({ level: "warn", code: "W_SPLIT_UNBALANCED", message: "检测到括号或引号未闭合，已按保守策略分块" });
  if (split.sawEmpty) diagnostics.push({ level: "warn", code: "W_SPLIT_EMPTY_SEGMENT", message: "检测到空语义段，已忽略空段" });

  const lines: string[] = [];
  for (const stmt of split.segments) {
    const tokens = tokenizeForWrap(stmt);
    if (!tokens.length) continue;
    let lineTokens: string[] = [];
    const flush = () => {
      if (!lineTokens.length) return;
      lines.push(joinTokens(lineTokens));
      lineTokens = [];
    };
    for (const tk of tokens) {
      const token = joinTokens([tk]);
      if (lineTokens.length) {
        const next = joinTokens([...lineTokens, token]);
        if (next.length <= max) {
          lineTokens.push(token);
          continue;
        }
        flush();
      }
      if (token.length <= max) {
        lineTokens.push(token);
        continue;
      }
      let rest = token;
      while (rest.length > max) {
        lines.push(rest.slice(0, max));
        rest = rest.slice(max);
      }
      if (rest.length) lineTokens.push(rest);
    }
    flush();
  }

  if (!lines.length) lines.push(raw.slice(0, max));
  return { lines, statements: split.segments, diagnostics };
}

export function splitNodeTitleForMapping(title: string): string[] {
  return splitNodeTitleSemantically(title, "process").statements;
}

export function wrapNodeTitle(title: string, shape: FlowNodeShape): string[] {
  return splitNodeTitleSemantically(title, shape).lines;
}

export function nodeSizeForTitle(shape: FlowNodeShape, title: string) {
  const base = nodeSize(shape);
  const lines = wrapNodeTitle(title, shape);
  const maxChars = lines.reduce((m, x) => Math.max(m, x.length), 0);
  const charW = shape === "decision" ? 7 : 7.2;
  const padW = shape === "decision" ? 70 : 56;
  const desiredW = Math.round((maxChars * charW + padW) * nodeScale);
  const minW = base.w;
  const maxW = Math.round(460 * nodeScale);
  const w = Math.max(minW, Math.min(maxW, desiredW));
  const lineH = 16 * nodeScale;
  const desiredH = Math.round((Math.max(1, lines.length) * lineH + 44 * nodeScale) * 1);
  const minH = base.h;
  const h = Math.max(minH, desiredH);
  return { w, h };
}

export function chooseSide(dx: number, dy: number): PortSide {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

export function fixedPortForStartEnd(title: string): PortSide {
  const t = title.trim().toLowerCase();
  if (t.includes("结束") || t.includes("end")) return "top";
  return "bottom";
}

export function allowedPortsForShape(shape: FlowNodeShape, title: string): PortSide[] {
  if (shape === "start_end") return [fixedPortForStartEnd(title)];
  if (shape === "note") return ["top", "right", "bottom", "left"];
  return ["top", "right", "bottom", "left"];
}

export function nodePortLocal(shape: FlowNodeShape, w: number, h: number, side: PortSide) {
  const hw = w / 2;
  const hh = h / 2;
  if (shape === "note") {
    const noteCenterY = h * 0.42;
    const noteRadiusY = h * 0.32;
    const yOnBubble = noteCenterY - hh;
    if (side === "top") return { x: 0, y: yOnBubble - noteRadiusY };
    if (side === "bottom") return { x: 0, y: yOnBubble + noteRadiusY };
    if (side === "left") return { x: -hw * 0.94, y: yOnBubble };
    return { x: hw * 0.94, y: yOnBubble };
  }
  if (shape === "io") {
    const slant = Math.min(14, Math.max(10, w * 0.12));
    if (side === "top") return { x: 0, y: -hh };
    if (side === "bottom") return { x: 0, y: hh };
    if (side === "left") return { x: -hw + slant / 2, y: 0 };
    return { x: hw - slant / 2, y: 0 };
  }
  if (side === "top") return { x: 0, y: -hh };
  if (side === "bottom") return { x: 0, y: hh };
  if (side === "left") return { x: -hw, y: 0 };
  return { x: hw, y: 0 };
}

export function shapePolygonForAttach(shape: FlowNodeShape, w: number, h: number) {
  const hw = w / 2;
  const hh = h / 2;
  if (shape === "decision") {
    return [
      { x: 0, y: -hh },
      { x: hw, y: 0 },
      { x: 0, y: hh },
      { x: -hw, y: 0 },
    ];
  }
  if (shape === "io") {
    const slant = Math.min(14, Math.max(10, w * 0.12));
    return [
      { x: -hw + slant, y: -hh },
      { x: hw, y: -hh },
      { x: hw - slant, y: hh },
      { x: -hw, y: hh },
    ];
  }
  return [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
}
