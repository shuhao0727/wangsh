#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const cwd = process.cwd();
const repoRoot = path.resolve(cwd, "..");
const reportsDir = path.join(repoRoot, "plans", "ui-page-reports");

const argv = process.argv.slice(2);

const getArgValue = (flag, fallback = "") => {
  const idx = argv.indexOf(flag);
  if (idx === -1) return fallback;
  const val = argv[idx + 1];
  return val && !val.startsWith("--") ? val : fallback;
};

const hasFlag = (flag) => argv.includes(flag);
const route = getArgValue("--route", "");
const pageNameArg = getArgValue("--page", "");
const outputPathArg = getArgValue("--out", "");
const withTypeCheck = hasFlag("--with-type-check");

if (!route) {
  console.error("[ui-page-workflow] missing --route, example: --route /ai-agents");
  process.exit(2);
}

const toSlug = (r) => r.replace(/^\//, "").replace(/[^\w/-]+/g, "").replace(/\//g, "-") || "root";
const slug = toSlug(route);
const today = new Date().toISOString().slice(0, 10);
const pageName = pageNameArg || route;

function runAudit() {
  const raw = execSync("node scripts/ui-audit.mjs --json", {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  return JSON.parse(raw);
}

function runTypeCheck() {
  try {
    execSync("npm run -s type-check", {
      cwd,
      stdio: "pipe",
      encoding: "utf8",
    });
    return { passed: true, detail: "passed" };
  } catch (error) {
    const stderr = String(error?.stderr || "").trim();
    const stdout = String(error?.stdout || "").trim();
    const detail = stderr || stdout || "failed";
    return { passed: false, detail };
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function buildMarkdown({ audit, typeCheck }) {
  const routeHits = audit?.by_route?.[route] || 0;
  const routeFiles = audit?.by_route_files?.[route] || 0;
  const routeTopFiles = audit?.by_route_top_files?.[route] || [];

  const topFilesText =
    routeTopFiles.length > 0
      ? routeTopFiles.slice(0, 10).map((it, idx) => `${idx + 1}. \`${it.file}\` (${it.hits})`).join("\n")
      : "1. （暂无命中）";

  const typeCheckText = typeCheck
    ? typeCheck.passed
      ? "✅ 通过"
      : "❌ 失败（见下方备注）"
    : "未执行（本次仅生成体检模板）";

  return `# UI 单页体检报告 - ${pageName}

更新时间：${today}  
目标路由：\`${route}\`

## 1) 页面体检表（统一模板）

- [ ] 信息层级：标题/正文/辅助文字在同一字号体系
- [ ] 布局比例：头部/侧栏/主区/输入区比例协调
- [ ] 间距节奏：组件内外间距使用统一档位（S/M/L）
- [ ] 视觉噪声：阴影/圆角/浮层/色块不过量
- [ ] 响应式一致性：1366/1536/1920/375 显示稳定

## 2) 问题分级（P0-P3）

- P0（比例失衡）：
- P1（字号体系冲突）：
- P2（间距密度不一致）：
- P3（细节噪声）：

## 3) 规则映射（违反项 -> 规则）

- 违反项 A -> 规则：
- 违反项 B -> 规则：
- 违反项 C -> 规则：

## 4) 本页改动边界（单页最小改动）

- 只改：
- 不改：

## 5) 本页专项验收

### 自动检查
- \`npm run type-check\`：${typeCheckText}
- \`ui-audit\` 路由命中：**${routeHits}**
- \`ui-audit\` 命中文件数：**${routeFiles}**

### 路由热点文件（Top 10）
${topFilesText}

### 视觉回归（人工）
- [ ] 1366×768
- [ ] 1536×864
- [ ] 1920×1080
- [ ] 375×812

### 交互回归（人工）
- [ ] 本页核心链路 1
- [ ] 本页核心链路 2
- [ ] 本页核心链路 3

## 6) 规则符合度评分（0-100）

- 导航/正文字号一致性：
- 骨架比例协调性：
- 间距节奏一致性：
- 组件外观统一性：
- 响应式一致性：
- 总分：

${typeCheck && !typeCheck.passed ? `\n## 备注（type-check 错误摘要）\n\n\`\`\`\n${typeCheck.detail.slice(0, 4000)}\n\`\`\`\n` : ""}
`;
}

try {
  const audit = runAudit();
  const typeCheck = withTypeCheck ? runTypeCheck() : null;
  const markdown = buildMarkdown({ audit, typeCheck });

  ensureDir(reportsDir);
  const defaultOut = path.join(reportsDir, `${slug}.md`);
  const finalOut = outputPathArg ? path.resolve(cwd, outputPathArg) : defaultOut;
  fs.writeFileSync(finalOut, markdown, "utf8");

  console.log("[ui-page-workflow] report generated:");
  console.log(finalOut);
  console.log(`[ui-page-workflow] route_hits=${audit?.by_route?.[route] || 0}`);
  if (withTypeCheck) {
    console.log(`[ui-page-workflow] type-check=${typeCheck?.passed ? "passed" : "failed"}`);
  }
} catch (error) {
  console.error("[ui-page-workflow] failed:", error?.message || error);
  process.exit(1);
}
