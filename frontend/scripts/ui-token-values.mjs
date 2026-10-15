#!/usr/bin/env node
/**
 * 颜色 token **值** 校验 —— 与 token-check.mjs 职责互补
 *
 * 为什么需要这个脚本（G6）：
 *   token-check.mjs 只回答"var(--ws-x) 有没有被定义"，它**完全不看值**。
 *   实测：把 index.css 的 --ws-color-success 从 #39795D 改成 #FF0000，
 *   token:check:ci 仍然 exit 0 并打印 "0 undefined tokens"。
 *   → 名字坏了管，值坏了不管。本脚本补上"值"这一半。
 *
 * 三件事：
 *   ① 值快照 ratchet：记录 :root 中每个 --ws-color-* 的当前值，**值变更即红**，
 *      必须显式 --adopt 才更新基线。任何人偷改真源都不可能静默通过。
 *   ② -rgb 三元组一致性：xxx 与 xxx-rgb 是"同一真源的两个投影"
 *      （index.css 里有明确注释要求同步），本项目极易漂移，故机械校验。
 *   ③ WCAG 对比度断言（AGENTS.md 要求三场景 ≥4.5:1）：
 *        场景 A 白字叠该色块         —— contrast(#FFFFFF, color)
 *        场景 B 该色作文字在白底上    —— contrast(color, --ws-color-surface)
 *        场景 C 该色作文字在页面底色上 —— contrast(color, --ws-color-bg)
 *      按语义角色选择场景；文字、代码文字、反白文字不套强调色的三场景。
 *      整值 var() 别名先解析再检查；原始声明仍用于快照比较。
 *      半透明设计元素及非内容角色跳过并计数；解析错误使 CI 失败，不能静默跳过。
 *
 * 用法：
 *   node scripts/ui-token-values.mjs                 # 人读报告
 *   node scripts/ui-token-values.mjs --json          # JSON
 *   node scripts/ui-token-values.mjs --ci            # 与基线比较，值变更即 exit 1
 *   node scripts/ui-token-values.mjs --ci --adopt    # 显式接受当前值并更新基线
 *
 * --adopt 优先于 --ci（同 ui-spacing-metrics.mjs 既有范式，避免提示不可执行）。
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
// 允许用环境变量指向替代 CSS/基线——供单测在不改动真源的前提下
// 验证「值变更即红」的完整回路（同 ui-spacing-metrics 的 UI_SPACING_BASELINE 范式）。
const CSS_PATH =
  process.env.UI_TOKEN_VALUES_CSS || path.join(ROOT, "src", "styles", "index.css");
// 允许用环境变量指向替代基线——供单测在不污染真实基线的前提下验证 ratchet 语义。
const BASELINE =
  process.env.UI_TOKEN_VALUES_BASELINE ||
  path.join(import.meta.dirname, "token-value-baseline.json");

/** WCAG 2.x 正文对比度下限 */
const MIN_CONTRAST = 4.5;

/* ─────────────────────────── :root 解析 ─────────────────────────── */

/**
 * 取出 index.css 中**第一个顶层 :root 块**的内容。
 * 不能简单全局匹配 --ws-color-：index.css 里媒体查询/其他层也有同名声明，
 * 而 AGENTS.md 规定真源是 :root。
 */
export function extractRootBlock(css) {
  const start = css.indexOf(":root");
  if (start === -1) throw new Error("index.css 中找不到 :root 块");
  const open = css.indexOf("{", start);
  if (open === -1) throw new Error(":root 后没有 {");
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(":root 块未闭合");
}

/**
 * 解析 --ws-color-* 声明。
 * 值可能跟行尾注释（/* = --ws-color-primary *​/），必须剥离，
 * 否则注释内容会被当成值的一部分、导致基线虚高漂移。
 */
