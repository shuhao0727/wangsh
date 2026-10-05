#!/usr/bin/env node
/**
 * 单页 UI 体检报告生成器（G3 重写）
 *
 * 为什么重写（计划 §5.3 / G3）：
 *   旧版本被计划点名为「报告可以手写」的直接工具，三个结构性问题：
 *     1. 产出空白「规则符合度评分（0-100）」模板 + 一堆 `- [ ]` 手写复选框 —— 报告永远是空壳，
 *        评分栏没人填、复选框没人勾，却看起来像一份正式验收记录。
 *     2. 输出到 `test-results/ui-page-reports/`，而该路径被 .gitignore:174,241 忽略
 *        → **报告永不入库、永不被复核**。
 *     3. 没有 generated_at / evidence_level，无法判断证据强度，也无法防日期造假。
 *
 * 新契约（必须通过 `node scripts/ui-verify-gate.mjs <report>`，即计划 §5.2 六条硬规则）：
 *   - generated_at 取**系统时钟**；拒绝 `--date` 覆写（规则5 防造假）
 *   - evidence_level 只报脚本**真正采集到**的级别；本脚本无浏览器采集能力，
 *     故恒为 L0/L1/L2（规则 3：浏览器不可用 → 不得存在「仅静态审查→通过」路径）
 *   - 每条结论行附 evidence_ref（规则1）
 *   - counts.scanned_hits 与 counts.human_confirmed **分开**（规则6）
 *   - 人工判断只能进 manual_notes 且逐条标 manual:true（规则4）
 *   - 正文不得出现空白评分模板（规则4）
 *
 * 用法：
 *   node scripts/ui-page-workflow.mjs --route /ai-agents [--page 名称] [--out 路径] [--with-type-check]
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");
const FE = path.resolve(HERE, "..");
// G3 关键修复：输出到**受版本管理**的目录。
// 旧值 frontend/test-results/ui-page-reports 被 .gitignore:174 忽略 → 报告永不入库。
const reportsDir = path.join(REPO_ROOT, "docs", "docker", "testing", "ui-page-reports");

// ── 参数解析必须在 main() 内：本模块要能被单测 import，
//    不能在 import 期就读 process.argv / process.exit。
const getArgValue = (flag, fallback = "", argv = process.argv.slice(2)) => {
  const idx = argv.indexOf(flag);
  if (idx === -1) return fallback;
  const val = argv[idx + 1];
  return val && !val.startsWith("--") ? val : fallback;
};

// ── 规则5：generated_at 必须是系统时钟。任何 --date/--generated-at 覆写一律拒绝。
//    这是 ui-verify-gate 规则5（防日期造假）在生成器侧的对应约束。
const FORGED_DATE_FLAGS = ["--date", "--generated-at", "--generated_at"];

/** 校验 CLI 参数；不合法时返回 { error }，由 main() 决定退出码。 */
export function validateArgs(argv) {
  const forged = FORGED_DATE_FLAGS.find((f) => argv.includes(f));
  if (forged) {
    return {
      error:
        `[ui-page-workflow] 拒绝 ${forged}：generated_at 必须取自系统时钟，` +
        "不得覆写（计划 §5.2 规则5 防日期造假）。",
      code: 2,
    };
  }
  if (!getArgValue("--route", "", argv)) {
    return { error: "[ui-page-workflow] missing --route, example: --route /ai-agents", code: 2 };
  }
  return { code: 0 };
}

// 仅在被直接执行时运行（便于单测 import 而不触发副作用）
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
const _argError = validateArgs(process.argv.slice(2));
if (invokedDirectly && _argError.error) {
  console.error(_argError.error);
  process.exit(_argError.code);
}

