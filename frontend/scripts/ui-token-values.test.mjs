import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  extractRootBlock,
  parseColorTokens,
  parseColor,
  composite,
  relativeLuminance,
  contrastRatio,
  classifyToken,
  buildReport,
} from "./ui-token-values.mjs";

const SCRIPT = path.join(import.meta.dirname, "ui-token-values.mjs");
const ROOT = path.resolve(import.meta.dirname, "..");
const REAL_BASELINE = path.join(import.meta.dirname, "token-value-baseline.json");
const CSS = path.join(ROOT, "src", "styles", "index.css");

const report = () => buildReport();

/** 独立解析整值 var(--ws-color-*) 别名链，供契约测试比较最终颜色。 */
function resolveTokenValue(name, values, seen = new Set()) {
  if (!(name in values)) return undefined;
  if (seen.has(name)) throw new Error("颜色 token alias 循环: " + name);
  const value = values[name];
  const match = value.match(/^var\(\s*(--ws-color-[a-z0-9-]+)\s*\)$/);
  if (!match) return value;
  return resolveTokenValue(match[1], values, new Set([...seen, name]));
}

/* ─────────────── WCAG 数学 ─────────────── */

test("relativeLuminance 与 WCAG 定义一致（黑白与中灰）", () => {
  assert.equal(relativeLuminance({ r: 0, g: 0, b: 0 }), 0);
  assert.equal(relativeLuminance({ r: 255, g: 255, b: 255 }), 1);
  const gray = relativeLuminance({ r: 128, g: 128, b: 128 });
  assert.ok(Math.abs(gray - 0.2159) < 0.001, "中灰亮度应约 0.2159，实际 " + gray);
});

test("contrastRatio 边界：黑白 = 21:1，同色 = 1:1", () => {
  const black = { r: 0, g: 0, b: 0, a: 1 };
  const white = { r: 255, g: 255, b: 255, a: 1 };
  assert.equal(Number(contrastRatio(black, white).toFixed(2)), 21);
  assert.equal(Number(contrastRatio(white, white).toFixed(2)), 1);
  assert.equal(
    Number(contrastRatio(black, white).toFixed(4)),
    Number(contrastRatio(white, black).toFixed(4)),
  );
});

test("contrastRatio 对半透明前景先做 alpha 合成", () => {
  const halfBlack = { r: 0, g: 0, b: 0, a: 0.5 };
  const white = { r: 255, g: 255, b: 255, a: 1 };
  const ratio = contrastRatio(halfBlack, white);
  assert.ok(ratio > 3.9 && ratio < 4.0, "半透明黑叠白应约 3.95，实际 " + ratio.toFixed(3));
});

test("composite 是 source-over 且结果不透明", () => {
  assert.deepEqual(
    composite({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 255, g: 255, b: 255, a: 1 }),
    { r: 128, g: 128, b: 128, a: 1 },
  );
  assert.deepEqual(
    composite({ r: 10, g: 20, b: 30, a: 1 }, { r: 255, g: 255, b: 255, a: 1 }),
    { r: 10, g: 20, b: 30, a: 1 },
  );
});

/* ─────────────── 颜色解析 ─────────────── */

test("parseColor 覆盖 hex/rgb/rgba/简写/命名色", () => {
  assert.deepEqual(parseColor("#FFFFFF"), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColor("#ffffff"), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColor("#FFF"), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColor("rgb(1, 2, 3)"), { r: 1, g: 2, b: 3, a: 1 });
  assert.deepEqual(parseColor("rgba(0, 0, 0, 0.4)"), { r: 0, g: 0, b: 0, a: 0.4 });
  assert.deepEqual(parseColor("rgba(0,0,0,0.08)"), { r: 0, g: 0, b: 0, a: 0.08 });
  assert.deepEqual(parseColor("white"), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColor("#00000080"), { r: 0, g: 0, b: 0, a: 128 / 255 });
});

