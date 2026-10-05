#!/usr/bin/env node
/**
 * B13 — UI 报告合法性校验器（只校验报告，不采集证据）
 *
 * 存在理由：计划 §5.2 的硬规则防的是「**没有浏览器却声称通过**」。
 * 仅仅重写报告生成器（G3）不够——生成器可以产出合法报告，人也可以手写一份假的。
 * 本脚本是那份「合法报告」的**可执行契约**。
 *
 * 校验的 6 条（对应计划 §5.2 的 6 条硬规则）：
 *   1. 结论行必须附 evidence_ref，缺失即非法
 *   2. L3/L4 必须内联 browser_engine/version/viewport/screenshot_sha256/assertion_count/ran_at
 *   3. 浏览器不可用 → 结论只能是 BLOCKED(no_browser)；不得存在「仅静态审查→通过」路径
 *   4. 正文不得手写评分；人工判断须在 manual_notes 且标 manual:true
 *   5. generated_at 须与文件 mtime 相当（防日期造假）
 *   6. counts.scanned_hits 与 counts.human_confirmed 必须分开
 *
 * 用法：
 *   node scripts/ui-verify-gate.mjs <report.md> [--ci] [--json]
 *   node scripts/ui-verify-gate.mjs --all --ci     # 校验 docs/docker/testing 下全部报告
 *
 * 退出码：0 合法；1 非法（--ci 与世界一致）；2 用法错误。
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FE = path.resolve(HERE, "..");
const REPORT_DIRS = [path.join(FE, "..", "docs", "docker", "testing")];

const VALID_LEVELS = new Set(["L0", "L1", "L2", "L3", "L4"]);
const BROWSER_FIELDS = ["browser_engine", "browser_version", "viewport", "screenshot_sha256", "assertion_count", "ran_at"];
const MTIME_TOLERANCE_MS = 24 * 60 * 60 * 1000; // generated_at 与文件 mtime 相差不得超过 24h

/** 从正文里取 `key: value` 或 `key = value` 形式的字段（大小写不敏感） */
function field(text, key) {
  const re = new RegExp("^[\\s>*|-]*" + key + "\\s*[:=]\\s*(.+)$", "im");
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

function parseJsonBlock(text) {
  const m = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function verify(file) {
  const errors = [];
  const warnings = [];
  let text;
  try { text = fs.readFileSync(file, "utf8"); } catch (e) { return { file, errors: ["无法读取: " + e.message], warnings: [] }; }

  // ── 规则 5：generated_at（系统时钟，拒绝 --date 覆写）
  const ga = field(text, "generated_at");
  if (!ga) {
    errors.push("规则5 缺 generated_at");
  } else {
    const ts = Date.parse(ga);
    if (Number.isNaN(ts)) errors.push("规则5 generated_at 不可解析: " + ga);
    else {
      const mtime = fs.statSync(file).mtimeMs;
      if (Math.abs(mtime - ts) > MTIME_TOLERANCE_MS) {
        errors.push("规则5 generated_at(" + ga + ") 与文件 mtime 相差超过 24h —— 疑似日期造假");
      }
    }
  }

  // ── evidence_level
  const lvl = (field(text, "evidence_level") || "").toUpperCase();
  if (!lvl) errors.push("缺 evidence_level（应为 L0–L4）");
  else if (!VALID_LEVELS.has(lvl)) errors.push("evidence_level 非法: " + lvl);

  // ── 规则 2：L3/L4 必须内联 6 个浏览器字段
  if (lvl === "L3" || lvl === "L4") {
    for (const f of BROWSER_FIELDS) {
      if (!field(text, f)) errors.push("规则2 " + lvl + " 报告缺浏览器字段: " + f);
    }
  }

  // ── 规则 3：浏览器不可用 → 只能 BLOCKED(no_browser)
  const mentionsNoBrowser = /浏览器不可用|no_browser|无浏览器|browser\s+unavailable/i.test(text);
  if (mentionsNoBrowser && !/BLOCKED\s*\(\s*no_browser\s*\)/i.test(text)) {
    errors.push("规则3 提到浏览器不可用，但结论不是 BLOCKED(no_browser)");
  }
  // 禁「仅静态审查 → 通过」路径
  if (/仅静态审查[^\n]{0,40}(通过|PASS)/i.test(text) || /static[- ]only[^\n]{0,40}(pass|通过)/i.test(text)) {
    errors.push("规则3 存在「仅静态审查→通过」路径（计划明令禁止）");
  }

  // ── 规则 4：不得手写评分模板；manual 判断须 manual:true
  if (/规则符合度评分[^\n]*[:：]\s*$/m.test(text)) {
    errors.push("规则4 残留空白「规则符合度评分」模板");
  }
  const manualSec = text.match(/manual_notes[\s\S]{0,400}?(?=\n##|\n#|$)/i);
  if (manualSec && /manual\s*[:=]\s*false/i.test(manualSec[0]) && /-\s*\S/.test(manualSec[0])) {
    warnings.push("规则4 manual_notes 有条目但标了 manual:false，请确认");
  }

  // ── 规则 1：结论行须附 evidence_ref
  //   结论行 = 含 PASS/FAIL/BLOCKED 的行；须在同一行或紧邻 2 行内出现 evidence_ref
  const lines = text.split("\n");
  let conclusionCount = 0;
  lines.forEach((ln, i) => {
    if (!/\b(PASS|FAIL|BLOCKED)\b/.test(ln)) return;
    if (/^\s*(#|>|\|\s*-)/.test(ln) && !/\b(PASS|FAIL|BLOCKED)\b/.test(ln.replace(/^[#>|\s-]+/, ""))) return;
    conclusionCount++;
    const window = lines.slice(Math.max(0, i - 2), i + 3).join("\n");
    if (!/evidence_ref/i.test(window)) errors.push("规则1 第 " + (i + 1) + " 行结论缺 evidence_ref: " + ln.trim().slice(0, 60));
  });
  if (conclusionCount === 0) warnings.push("正文未发现 PASS/FAIL/BLOCKED 结论行");

  // ── 规则 6：counts.scanned_hits 与 human_confirmed 分开
  const json = parseJsonBlock(text);
  if (json && json.counts) {
    if (!("scanned_hits" in json.counts)) errors.push("规则6 counts 缺 scanned_hits");
    if (!("human_confirmed" in json.counts)) errors.push("规则6 counts 缺 human_confirmed");
  } else {
    const sh = field(text, "scanned_hits");
    const hc = field(text, "human_confirmed");
    if (!sh || !hc) errors.push("规则6 缺 counts{scanned_hits, human_confirmed}（两者必须分开）");
  }

  return { file, level: lvl || "?", conclusions: conclusionCount, errors, warnings };
}

function collectReports(args) {
  const given = args.filter((a) => !a.startsWith("--"));
  if (given.length) return given;
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) {
        // 报告可能放在子目录（如 ui-page-reports/），必须递归。
        if (!/^(node_modules|\.git)$/.test(e.name)) walk(path.join(d, e.name));
        continue;
      }
      // 只认「报告」：说明文档与**长期状态台账**不是单次验证报告，跳过（否则 --all 恒红）。
      //
      // 排除依据（不是图省事，是类别判断）——计划 §5.2 约束的是「一次验证的结论」，
      // 要求一份持续累积的台账满足它既不合理也无意义：
      //   · README/INDEX/TEMPLATE/CHANGELOG：说明与模板，本就不是结论。
      //   · TEST_STATUS.md：docs/docker/testing/README.md 明确定义它为「当前唯一测试状态、
      //     功能矩阵、证据和重跑入口」的汇总台账（1805 行、Owner: testing、持续更新），
      //     它**引用**各次报告，本身不是一份报告。
      // 真正需要守的是 ui-page-reports/ 下由生成器产出的单次报告。
      if (!e.isFile() || !/\.md$/.test(e.name)) continue;
      if (/^(README|INDEX|TEMPLATE|CHANGELOG|TEST_STATUS)\.md$/i.test(e.name)) continue;
      out.push(path.join(d, e.name));
    }
  };
  for (const d of REPORT_DIRS) {
    if (fs.existsSync(d)) walk(d);
  }
  return out;
}

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const all = args.includes("--all");
const reports = collectReports(args.filter((a) => a !== "--ci" && a !== "--json" && a !== "--all"));

if (!reports.length) {
  console.log("[ui-verify] 未找到报告文件。");
  if (all) { console.log("[ui-verify] 目录: " + REPORT_DIRS.join(", ")); }
  console.log("[ui-verify] 用法: node scripts/ui-verify-gate.mjs <report.md> [--ci] [--json]");
  process.exit(0);
}

const results = reports.map(verify);
const totalErrors = results.reduce((n, r) => n + r.errors.length, 0);
const totalWarnings = results.reduce((n, r) => n + r.warnings.length, 0);

if (asJson) {
  console.log(JSON.stringify({ results, total_errors: totalErrors }, null, 1));
} else {
  console.log("[ui-verify] 校验 " + results.length + " 份报告（计划 §5.2 六条硬规则）");
  for (const r of results) {
    const tag = r.errors.length ? "非法" : "合法";
    console.log("  [" + tag + "] " + path.relative(process.cwd(), r.file) + "  level=" + r.level);
    r.errors.forEach((e) => console.log("      ✗ " + e));
    r.warnings.forEach((w) => console.log("      ⚠ " + w));
  }
  console.log("[ui-verify] 错误 " + totalErrors + "，警告 " + totalWarnings);

  // ── 覆盖度观测（**不参与退出码**）────────────────────────────────────────
  //
  // 本门禁守的是「已存在的报告是否合法」，但**发现不了「该有报告却没有」**——
  // 若某路由没人跑生成器，它就不会有报告，门禁也照绿。这与 G3 原本写进
  // .gitignore 的病根同源：机制上「通过」，实际什么都没守住。
  //
  // 因此这里额外报告「路由清单 ↔ 报告文件」的差集。
  // ⚠️ 刻意**只观测不阻断**：路由清单（ui-visual-routes.json，12 条）比报告
  // 覆盖面（36 份）窄得多，两者口径尚未对齐，直接设成硬门禁会把 CI 弄红。
  // 待两边口径统一后，再考虑升级为 gating 检查。
  if (all) {
    const routesFile = path.join(import.meta.dirname, "ui-visual-routes.json");
    if (fs.existsSync(routesFile)) {
      const raw = JSON.parse(fs.readFileSync(routesFile, "utf8"));
      const routes = Array.isArray(raw) ? raw : raw.routes || [];
      const covered = new Set(
        results.map((r) => path.basename(r.file).replace(/\.md$/, "")),
      );
      const slug = (r) => r.replace(/^\//, "").replace(/\//g, "-") || "home";
      const missing = routes.filter((r) => !covered.has(slug(r)) && !covered.has(slug(r) + "-index"));
      console.log(
        `[ui-verify] 覆盖度：路由清单 ${routes.length} 条，报告 ${results.length} 份，` +
          `清单中缺报告 ${missing.length} 条` +
          (missing.length ? `（${missing.join(", ")}）` : ""),
      );
    }
  }
}

process.exit(totalErrors > 0 ? 1 : 0);