const toSlug = (r) =>
  r.replace(/^\//, "").replace(/[^\w/-]+/g, "").replace(/\//g, "-") || "root";

/** 供单测注入替身，避免真的跑 ui-audit/type-check */
const auditRunner = globalThis.__UI_PAGE_WORKFLOW_AUDIT__;
const typeCheckRunner = globalThis.__UI_PAGE_WORKFLOW_TYPECHECK__;

function runAudit() {
  if (typeof auditRunner === "function") return auditRunner();
  const raw = execSync("node scripts/ui-audit.mjs --json", {
    cwd: FE,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  return JSON.parse(raw);
}

function runTypeCheck() {
  if (typeof typeCheckRunner === "function") return typeCheckRunner();
  try {
    execSync("npm run -s type-check", { cwd: FE, stdio: "pipe", encoding: "utf8" });
    return { passed: true, detail: "passed" };
  } catch (error) {
    const stderr = String(error?.stderr || "").trim();
    const stdout = String(error?.stdout || "").trim();
    return { passed: false, detail: stderr || stdout || "failed" };
  }
}

/**
 * 证据级别 —— 由**实际采集到的证据**决定，不由调用者声明。
 * 本脚本只能做到静态扫描（L0）与可选的本机命令（L1）；它没有浏览器，
 * 因此**永远不会**产出 L3/L4。规则3 要求：浏览器不可用就必须显式声明，
 * 且不得给出「仅静态审查 → 通过」的结论。
 */
function resolveEvidenceLevel({ typeCheck }) {
  if (typeCheck) return "L1"; // 真跑了 type-check = 编译级证据
  return "L0"; // 仅静态扫描
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function buildMarkdown({ audit, typeCheck, route: r, pageName: name, generatedAt: ts }) {
  const routeHits = audit?.by_route?.[r] || 0;
  const routeFiles = audit?.by_route_files?.[r] || 0;
  const routeTopFiles = audit?.by_route_top_files?.[r] || [];
  const evidenceLevel = resolveEvidenceLevel({ typeCheck });

  // scanned_hits 是**机器扫描**得到的命中数；human_confirmed 必须由人另行填写。
  // 规则6 要求两者分开——旧版把二者混为「报告结论」，无法区分机器与人。
  const scannedHits = routeHits;

  const topFilesText =
    routeTopFiles.length > 0
      ? routeTopFiles
          .slice(0, 10)
          .map((it, idx) => `${idx + 1}. \`${it.file}\` (${it.hits})`)
          .join("\n")
      : "（暂无命中）";

  const evidenceRef = `ui-audit:by_route:${r}`;
  const typeCheckEvidenceRef = "npm:type-check";

  // 结论只允许由**机器证据**推导。没有浏览器 → 不能声明视觉/交互通过。
  const conclusions = [];
  conclusions.push(
    `- **PASS**（静态口径）\`ui-audit\` 扫描完成，路由命中 ${scannedHits} 处。evidence_ref: ${evidenceRef}`,
  );
  if (typeCheck) {
    conclusions.push(
      typeCheck.passed
        ? `- **PASS** \`npm run type-check\` exit 0。evidence_ref: ${typeCheckEvidenceRef}`
        : `- **FAIL** \`npm run type-check\` 非 0 退出，详见下方错误摘要。evidence_ref: ${typeCheckEvidenceRef}`,
    );
  }
  // 规则3：必须显式声明浏览器证据缺失，且结论形态为 BLOCKED(no_browser)。
  conclusions.push(
    "- **BLOCKED(no_browser)** 本脚本无浏览器采集能力，**视觉/交互/无障碍结论一律不作数**；" +
      "须由 L3/L4 报告另行验证。evidence_ref: ui-verify-gate:rule3",
  );

  return [
    `# UI 单页体检报告 - ${name}`,
    "",
    // 生命周期元数据：docs/docker/testing/ 是**受治理目录**，
    // check-markdown-contracts.mjs 要求该目录下的文档声明 `状态` 与 `Owner`，
    // 缺失即报 "missing lifecycle status" / "missing owner"。
    "> 状态：active",
    "> Owner：testing",
    "",
    `generated_at: ${ts}`,
    `evidence_level: ${evidenceLevel}`,
    `route: \`${r}\``,
    "",
    "> 本报告由 `scripts/ui-page-workflow.mjs` 自动生成（G3 重写）。",
    "> `generated_at` 取自系统时钟，不接受覆写；`evidence_level` 由脚本实际采集到的证据决定。",
    "> **本报告不包含浏览器证据**，任何视觉/交互/无障碍结论都必须由 L3/L4 报告补充。",
    "",
    "## 结论",
    "",
    ...conclusions,
    "",
    "## counts",
    "",
    "```json",
    JSON.stringify(
      {
        counts: {
          // 规则6：机器扫描与实际人工确认必须分开，不得混为一个数
          scanned_hits: scannedHits,
          scanned_files: routeFiles,
          // 人工确认数由复核者填写；生成器不臆造，恒为 0
          human_confirmed: 0,
        },
      },
      null,
      2,
    ),
    "```",
    "",
    "`scanned_hits` 为 `ui-audit` 机器扫描命中数；`human_confirmed` 需由复核者逐条确认后填写，",
    "两者口径不同、不可互相替代（`ui-verify-gate` 规则6）。",
    "",
    "### 路由热点文件（Top 10，机器扫描）",
    "",
    topFilesText,
    "",
    "## manual_notes",
    "",
    "人工判断一律写在此处，且逐条标注 `manual:true`。**未标注的条目视为未经确认**，",
    "不得作为验收依据（`ui-verify-gate` 规则4）。",
    "",
    "```json",
    JSON.stringify({ manual_notes: [] }, null, 2),
    "```",
    "",
    "填写示例（人工复核后追加）：",
    "",
    "```json",
    JSON.stringify(
      {
        manual_notes: [
          {
            manual: true,
            note: "1366×768 下头部留白偏紧",
            by: "复核者",
            at: "<ISO 时间>",
          },
        ],
      },
      null,
      2,
    ),
    "```",
    "",
    "## 自动检查明细",
    "",
    `- \`ui-audit\` 路由命中：**${routeHits}**　evidence_ref: ${evidenceRef}`,
    `- \`ui-audit\` 命中文件数：**${routeFiles}**　evidence_ref: ${evidenceRef}`,
    typeCheck
      ? `- \`npm run type-check\`：${typeCheck.passed ? "**PASS**" : "**FAIL**"}　evidence_ref: ${typeCheckEvidenceRef}`
      : "- `npm run type-check`：**未执行**（如需请加 `--with-type-check`），本项无证据，不构成结论。",
    "",
    typeCheck && !typeCheck.passed
      ? `## 备注（type-check 错误摘要）\n\n\`\`\`\n${typeCheck.detail.slice(0, 4000)}\n\`\`\`\n`
      : "",
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");
}

function main() {
  const argv = process.argv.slice(2);
  const route = getArgValue("--route", "", argv);
  const pageNameArg = getArgValue("--page", "", argv);
  const outputPathArg = getArgValue("--out", "", argv);
  const withTypeCheck = argv.includes("--with-type-check");
  const slug = toSlug(route);
  const pageName = pageNameArg || route;
  // 系统时钟，唯一来源（--date 覆写已在 validateArgs 中拒绝）。
  const generatedAt = new Date().toISOString();

  const audit = runAudit();
  const typeCheck = withTypeCheck ? runTypeCheck() : null;
  const markdown = buildMarkdown({
    audit,
    typeCheck,
    route,
    pageName,
    generatedAt,
  });

  ensureDir(reportsDir);
  const defaultOut = path.join(reportsDir, `${slug}.md`);
  const finalOut = outputPathArg ? path.resolve(FE, outputPathArg) : defaultOut;
  ensureDir(path.dirname(finalOut));
  fs.writeFileSync(finalOut, markdown, "utf8");

  console.log("[ui-page-workflow] report generated:");
  console.log(finalOut);
  console.log(`[ui-page-workflow] route_hits=${audit?.by_route?.[route] || 0}`);
  console.log(`[ui-page-workflow] evidence_level=${resolveEvidenceLevel({ typeCheck })}`);
  if (withTypeCheck) {
    console.log(`[ui-page-workflow] type-check=${typeCheck?.passed ? "passed" : "failed"}`);
  }
  return 0;
}

if (invokedDirectly) {
  try {
    process.exit(main());
  } catch (error) {
    console.error("[ui-page-workflow] failed:", error?.message || error);
    process.exit(1);
  }
}
