#!/usr/bin/env node
/**
 * 数字间距类 vs 语义 token 间距类 —— 计数与迁移率门禁
 *
 * 为什么需要这个脚本：
 *   ui-audit.mjs 的 TAILWIND_ARBITRARY_PX 只匹配 `-[\d+px]` 形式（如 gap-[24px]），
 *   因此**看不到** `gap-4` / `px-6` / `mb-3` 这类数字间距类。B5「间距迁移」的
 *   对象恰恰是后者，用 ui-audit 的 route 阈值下降来验收 B5 是不可执行的（见计划 §2.1.1）。
 *   本脚本补上这个口径。
 *
 * 口径：
 *   间距前缀 = gap|space-x|space-y|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr
 *   语义 token  = 上述前缀 + 计划 §四 定义的语义名（panel-padding / item-gap / ...）
 *   数字间距类  = 上述前缀 + 数字（含小数），且后面不再跟 [ 或数字/单词
 *
 * 用法：
 *   node scripts/ui-spacing-metrics.mjs            # 人读报告
 *   node scripts/ui-spacing-metrics.mjs --json     # JSON
 *   node scripts/ui-spacing-metrics.mjs --ci       # 与基线比较，超阈值 exit 1
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");
// 允许用环境变量指向替代基线文件——供单元测试在不改动真实基线的前提下
// 验证 --ci 比较与 --adopt 收紧语义。
const BASELINE =
  process.env.UI_SPACING_BASELINE || path.join(import.meta.dirname, "ui-spacing-baseline.json");

/**
 * 新指标「首次登记」的授权来源：**基线文件里的 `reference.first_adoption` 数组**，
 * 形如 `[{ key, recorded_at, reason }]`。
 *
 * 背景：门禁键语义是「只降不升」，但**全新**指标在基线里还没有键，首次 --adopt
 * 必然「上升」（0 → 实测值）。不特判则新指标永远接不进来；特判不当则开后门。
 *
 * 演进过程（两次都不对，最终版才对，留此记录避免重蹈）：
 *   ① `if (!(key in base)) continue;`  → **安全漏洞**：删键即重新获得无限放宽通道。
 *   ② 脚本内白名单 FIRST_ADOPT_KEYS → **同样漏**：键本就在白名单里，删了照样放行。
 *   ③ 授权记录在基线 reference 里 → 删键不会重建授权，因为授权不在被删的键上。
 *
 * 该授权是**一次性**的：键被写入基线后就不再「不存在」，分支自然失效。
 */

/** 计划 §四 定义的语义间距名（含 B5-C 新增的微间距档 2xs/xs） */
const SEMANTIC_NAMES = [
  "panel-padding",
  "panel-padding-sm",
  "panel-padding-lg",
  "card-padding",
  "item-gap",
  "content-gap",
  "button-gap",
  "section-gap",
  "form-field-gap",
  // B5-C：4px / 8px 两档原先无 token，是 2425 处数字间距里最大的两块欠账
  // （8px 670 处、4px 373 处）。新增为**纯别名**——值与原 Tailwind 数字类
  // 逐位相同（4px/8px），迁移后计算值零变化。注意不可写成 var(--ws-space-1/2)：
  // 那两个是流体 clamp（1440px 下实测 6.39px / 10.54px），会真的改视觉。
  "2xs",
  "xs",
];

/** 间距前缀（长的在前，保证最长匹配——space-x 必须优先于 space） */
const SPACING_PREFIXES = [
  "space-x",
  "space-y",
  "gap",
  "px",
  "py",
  "pt",
  "pb",
  "pl",
  "pr",
  "mx",
  "my",
  "mt",
  "mb",
  "ml",
  "mr",
  "p",
  "m",
];

const PREFIX = "(?:" + SPACING_PREFIXES.join("|") + ")";
const SEM_ALT = [...SEMANTIC_NAMES].sort((a, b) => b.length - a.length).join("|");