test("parseColor 不直接解析 var()/clamp()；别名由报告层解析", () => {
  assert.equal(parseColor("var(--ws-color-primary)"), null);
  assert.equal(parseColor("clamp(1px, 2vw, 3px)"), null);
  assert.equal(parseColor(""), null);
  assert.equal(parseColor(undefined), null);
});

test("parseColor 拒绝畸形或越界的 RGB/alpha，不能截断或透明跳过", () => {
  for (const value of [
    "rgb(17..5, 17, 17)",
    "rgba(17, 17, 17, 0..5)",
    "rgba(17, 17, 17, 1..5)",
    "rgb(256, 0, 0)",
    "rgba(17, 17, 17, 1.5)",
    "rgba(17, 17, 17, 150%)",
  ]) {
    assert.equal(parseColor(value), null, "必须拒绝非法数值: " + value);
  }
});

/* ─────────────── :root 解析 ─────────────── */

test("extractRootBlock 只取第一个顶层 :root，且正确配平嵌套括号", () => {
  const css = ":root { --a: 1; --b: calc(2 * (3 + 4)); }\n@media x { :root { --a: 9; } }";
  const block = extractRootBlock(css);
  assert.ok(block.includes("--a: 1"));
  assert.ok(block.includes("calc(2 * (3 + 4))"), "嵌套括号不应提前截断");
  assert.ok(!block.includes("--a: 9"), "媒体查询里的 :root 不应被取到");
});

test("parseColorTokens 剥离行尾注释（否则基线会因注释漂移）", () => {
  const block = "  --ws-color-primary: #0F766E;   /* 白字 5.19:1｜中等彩度 */\n";
  const tokens = parseColorTokens(block);
  assert.equal(tokens["--ws-color-primary"], "#0F766E");
  assert.ok(!tokens["--ws-color-primary"].includes("/*"), "注释必须被剥离");
});

test("parseColorTokens 只取 --ws-color-* 且同名以首次为准", () => {
  const block = "--ws-color-a: #111111;\n--ws-radius-lg: 8px;\n--ws-color-a: #222222;\n";
  const tokens = parseColorTokens(block);
  assert.deepEqual(Object.keys(tokens), ["--ws-color-a"]);
  assert.equal(tokens["--ws-color-a"], "#111111");
});

/* ─────────────── 角色分类（决定断言是否适用） ─────────────── */

test("classifyToken 把底色/装饰色与内容色分开（避免假阳性）", () => {
  assert.equal(classifyToken("--ws-color-primary"), "accent");
  assert.equal(classifyToken("--ws-color-success"), "accent");
  assert.equal(classifyToken("--ws-color-text-tertiary"), "text");
  assert.equal(classifyToken("--ws-color-code-text"), "code_text");
  assert.equal(classifyToken("--ws-color-surface"), "surface");
  assert.equal(classifyToken("--ws-color-bg"), "surface");
  assert.equal(classifyToken("--ws-color-overlay"), "surface");
  assert.equal(classifyToken("--ws-color-error-light"), "decor");
});

test("真实 :root 中底色/装饰色都不被当作正文色断言", () => {
  const r = report();
  const roles = new Set(r.contrast.map((c) => c.role));
  assert.ok(!roles.has("surface"), "surface 类不应出现在对比度断言中");
  assert.ok(!roles.has("decor"), "decor 类不应出现在对比度断言中");
  for (const s of r.skipped) {
    assert.ok(typeof s.reason === "string" && s.reason.length > 0, "跳过项必须有 reason");
  }
});

/* ─────────────── 报告结构 ─────────────── */

test("报告计数自洽：颜色 token + rgb 三元组 = token 总数", () => {
  const c = report().counts;
  assert.equal(c.color_tokens + c.rgb_triplets, c.tokens_total);
});

test("min_ratio 等于各场景比值的最小值", () => {
  const r = report();
  assert.ok(r.contrast.length > 0, "应有被断言的 token");
  for (const c of r.contrast) {
    const vals = Object.values(c.ratios);
    assert.ok(vals.length > 0, c.token + " 应有至少一个场景比值");
    assert.equal(c.min_ratio, Math.min(...vals), c.token + " 的 min_ratio 与比值不符");
  }
});

