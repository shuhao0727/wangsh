const findMatchingBrace = (input: string, openIndex: number): number => {
  let depth = 0;
  for (let i = openIndex; i < input.length; i++) {
    const ch = input[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
};

const scopeSelectorList = (selectorText: string, scopeSelector: string): string => {
  const selectors = selectorText
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const scoped = selectors.map((sel) => {
    if (sel.startsWith(scopeSelector)) return sel;
    if (sel === ":root") return scopeSelector;
    if (sel.startsWith("@")) return sel;
    return `${scopeSelector} ${sel}`;
  });

  return scoped.join(", ");
};

export const toScopedCss = (css: string, scopeSelector: string): string => {
  const input = String(css || "").replace(/<\/style/gi, "<\\/style");
  let out = "";
  let i = 0;

  while (i < input.length) {
    const rest = input.slice(i);
    const nextNonSpace = rest.match(/^\s*/)?.[0]?.length ?? 0;
    i += nextNonSpace;
    if (i >= input.length) break;

    if (input[i] === "@") {
      const semi = input.indexOf(";", i);
      const brace = input.indexOf("{", i);

      if (semi !== -1 && (brace === -1 || semi < brace)) {
        out += input.slice(i, semi + 1);
        i = semi + 1;
        continue;
      }

      if (brace === -1) {
        out += input.slice(i);
        break;
      }

      const prelude = input.slice(i, brace + 1);
      const atName = prelude
        .slice(1)
        .trim()
        .split(/\s+/)[0]
        .toLowerCase();
      const close = findMatchingBrace(input, brace);
      if (close === -1) {
        out += input.slice(i);
        break;
      }

      const inner = input.slice(brace + 1, close);
      if (atName.includes("keyframes") || atName === "font-face") {
        out += prelude + inner + "}";
      } else {
        out += prelude + toScopedCss(inner, scopeSelector) + "}";
      }
      i = close + 1;
      continue;
    }

    const brace = input.indexOf("{", i);
    if (brace === -1) {
      out += input.slice(i);
      break;
    }

    const selectorText = input.slice(i, brace).trim();
    const close = findMatchingBrace(input, brace);
    if (close === -1) {
      out += input.slice(i);
      break;
    }

    const body = input.slice(brace + 1, close);
    out += scopeSelectorList(selectorText, scopeSelector) + "{" + body + "}";
    i = close + 1;
  }

  return out;
};