export function parseColorTokens(rootBlock) {
  const tokens = {};
  const re = /(--ws-color-[a-z0-9-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(rootBlock)) !== null) {
    const name = m[1];
    const value = m[2].replace(/\/\*[\s\S]*?\*\//g, "").trim();
    if (!(name in tokens)) tokens[name] = value; // 同名以首次为准
  }
  return tokens;
}

/* ─────────────────────────── 颜色解析与 WCAG ─────────────────────────── */

const NAMED = { white: "#FFFFFF", black: "#000000" };

/**
 * 角色分类 —— 决定该 token 适用哪几条对比度断言。
 *
 * 为什么必须分角色：AGENTS.md 的三场景契约（白字叠色块 / 该色作文字在白底 /
 * 该色作文字在页底色上）针对的是**语义强调色**。把背景/文本色套进同一个模具
 * 会产生纯粹的假阳性，两类典型：
 *   - --ws-color-surface = #FFFFFF，报"白字叠色块 = 1.0" —— 白底叠白字是**定义**，
 *     不是缺陷；surface 是页面底色，永远不作"被叠的色块"。
 *   - --ws-color-code-text = #d4d4d4，它的真实背景是 code-bg(#1e1e1e) 而非白底，
 *     拿白底去算它同样没有意义。
 * 反过来，真正的强调色（primary/success/warning/error/...）必须三向全达标。
 *
 * 判据来自 token 名语义 + index.css 注释，不靠猜测：
 *   accent      —— 可作正文、图标、按钮底色的强调色：三向全查
 *   text        —— 正文/辅助/占位文字：查"作文字"两向
 *   code_text   —— 代码文本，真实背景是 code-bg：查 code-bg 上的对比度
 *   inverse_text —— 深色主填充上的反白文字：查 primary-fill 上的对比度
 *   surface     —— 页面/面板底色，不作文字也不作被叠色块：不适用三场景，跳过
 *   decor       —— 非常规语境（error-light 浅色提示底、scrollbar 非内容）：跳过
 */
const TEXT_TOKENS = /^--ws-color-(text|text-secondary|text-tertiary|text-placeholder)$/;
const SURFACE_TOKENS =
  /^--ws-color-(page|bg|surface|surface-2|primary-muted|overlay|tooltip|code-bg)$/;
const DECOR_TOKENS = /^--ws-color-(error-light|error-soft-solid|scrollbar)$/;
const MODULE_ALIASES = /^--ws-color-(chart|debug|diagram|editor|module-shell|terminal)(-|$)/;

export function classifyToken(name, sourceToken = name, aliasChain = []) {
  if (name === "--ws-color-text-inverse") return "inverse_text";
  if (name === "--ws-color-code-text") return "code_text";
  if (TEXT_TOKENS.test(name)) return "text";
  if (SURFACE_TOKENS.test(name)) return "surface";
  if (DECOR_TOKENS.test(name)) return "decor";
  // Keep the first canonical semantic role along a module alias chain. For example,
  // module-shell-code-text -> code-text -> surface is still code_text, not surface.
  // Public accent tokens keep their own role: primary -> surface must still fail contrast.
  if (sourceToken !== name && MODULE_ALIASES.test(name)) {
    const semanticSource = aliasChain.find((token) => !MODULE_ALIASES.test(token));
    return classifyToken(semanticSource || sourceToken);
  }
  return "accent";
}

/** 解析 #RGB / #RRGGBB / #RRGGBBAA / rgb() / rgba() → {r,g,b,a} 或 null */
export function parseColor(input) {
  if (typeof input !== "string") return null;
  const s = input.trim().toLowerCase();
  if (NAMED[s]) return parseColor(NAMED[s]);
  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+%?))?\s*\)$/);
  if (m) {
    // parseFloat alone truncates malformed values such as 17..5 and 0..5.
    if (m.slice(1).some((part) => part != null && !/^(?:\d+(?:\.\d+)?|\.\d+)%?$/.test(part))) {
      return null;
    }
    const num = (x) => (x.endsWith("%") ? (parseFloat(x) / 100) * 255 : parseFloat(x));
    const alpha = m[4] == null ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    const r = num(m[1]), g = num(m[2]), b = num(m[3]);
    if ([r, g, b, alpha].some((v) => !Number.isFinite(v)) ||
        [r, g, b].some((v) => v < 0 || v > 255) || alpha < 0 || alpha > 1) return null;
    return { r, g, b, a: alpha };
  }
  return null;
}

