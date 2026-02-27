const trimEmptyEdges = (arr: string[]) => {
  let start = 0;
  let end = arr.length;
  while (start < end && arr[start].trim() === "") start += 1;
  while (end > start && arr[end - 1].trim() === "") end -= 1;
  return arr.slice(start, end);
};

const isBracketOpen = (t: string) => t === "[" || t === "\\[";
const isBracketClose = (t: string) => t === "]" || t === "\\]";

const isMathFenceLang = (lang: string) => {
  const l = lang.trim().toLowerCase();
  return l === "latex" || l === "math";
};

const looksLikeLatexMath = (bodyLines: string[]) => {
  const body = trimEmptyEdges(bodyLines).join("\n");
  const s = body.trim();
  if (!s) return false;

  if (/\\[A-Za-z]+/.test(s)) return true;
  if (/\\(begin|end)\s*\{/.test(s)) return true;
  if (/\\(frac|sqrt|sum|prod|int|lim|left|right|cdot|times|le|ge|neq|approx|sim)\b/.test(s)) return true;

  const hasSupSub = /(^|[^\\])(\^|_)\s*(\{[^}]+\}|[A-Za-z0-9]+)/.test(s);
  const hasOperator = /[=<>]|[+\-*/]/.test(s);
  const hasIdentifierOrNumber = /[A-Za-z0-9]/.test(s);
  if (hasSupSub && hasOperator && hasIdentifierOrNumber) return true;

  const opCount = (s.match(/[=<>]/g) || []).length;
  if (opCount >= 1 && /[A-Za-z]/.test(s) && /[0-9]/.test(s)) return true;

  return false;
};

const looksLikeLatexInlineMath = (s: string) => {
  const t = (s || "").trim();
  if (!t) return false;
  if (t.length > 200) return false;
  if (/\\[A-Za-z]+/.test(t)) return true;
  if (/\\(frac|sqrt|sum|prod|int|lim|left|right|cdot|times|le|ge|neq|approx|sim|lceil|rceil)\b/.test(t)) return true;
  const hasSupSub = /(^|[^\\])(\^|_)\s*(\{[^}]+\}|[A-Za-z0-9]+)/.test(t);
  const hasOperator = /[=<>]|[+\-*/]/.test(t);
  const hasIdentifierOrNumber = /[A-Za-z0-9]/.test(t);
  if (hasSupSub && hasOperator && hasIdentifierOrNumber) return true;
  return false;
};

export const normalizeMarkdown = (text: string) => {
  const s = (text || "").replace(/\r\n/g, "\n");
  const lines = s.split("\n");

  const out: string[] = [];
  const ensureBlankLine = () => {
    if (out.length === 0) return;
    if (out[out.length - 1].trim() === "") return;
    out.push("");
  };
  const emitMathBlock = (bodyLines: string[]) => {
    ensureBlankLine();
    out.push("$$");
    out.push(...trimEmptyEdges(bodyLines));
    out.push("$$");
    out.push("");
  };

  let inFence = false;
  let fenceChar: "`" | "~" | null = null;
  let fenceLen = 0;
  let fenceIsMath = false;
  let fenceOpenLine = "";
  let fenceBuf: string[] = [];

  let inBracketMath = false;
  let bracketOpenLine = "";
  let bracketOpenTrimmed = "";
  let bracketBuf: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!inFence && !inBracketMath) {
      const openFence = line.match(/^\s*([`~]{3,})\s*([A-Za-z0-9_-]+)?\s*$/);
      if (openFence) {
        const marker = openFence[1];
        const lang = openFence[2] || "";
        inFence = true;
        fenceChar = marker[0] as "`" | "~";
        fenceLen = marker.length;
        fenceIsMath = isMathFenceLang(lang);
        fenceOpenLine = line;
        fenceBuf = [];
        if (!fenceIsMath) out.push(line);
        continue;
      }

      if (isBracketOpen(trimmed)) {
        inBracketMath = true;
        bracketOpenLine = line;
        bracketOpenTrimmed = trimmed;
        bracketBuf = [];
        continue;
      }

      out.push(line);
      continue;
    }

    if (inFence) {
      const closeFence = line.match(/^\s*([`~]{3,})\s*$/);
      if (closeFence) {
        const marker = closeFence[1];
        const ch = marker[0] as "`" | "~";
        if (fenceChar && ch === fenceChar && marker.length >= fenceLen) {
          if (fenceIsMath) emitMathBlock(fenceBuf);
          else out.push(line);
          inFence = false;
          fenceChar = null;
          fenceLen = 0;
          fenceIsMath = false;
          fenceOpenLine = "";
          fenceBuf = [];
          continue;
        }
      }

      if (fenceIsMath) fenceBuf.push(line);
      else out.push(line);
      continue;
    }

    if (inBracketMath) {
      if (isBracketClose(trimmed)) {
        const shouldConvert = bracketOpenTrimmed === "\\[" || trimmed === "\\]" || looksLikeLatexMath(bracketBuf);
        if (shouldConvert) emitMathBlock(bracketBuf);
        else {
          out.push(bracketOpenLine);
          out.push(...bracketBuf);
          out.push(line);
        }

        inBracketMath = false;
        bracketOpenLine = "";
        bracketOpenTrimmed = "";
        bracketBuf = [];
        continue;
      }
      bracketBuf.push(line);
      continue;
    }
  }

  if (inFence && fenceIsMath) {
    out.push(fenceOpenLine);
    out.push(...fenceBuf);
  }

  if (inBracketMath) {
    out.push(bracketOpenLine);
    out.push(...bracketBuf);
  }

  let normalized = out.join("\n");

  const withInlineDelims = normalized
    .split("\n")
    .map((line) => {
      if (line.includes("`")) return line;
      return line.replace(/\\\(([\s\S]*?)\\\)/g, (_m, body) => {
        const b = String(body ?? "").trim();
        if (!looksLikeLatexInlineMath(b)) return `\\(${body}\\)`;
        return `$${b}$`;
      });
    })
    .join("\n");

  normalized = withInlineDelims
    .split("\n")
    .map((line) => {
      if (line.includes("`")) return line;
      return line.replace(/\(([^()\n]{1,200})\)/g, (m, body) => {
        const b = String(body ?? "");
        if (!b.includes("\\")) return m;
        if (!looksLikeLatexInlineMath(b)) return m;
        const inner = b.trim();
        return `$\\left(${inner}\\right)$`;
      });
    })
    .join("\n");

  return normalized.trimEnd();
};
