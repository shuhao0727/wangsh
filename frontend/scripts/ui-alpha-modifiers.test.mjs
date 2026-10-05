import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import {
  judgeToken,
  loadColorMap,
  supportsAlpha,
  scanSource,
  extractCandidateTokens,
  extractEvidenceTokens,
  looksLikeClassList,
  selectDeadClasses,
  findDeadColorClasses,
  buildReport,
} from "./ui-alpha-modifiers.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const run = (args = []) =>
  execFileSync("node", [path.join(import.meta.dirname, "ui-alpha-modifiers.mjs"), ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });

// 项目真实颜色表：测试直接用生产 config，避免测试自造 token 与真实配置脱节
const colorMap = loadColorMap();

test("配置层：-rgb 色名已映射为 alpha-capable", () => {
  for (const name of [
    "primary",
    "surface",
    "surface-2",
    "text-secondary",
    "text-tertiary",
    "secondary",
    "success",
    "warning",
    "error",
    "destructive",
    "muted",
    "muted-foreground",
  ]) {
    assert.ok(colorMap.has(name), "颜色表缺少 " + name);
    assert.ok(supportsAlpha(colorMap.get(name)), name + " 应为 alpha-capable");
  }
});

test("配置层：rgba/hex 直映射的色名仍不支持 alpha（本就该报错）", () => {
  for (const name of ["border", "input", "ring", "primary-soft", "warning-soft"]) {
    assert.ok(colorMap.has(name), "颜色表缺少 " + name);
    assert.equal(supportsAlpha(colorMap.get(name)), false, name + " 不应被当成 alpha-capable");
  }
});

test("放行：bg-primary/10（已改为 rgb(var(...-rgb) / <alpha-value>)）", () => {
  assert.equal(judgeToken("bg-primary/10", colorMap), null);
});

test("放行：bg-white/10（内置静态色）", () => {
  assert.equal(judgeToken("bg-white/10", colorMap), null);
});

test("放行：bg-black/80 与 text-white/25", () => {
  assert.equal(judgeToken("bg-black/80", colorMap), null);
  assert.equal(judgeToken("text-white/25", colorMap), null);
});

test("报错：border-border/40（border 映射到 rgba，双重透明度）", () => {
  const v = judgeToken("border-border/40", colorMap);
  assert.ok(v, "border-border/40 应判为违规");
  assert.equal(v.colorName, "border");
  assert.equal(v.alpha, "40");
});

test("报错：bg-primary-soft/20 与 border-warning-soft/50（本已是 rgba）", () => {
  assert.ok(judgeToken("bg-primary-soft/20", colorMap));
  assert.ok(judgeToken("border-warning-soft/50", colorMap));
});

test("不误报定位类：left-1/4 / w-1/2 / top-1/2 / translate-x-1/2", () => {
  for (const token of ["left-1/4", "w-1/2", "top-1/2", "translate-x-1/2", "basis-1/3", "grid-cols-1/2"]) {
    assert.equal(judgeToken(token, colorMap), null, token + " 不应误报");
  }
});

test("不误报：slide 动画复合类 to-left-1/2 / from-left-1/2 / slide-out-to-left-1/2", () => {
  // 正则要求 token 前不是 [\\w-]，故 to-left-1/2 不会被当成 to- 前缀的颜色类
  for (const token of ["to-left-1/2", "from-left-1/2", "slide-out-to-left-1/2", "slide-in-from-right-1/2"]) {
    assert.equal(judgeToken(token, colorMap), null, token + " 不应误报");
  }
});

test("变体前缀下的写法必须被扫到：hover:bg-destructive/80 在修复后放行", () => {
  assert.equal(judgeToken("hover:bg-destructive/80", colorMap), null);
});

test("judgeToken 收到的是剥掉变体前缀后的本体（扫描器口径）", () => {
  // scanSource 的 ALPHA_RE lookbehind 只排除 [\w-]，冒号不排除，
  // 因此 hover:border-border/70 里被捕获的是 border-border/70 本身。
  const v = judgeToken("border-border/70", colorMap);
  assert.ok(v, "border-border/70 应报错");
});