test("passes 与 min_ratio 的阈值判定一致", () => {
  const r = report();
  for (const c of r.contrast) {
    assert.equal(c.passes, c.min_ratio >= r.min_contrast, c.token + " 的 passes 判定错误");
  }
});

test("报告值与 index.css 真源一致（不是硬编码副本）", () => {
  const r = report();
  const live = parseColorTokens(extractRootBlock(readFileSync(CSS, "utf8")));
  assert.deepEqual(r.values, Object.fromEntries(Object.entries(live).sort()));
});

/* ─────────────── 颜色真源：已知值锚定 ─────────────── */

test("AGENTS.md 表格中的核心色值与 index.css 真源一致", () => {
  const r = report();
  const expected = {
    "--ws-color-primary": "#0F766E",
    "--ws-color-primary-hover": "#0B5F59",
    "--ws-color-primary-active": "#084C47",
    "--ws-color-primary-muted": "#E6F7F5",
    "--ws-color-secondary": "#4F46E5",
    "--ws-color-accent": "#4F46E5",
    "--ws-color-focus-ring": "#4F46E5",
    "--ws-color-info": "#0369A1",
    "--ws-color-success": "#15803D",
    "--ws-color-warning": "#B45309",
    "--ws-color-error": "#B42318",
    "--ws-color-danger": "#B42318",
    "--ws-color-bg": "#F8FBFC",
  };
  for (const [token, value] of Object.entries(expected)) {
    assert.equal(
      resolveTokenValue(token, r.values),
      value,
      token + " 与 AGENTS.md/真源不符（应解析 alias）",
    );
  }
});

test("当前所有内容色均满足 4.5:1（此测试失败=颜色真源被改坏）", () => {
  const r = report();
  const failing = r.contrast_failures.map((c) => c.token + "=" + c.min_ratio);
  assert.deepEqual(failing, [], "存在对比度不达标的内容色: " + failing.join(", "));
});

test("-rgb 三元组与 hex 投影一致（index.css 注释要求同步）", () => {
  const r = report();
  assert.deepEqual(r.rgb_mismatches, [], "三元组漂移: " + JSON.stringify(r.rgb_mismatches));
  const rgbNames = Object.keys(r.values).filter((name) => name.endsWith("-rgb"));
  assert.equal(r.counts.rgb_triplets, rgbNames.length);
  assert.ok(r.counts.rgb_triplets > 0, "应至少存在一个 -rgb 投影");
});

/* ─────────────── CLI ratchet：值变更即红 ─────────────── */

const runCli = (args, env = {}) => {
  try {
    const out = execFileSync("node", [SCRIPT, ...args], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, ...env },
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: String(e.stdout || "") + String(e.stderr || "") };
  }
};