/** Resolve whole-token var() aliases without changing the raw baseline values. */
export function resolveTokenValue(tokens, name) {
  const seen = new Set();
  let current = name;
  while (true) {
    if (!Object.hasOwn(tokens, current)) return { reason: "missing-token", target: current };
    if (seen.has(current)) return { reason: "alias-cycle", target: current };
    seen.add(current);
    const value = tokens[current];
    const alias = value.match(/^var\(\s*(--ws-color-[a-z0-9-]+)\s*\)$/);
    if (!alias) return { value, source_token: current, alias_chain: [...seen] };
    current = alias[1];
  }
}

/** alpha 合成到不透明背景上（source-over） */
export function composite(fg, bg) {
  const a = fg.a;
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
    a: 1,
  };
}

/** WCAG relative luminance */
export function relativeLuminance(c) {
  const ch = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}

/** WCAG 对比度（1..21）。半透明前景先合成到背景上。 */
export function contrastRatio(fg, bg) {
  const f = fg.a < 1 ? composite(fg, bg) : fg;
  const l1 = relativeLuminance(f);
  const l2 = relativeLuminance(bg);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

/* ─────────────────────────── 报告构建 ─────────────────────────── */

export function buildReport(opts = {}) {
  const cssPath = opts.cssPath || CSS_PATH;
  const css = fs.readFileSync(cssPath, "utf8");
  const tokens = parseColorTokens(extractRootBlock(css));

  const names = Object.keys(tokens).sort();
  const resolved = { ...tokens };
  const resolvedValues = {};
  const colors = {};
  const roles = {};
  const resolutionErrors = [];
  const contrastChecks = [];
  const skipped = [];

  for (const name of names) {
    const result = resolveTokenValue(tokens, name);
    resolvedValues[name] = result.value ?? null;
    if (result.reason) {
      resolutionErrors.push({ token: name, value: tokens[name], ...result });
    } else if (!name.endsWith("-rgb")) {
      const color = parseColor(result.value);
      if (color) {
        colors[name] = color;
        roles[name] = classifyToken(name, result.source_token, result.alias_chain);
      } else {
        resolutionErrors.push({ token: name, value: tokens[name], reason: "invalid-color" });
      }
    }
  }

  // Missing optional backgrounds retain the fixture defaults; invalid defined ones never do.
  const background = (name, fallback) =>
    Object.hasOwn(tokens, name) ? colors[name] : parseColor(fallback);
  const surface = background("--ws-color-surface", "#FFFFFF");
  const pageBg = background("--ws-color-bg", "#FFFFFF");
  const codeBg = background("--ws-color-code-bg", "#1e1e1e");
  const primaryFill = Object.hasOwn(tokens, "--ws-color-primary-fill")
    ? colors["--ws-color-primary-fill"]
    : background("--ws-color-primary", "#0F766E");
  const white = { r: 255, g: 255, b: 255, a: 1 };

  for (const name of names) {
    const raw = tokens[name];
    // -rgb 三元组是数值投影，不是颜色，单独在一致性检查里处理
    if (name.endsWith("-rgb")) {
      continue;
    }
    const color = colors[name];
    if (!color) {
      skipped.push({ token: name, value: raw, reason: "resolution-error" });
      continue;
    }
    if (color.a < 1) {
      // 半透明语义色（*-soft / border / overlay / hover-bg）本就不作正文色，
      // 对其断言 4.5:1 会产生大量无意义告警。跳过并显式计数。
      skipped.push({ token: name, value: raw, reason: "translucent" });
      continue;
    }

    const role = roles[name];
    // 各角色适用场景（见 classifyToken 注释）：
    const SCENARIOS = {
      accent: ["white_text_on_color", "color_text_on_surface", "color_text_on_page_bg"],
      text: ["color_text_on_surface", "color_text_on_page_bg"],
      code_text: ["color_text_on_code_bg"],
      inverse_text: ["color_text_on_primary_fill"],
      surface: [],
      decor: [],
    };
    const wanted = SCENARIOS[role];
    if (wanted.length === 0) {
      skipped.push({ token: name, value: raw, reason: "not-a-content-color:" + role });
      continue;
    }
    const all = {
      white_text_on_color: { bg: color, fg: white },
      color_text_on_surface: { bg: surface, fg: color },
      color_text_on_page_bg: { bg: pageBg, fg: color },
      color_text_on_code_bg: { bg: codeBg, fg: color },
      color_text_on_primary_fill: { bg: primaryFill, fg: color },
    };
    if (wanted.some((scenario) => !all[scenario].bg)) {
      skipped.push({ token: name, value: raw, reason: "unresolved-background" });
      continue;
    }
    const ratios = {};
    let min = Infinity;
    for (const scenario of wanted) {
      const c = all[scenario];
      const ratio = Number(contrastRatio(c.fg, c.bg).toFixed(2));
      ratios[scenario] = ratio;
      if (ratio < min) min = ratio;
    }
    contrastChecks.push({
      token: name,
      value: raw,
      role,
      scenarios_checked: wanted,
      ratios,
      min_ratio: Number(min.toFixed(2)),
      passes: min >= MIN_CONTRAST,
    });
  }

  const failures = contrastChecks.filter((c) => !c.passes);

  // -rgb 三元组一致性：a 与 a-rgb 必须是同一颜色的两个投影
  const rgbMismatches = [];
  for (const name of names) {
    if (!name.endsWith("-rgb")) continue;
    const base = name.slice(0, -4);
    const triplet = resolvedValues[name];
    if (triplet == null) continue; // Already reported as an alias resolution error.
    const parts = triplet.match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})$/);
    if (!parts || parts.slice(1).some((part) => Number(part) > 255)) {
      resolutionErrors.push({ token: name, value: tokens[name], reason: "invalid-rgb-triplet" });
      continue;
    }
    if (!(base in tokens)) continue; // Orphan projections still require valid triplet syntax/range.
    const baseColor = colors[base];
    if (!baseColor) continue; // The base color's resolution error is already reported.
    const [r, g, b] = parts.slice(1).map(Number);
    if (r !== baseColor.r || g !== baseColor.g || b !== baseColor.b) {
      rgbMismatches.push({
        rgb_token: name,
        base_token: base,
        rgb_value: tokens[name].trim(),
        base_value: tokens[base],
        expected: String(baseColor.r) + " " + String(baseColor.g) + " " + String(baseColor.b),
      });
    }
  }

  return {
    generated_at: new Date().toISOString(),
    source: path.relative(ROOT, cssPath).split(path.sep).join("/"),
    min_contrast: MIN_CONTRAST,
    counts: {
      tokens_total: names.length,
      color_tokens: names.filter((n) => !n.endsWith("-rgb")).length,
      rgb_triplets: names.filter((n) => n.endsWith("-rgb")).length,
      contrast_checked: contrastChecks.length,
      contrast_skipped: skipped.length,
      contrast_failures: failures.length,
      rgb_mismatches: rgbMismatches.length,
      resolution_errors: resolutionErrors.length,
    },
    values: resolved,
    resolved_values: resolvedValues,
    contrast: contrastChecks,
    contrast_failures: failures,
    skipped,
    rgb_mismatches: rgbMismatches,
    resolution_errors: resolutionErrors,
  };
}