const SEMANTIC_RE = new RegExp(String.raw`\b${PREFIX}-(?:${SEM_ALT})\b`, "g");
// ---- G5 同款口径分层（B12）：数字间距类里有一类**物理上不可迁移**——零值复位
// （p-0 / gap-0 / mt-0 / space-y-0 …）。它们对应 Tailwind 的「无间距」标准类，
// 永远不会有语义 token（加 zero-gap: 0px 毫无意义），却占用 192 处分母，
// 让迁移率虚低、也拖长 ratchet 的归零路径。因此 NUMERIC_RE 只统计**值非零**的真欠账；
// ZERO_RE 单独统计并列为 non_migratable_zero_uses。见 SPACING.md / 计划 3.1 G5。
// 尾部负向前瞻 (?![\d\w\-\[]) 不可省：
// 否则 p-2x / mt-3xl 这类「前缀相同但值不同」的 class 会被误计。
const NUMERIC_RE = new RegExp(
  String.raw`\b${PREFIX}-[1-9]\d*(?:\.\d+)?(?![\d\w\-\[])`,
  "g",
);
const ZERO_RE = new RegExp(
  String.raw`\b${PREFIX}-0(?:\.0+)?(?![\d\w\-\[])`,
  "g",
);

// ---- G2 laundering 计数器（task-27）----------------------------------------
// 洗白通道：把**有语义**的数字间距类（p-2 → 8px）改写成 **内联字面量**任意值，
// 视觉**逐位等价**、token 化零进展，却让 numeric_spacing_uses 直接归零——
// 而它是 `ui:spacing:ci` 的核心等值 ratchet 键。故必须独立计数：
//   · 不并入 numeric —— 否则将来 --adopt 会把洗白值当成"真实债务"固化进基线；
//   · 不并入 total   —— total 是 semantic+numeric 的派生观测值，混入会污染迁移率；
//   · 独立等值 ratchet 键 —— 与 numeric 同待遇（双向收紧）。
//
// ⚠️ 判据（2026-10-05 Lead 裁决，方案 B）：**只计内联字面量**。
//   p-[8px] / p-[0.5rem] / p-[1.5em]  → 洗白（视觉等价改写，计）
//   p-[var(--ws-space-3)]              → **不是**洗白（计 0）
//   p-[calc(1rem+2px)]                 → 放行（计 0）
// 依据（实测）：`p-3` = 0.75rem = 10.67px@1024 / 11.25px@1920，
// 而 `--ws-space-3` = clamp(12px, 0.38vw+9.6px, 20px) = 13.49px@1024 / 16.90px@1920。
// **两者数值根本不同** —— 把数字类换成引用真实定义的 CSS 变量是一次**真实的语义
// token 迁移**，且正是我们想要的方向（写死值 → 随视口缩放）。若把它算作洗白，
// 等于惩罚正确行为，并让基线长期虚高 153。
// var() 形态的真实信息不丢弃：另设纯观测字段 token_arbitrary_uses（**不进门禁**）。
//
// 与 NUMERIC_RE 的**互补性**：NUMERIC_RE 尾锚已排除 `[`，所以 p-[8px] 永远不会
// 被 numeric 计入，两者不会双重计数。
const LAUNDER_RE = new RegExp(
  String.raw`\b${PREFIX}-\[-?\d+(?:\.\d+)?(?:px|rem|em)(?![\w-])\]`,
  "g",
);

// 纯观测（**不进任何门禁**）：间距前缀 + var(--ws-*)。这些是"用任意值语法引用
// 真实定义的 CSS 变量"，属正确的 token 迁移方向，不是洗白。保留计数只为让
// 「有多少处走了 var() 任意值」这一事实可见，避免信息消失。
const TOKEN_ARBITRARY_RE = new RegExp(
  String.raw`\b${PREFIX}-\[var\(--ws-[A-Za-z0-9_-]+\)\](?![\w-])`,
  "g",
);

