import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss, { type Rule } from "postcss";
import tailwindcss from "tailwindcss";
import { describe, expect, it } from "vitest";
import { cssColorFallbacks, parseColor } from "./cssTokens";

// Vitest intentionally disables CSS transforms; read the candidate's own file.
const stylesheet = readFileSync(resolve(process.cwd(), "src/styles/index.css"), "utf8");
const root = postcss.parse(stylesheet).nodes.find(
  (node): node is Rule => node.type === "rule" && node.selector.trim() === ":root",
);
const declarations = new Map<string, string>();
root?.walkDecls((declaration) => {
  declarations.set(declaration.prop, declaration.value.trim());
});

function resolveDeclaration(name: string, seen = new Set<string>()): string {
  if (seen.has(name)) throw new Error(`Cyclic CSS token: ${name}`);
  const value = declarations.get(name);
  if (!value) throw new Error(`Undefined CSS token: ${name}`);
  const alias = value.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  return alias ? resolveDeclaration(alias[1], new Set([...seen, name])) : value;
}

describe("CSS renderer fallback and Tailwind color contract", () => {
  it("keeps every registered renderer fallback equal to the actual root declaration", () => {
    expect(root).toBeDefined();
    expect(Object.keys(cssColorFallbacks).length).toBeGreaterThan(100);
    for (const [name, fallback] of Object.entries(cssColorFallbacks)) {
      const actual = parseColor(resolveDeclaration(name));
      expect(actual, name).not.toBeNull();
      expect(parseColor(fallback), name).toEqual(actual);
    }
  });

  it("keeps concrete RGB projections equal to their color source", () => {
    for (const [name] of declarations) {
      if (!name.endsWith("-rgb")) continue;
      const colorName = name.slice(0, -4);
      expect(declarations.has(colorName), `Orphan RGB projection: ${name}`).toBe(true);
      const color = parseColor(resolveDeclaration(colorName));
      expect(color, colorName).not.toBeNull();
      const channels = resolveDeclaration(name).split(/\s+/).map(Number);
      expect(channels, name).toEqual([color?.red, color?.green, color?.blue]);
    }
  });

  it("defines every CSS variable referenced by the Tailwind color mappings", () => {
    const require = createRequire(resolve(process.cwd(), "package.json"));
    const config = require("./tailwind.config.js");
    const mappings = JSON.stringify(config.theme.extend.colors);
    const references = [...mappings.matchAll(/var\(\s*(--[\w-]+)/g)];
    expect(references.length).toBeGreaterThan(50);
    for (const [, name] of references) {
      expect(() => resolveDeclaration(name), name).not.toThrow();
    }
  });

  it("actually emits dense metadata fonts and supported alpha classes, but not an unsupported border alpha", async () => {
    const require = createRequire(resolve(process.cwd(), "package.json"));
    const config = require("./tailwind.config.js");
    const compiled = await postcss([tailwindcss({
      ...config,
      content: [{ raw: '<span class="text-2xs text-3xs bg-primary/50 border-border/50"></span>', extension: "html" }],
    })]).process("@tailwind utilities;", { from: undefined });
    const rules = new Map<string, Map<string, string>>();
    compiled.root.walkRules((rule) => {
      const values = new Map<string, string>();
      rule.walkDecls((declaration) => { values.set(declaration.prop, declaration.value); });
      rules.set(rule.selector, values);
    });
    expect(rules.get(".text-2xs")?.get("font-size")).toBe("var(--ws-text-2xs)");
    expect(rules.get(".text-3xs")?.get("font-size")).toBe("var(--ws-text-3xs)");
    expect(rules.get(".bg-primary\\/50")?.get("background-color")).toBe(
      config.theme.extend.colors.primary.DEFAULT.replace("<alpha-value>", "0.5"),
    );
    expect(rules.has(".border-border\\/50")).toBe(false);
  });
});
