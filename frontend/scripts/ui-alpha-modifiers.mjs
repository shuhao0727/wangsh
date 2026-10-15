#!/usr/bin/env node
/**
 * 透明度修饰符门禁（G9，计划 §2.4）+ 死类检查（C）
 *
 * 为什么需要这个脚本：
 *   Tailwind v3 只为静态色生成透明度修饰符规则。项目把颜色映射到
 *   var(--ws-color-*)（hex 或 rgba），因此 bg-primary/10、border-border/40
 *   这类写法不生成任何 CSS——不报错、不警告，元素静默拿到默认值。
 *   实测：bg-primary/10 = rgba(0,0,0,0) 全透明；border-border/40 = 默认灰 rgb(229,231,235)。
 *   修复方案是并列定义 -rgb 三元组并映射为 rgb(var(--...-rgb) / <alpha-value>)。
 *
 * 检查 1（决定退出码）alpha 支持检查
 *   1. 取 <前缀>-<色名>/<数字>；要求 token 前面不是 [\w-]，
 *      这样 slide-out-to-left-1/2 不会被当成 to-left-1/2（定位类天然不误报）
 *   2. 色名必须在 tailwind.config.js 颜色表里精确命中；命中不了就跳过
 *      （left-1/4、w-1/2 等因此不受影响）
 *   3. 命中后：值含 <alpha-value> 放行；white/black/transparent 等静态色放行；
 *      其余（var(--ws-color-*)、rgba(...)）报错
 *   变体前缀（hover: / focus: / group-hover: / data-[state=open]: / sm:）由 lookbehind
 *   保证兼容：只排除 [\w-]，冒号不在排除范围内，可叠加多层。
 *
 * 检查 2（--dead-classes / --dead-classes-ci）
 *   把 src 中出现的颜色工具类交给 Tailwind 实编译，比对哪些没有生成任何 CSS。
 *   覆盖 border-border-secondary（本例 113 处静默失效）这类「看着有 token、其实是死类」写法。
 *   --dead-classes        信息性报告，不影响退出码（默认关闭，需一次 Tailwind 编译）。
 *   --dead-classes-ci     有死类即 exit 1，供 CI 使用（实测约 270ms，已接入 ci-quality.yml）。
 *
 *   ★ 漏检修复（task-11）：判断「这是不是一个 class 列表」的活性证据必须取自
 *     **原始字面量的全部 token**（含 flex / p-2 等非颜色 token），而不是过滤后的
 *     颜色 token 子集。否则「整组都是死类」的字面量会因一个能生成 CSS 的 token
 *     都没有而被当成散文跳过——这正是 border-border-secondary 当初逃逸的路径。
 *     同时探针 HTML 必须写入这些证据 token，否则 emits("flex") 永远为 false。
 *
 * 用法：
 *   node scripts/ui-alpha-modifiers.mjs                  # 人读报告
 *   node scripts/ui-alpha-modifiers.mjs --json           # JSON
 *   node scripts/ui-alpha-modifiers.mjs --ci             # 有违规 exit 1
 *   node scripts/ui-alpha-modifiers.mjs --dead-classes   # 附加死类报告
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { compilerFixtureRanges } from "./ui-alpha-fixture-context.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const CONFIG = path.join(ROOT, "tailwind.config.js");

/** 会消费颜色的工具前缀 */
export const COLOR_UTILITY_PREFIXES = [
  "placeholder",
  "decoration",
  "outline",
  "divide",
  "stroke",
  "border",
  "ring",
  "text",
  "from",
  "via",
  "fill",
  "bg",
  "to",
];

/** Tailwind 内置静态色：天然支持 /N */
export const STATIC_COLORS = new Set([
  "white",
  "black",
  "transparent",
  "current",
  "inherit",
]);

const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);
const SKIP_DIRS = /(^|\/)(node_modules|build|dist|coverage)$/;
const BACKTICK = String.fromCharCode(96);

const ALPHA_RE = new RegExp(
  "(?<![\\w-])(" +
    COLOR_UTILITY_PREFIXES.join("|") +
    ")-([a-z0-9][a-z0-9-]*)\\/(\\d+)\\b",
  "g",
);

/** 把 colors 展平成 名 -> 值（嵌套对象按 - 拼接） */
export function flattenColors(colors, out = new Map(), prefix = "") {
  for (const [key, value] of Object.entries(colors || {})) {
    const name = prefix ? prefix + "-" + key : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flattenColors(value, out, name);
    } else if (typeof value === "string") {
      out.set(name, value);
    }
  }
  return out;
}

/** DEFAULT 表示父名本身 */
export function normalizeColorKeys(colors) {
  const normalized = new Map();
  for (const [name, value] of flattenColors(colors)) {
    normalized.set(name.replace(/-DEFAULT$/, ""), value);
  }
  return normalized;
}