const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
// 测试文件不算生产间距欠账（计划 §5.3「排除 *.test.*」）。
// 迁移回归测试本身必须写数字类才能证明覆盖语义生效（cn("p-card-padding", "p-4")），
// 若把测试文件计入分母，写一条正确的回归测试反而会让门禁变红。
const IS_TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!/(^|\/)(node_modules|build|dist|coverage)$/.test(entry.name)) walk(full, out);
    } else if (SCAN_EXTENSIONS.has(path.extname(entry.name)) && !IS_TEST_FILE.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function countMatches(re) {
  const perFile = {};
  const perPrefix = {};
  let total = 0;
  for (const file of walk(SRC)) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split("\n");
    for (const line of lines) {
      // 跳过整行注释，避免把说明性文字计入
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
      const hits = line.match(re);
      if (!hits) continue;
      total += hits.length;
      perFile[rel] = (perFile[rel] || 0) + hits.length;
      for (const hit of hits) {
        // 前缀必须是已知间距前缀之一，且加 '-' 后正好是本命中的开头。
        // 不能简单按 '-' 切分：语义名含连字符（mb-content-gap），
        // 而前缀本身也有含连字符的（space-x / space-y）。
        const p =
          SPACING_PREFIXES.find((cand) => hit.startsWith(cand + "-")) ?? "unknown";
        perPrefix[p] = (perPrefix[p] || 0) + 1;
      }
    }
  }
  return { total, perFile, perPrefix };
}

const semantic = countMatches(SEMANTIC_RE);
const numeric = countMatches(NUMERIC_RE);
const zero = countMatches(ZERO_RE);
const laundering = countMatches(LAUNDER_RE);
const tokenArbitrary = countMatches(TOKEN_ARBITRARY_RE);
const sum = semantic.total + numeric.total;
const report = {
  generated_at: new Date().toISOString(),
  scope: { src: "frontend/src", extensions: [...SCAN_EXTENSIONS] },
  semantic_token_uses: semantic.total,
  numeric_spacing_uses: numeric.total,
  // 零值复位（p-0 / gap-0 / mt-0 …）不是欠账，只是「没有间距」这一事实的写法。
  // 单列出来是为了让分母可解释：numeric_spacing_uses 现在只含真欠账。
  non_migratable_zero_uses: zero.total,
  // G2 洗白计数（task-27，方案 B）：间距前缀 + **内联字面量**任意值（px/rem/em）。
  // 参照系是"视觉等价的改写"：p-2 → p-[8px] 视觉逐位相同，属真洗白。
  // **刻意不进 total、不进 migration_rate_pct**——它们描述的是"数字类欠账的剩余量"，
  // 而洗白是**另一类**事实：把欠账藏起来。混入会让迁移率在两份代码间不可比。
  laundering_classes: laundering.total,
  // 纯观测（**不进门禁**）：间距前缀 + var(--ws-*)。这是"用任意值语法引用真实
  // 定义的 CSS 变量"，数值与数字类不同（见 LAUNDER_RE 上方实测），属正确的
  // token 迁移方向。保留只为让该事实可见。
  token_arbitrary_uses: tokenArbitrary.total,
  total: sum,
  migration_rate_pct: sum === 0 ? 0 : Number(((semantic.total / sum) * 100).toFixed(2)),
  by_prefix: {
    semantic: semantic.perPrefix,
    numeric: numeric.perPrefix,
    zero: zero.perPrefix,
    laundering: laundering.perPrefix,
    token_arbitrary: tokenArbitrary.perPrefix,
  },
  top_numeric_files: Object.entries(numeric.perFile)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([file, hits]) => ({ file, hits })),
  top_laundering_files: Object.entries(laundering.perFile)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([file, hits]) => ({ file, hits })),
};

const asJson = process.argv.includes("--json");
// `--adopt` 必须优先于 `--ci`：否则 --ci 分支会先 process.exit(1)，
// 导致脚本自己打印的 "run with --ci --adopt" 提示永远无法执行（实测踩到）。
const asAdopt = process.argv.includes("--adopt");
const asCi = process.argv.includes("--ci") && !asAdopt;

