/**
 * 契约测试：`src/lib/cssTokens.ts` 的镜像表必须与 `src/styles/index.css` 的 :root 一致。
 *
 * 这条测试是"值"这一半的门禁：
 *   token-check.mjs 只管 `var(--x)` 有没有定义，完全不管值；
 *   如果 index.css 的 --ws-color-primary 被偷改，而 cssTokens 镜像表没跟上，
 *   Canvas/ECharts 就会画出旧颜色，且没有任何报错。这里让它直接红。
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { COLOR_TOKEN_FALLBACKS, parseColor } from "./cssTokens";

const STYLESHEET_PATH = resolve(process.cwd(), "src/styles/index.css");
const COLOR_DECLARATION = /(--ws-(?:color|tag)-[a-z0-9-]+)\s*:\s*([^;]+);/g;
/** 允许出现 color-mix() 的 token（镜像表存等价色值，不做在线求值）。 */
const COLOR_MIX_TOKENS = new Set(["--ws-color-workspace-muted"]);

/** 取第一个顶层 :root 块（index.css 只有这一个 :root）。 */
function extractRootBlock(css: string): string {
  const start = css.indexOf(":root");
  if (start === -1) throw new Error("index.css 中找不到 :root 块");
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    else if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, index);
    }
  }
  throw new Error(":root 块未闭合");
}

/** 解析 :root 中的颜色声明；剥掉行尾注释，同名以首次为准。 */
function readRootColorDeclarations(): Map<string, string> {
  const block = extractRootBlock(readFileSync(STYLESHEET_PATH, "utf8"));
  const declarations = new Map<string, string>();
  for (const match of block.matchAll(COLOR_DECLARATION)) {
    const value = match[2].replace(/\/\*[\s\S]*?\*\//g, "").trim();
    if (!declarations.has(match[1])) declarations.set(match[1], value);
  }
  return declarations;
}

/** 展开整值 var() 别名，得到最终声明值。 */
function resolveAlias(declarations: Map<string, string>, name: string, seen = new Set<string>()): string {
  if (seen.has(name)) throw new Error(`循环引用: ${name}`);
  const value = declarations.get(name);
  if (!value) throw new Error(`未定义: ${name}`);
  const alias = value.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  return alias ? resolveAlias(declarations, alias[1], new Set([...seen, name])) : value;
}

/** color-mix(in srgb, A p%, B) 在 sRGB 下的等价通道值（仅支持两色、alpha=1）。 */
function mixInSrgb(base: string, ratioPercent: number, other: string): string {
  const a = parseColor(base);
  const b = parseColor(other);
  if (!a || !b) throw new Error(`无法解析 color-mix 操作数: ${base} / ${other}`);
  const ratio = ratioPercent / 100;
  const channel = (from: number, to: number) => Math.round(from * ratio + to * (1 - ratio));
  return `rgb(${channel(a.red, b.red)}, ${channel(a.green, b.green)}, ${channel(a.blue, b.blue)})`;
}

/** 把声明值换算成可比较的具体色值。 */
function toConcrete(declarations: Map<string, string>, name: string): string {
  const value = resolveAlias(declarations, name);
  const mix = value.match(/^color-mix\(\s*in srgb\s*,\s*var\((--[\w-]+)\)\s*([\d.]+)%\s*,\s*var\((--[\w-]+)\)\s*\)$/);
  if (mix) {
    return mixInSrgb(
      toConcrete(declarations, mix[1]),
      Number(mix[2]),
      toConcrete(declarations, mix[3]),
    );
  }
  return value;
}

describe("cssTokens 镜像表与 index.css 的契约", () => {
  const declarations = readRootColorDeclarations();

  it(":root 里定义了颜色 token（防止解析逻辑失效导致空跑）", () => {
    expect(declarations.size).toBeGreaterThan(40);
  });

  it("index.css 的每个颜色 token 都在镜像表里，且镜像表没有多余条目", () => {
    const declared = [...declarations.keys()].sort();
    const mirrored = Object.keys(COLOR_TOKEN_FALLBACKS).sort();
    expect(mirrored).toEqual(declared);
  });

  it("镜像表的每个值都是非 CSS 渲染器能直接消费的具体色", () => {
    for (const [name, value] of Object.entries(COLOR_TOKEN_FALLBACKS)) {
      expect(value, name).not.toMatch(/\b(?:var|color-mix)\s*\(/i);
      expect(parseColor(value), name).not.toBeNull();
    }
  });

  it("镜像值与 index.css 的实际声明同色（值被偷改即失败）", () => {
    const mismatched: string[] = [];
    for (const [name, mirrored] of Object.entries(COLOR_TOKEN_FALLBACKS)) {
      // color-mix() 的等价色逐通道比较会受舍入影响，单独由下一条用例覆盖。
      if (COLOR_MIX_TOKENS.has(name)) continue;
      const actual = parseColor(toConcrete(declarations, name));
      const expected = parseColor(mirrored);
      if (!actual || !expected) {
        mismatched.push(`${name}: 无法解析（实际 ${actual ? "ok" : "null"} / 镜像 ${expected ? "ok" : "null"}）`);
      } else if (
        actual.red !== expected.red ||
        actual.green !== expected.green ||
        actual.blue !== expected.blue ||
        Math.abs(actual.alpha - expected.alpha) > 0.002
      ) {
        mismatched.push(
          `${name}: index.css=${JSON.stringify(actual)} 镜像=${JSON.stringify(expected)}`,
        );
      }
    }
    expect(mismatched, mismatched.join("\n")).toEqual([]);
  });

  it("color-mix() token 的镜像值与 sRGB 混色结果一致，且只允许白名单内的 token 使用混色", () => {
    for (const name of [...declarations.keys()]) {
      if (!/color-mix\s*\(/i.test(resolveAlias(declarations, name))) continue;
      expect(COLOR_MIX_TOKENS.has(name), `未登记的 color-mix token: ${name}`).toBe(true);
    }
    for (const name of COLOR_MIX_TOKENS) {
      const actual = parseColor(toConcrete(declarations, name));
      const expected = parseColor(COLOR_TOKEN_FALLBACKS[name] ?? "");
      expect(actual, name).not.toBeNull();
      expect(expected, name).not.toBeNull();
      // sRGB 插值 + 8 位量化，允许 ±1 的舍入误差。
      expect(Math.abs(actual!.red - expected!.red), name).toBeLessThanOrEqual(1);
      expect(Math.abs(actual!.green - expected!.green), name).toBeLessThanOrEqual(1);
      expect(Math.abs(actual!.blue - expected!.blue), name).toBeLessThanOrEqual(1);
    }
  });
});