export function loadColorMap(configPath = CONFIG) {
  const require = createRequire(path.join(ROOT, "package.json"));
  const config = require(configPath);
  const extend =
    (config && config.theme && config.theme.extend && config.theme.extend.colors) || {};
  const base = (config && config.theme && config.theme.colors) || {};
  return normalizeColorKeys({ ...base, ...extend });
}

export function supportsAlpha(value) {
  return typeof value === "string" && value.includes("<alpha-value>");
}

/**
 * 纯函数：判定单个 class token 是否违规。
 * 返回 null 表示放行或不适用，否则返回违规详情。
 */
export function judgeToken(token, colorMap) {
  const splitAt = token.lastIndexOf("/");
  if (splitAt <= 0) return null;
  const utility = token.slice(0, splitAt);
  const alpha = token.slice(splitAt + 1);
  if (!/^\d+$/.test(alpha)) return null;

  const sortedPrefixes = [...COLOR_UTILITY_PREFIXES].sort((a, b) => b.length - a.length);
  let colorName = null;
  for (const prefix of sortedPrefixes) {
    if (!utility.startsWith(prefix + "-")) continue;
    const rest = utility.slice(prefix.length + 1);
    if (colorMap.has(rest)) {
      colorName = rest;
      break;
    }
  }
  // 色名不在颜色表里 -> 不是颜色工具类（left-1/4、to-left-1/2）-> 不误报
  if (colorName === null) return null;
  if (STATIC_COLORS.has(colorName)) return null;

  const value = colorMap.get(colorName);
  if (supportsAlpha(value)) return null;

  return {
    token,
    colorName,
    alpha,
    value,
    reason: "颜色映射到不支持 alpha 的 var()/rgba()，不生成 /" + alpha + " 规则",
  };
}

export function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.test(entry.name)) walk(full, out);
    } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

export function scanSourceDetails(colorMap, srcDir = SRC) {
  const violations = [];
  const rawViolations = [];
  const compilerFixtures = [];
  for (const file of walk(srcDir)) {
    const content = fs.readFileSync(file, "utf8");
    const relative = path.relative(ROOT, file).split(path.sep).join("/");
    const ranges = compilerFixtureRanges(content, file);
    const lines = content.split("\n");
    let offset = 0;
    for (let index = 0; index < lines.length; index += 1) {
      for (const match of lines[index].matchAll(ALPHA_RE)) {
        const verdict = judgeToken(match[0], colorMap);
        if (!verdict) continue;
        const row = { ...verdict, file: relative, line: index + 1 };
        rawViolations.push(row);
        const range = ranges.find((r) => offset + match.index >= r.start && offset + match.index + match[0].length <= r.end);
        if (range) compilerFixtures.push({ ...row, rule: range.rule });
        else violations.push(row);
      }
      offset += lines[index].length + 1;
    }
  }
  return { violations, rawViolations, compilerFixtures };
}

export function scanSource(colorMap, srcDir = SRC) {
  return scanSourceDetails(colorMap, srcDir).violations;
}

/**
 * 信息性：src 中出现的颜色工具类里，哪些完全不生成 CSS。
 *
 * 精度处理（否则报告会被噪音淹没而失去意义）：
 *   1. 只在 .ts/.tsx 的字符串字面量里取候选，不扫 .css
 *      -> 排除 CSS 属性名（border-bottom-color、text-align、outline-offset…）
 *   2. 候选必须是完整连字符 token（后面不接 [\w-]）
 *      -> 排除 text-text（实为 text-text-secondary 的前缀）这类截断误报
 *   3. 只保留"看起来是 class 列表"的字符串：其中至少 1 个候选真的生成了 CSS
 *      -> 排除散文/模型名（如 data.ts 里的 text-embedding-3-small）
 */
/**
 * 纯函数：从一个字符串字面量里抽取候选颜色工具类。
 *
 * 1. 先剥掉 arbitrary 值 [..]，避免把 transition-[border-color,box-shadow]
 *    里的 CSS 属性名、border-l-[3px] 里的裸前缀当成 class
 * 2. token 必须首尾都是字母数字，避免 text-text 吃掉 text-text-secondary 的前缀
 */
export function extractCandidateTokens(raw) {
  if (typeof raw !== "string" || !raw.includes("-")) return [];
  const text = raw.replace(/\[[^\]]*\]/g, " ").replace(/[{}();,]/g, " ");
  const tokenRe = new RegExp(
    "(?<![\\w-])(" +
      COLOR_UTILITY_PREFIXES.join("|") +
      ")-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?![\\w-])",
    "g",
  );
  const out = new Set();
  for (const match of text.matchAll(tokenRe)) {
    // CSS 声明上下文（text-align: / border-right: / border-radius:）里是属性名，不是 class。
    // 变体前缀的冒号在 token 之前（hover:bg-primary），故只检查 token 之后的冒号。
    if (text[match.index + match[0].length] === ":") continue;
    out.add(match[0]);
  }
  return [...out];
}

