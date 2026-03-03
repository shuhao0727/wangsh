import { parsePythonToIR } from "./python_sync";

export type DebugFocusRole = "for_init" | "for_check" | "for_inc";

export type DebugEmphasis = {
  line: number;
  role: DebugFocusRole | null;
  thenRole?: DebugFocusRole | null;
};

type ForRangeMeta = { line: number; v: string; body?: { startLine: number; endLine: number } };

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isBlock(v: unknown): v is { kind: "block"; items: unknown[] } {
  return isRecord(v) && v.kind === "block" && Array.isArray((v as any).items);
}

export function buildForRangeIndex(code: string): Map<number, ForRangeMeta[]> {
  const res = parsePythonToIR(code);
  const out = new Map<number, ForRangeMeta[]>();
  if (!res.ok) return out;

  const push = (meta: ForRangeMeta) => {
    const arr = out.get(meta.line) ?? [];
    arr.push(meta);
    out.set(meta.line, arr);
  };

  const walk = (b: unknown) => {
    if (!isBlock(b)) return;
    for (const it of b.items) {
      if (!isRecord(it)) continue;
      const kind = (it as any).kind;
      if (kind === "for_range") {
        const loc = (it as any).loc;
        const line = isRecord(loc) && typeof loc.line === "number" ? loc.line : null;
        const v = typeof (it as any).v === "string" ? (it as any).v : "";
        const body = (it as any).body;
        const bodyRange = (() => {
          const r = blockLineRange(body);
          if (!r) return undefined;
          return { startLine: r.startLine, endLine: r.endLine };
        })();
        if (line && v) push({ line, v, body: bodyRange });
        walk((it as any).body);
        continue;
      }
      if (kind === "while") {
        walk((it as any).body);
        continue;
      }
      if (kind === "if") {
        walk((it as any).then);
        walk((it as any).else);
        continue;
      }
      if (kind === "def") {
        walk((it as any).body);
        continue;
      }
    }
  };

  walk((res as any).ir);
  return out;
}

function blockLineRange(b: unknown): { startLine: number; endLine: number } | null {
  if (!isBlock(b)) return null;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  const walk = (x: unknown) => {
    if (!isRecord(x)) return;
    const loc = (x as any).loc;
    const ln = isRecord(loc) && typeof loc.line === "number" ? loc.line : null;
    if (ln) {
      min = Math.min(min, ln);
      max = Math.max(max, ln);
    }
    const kind = (x as any).kind;
    if (kind === "if") {
      walkBlock((x as any).then);
      walkBlock((x as any).else);
    }
    if (kind === "while") {
      walkBlock((x as any).body);
    }
    if (kind === "for_range") {
      walkBlock((x as any).body);
    }
    if (kind === "def") {
      walkBlock((x as any).body);
    }
  };
  const walkBlock = (blk: unknown) => {
    if (!isBlock(blk)) return;
    for (const it of blk.items) walk(it);
  };
  walkBlock(b);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { startLine: min, endLine: max };
}

export function inferDebugEmphasis(params: {
  forRangeIndex: Map<number, ForRangeMeta[]>;
  activeLine: number | null;
  prevActiveLine: number | null;
  prevVars: Map<string, { value: string; type: string }>;
  nextVars: Map<string, { value: string; type: string }>;
}): DebugEmphasis | null {
  const { forRangeIndex, activeLine, prevActiveLine, prevVars, nextVars } = params;
  if (!activeLine) return null;

  const inferAtLine = (line: number, allowBodyTransition: boolean, originalActiveLine: number) => {
    const metas = forRangeIndex.get(line) ?? [];
    if (!metas.length) return null;
    let considered = false;
    for (const meta of metas) {
      if (line !== originalActiveLine && meta.body) {
        if (originalActiveLine >= meta.body.startLine && originalActiveLine <= meta.body.endLine) {
          continue;
        }
      }
      considered = true;
      const prev = prevVars.get(meta.v) ?? null;
      const next = nextVars.get(meta.v) ?? null;
      if (prev && next && prev.value !== next.value) return { line, role: "for_inc" as const, thenRole: "for_check" as const };
      if (allowBodyTransition && meta.body && prevActiveLine) {
        if (prevActiveLine >= meta.body.startLine && prevActiveLine <= meta.body.endLine) {
          return { line, role: "for_inc" as const, thenRole: "for_check" as const };
        }
      }
    }
    if (!considered) return null;
    return { line, role: "for_check" as const };
  };

  const direct = inferAtLine(activeLine, true, activeLine);
  if (direct) return direct;

  const offsets = [1, -1, 2, -2];
  for (const d of offsets) {
    const near = inferAtLine(activeLine + d, true, activeLine);
    if (near) return near;
  }

  if (prevActiveLine && prevActiveLine !== activeLine) {
    const shifted = inferAtLine(prevActiveLine, false, prevActiveLine);
    if (shifted && shifted.role !== "for_check") return shifted;
  }

  return null;
}