function withSandbox(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "token-values-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** 复制真实 CSS 到沙箱，返回 {cssPath, baseline, env} */
function sandboxEnv(dir) {
  const cssPath = path.join(dir, "index.css");
  const baseline = path.join(dir, "baseline.json");
  writeFileSync(cssPath, readFileSync(CSS, "utf8"));
  return {
    cssPath,
    baseline,
    env: { UI_TOKEN_VALUES_BASELINE: baseline, UI_TOKEN_VALUES_CSS: cssPath },
  };
}

/** 注入负例前确认当前声明确实且唯一命中，不能因旧替换目标失效而伪造红绿。 */
function injectFixtureValue(cssPath, before, after) {
  const css = readFileSync(cssPath, "utf8");
  assert.notEqual(before, after, "负例必须改变声明");
  assert.equal(css.split(before).length - 1, 1, "负例声明必须唯一命中: " + before);
  const changed = css.replace(before, after);
  writeFileSync(cssPath, changed);
  assert.ok(readFileSync(cssPath, "utf8").includes(after), "负例必须写入夹具");
}

test("--ci 在基线缺失时拒绝通过（不静默放行）", () => {
  const res = withSandbox((dir) =>
    runCli(["--ci"], { UI_TOKEN_VALUES_BASELINE: path.join(dir, "missing.json") }),
  );
  assert.equal(res.code, 1, "基线缺失必须 exit 1");
  assert.match(res.out, /baseline missing/);
});

test("--ci 与真实基线一致时 exit 0", () => {
  assert.ok(readFileSync(REAL_BASELINE, "utf8").length > 0);
  const res = runCli(["--ci"]);
  assert.equal(res.code, 0, "真实基线应通过: " + res.out.slice(0, 300));
});

test("--adopt 后 --ci 必通过；再改值则必红（完整 ratchet 回路）", () => {
  withSandbox((dir) => {
    const { cssPath, baseline, env } = sandboxEnv(dir);
    const adopt = runCli(["--ci", "--adopt"], env);
    assert.equal(adopt.code, 0, "--adopt 应成功: " + adopt.out.slice(0, 200));
    assert.match(adopt.out, /baseline adopted/);
    assert.ok(readFileSync(baseline, "utf8").length > 0);
    assert.equal(runCli(["--ci"], env).code, 0, "adopt 后应通过");
    injectFixtureValue(
      cssPath,
      "--ws-color-success-fill: #15803D",
      "--ws-color-success-fill: #FF0000",
    );
    const red = runCli(["--ci"], env);
    assert.equal(red.code, 1, "值变更必须 exit 1");
    assert.match(red.out, /token value changed: --ws-color-success-fill/);
  });
});

test("--ci 必须捕获 Lead 复现的 #15803D -> #FF0000（回归锚点，三层都报）", () => {
  withSandbox((dir) => {
    const { cssPath, env } = sandboxEnv(dir);
    runCli(["--ci", "--adopt"], env);
    injectFixtureValue(
      cssPath,
      "--ws-color-success-fill: #15803D",
      "--ws-color-success-fill: #FF0000",
    );
    const res = runCli(["--ci"], env);
    assert.equal(res.code, 1, "严重错误色值必须被拦截");
    assert.match(res.out, /token value changed: --ws-color-success-fill/);
    assert.match(res.out, /rgb triplet out of sync: --ws-color-success-fill-rgb/);
    assert.match(res.out, /contrast regression: --ws-color-success-fill/);
  });
});

test("token 被删除时也要报（基线有、现实没有）", () => {
  withSandbox((dir) => {
    const { cssPath, env } = sandboxEnv(dir);
    runCli(["--ci", "--adopt"], env);
    writeFileSync(cssPath, readFileSync(CSS, "utf8").replace(/^\s*--ws-color-info: .*$/m, ""));
    const res = runCli(["--ci"], env);
    assert.equal(res.code, 1, "删除 token 必须 exit 1");
    assert.match(res.out, /token removed: --ws-color-info/);
  });
});

test("--json 输出可解析且与 buildReport 一致", () => {
  const parsed = JSON.parse(runCli(["--json"]).out);
  const direct = report();
  assert.equal(parsed.counts.tokens_total, direct.counts.tokens_total);
  assert.deepEqual(parsed.values, direct.values);
});

test("--adopt 优先于 --ci（既有范式：提示必须可执行）", () => {
  withSandbox((dir) => {
    const { baseline, env } = sandboxEnv(dir);
    runCli(["--ci", "--adopt"], env);
    const base = JSON.parse(readFileSync(baseline, "utf8"));
    base.values["--ws-color-primary"] = "#123456";
    writeFileSync(baseline, JSON.stringify(base));
    assert.equal(runCli(["--ci"], env).code, 1, "前置条件：偏松基线应让 --ci 失败");
    const combined = runCli(["--ci", "--adopt"], env);
    assert.equal(combined.code, 0, "--ci --adopt 应成功 adopt: " + combined.out.slice(0, 200));
    assert.match(combined.out, /baseline adopted/);
    assert.equal(
      JSON.parse(readFileSync(baseline, "utf8")).values["--ws-color-primary"],
      report().values["--ws-color-primary"],
    );
  });
});
