#!/usr/bin/env node
/**
 * 死类守卫（layout/helper 类）
 *
 * 背景：`ui:alpha:dead-classes` 只检查**颜色类**（findDeadColorClasses），
 * 因此 `src/styles/index.css` 里的布局/助手类（.ws-grid-cards、.ws-stack、
 * .module-card …）即便全站 0 引用也不会被发现。2026-08-06 的
 * `docs/docker/archive/2026-08-06-multi-agent-diagnosis-report.md` 已点名过这批
 * 「死定义」，但两个月无人处理，因为**没有门禁看着它们**。
 *
 * 本脚本补上这个盲区：扫描 index.css 中定义的每个 class，若在「会加载该文件的
 * 代码」中 0 引用，即报错退出。
 *
 * 用法：
 *   node scripts/dead-layout-classes.mjs            # 报告
 *   node scripts/dead-layout-classes.mjs --ci       # 有死类即 exit 1
 *
 * 重要的边界（踩过的坑）：
 *  - `frontend/ai-partner/` 是**独立子应用**，自带 leaderboard/selection/style.css，
 *    不加载 index.css。它有同名 `.module-arrow`，属**巧合同名**，必须排除，
 *    否则会误报。
 *  - 必须以「整词」匹配，否则 `.module-card` 会命中 CSS 变量
 *    `--ws-module-card-min-height`。
 *  - 注释行与 CSS 变量声明不算引用。
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(HERE, "..");
const SRC = path.join(FRONTEND, "src");
const INDEX_CSS = path.join(SRC, "styles", "index.css");

// 会加载 index.css 的代码范围；ai-partner 是独立子应用，明确排除
const SCAN_ROOTS = [SRC, path.join(FRONTEND, "public"), path.join(FRONTEND, "index.html")];
const EXCLUDED_DIRS = /^(node_modules|build|dist|ai-partner|coverage|\.git)$/;
const SCAN_EXT = /\.(tsx?|jsx?|mjs|cjs|html?|css|scss)$/;

const ci = process.argv.includes("--ci");

function collect(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (EXCLUDED_DIRS.test(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collect(p, out);
    else if (SCAN_EXT.test(e.name)) out.push(p);
  }
  return out;
}

function scanFiles() {
  const out = [];
  for (const root of SCAN_ROOTS) {
    if (!fs.existsSync(root)) continue;
    if (fs.statSync(root).isDirectory()) collect(root, out);
    else out.push(root);
  }
  return out.filter((f) => f !== INDEX_CSS && !/\.backup$/.test(f));
}

// index.css 中定义的顶层 class 名（只取「单独成段」的选择器行，忽略伪类后缀）
function definedClasses(css) {
  const names = new Set();
  for (const m of css.matchAll(/^\s*\.([a-z][a-z0-9-]*)/gm)) names.add(m[1]);
  return [...names].sort();
}

function main() {
  if (!fs.existsSync(INDEX_CSS)) {
    console.error("[dead-layout] 找不到 " + path.relative(FRONTEND, INDEX_CSS));
    process.exit(2);
  }
  const css = fs.readFileSync(INDEX_CSS, "utf8");
  const classes = definedClasses(css);
  const files = scanFiles();
  const texts = files.map((f) => ({ f, t: fs.readFileSync(f, "utf8") }));

  const dead = [];
  for (const cls of classes) {
    const word = new RegExp("(?<![a-zA-Z0-9_-])" + cls.replace(/-/g, "\\-") + "(?![a-zA-Z0-9_-])");
    const varForm = new RegExp("--" + cls.replace(/-/g, "\\-"));
    let hits = 0;
    for (const { t } of texts) {
      for (const line of t.split("\n")) {
        if (!word.test(line)) continue;
        if (varForm.test(line)) continue;                       // CSS 变量，不是类引用
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;        // 注释
        hits++;
      }
    }
    if (hits === 0) dead.push(cls);
  }

  console.log("[dead-layout] index.css 定义 class: " + classes.length);
  console.log("[dead-layout] 扫描文件: " + files.length + "（排除 ai-partner / build）");
  console.log("[dead-layout] 0 引用的类: " + dead.length);
  if (dead.length) {
    for (const d of dead) console.log("[dead-layout]   ." + d);
    if (ci) {
      console.error("[dead-layout] 死类即失败（--ci）。请删除定义，或在代码中实际使用它们。");
      process.exit(1);
    }
  }
  process.exit(0);
}

main();