/* ─────────────────────────── CLI ─────────────────────────── */

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);

if (isMain) {
  const asJson = process.argv.includes("--json");
  // --adopt 必须先于 --ci 判断（既有范式：否则 --ci 会先 exit 1，自己打印的
  // "run with --ci --adopt" 提示永远无法执行）。
  const asAdopt = process.argv.includes("--adopt");
  const asCi = process.argv.includes("--ci") && !asAdopt;

  const report = buildReport();
  const values = {};
  for (const [k, v] of Object.entries(report.values)) values[k] = v;

  if (asCi) {
    if (!fs.existsSync(BASELINE)) {
      console.error("[ui-token-values] baseline missing: " + BASELINE);
      console.error("[ui-token-values] run with --adopt to create it.");
      process.exit(1);
    }
    const base = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
    const baseValues = base.values || {};
    const problems = [];

    for (const error of report.resolution_errors) {
      problems.push("token resolution failed: " + error.token + " (" + error.reason + ")");
    }

    // ① 值变更即红（新增/删除/改值三类都要报）
    for (const [name, value] of Object.entries(values)) {
      if (!(name in baseValues)) {
        problems.push("token added (not in baseline): " + name + ": " + value);
      } else if (baseValues[name] !== value) {
        problems.push(
          "token value changed: " + name + ": " + baseValues[name] + " -> " + value,
        );
      }
    }
    for (const name of Object.keys(baseValues)) {
      if (!(name in values)) {
        problems.push("token removed: " + name + " (baseline had " + baseValues[name] + ")");
      }
    }

    // ② -rgb 三元组漂移即红
    for (const mm of report.rgb_mismatches) {
      problems.push(
        "rgb triplet out of sync: " + mm.rgb_token + "=" + mm.rgb_value +
          " but " + mm.base_token + "=" + mm.base_value + " (expected " + mm.expected + ")",
      );
    }

    // ③ 对比度回归即红：基线达标、现在不达标
    const baseFailures = new Set(base.contrast_failures || []);
    for (const f of report.contrast_failures) {
      if (!baseFailures.has(f.token)) {
        problems.push(
          "contrast regression: " + f.token + " (" + f.value + ") min_ratio=" +
            f.min_ratio + " < " + MIN_CONTRAST,
        );
      }
    }

    if (problems.length) {
      console.error("[ui-token-values] gate FAILED");
      for (const p of problems) console.error("  " + p);
      console.error("[ui-token-values] if the change is deliberate:");
      console.error("  npm run -s ui:token-values -- --ci --adopt");
      process.exit(1);
    }
    console.log(
      "[ui-token-values] gate passed. " + report.counts.color_tokens +
        " color tokens unchanged, " + report.counts.contrast_failures +
        " known contrast failure(s) (baselined)",
    );
    process.exit(0);
  }

  if (asAdopt) {
    if (report.resolution_errors.length) {
      console.error("[ui-token-values] cannot adopt unresolved or invalid tokens");
      for (const error of report.resolution_errors) {
        console.error("  " + error.token + ": " + error.reason);
      }
      process.exit(1);
    }
    const next = {
      generated_at: report.generated_at,
      source: report.source,
      min_contrast: MIN_CONTRAST,
      note:
        "值变更即红（ratchet）。--adopt 是显式接受当前值的唯一路径；改色需 Lead 决策。",
      counts: report.counts,
      values,
      contrast_failures: report.contrast_failures.map((f) => f.token),
      rgb_mismatches: report.rgb_mismatches,
    };
    fs.writeFileSync(BASELINE, JSON.stringify(next, null, 2) + "\n");
    console.log(
      "[ui-token-values] baseline adopted: " + report.counts.color_tokens +
        " color tokens, " + report.counts.contrast_failures + " contrast failure(s) recorded",
    );
    process.exit(0);
  }

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("=".repeat(62));
    console.log("颜色 token 值校验（G6）");
    console.log("=".repeat(62));
    console.log("真源             : " + report.source);
    console.log("token 总数       : " + report.counts.tokens_total);
    console.log("  颜色 token     : " + report.counts.color_tokens);
    console.log("  -rgb 三元组    : " + report.counts.rgb_triplets);
    console.log("对比度已测       : " + report.counts.contrast_checked);
    console.log(
      "对比度跳过       : " + report.counts.contrast_skipped + "（半透明/非内容角色/解析错误）",
    );
    console.log("解析错误         : " + report.counts.resolution_errors);
    for (const error of report.resolution_errors) {
      console.log("  " + error.token + ": " + error.reason);
    }
    console.log("对比度不达标     : " + report.counts.contrast_failures);
    console.log("-rgb 不同步      : " + report.counts.rgb_mismatches);
    if (report.contrast_failures.length) {
      console.log("");
      console.log("不达标明细（阈值 " + MIN_CONTRAST + ":1）:");
      for (const f of report.contrast_failures.slice().sort((a, b) => a.min_ratio - b.min_ratio)) {
        console.log("  " + f.token + " " + f.value + "  min=" + f.min_ratio);
        console.log(
          "      白字叠色块=" + f.ratios.white_text_on_color +
            " / 白底文字=" + f.ratios.color_text_on_surface +
            " / 页底文字=" + f.ratios.color_text_on_page_bg,
        );
      }
    }
    if (report.rgb_mismatches.length) {
      console.log("");
      console.log("-rgb 三元组不同步:");
      for (const mm of report.rgb_mismatches) {
        console.log(
          "  " + mm.rgb_token + "=" + mm.rgb_value + "  但 " + mm.base_token + "=" +
            mm.base_value + "（应为 " + mm.expected + "）",
        );
      }
    }
  }
}