test("★ 源码扫描：变体前缀/可叠加前缀下的失效写法必须被扫到", () => {
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "ws-alpha-var-"));
  fs.writeFileSync(
    path.join(tmp, "Variant.tsx"),
    [
      'export const a = "hover:border-border/70";',
      'export const b = "sm:hover:bg-primary-soft/20";',
      'export const c = "group-hover:border-warning-soft/50";',
      'export const d = "data-[state=open]:border-border/40";',
      'export const e = "peer-checked:border-border/30";',
      'export const ok = "hover:bg-primary/10";',
      'export const pos = "left-1/4 to-left-1/2";',
    ].join("\n"),
    "utf8",
  );
  try {
    const violations = scanSource(colorMap, tmp);
    const tokens = violations.map((v) => v.token).sort();
    assert.deepEqual(
      tokens,
      ["bg-primary-soft/20", "border-border/30", "border-border/40", "border-border/70", "border-warning-soft/50"],
      "变体前缀（含可叠加 sm:hover:、group-hover:、data-[state=open]:、peer-checked:）下的违规必须全部命中",
    );
    // hover:bg-primary/10、peer-checked:text-text-tertiary/60 已修复 -> 放行；
    // left-1/4 / to-left-1/2 勿误报
    assert.ok(!tokens.includes("bg-primary/10"), "已修复的 hover:bg-primary/10 不应报错");
    assert.ok(!tokens.includes("text-text-tertiary/60"), "已修复的 peer-checked:text-text-tertiary/60 不应报错");
    assert.ok(!violations.some((v) => /left/.test(v.token)), "定位类不应误报");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("抽取器：剥掉 arbitrary 值，不把 CSS 属性名当 class", () => {
  const tokens = extractCandidateTokens("transition-[border-color,box-shadow,transform] border-l-[3px]");
  assert.ok(!tokens.includes("border-color"), "不应把 border-color 当 class");
  assert.ok(!tokens.includes("border-l-"), "不应抽出以 - 结尾的裸前缀");
});

test("抽取器：不会把 text-text-secondary 截断成 text-text", () => {
  const tokens = extractCandidateTokens("text-sm text-text-secondary");
  assert.ok(!tokens.includes("text-text"), "不应抽出截断的 text-text");
  assert.ok(tokens.includes("text-text-secondary"), "应抽出完整 text-text-secondary");
});

test("死类判定：过滤器 3 让散文/模型名不产生假阳性", () => {
  const emits = (c) => c === "text-text-base";
  // 只含散文 token 的字面量没有一个能生成 CSS -> 整体跳过
  const dead = selectDeadClasses([["text-embedding-3-small"], ["text-text-base"]], emits);
  assert.deepEqual(dead, []);
});

test("死类判定：class 列表里不生成 CSS 的 token 会被列出", () => {
  const emits = (c) => c === "bg-surface" || c === "text-text-base";
  const dead = selectDeadClasses([["bg-surface", "bg-surface-1", "text-text-base"]], emits);
  assert.deepEqual(dead, ["bg-surface-1"]);
});

test("依赖注入：emits 判定不会被外部状态污染（border-border-secondary 修复前后）", () => {
  // 修复前：border-border-secondary 不生成 -> 被列为死类
  const before = selectDeadClasses([["border-border", "border-border-secondary"]], (c) => c === "border-border");
  assert.deepEqual(before, ["border-border-secondary"]);
  // 修复后：两者都生成 -> 无死类
  const after = selectDeadClasses([["border-border", "border-border-secondary"]], () => true);
  assert.deepEqual(after, []);
});

test("门禁口径：--json 输出结构完整且自洽", () => {
  const report = JSON.parse(run(["--json"]));
  for (const key of ["scanned_color_names", "alpha_capable", "violation_count", "by_file", "violations"]) {
    assert.ok(key in report, "缺少字段 " + key);
  }
  assert.equal(report.violation_count, report.violations.length);
  const sum = Object.values(report.by_file).reduce((a, b) => a + b, 0);
  assert.equal(sum, report.violation_count);
  assert.ok(report.alpha_capable.includes("primary"));
  assert.ok(report.alpha_capable.includes("surface-2"));
  assert.ok(!report.alpha_capable.includes("border"));
});

test("门禁口径：当前仓库 0 违规（修复后应保持）", () => {
  const report = JSON.parse(run(["--json"]));
  assert.equal(report.violation_count, 0, "仍存在会静默失效的 /N 写法");
});

test("--ci 无违规时 exit 0", () => {
  const out = run(["--ci"]);
  assert.match(out, /门禁通过/);
});

test("--ci 有违规时 exit 1（用探针目录注入违规）", () => {
  const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "ws-alpha-"));
  fs.writeFileSync(path.join(tmp, "Bad.tsx"), 'export const c = "bg-primary/10 border-border/40";\n');
  let code = 0;
  try {
    run(["--ci", "--src", tmp]);
  } catch (error) {
    code = error.status;
  }
  assert.equal(code, 1, "有违规时 --ci 必须 exit 1");
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("不允许未知参数（避免 CI 里静默写错参数而假通过）", () => {
  assert.throws(() => run(["--nope"]));
});

test("扫描器不因 node_modules 崩溃（跳过大目录）", () => {
  const violations = scanSource(colorMap);
  assert.ok(Array.isArray(violations));
  assert.equal(violations.length, 0);
});

test("buildReport 不默认跑死类检查（性能取舍：默认关闭）", async () => {
  const report = await buildReport({});
  assert.ok(!("dead_color_classes" in report), "默认不应包含 dead_color_classes");
});

// ---- task-11 回归：死类检查的漏检与假阳性 ----

const tmpSrc = (files) => {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "ws-dead-"));
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), body + "\n");
  }
  return dir;
};

