import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { buildMarkdown } from "./ui-page-workflow.mjs";

const SCRIPT = path.join(import.meta.dirname, "ui-page-workflow.mjs");
const FE = path.resolve(import.meta.dirname, "..");
const GATE = path.join(import.meta.dirname, "ui-verify-gate.mjs");
const REPO = path.resolve(FE, "..");
const REPORT_DIR = path.join(REPO, "docs", "docker", "testing", "ui-page-reports");

/** 一份最小的合法 audit 替身，字段结构与 ui-audit.mjs --json 一致 */
const FAKE_AUDIT = {
  by_route: { "/ai-agents": 7 },
  by_route_files: { "/ai-agents": 3 },
  by_route_top_files: {
    "/ai-agents": [
      { file: "src/pages/AIAgents/index.tsx", hits: 5 },
      { file: "src/pages/AIAgents/ChatArea.tsx", hits: 2 },
    ],
  },
};

const build = (over = {}) =>
  buildMarkdown({
    audit: FAKE_AUDIT,
    typeCheck: null,
    route: "/ai-agents",
    pageName: "/ai-agents",
    generatedAt: new Date().toISOString(),
    ...over,
  });

/** 把 markdown 写进临时文件并跑 ui-verify-gate，返回 exit code */
function gateExit(markdown) {
  const dir = mkdtempSync(path.join(tmpdir(), "page-workflow-"));
  const f = path.join(dir, "report.md");
  try {
    writeFileSync(f, markdown);
    execFileSync("node", [GATE, f], { stdio: "ignore" });
    return 0;
  } catch (e) {
    return e.status ?? 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/* ───────── G3 核心：报告必须通过 B13 契约 ───────── */

test("L0 报告通过 ui-verify-gate（G3 首要验收）", () => {
  assert.equal(gateExit(build()), 0);
});

test("L1 报告（含 type-check）同样通过契约", () => {
  const md = build({ typeCheck: { passed: true, detail: "passed" } });
  assert.match(md, /evidence_level: L1/);
  assert.equal(gateExit(md), 0);
});

test("type-check 失败时报告仍合法，且结论为 FAIL", () => {
  const md = build({ typeCheck: { passed: false, detail: "error TS1234: boom" } });
  assert.match(md, /\*\*FAIL\*\*/);
  assert.match(md, /error TS1234/);
  assert.equal(gateExit(md), 0);
});

/* ───────── 规则4：不得残留空白评分模板 / 手写复选框 ───────── */

test("不再产出空白「规则符合度评分」模板（规则4 回归锚点）", () => {
  const md = build();
  assert.ok(!/规则符合度评分/.test(md), "旧版的空白评分模板必须消失");
  // 直接喂给契约校验器也必须合法
  assert.equal(gateExit(md), 0);
});

test("不再产出 `- [ ]` 手写复选框（旧版空壳来源）", () => {
  const md = build();
  assert.ok(!/-\s*\[\s*\]/.test(md), "手写复选框必须消失");
});

/* ───────── 规则6：counts 两个口径必须分开 ───────── */

test("counts 中 scanned_hits 与 human_confirmed 分开且均可解析（规则6）", () => {
  const md = build();
  const block = md.match(/```json\s*\n([\s\S]*?)\n```/);
  assert.ok(block, "应含 json 代码块");
  const parsed = JSON.parse(block[1]);
  assert.equal(parsed.counts.scanned_hits, 7);
  assert.equal(parsed.counts.human_confirmed, 0);
  assert.notEqual(parsed.counts.scanned_hits, parsed.counts.human_confirmed);
});

test("生成器不臆造 human_confirmed（机器扫描不等于人工确认）", () => {
  const md = build();
  const parsed = JSON.parse(md.match(/```json\s*\n([\s\S]*?)\n```/)[1]);
  assert.equal(parsed.counts.human_confirmed, 0, "人工确认数必须由人填写，生成器恒为 0");
  assert.ok(parsed.counts.scanned_hits > 0);
});

/* ───────── 规则3：必须显式声明无浏览器证据 ───────── */

test("报告显式给出 BLOCKED(no_browser)，不留「仅静态审查→通过」路径（规则3）", () => {
  const md = build();
  assert.match(md, /BLOCKED\(no_browser\)/);
  assert.equal(gateExit(md), 0);
});

test("evidence_level 由证据决定：无采集=L0，跑过 type-check=L1，永不为 L3/L4", () => {
  assert.match(build(), /evidence_level: L0/);
  assert.match(build({ typeCheck: { passed: true, detail: "ok" } }), /evidence_level: L1/);
  // 本脚本没有浏览器，断言结构上不可能升到 L3/L4
  assert.ok(!/evidence_level: L[34]/.test(build()));
  assert.ok(!/evidence_level: L[34]/.test(build({ typeCheck: { passed: true, detail: "ok" } })));
});

/* ───────── 规则1：结论行必须附 evidence_ref ───────── */

test("每条 PASS/FAIL/BLOCKED 结论都带 evidence_ref（规则1）", () => {
  const md = build({ typeCheck: { passed: true, detail: "ok" } });
  const lines = md.split("\n");
  const conclusions = lines.filter((l) => /\b(PASS|FAIL|BLOCKED)\b/.test(l));
  assert.ok(conclusions.length > 0, "应有结论行");
  for (const line of conclusions) {
    assert.match(line, /evidence_ref/i, "结论缺 evidence_ref: " + line.slice(0, 60));
  }
});

/* ───────── 规则5：generated_at 必须系统时钟 ───────── */

test("generated_at 取自传入的系统时间且可解析（规则5）", () => {
  const ts = new Date().toISOString();
  const md = build({ generatedAt: ts });
  assert.match(md, new RegExp("generated_at: " + ts.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.ok(!Number.isNaN(Date.parse(md.match(/generated_at: (\S+)/)[1])));
});

test("CLI 拒绝 --date / --generated-at 覆写（规则5 防造假，exit 2）", () => {
  const run = (args) => {
    try {
      execFileSync("node", [SCRIPT, ...args], { cwd: FE, stdio: "pipe", encoding: "utf8" });
      return { code: 0, out: "" };
    } catch (e) {
      return { code: e.status ?? 1, out: String(e.stderr || "") + String(e.stdout || "") };
    }
  };
  for (const flag of ["--date", "--generated-at", "--generated_at"]) {
    const res = run(["--route", "/ai-agents", flag, "2020-01-01"]);
    assert.equal(res.code, 2, flag + " 必须被拒绝");
    assert.match(res.out, /拒绝/);
  }
});

/* ───────── 输出位置：受版本管理，不再被 gitignore ───────── */

test("输出目录指向 docs/docker/testing（受版本管理），不再是 test-results/", () => {
  const src = readFileSync(SCRIPT, "utf8");
  assert.match(src, /docs",\s*"docker",\s*"testing"/, "应输出到 docs/docker/testing");
  // 注释里保留 test-results 是为了说明"为什么改"，是合法的；
  // 但**代码路径**（reportsDir 的实际取值）不得再指向被 gitignore 的目录。
  const reportsDirLine = src.match(/^const reportsDir\s*=\s*(.+);$/m);
  assert.ok(reportsDirLine, "应能定位 reportsDir 定义");
  assert.ok(
    !/test-results/.test(reportsDirLine[1]),
    "reportsDir 不得指向 test-results: " + reportsDirLine[1].trim(),
  );
  assert.match(reportsDirLine[1], /docs/);
});

test("端到端：CLI 生成的报告可通过契约校验，且落在 docs/docker/testing", () => {
  const out = path.join(REPORT_DIR, "_contract-selftest.md");
  try {
    execFileSync("node", [SCRIPT, "--route", "/ai-agents", "--out", out], {
      cwd: FE,
      stdio: "pipe",
      encoding: "utf8",
    });
    assert.ok(existsSync(out), "报告应被写出");
    // 契约校验（ui-verify-gate 用 mtime 比对 generated_at，必须刚生成）
    execFileSync("node", [GATE, out], { stdio: "ignore" });
  } finally {
    rmSync(out, { force: true });
  }
});

test("缺少 --route 时 exit 2（用法错误，不静默产出空报告）", () => {
  try {
    execFileSync("node", [SCRIPT], { cwd: FE, stdio: "pipe", encoding: "utf8" });
    assert.fail("应 exit 2");
  } catch (e) {
    assert.equal(e.status, 2);
    assert.match(String(e.stderr), /missing --route/);
  }
});