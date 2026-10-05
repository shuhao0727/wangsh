#!/usr/bin/env node
/**
 * UI 迁移指标 + 门禁（G7 脚本改造，2026-10-05）
 *
 * 背景：本脚本原为「只打印指标」的裸脚本 —— 无 --ci、无 baseline、无 --adopt，
 * 且 ui:migration:gate 这个 npm 入口**零调用者**（CI 不引用、文档不引用），
 * 实际是个死入口。计划 §5.3 要求把它改造成真正的门禁。
 *
 * 改造后语义与项目其他门禁（ui:spacing / ui:token-values / ui:alpha）一致：
 *   · 基线是**双向等值 ratchet**：上升=回归（红），下降=基线陈旧（也红，须 --adopt）
 *   · --ci     按基线比对，双向不符即 exit 1
 *   · --adopt  采纳实测值；**拒绝放宽**（只降不升）
 *   · --json   输出机器可读结果
 *
 * 指标取舍（不是照搬原字段）：
 *   · antd_import_files / ant_design_icons_import_files 恒为 0 —— antd 迁移早已
 *     完成、package.json 已无该依赖。保留为**哨兵**：一旦有人重新引入 antd，
 *     计数立刻 > 0 并触发红灯。
 *   · message_calls（antd 的 message.*）恒为 0，而 show_message_calls 有 501 ——
 *     这组是关键不变量：证明 Toast 已全量走项目约定的 showMessage。
 *     message_calls 若从 0 变正，说明有人绕过约定，必须拦。
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const srcDir = path.join(root, "src");
const BASELINE = process.env.UI_MIGRATION_BASELINE
  ? path.resolve(process.env.UI_MIGRATION_BASELINE)
  : path.join(import.meta.dirname, "ui-migration-baseline.json");
const asCi = process.argv.includes("--ci");
const asAdopt = process.argv.includes("--adopt");
const asJson = process.argv.includes("--json");

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name.startsWith(".")) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(ent.name)) out.push(full);
  }
  return out;
}

const files = walk(srcDir);

const metrics = {
  tsx_ts_files: files.length,
  antd_import_files: 0,
  ant_design_icons_import_files: 0,
  message_calls: 0,
  show_message_calls: 0,
};

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  if (/from\s*["']antd(?:["']|\/)/.test(text)) {
    metrics.antd_import_files += 1;
  }
  if (/from\s*["']@ant-design\/icons["']/.test(text)) {
    metrics.ant_design_icons_import_files += 1;
  }

  const messageCalls = text.match(/\bmessage\.(success|error|warning|info|loading|destroy)\(/g);
  if (messageCalls) metrics.message_calls += messageCalls.length;

  const showMessageCalls = text.match(/\bshowMessage\.(success|error|warning|info|loading|destroy)\(/g);
  if (showMessageCalls) metrics.show_message_calls += showMessageCalls.length;
}

const output = {
  generated_at: new Date().toISOString(),
  cwd: root,
  metrics,
};

// ---------------------------------------------------------------- 门禁
//
// 只对**有约定意义**的指标设门禁，不对纯观测指标设门禁：
//   · message_calls 必须恒为 0        —— 绕过 showMessage 约定即红灯
//   · antd_import_files 必须恒为 0     —— 谁敢把 antd 引回来即红灯
//   · ant_design_icons_import_files 同上
//   · show_message_calls 与 tsx_ts_files 是**观测值**（随代码量自然变化），
//     不设门禁，否则每次加页面都要 --adopt，门禁会变成噪音。
const GATED = ["message_calls", "antd_import_files", "ant_design_icons_import_files"];

if (asAdopt) {
  const next = { metrics: Object.fromEntries(GATED.map((k) => [k, metrics[k]])) };
  if (fs.existsSync(BASELINE)) {
    const base = JSON.parse(fs.readFileSync(BASELINE, "utf8")).metrics || {};
    for (const k of GATED) {
      const prev = typeof base[k] === "number" ? base[k] : 0;
      if (next.metrics[k] > prev) {
        console.error(
          `[ui-migration] refusing to widen ${k}: ${next.metrics[k]} > ${prev} (baseline only ratchets down)`,
        );
        process.exit(1);
      }
    }
  }
  const merged = {
    generated_at: output.generated_at,
    metrics: { ...(fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, "utf8")).metrics : {}), ...next.metrics },
    note: "只对 §约定的不变量设门禁（message_calls / antd 引入数）。只允许收紧。",
  };
  fs.writeFileSync(BASELINE, JSON.stringify(merged, null, 2) + "\n");
  console.log(`[ui-migration] baseline adopted: ${GATED.map((k) => k + "=" + metrics[k]).join(" ")}`);
  process.exit(0);
}

if (asCi) {
  if (!fs.existsSync(BASELINE)) {
    console.error(`[ui-migration] baseline missing: ${BASELINE}`);
    console.error("[ui-migration] run with --adopt after a deliberate migration to create it.");
    process.exit(1);
  }
  const base = JSON.parse(fs.readFileSync(BASELINE, "utf8")).metrics || {};
  let failed = 0;
  for (const k of GATED) {
    const prev = typeof base[k] === "number" ? base[k] : 0;
    const now = metrics[k];
    if (now > prev) {
      console.error(`  ${k} increased: ${now} > ${prev}`);
      failed += 1;
    } else if (now < prev) {
      console.error(`  ${k} decreased: ${now} < ${prev} (baseline stale, run --adopt)`);
      failed += 1;
    }
  }
  if (failed > 0) {
    console.error("[ui-migration] gate FAILED");
    process.exit(1);
  }
  console.log(`[ui-migration] gate OK (${GATED.map((k) => k + "=" + metrics[k]).join(" ")})`);
  process.exit(0);
}

if (asJson) {
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

console.log("UI Migration Metrics");
console.log("===================");
console.log(`generated_at: ${output.generated_at}`);
console.log(`ts/tsx files: ${metrics.tsx_ts_files}  (观测)`);
console.log(`antd import files: ${metrics.antd_import_files}  (门禁：须恒为 0)`);
console.log(`@ant-design/icons import files: ${metrics.ant_design_icons_import_files}  (门禁：须恒为 0)`);
console.log(`message.* calls: ${metrics.message_calls}  (门禁：须恒为 0)`);
console.log(`showMessage.* calls: ${metrics.show_message_calls}  (观测)`);
