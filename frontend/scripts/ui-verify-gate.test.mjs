import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SCRIPT = path.join(import.meta.dirname, "ui-verify-gate.mjs");

// 每条硬规则一个「必须被抓到」的非法样例，外加合法样例做负例，
// 确保校验器既不「什么都报错」也不「什么都不报」。
const NOW = new Date().toISOString();
const GOOD = [
  "# UI 验证报告",
  "generated_at: " + NOW,
  "evidence_level: L3",
  "browser_engine: chromium",
  "browser_version: 147.0.7727.15",
  "viewport: 1440x900",
  "screenshot_sha256: abc123",
  "assertion_count: 9",
  "ran_at: " + NOW,
  "",
  "scanned_hits: 47",
  "human_confirmed: 12",
  "",
  "## 结论",
  "- PASS evidence_ref: l3-focus-01",
  "",
  "manual_notes: []",
].join("\n");

function exitCode(content) {
  const dir = mkdtempSync(path.join(tmpdir(), "ui-verify-"));
  const f = path.join(dir, "report.md");
  writeFileSync(f, content);
  try {
    execFileSync("node", [SCRIPT, f], { stdio: "ignore" });
    return 0;
  } catch (e) {
    return e.status;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("合法报告 exit 0（负例：校验器不是什么都报错）", () => {
  assert.equal(exitCode(GOOD), 0);
});

test("规则1：结论缺 evidence_ref 即非法", () => {
  assert.equal(exitCode(GOOD.replace("- PASS evidence_ref: l3-focus-01", "- PASS")), 1);
});

test("规则2：L3 缺浏览器字段即非法", () => {
  assert.equal(exitCode(GOOD.replace("browser_version: 147.0.7727.15\n", "")), 1);
});

test("规则3：提到浏览器不可用却未判 BLOCKED 即非法", () => {
  const bad = GOOD.replace("evidence_level: L3", "evidence_level: L0") + "\n浏览器不可用，因此仅静态审查通过";
  assert.equal(exitCode(bad), 1);
});

test("规则4：残留空白「规则符合度评分」模板即非法", () => {
  assert.equal(exitCode(GOOD + "\n规则符合度评分："), 1);
});

test("规则5：缺 generated_at 即非法", () => {
  assert.equal(exitCode(GOOD.replace("generated_at: " + NOW + "\n", "")), 1);
});

test("规则6：counts 缺 human_confirmed 即非法", () => {
  assert.equal(exitCode(GOOD.replace("human_confirmed: 12\n", "")), 1);
});

test("--all 不把 README/INDEX 当报告（否则恒红）", () => {
  // 仓库里现存报告可能合法也可能非法，所以这里**不能**断言 exit 0，
  // 只断言「README 没有被当成报告」——这才是本用例要守的行为。
  let out = "";
  try {
    out = execFileSync("node", [SCRIPT, "--all"], {
      cwd: path.resolve(import.meta.dirname, ".."),
      encoding: "utf8",
    });
  } catch (e) {
    out = String(e.stdout || "") + String(e.stderr || "");
  }
  assert.ok(!/README\.md/.test(out), "README 不应被当作报告校验");
});