if (asCi) {
  if (!fs.existsSync(BASELINE)) {
    console.error(`[ui-spacing] baseline missing: ${BASELINE}`);
    console.error("[ui-spacing] run with --adopt after a deliberate migration to create it.");
    process.exit(1);
  }
  const base = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
  const problems = [];

  // ── 门禁只盯 **numeric_spacing_uses**（数字间距类），它必须双向收紧：
  //    上升 = 新增 px 债务（回归）；下降 = 基线陈旧，应 --adopt 收紧。
  const cmp = (label, actual, expected) => {
    if (actual > expected) problems.push(`${label} increased: ${actual} > ${expected}`);
    else if (actual < expected)
      problems.push(`${label} decreased (baseline stale, tighten it): ${actual} < ${expected}`);
  };
  cmp("numeric_spacing_uses", report.numeric_spacing_uses, base.numeric_spacing_uses);

  // ── G2：laundering 独立双向 ratchet（task-27）。
  //    与 numeric **同待遇但不同键**：上升 = 新增洗白写法（把欠账藏进任意值）；
  //    下降 = 基线陈旧，应 --adopt 收紧。
  //    独立成键的原因：若与 numeric 合并，一次洗白会同时表现为
  //    "numeric 下降"（被误判为迁移收益）与"洗白上升"（真实信号），
  //    两者互相抵销后门禁反而可能通过——必须分开比较，让洗白单独可见。
  //    基线缺该键时（旧基线）视为 0：新键首次出现必然红，这是**期望行为**，
  //    由 Lead 显式 --adopt 采纳，不由脚本自动放行。
  const baseLaunder = typeof base.laundering_classes === "number" ? base.laundering_classes : 0;
  cmp("laundering_classes", report.laundering_classes, baseLaunder);

  // ── **不用 total 做等值门禁**（曾误报，2026-10-04 修正）。
  //    total = 语义用法 + 数字用法。迁移的正常形态是「数字↓、语义↑」，
  //    当一处的语义增量 ≥ 数字减量时 total 会上升——那是**收益**，不是回归。
  //    实例：B6 把 gap-2/px-4/py-12 换成语义 token，numeric 净增 0、semantic +4，
  //    total 2743→2747，旧逻辑误判为回归。
  //    正确的 total 守则是**单向上界**：只拦「数字债务没降却总用量暴涨」的情形，
  //    给 5% 的缓冲，避免语义迁移被误伤。
  //
  //    改用 numeric 单独作等值门禁后，total 仅作观测项：若 numeric 不升，
  //    而 total 异常膨胀（语义类被滥用为大段样板），仍给出提示但不 fail。
  if (base.total) {
    const growth = report.total - base.total;
    if (growth > 0 && report.numeric_spacing_uses >= base.numeric_spacing_uses) {
      const pct = (growth / base.total) * 100;
      if (pct > 5) {
        console.warn(
          `[ui-spacing] warning: total grew ${growth} (${pct.toFixed(2)}%) without numeric reduction ` +
            `— check for semantic-class bloat`,
        );
      }
    }
  }

  if (problems.length) {
    console.error("[ui-spacing] gate FAILED");
    for (const p of problems) console.error("  " + p);
    if (report.numeric_spacing_uses < base.numeric_spacing_uses) {
      console.error("[ui-spacing] tighten with: npm run -s ui:spacing -- --ci --adopt");
    }
    process.exit(1);
  }
  console.log(
    `[ui-spacing] gate passed (ratchet exact). numeric spacing: ${report.numeric_spacing_uses}, migration rate: ${report.migration_rate_pct}%`,
  );
  process.exit(0);
}

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("=".repeat(62));
  console.log("间距迁移度量（B5 门禁口径）");
  console.log("=".repeat(62));
  console.log(`语义 token 间距类 : ${report.semantic_token_uses}`);
  console.log(`数字间距类       : ${report.numeric_spacing_uses}`);
  console.log(`  其中零值复位   : ${report.non_migratable_zero_uses}（p-0/gap-0 等，非欠账，不迁移）`);
  console.log(`合计             : ${report.total}`);
  console.log(`迁移率           : ${report.migration_rate_pct}%`);
  console.log("");
  console.log(
    `洗白类（内联字面量任意值 px/rem/em，独立 ratchet）: ${report.laundering_classes}`,
  );
  console.log(
    `  （观测，不进门禁）var(--ws-*) 任意值用法: ${report.token_arbitrary_uses}`,
  );
  if (report.laundering_classes > 0) {
    console.log("  按前缀:");
    for (const [k, v] of Object.entries(report.by_prefix.laundering).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${k.padEnd(10)} ${v}`);
    }
    console.log("  Top 文件:");
    for (const { file, hits } of (report.top_laundering_files || []).slice(0, 10)) {
      console.log(`    ${String(hits).padStart(4)}  ${file}`);
    }
  }
  console.log("");
  console.log("数字间距类按前缀（决定迁移顺序）:");
  for (const [k, v] of Object.entries(report.by_prefix.numeric).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(10)} ${v}`);
  }
  console.log("");
  console.log("数字间距类 Top 文件:");
  for (const { file, hits } of report.top_numeric_files.slice(0, 12)) {
    console.log(`  ${String(hits).padStart(4)}  ${file}`);
  }
}