/**
 * 纯函数：从「原始字面量」里抽取所有可能生成 CSS 的 class token（不只是颜色类）。
 *
 * 为什么不能只看颜色 token：判断"这是不是一个 class 列表"需要活性证据，
 * 而证据往往来自 flex / p-2 这类与颜色无关的 token。若只取颜色子集，
 * 全死组（flex border-border-nope bg-surface-99 p-2 text-text-nope）
 * 会因为没有**任何一个** token 能生成 CSS 而被当成散文跳过——这正是 G9 漏检的根因。
 */
export function extractEvidenceTokens(raw) {
  if (typeof raw !== "string") return [];
  const text = raw
    .replace(/\$\{[^}]*\}/g, " ") // 模板插值
    .replace(/\[[^\]]*\]/g, " ") // arbitrary 值里是 CSS，不是 class
    .replace(/[{}();,]/g, " ");
  const out = new Set();
  for (const part of text.split(/\s+/).filter(Boolean)) {
    // 允许 !important 与负值前缀；只保留 class 合法字符组成的、含字母的 token
    if (/^!?-?[a-z0-9][a-z0-9._:/#%()!-]*$/i.test(part) && /[a-z]/i.test(part)) {
      out.add(part.replace(/[.#%]+$/, ""));
    }
  }
  return [...out];
}

/** 中日韩文字/全角标点：出现在字面量里说明是散文或说明文字，不是 class 列表 */
const CJK_RE = /[\u3000-\u303f\u3040-\u30ff\u4e00-\u9fff\uff00-\uffef]/;

/**
 * 纯函数：判断一个字面量是否"看起来像 class 列表"。
 * 护栏：含中日韩文字 → 散文（如 data.ts 里 text-embedding-3-small 的说明文字）。
 */
const CSS_DECL_RE = /(^|[;{])\s*[a-z-]+\s*:/i;
export function looksLikeClassList(raw) {
  if (typeof raw !== "string") return false;
  if (CJK_RE.test(raw)) return false;
  // 内联 CSS 源码块（MonacoPythonEditor 的 <style> 模板串）：含 { } ; 或
  // "type: value" 声明形态——里面出现的 border-right / border-radius / text-align
  // 是 CSS 属性名，不是 class。排除它们，避免把 CSS 属性名当死类报出。
  if (/[{}]/.test(raw) && (raw.includes(";") || CSS_DECL_RE.test(raw))) return false;
  return extractEvidenceTokens(raw).length > 0;
}

/**
 * 纯函数：给定「按字面量分组的候选 token」与一个 emits(cls) 判定函数，
 * 返回真正死掉的 class。
 *
 * 过滤器 3：只有"至少含 1 个真实生成 CSS 的 token"的字面量才当成 class 列表，
 * 否则散文/模型名（text-embedding-3-small）会产生假阳性。
 *
 * ★ 活性证据必须取自**原始字面量的全部 token**（evidence），而不是过滤后的
 *   颜色 token 子集（colors）。否则"整组都是死类"的字面量会因一个能生成 CSS
 *   的 token 都没有而被误判为散文——这正是 border-border-secondary 逃逸的路径。
 *
 * literals 每项可为 { colors, evidence }；传入纯数组时按旧语义处理
 * （数组同时充当 colors 与 evidence，仅供既有单测向后兼容）。
 */
export function selectDeadClasses(literals, emits) {
  const dead = new Set();
  for (const record of literals) {
    const isArray = Array.isArray(record);
    const colors = isArray ? record : record.colors || [];
    const evidence = isArray ? record : record.evidence || colors;
    if (!evidence.some((token) => emits(token))) continue;
    for (const token of colors) if (!emits(token)) dead.add(token);
  }
  return [...dead].sort();
}

export async function findDeadColorClasses(srcDir = SRC) {
  const require = createRequire(path.join(ROOT, "package.json"));
  const postcss = require("postcss");
  const tailwindcss = require("tailwindcss");

  const literalRe = new RegExp(
    '"([^"\\n]*)"' + "|'([^'\\n]*)'" + "|" + BACKTICK + "([^" + BACKTICK + "]*)" + BACKTICK,
    "g",
  );

  const literals = [];
  const probeTokens = new Set();
  for (const file of walk(srcDir)) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const content = fs.readFileSync(file, "utf8");
    const ranges = compilerFixtureRanges(content, file);
    for (const match of content.matchAll(literalRe)) {
      if (ranges.some((r) => match.index >= r.start && match.index + match[0].length <= r.end)) continue;
      const raw = match[1] ?? match[2] ?? match[3] ?? "";
      if (!looksLikeClassList(raw)) continue;
      const colors = extractCandidateTokens(raw);
      if (colors.length === 0) continue;
      const evidence = extractEvidenceTokens(raw);
      literals.push({ colors, evidence });
      // probe must also contain evidence tokens (flex / p-2 ...), otherwise
      // emits("flex") stays false forever and an all-dead group cannot be recognized
      for (const token of colors) probeTokens.add(token);
      for (const token of evidence) probeTokens.add(token);
    }
  }
  const list = [...probeTokens].sort();

  const probe = path.join(ROOT, "node_modules", ".cache-ws-alpha-probe.html");
  fs.writeFileSync(probe, list.map((c) => '<div class="' + c + '"></div>').join("\n"), "utf8");
  try {
    const config = require(CONFIG);
    const result = await postcss([tailwindcss({ ...config, content: [probe] })]).process(
      "@tailwind utilities;",
      { from: probe.replace(/\.html$/, ".css") },
    );
    const css = result.css;
    const esc = (s) =>
      s
        .split("")
        .map((ch) => ("\\/.:[]#%(),".includes(ch) ? "\\" + ch : ch))
        .join("");
    const emits = (cls) => {
      const needle = "." + esc(cls);
      let index = css.indexOf(needle);
      while (index >= 0) {
        const after = css[index + needle.length];
        if (!(after && /[a-zA-Z0-9_-]/.test(after))) return true;
        index = css.indexOf(needle, index + 1);
      }
      return false;
    };

    return selectDeadClasses(literals, emits);
  } finally {
    try {
      fs.unlinkSync(probe);
    } catch {}
  }
}

function parseArgs(args) {
  const options = { json: false, ci: false, deadClasses: false, src: SRC };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") options.json = true;
    else if (arg === "--ci") options.ci = true;
    else if (arg === "--dead-classes") options.deadClasses = true;
    else if (arg === "--dead-classes-ci") {
      options.deadClasses = true;
      options.deadClassesCi = true;
    } else if (arg === "--src") {
      options.src = path.resolve(args[index + 1]);
      index += 1;
    } else throw new Error("Unknown argument: " + arg);
  }
  return options;
}

export async function buildReport(options = {}) {
  const colorMap = loadColorMap();
  const { violations, rawViolations, compilerFixtures } = scanSourceDetails(colorMap, options.src || SRC);
  const report = {
    scanned_color_names: colorMap.size,
    alpha_capable: [...colorMap.entries()]
      .filter(([, value]) => supportsAlpha(value))
      .map(([name]) => name)
      .sort(),
    violation_count: violations.length,
    by_file: violations.reduce((acc, v) => {
      acc[v.file] = (acc[v.file] || 0) + 1;
      return acc;
    }, {}),
    violations,
    raw_violation_count: rawViolations.length,
    raw_violations: rawViolations,
    compiler_fixture_count: compilerFixtures.length,
    compiler_fixtures: compilerFixtures,
  };
  if (options.deadClasses) {
    report.dead_color_classes = await findDeadColorClasses(options.src || SRC);
    report.dead_class_count = report.dead_color_classes.length;
    if (options.deadClassesCi && report.dead_color_classes.length > 0) {
      process.exitCode = 1;
    }
  }
  return report;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = await buildReport(options);

  if (options.ci && report.violation_count > 0) process.exitCode = 1;

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(
    "alpha-capable color names (" +
      report.alpha_capable.length +
      "): " +
      report.alpha_capable.join(", "),
  );
  if (report.compiler_fixture_count) console.log("仅编译负例：" + report.compiler_fixture_count + " 处（原始命中保留；非测试文件豁免）。");
  if (report.violation_count === 0) {
    console.log(
      "透明度修饰符门禁通过：0 处 /N 用于不支持 alpha 的颜色（扫描 " +
        report.scanned_color_names +
        " 个色名）。",
    );
  } else {
    console.log("透明度修饰符门禁失败：" + report.violation_count + " 处 /N 会静默失效。");
    for (const v of report.violations) {
      console.log(v.file + ":" + v.line + "  " + v.token + "  ->  " + v.reason);
    }
  }
  if (options.deadClasses) {
    const dead = report.dead_color_classes || [];
    console.log("");
    console.log("[死类] 完全不生成 CSS 的颜色类：" + dead.length + " 个" + (options.deadClassesCi ? "（--dead-classes-ci：有死类即 exit 1）" : "（信息性，不影响退出码）"));
    for (const cls of dead) console.log("  " + cls);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("透明度修饰符门禁错误：" + error.message);
    process.exitCode = 2;
  });
}