test("死类检查：全死组必须被报出（活性证据取自原始字面量，而非颜色子集）", async () => {
  // 整组颜色类都不生成 CSS，但字面量里有 flex / p-2 这两个真 class 作为活性证据。
  // 修复前：证据只看颜色子集 → 一个能生成 CSS 的 token 都没有 → 被当散文跳过（漏检）。
  const dir = tmpSrc({
    "Probe.tsx":
      'export const __mix = <div className="flex border-border-nope bg-surface-99 p-2 text-text-nope" />;',
  });
  try {
    const dead = await findDeadColorClasses(dir);
    assert.deepEqual(dead, ["bg-surface-99", "border-border-nope", "text-text-nope"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("死类检查：--dead-classes-ci 有死类时 exit 1", () => {
  const dir = tmpSrc({
    "Probe.tsx":
      'export const __mix = <div className="flex border-border-nope bg-surface-99 p-2" />;',
  });
  let code = 0;
  try {
    run(["--dead-classes-ci", "--src", dir]);
  } catch (error) {
    code = error.status;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  assert.equal(code, 1, "有死类时 --dead-classes-ci 必须 exit 1");
});

test("死类检查：--dead-classes（信息性）不改变退出码", () => {
  const dir = tmpSrc({
    "Probe.tsx":
      'export const __mix = <div className="flex border-border-nope p-2" />;',
  });
  try {
    const out = run(["--dead-classes", "--src", dir]);
    assert.match(out, /border-border-nope/);
    assert.match(out, /信息性/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("死类检查：text-embedding-3-small 这类散文不误报", async () => {
  // data.ts 里真实存在的说明文字：必须仍被判为散文，不得当成 class 列表。
  const prose =
    "对比 BAAI/bge-large-zh-v1.5、text-embedding-3-small 和通义千问 Embedding 三种嵌入模型，在中文检索精度、速度和成本上如何权衡？";
  assert.equal(looksLikeClassList(prose), false, "含中日韩文字的说明文字不是 class 列表");
  assert.equal(looksLikeClassList("检索增强生成 (RAG) —— text-embedding-3/BGE/Jina"), false);
  // 真实 className 仍必须是 class 列表
  assert.equal(looksLikeClassList("flex items-center gap-2 bg-surface-1 text-text-base"), true);
  const dir = tmpSrc({ "data.ts": "export const q = " + JSON.stringify(prose) + ";" });
  try {
    assert.deepEqual(await findDeadColorClasses(dir), [], "散文不得产生死类假阳性");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("死类检查：CSS 属性名不误报（border-radius / border-box / border-right / text-align）", async () => {
  // MonacoPythonEditor.tsx 里的内联 CSS 模板串：里面是 CSS 属性名，不是 class。
  const css = [
    "export const CSS = `",
    "  text-align: right !important;",
    "  border-right: 1px solid var(--ws-color-border-secondary);",
    "  border-radius: 999px;",
    "  box-sizing: border-box;",
    "`;",
  ].join("\n");
  const dir = tmpSrc({ "editor.ts": css });
  try {
    assert.deepEqual(await findDeadColorClasses(dir), [], "CSS 属性名不得被报为死类");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("死类检查：selectDeadClasses 用 evidence 判活性、只报 colors", () => {
  const emits = (cls) => ["flex", "p-2", "text-text-base"].includes(cls);
  // 全死组 + 活性证据 → 全部报出
  assert.deepEqual(
    selectDeadClasses([{ colors: ["bg-nope", "text-nope"], evidence: ["flex", "p-2"] }], emits),
    ["bg-nope", "text-nope"],
  );
  // 无活性证据 → 视为散文，跳过
  assert.deepEqual(selectDeadClasses([{ colors: ["bg-nope"], evidence: ["embedding-3"] }], emits), []);
  // 向后兼容：纯数组仍按旧语义（数组同时充当 colors 与 evidence）
  assert.deepEqual(selectDeadClasses([["text-text-base", "bg-nope"]], emits), ["bg-nope"]);
});

test("死类检查：extractEvidenceTokens 抽出非颜色 token 作活性证据", () => {
  const tokens = extractEvidenceTokens("flex border-border-nope bg-surface-99 p-2 text-text-nope");
  for (const expected of ["flex", "p-2", "border-border-nope", "bg-surface-99"]) {
    assert.ok(tokens.includes(expected), "缺少证据 token " + expected);
  }
});