if (asAdopt) {
  // 只允许收紧：任何键想变大都会被拒绝
  const next = {
    numeric_spacing_uses: report.numeric_spacing_uses,
    laundering_classes: report.laundering_classes,
    non_migratable_zero_uses: report.non_migratable_zero_uses,
    total: report.total,
    generated_at: report.generated_at,
    note: "只允许收紧。任何数值上升都会让 --adopt 失败。",
  };
  if (fs.existsSync(BASELINE)) {
    const base = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
    // 门禁键（拒绝加宽）：numeric 与 laundering。
    // total 是观测值，允许随语义迁移上升（见上方 total 守则注释）。
    // 首次登记授权**记录在基线文件里**（reference.first_adoption），不是脚本常量里。
    // 这样「授权」是一次性的、有时间和理由的持久痕迹，删键无法重新获得授权。
    const granted = new Set(
      (base.reference && base.reference.first_adoption ? base.reference.first_adoption : []).map(
        (e) => e && e.key,
      ),
    );
    for (const key of ["numeric_spacing_uses", "laundering_classes"]) {
      const prev = typeof base[key] === "number" ? base[key] : 0;
      if (next[key] > prev) {
        // **新指标首采**与「放宽既有承诺」都走到这里，两者必须区分开。
        //
        // ⚠️ 曾经写成 `if (!(key in base)) continue;` —— 那是**安全漏洞**：
        // 任何键只要从基线里删掉，就重新获得一次「无限放宽」通道。
        // 实测攻击：删掉 laundering_classes 键 → 注入 1500 处洗白 → --adopt → exit 0，
        // 基线被静默改写成攻击值。这正好把 G2 想堵的门重新打开。
        // 改成脚本内白名单也不行——键本来就在白名单里，删了照样放行。
        //
        // 正确做法：授权必须**已持久记录在基线里**（reference.first_adoption），
        // 且该键当前在基线中确实不存在。删键不会重新获得授权，因为授权记录本身
        // 在 reference 里、不在被删的键上。
        const isFirstAdopt = !(key in base) && granted.has(key);
        if (isFirstAdopt) {
          console.log(
            `[ui-spacing] first adoption of new metric ${key}: ${next[key]} (authorized in reference.first_adoption)`,
          );
          continue;
        }
        console.error(
          `[ui-spacing] refusing to widen ${key}: ${next[key]} > ${prev} (baseline only ratchets down)`,
        );
        if (!(key in base) && !granted.has(key)) {
          console.error(
            `[ui-spacing] 该键在基线中不存在。若这确实是**新指标首次登记**，须先在基线的\n` +
              `             reference.first_adoption 中登记 {key, recorded_at, reason} 再 --adopt。\n` +
              `             禁止隐式放宽：仅删键不会获得授权。`,
          );
        }
        process.exit(1);
      }
    }
  }
  // ⚠️ 必须**保留** baseline 里 next 未覆盖的字段（尤其 reference）。
  //
  // 曾经直接 `writeFileSync(BASELINE, JSON.stringify(next))` —— next 只含 6 个数值字段，
  // 整文件覆写会把 reference 整个抹掉。后果是**授权自毁**：
  // 首采 adopt 成功 → reference.first_adoption 被删 → 该键若再次缺失，
  // 授权已不存在，永久无法再合法首采（且看不出原因）。
  // 实测：adopt 前 first_adoption 1 条，adopt 后 reference = undefined。
  // 这与「授权是一次性**持久**痕迹」的设计目标直接矛盾。
  const merged = { ...(fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, "utf8")) : {}), ...next };
  fs.writeFileSync(BASELINE, JSON.stringify(merged, null, 2) + "\n");
  console.log(`[ui-spacing] baseline adopted: numeric=${next.numeric_spacing_uses} total=${next.total}`);
}
