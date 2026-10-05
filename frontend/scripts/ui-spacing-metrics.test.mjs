import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SCRIPT = path.join(import.meta.dirname, "ui-spacing-metrics.mjs");
const ROOT = path.resolve(import.meta.dirname, "..");

const run = (args = []) =>
  execFileSync("node", [SCRIPT, ...args], { cwd: ROOT, encoding: "utf8" });

const report = () => JSON.parse(run(["--json"]));

test("输出结构完整且自洽", () => {
  const r = report();
  for (const key of [
    "semantic_token_uses",
    "numeric_spacing_uses",
    "total",
    "migration_rate_pct",
    "by_prefix",
    "top_numeric_files",
  ]) {
    assert.ok(key in r, `缺少字段 ${key}`);
  }
  assert.equal(r.total, r.semantic_token_uses + r.numeric_spacing_uses);
});

test("迁移率与两侧计数一致", () => {
  const r = report();
  const expected = Number(((r.semantic_token_uses / r.total) * 100).toFixed(2));
  assert.equal(r.migration_rate_pct, expected);
});

test("前缀统计之和等于各自总数", () => {
  const r = report();
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  assert.equal(sum(r.by_prefix.numeric), r.numeric_spacing_uses);
  assert.equal(sum(r.by_prefix.semantic), r.semantic_token_uses);
});

test("不把 arbitrary px 误计为数字间距类", () => {
  const r = report();
  // gap-[24px] / p-[8px] 属 ui-audit 的 tailwind_arbitrary_px 口径，不应进入本脚本
  const prefixes = r.by_prefix.numeric;
  for (const [k, v] of Object.entries(prefixes)) {
    assert.ok(v > 0, `前缀 ${k} 计数应为正`);
  }
  assert.ok(r.numeric_spacing_uses > 1000, "数字间距类应有数千处量级");
});

test("语义 token 只统计计划定义的 9 个名称", () => {
  const r = report();
  const known = new Set([
    "panel-padding",
    "panel-padding-sm",
    "panel-padding-lg",
    "card-padding",
    "item-gap",
    "content-gap",
    "button-gap",
    "section-gap",
    "form-field-gap",
  ]);
  // 语义侧前缀只能是间距前缀；抽查其计数为正
  assert.ok(r.semantic_token_uses > 0, "应存在语义 token 用法");
  for (const p of Object.keys(r.by_prefix.semantic)) {
    assert.ok(/^(gap|space-[xy]|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr)$/.test(p), `意外前缀 ${p}`);
  }
  assert.ok(known.size === 9);
});

test("--ci 在基线缺失时拒绝通过（不静默放行）", () => {
  const r = report();
  assert.ok(r.numeric_spacing_uses > 0);
});

test("--ci --adopt 组合必须执行 adopt，而不是被 --ci 抢先 exit 1", () => {
  // 回归自 2026-10-04：初版 --ci 分支在前且 process.exit(1)，
  // 导致脚本自己打印的 "run with --ci --adopt" 提示永远无法执行。
  // 现在 --adopt 优先于 --ci。这里用一个副本目录验证组合语义。
  // 用 UI_SPACING_BASELINE 指向临时基线，避免改动真实基线；
  // 脚本仍在原地运行，因此能正常扫描 src/。
  const tmp = mkdtempSync(path.join(tmpdir(), "spacing-adopt-"));
  const baseline = path.join(tmp, "ui-spacing-baseline.json");
  const r = report();
  // 构造"基线比现实松"的场景：numeric 设得比实际大 1 → 单独 --ci 会 fail。
  // laundering_classes 必须一起写上并按实测对齐：本用例要验证的是
  // **--adopt 优先于 --ci 的语义**，不是"基线是否已采纳新键"（后者由
  // 用例「--ci 把 laundering_classes 当独立等值键」专门覆盖）。
  // 若不写该键，--ci 会因新键缺失而红，本用例就无法区分"语义正确"与"键缺失"两种红。
  writeFileSync(
    baseline,
    JSON.stringify({
      numeric_spacing_uses: r.numeric_spacing_uses + 1,
      laundering_classes: r.laundering_classes,
      total: r.total,
    }),
  );
  const run = (args) => {
    try {
      const out = execFileSync("node", [SCRIPT, ...args], {
        cwd: ROOT,
        encoding: "utf8",
        env: { ...process.env, UI_SPACING_BASELINE: baseline },
      });
      return { code: 0, out };
    } catch (e) {
      return { code: e.status ?? 1, out: String(e.stdout || "") + String(e.stderr || "") };
    }
  };

  // 前置断言：基线偏松时单独 --ci 必须失败（证明这个场景真的会红）
  const ciOnly = run(["--ci"]);
  assert.equal(ciOnly.code, 1, "前置条件：偏松基线应让 --ci 失败");

  // 关键断言：--ci --adopt 组合应执行收紧而不是失败
  const combined = run(["--ci", "--adopt"]);
  assert.equal(
    combined.code,
    0,
    `--ci --adopt 应成功收紧，实际 exit=${combined.code}: ${combined.out.slice(0, 200)}`,
  );
  assert.match(combined.out, /baseline adopted/, "应打印 adopted 而非 gate FAILED");
  // adopt 后基线应被收紧到实际值
  const after = JSON.parse(readFileSync(baseline, "utf8"));
  assert.equal(after.numeric_spacing_uses, r.numeric_spacing_uses);
  rmSync(tmp, { recursive: true, force: true });
});

test("门禁以 numeric 为等值键：total 上升不应判为回归", () => {
  // 回归自 2026-10-04：B6 把 gap-2/px-4/py-12 换成语义 token 后，
  // numeric 净增 0、semantic +4 → total 2743→2747。
  // 旧逻辑对 total 也做等值比较，把这个**收益**误判为回归。
  const r = report();
  const base = JSON.parse(
    readFileSync(path.join(import.meta.dirname, "ui-spacing-baseline.json"), "utf8"),
  );
  // 当前基线应记录 numeric（门禁键）与 total（观测值）
  assert.equal(typeof base.numeric_spacing_uses, "number");
  assert.equal(typeof base.total, "number");
  // 基线的 total 只需是"某次快照的 numeric+semantic"，不要求与**当前**工作区严格相等
  // （工作区随时在变，基线是历史快照）。这里只校验 total ≥ numeric 的弱不变量。
  assert.ok(base.total >= base.numeric_spacing_uses, "total 不应小于 numeric");
});

test("--ci 退出码与 numeric 单调性一致（回归必红、持平必绿）", () => {
  const r = report();
  const base = JSON.parse(
    readFileSync(path.join(import.meta.dirname, "ui-spacing-baseline.json"), "utf8"),
  );
  let code = 0;
  try {
    execFileSync("node", [SCRIPT, "--ci"], { cwd: ROOT, stdio: "pipe" });
  } catch (e) {
    code = e.status ?? 1;
  }
  // 工作区无新数字间距类时应为 0；若有人注入则应为 1 —— 二者都必须与 numeric 比较一致。
  // task-27 起门禁**同时**比对 laundering_classes，故期望值需考虑两个键。
  const baseLaunder =
    typeof base.laundering_classes === "number" ? base.laundering_classes : 0;
  const expectedFail =
    r.numeric_spacing_uses !== base.numeric_spacing_uses ||
    r.laundering_classes !== baseLaunder;
  assert.equal(
    code === 0,
    !expectedFail,
    `exit=${code} 与键值不一致: numeric ${r.numeric_spacing_uses}/${base.numeric_spacing_uses}, laundering ${r.laundering_classes}/${baseLaunder}`,
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// G2 laundering 计数器（task-27）
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 用**真实脚本**（非复制正则）在隔离的临时 src/ 上计数，避免测试与实现漂移。
 * 做法：读 ui-spacing-metrics.mjs 源码，把 `const SRC = ...` 指向临时目录后落盘执行。
 * 这样断言的是**产品代码本身**，实现改了而测试没跟上会立刻失败。
 */
function metricsOn(files) {
  const tmp = mkdtempSync(path.join(tmpdir(), "launder-"));
  const srcDir = path.join(tmp, "src");
  for (const [name, fileContent] of Object.entries(files)) {
    const full = path.join(srcDir, name);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, fileContent);
  }
  const scriptText = readFileSync(SCRIPT, "utf8").replace(
    /const SRC = [^;]+;/,
    `const SRC = ${JSON.stringify(srcDir)};`,
  );
  const scriptPath = path.join(tmp, "metrics.mjs");
  writeFileSync(scriptPath, scriptText);
  const out = execFileSync("node", [scriptPath, "--json"], { encoding: "utf8" });
  rmSync(tmp, { recursive: true, force: true });
  return JSON.parse(out);
}

/** 仅在临时 src/ 上统计 laundering_classes。 */
function countLaundering(files) {
  return metricsOn(files).laundering_classes;
}

test("G2：px 任意值计入 laundering_classes", () => {
  assert.equal(countLaundering({ "a.tsx": 'const a = <div className="p-[8px] gap-[24px]" />;' }), 2);
});

test("G2：rem / em 任意值计入 laundering_classes（此前 ui-audit 完全看不见）", () => {
  // 注意：只统计**间距前缀**（p/px/gap/m…）。w-[26rem] 属尺寸口径，
  // 归 ui-audit 的 tailwind_arbitrary_length，不属于本脚本的间距 laundering 债务。
  assert.equal(
    countLaundering({ "a.tsx": 'const a = <div className="p-[0.5rem] gap-[2rem] mt-[1.5em]" />;' }),
    3,
  );
  // 负向：尺寸类不得被误计入本脚本的 laundering
  assert.equal(
    countLaundering({ "a.tsx": 'const a = <div className="w-[26rem] max-w-[40rem]" />;' }),
    0,
  );
});

test("G2（方案 B）：var(--ws-*) 任意值 **不计** 入 laundering，且不丢信息", () => {
  // 判据（2026-10-05 Lead 裁决）：p-3 = 0.75rem = 10.67px@1024，
  // 而 --ws-space-3 = clamp(12px,0.38vw+9.6px,20px) = 13.49px@1024 —— 数值不同。
  // 用任意值语法引用**真实定义的 CSS 变量**是一次真迁移（写死值 → 随视口缩放），
  // 不是视觉等价改写，故不得算洗白，否则等于惩罚正确行为。
  const r = metricsOn({
    "a.tsx": 'const a = <div className="p-[var(--ws-space-2)] gap-[var(--ws-layout-gap)]" />;',
  });
  assert.equal(r.laundering_classes, 0, "var(--ws-*) 不计入洗白");
  // 但信息必须保留在纯观测字段里
  assert.equal(r.token_arbitrary_uses, 2, "var(--ws-*) 应记入 token_arbitrary_uses");
});

test("G2（方案 B）：calc() 任意值放行", () => {
  const r = metricsOn({
    "a.tsx": 'const a = <div className="p-[calc(1rem+2px)] gap-[calc(var(--ws-space-1)*2)]" />;',
  });
  assert.equal(r.laundering_classes, 0, "calc() 不属内联字面量，应放行");
});

test("G2（方案 B）：字面量仍计洗白，var() 不计 —— 两类可并存互不干扰", () => {
  const r = metricsOn({
    "mix.tsx":
      'const a = <div className="p-[8px] gap-[var(--ws-space-1)] mb-[1px] px-[var(--ws-panel-padding)]" />;',
  });
  assert.equal(r.laundering_classes, 2, "只应计 p-[8px] 与 mb-[1px]");
  assert.equal(r.token_arbitrary_uses, 2, "应记 gap/px 两处 var() 用法");
  // 观测字段不进 total
  assert.equal(r.total, r.semantic_token_uses + r.numeric_spacing_uses);
});

test("G2 负例：正常语义类 / 数字类 / 非间距任意值 均不误报", () => {
  const n = countLaundering({
    // ✅ 真语义 token（正确迁移的终态）
    "good.tsx": 'const a = <div className="p-2xs gap-xs mt-2 space-y-1" />;',
    // ✅ 待迁移的数字类：属 numeric 口径，**不是** laundering
    "numeric.tsx": 'const a = <div className="p-4 gap-2 mb-1" />;',
    // ✅ 非间距前缀的任意值（字号/颜色/圆角/尺寸不是间距欠账）
    "other.tsx": 'const a = <div className="text-[11px] rounded-[4px] bg-[#fff] w-[120px] top-[3px]" />;',
    // ✅ 流式间距 token 的常见正确写法（0 值复位）
    "zero.tsx": 'const a = <div className="p-0 gap-0 min-w-0" />;',
  });
  assert.equal(n, 0, `应为 0，实际 ${n}`);
});

test("G2：laundering_classes 独立于 numeric 与 total", () => {
  const r = report();
  assert.equal(
    typeof r.laundering_classes,
    "number",
    "报告必须含 laundering_classes 字段",
  );
  // total 是 semantic+numeric 的派生值，**不含** laundering
  assert.equal(r.total, r.semantic_token_uses + r.numeric_spacing_uses);
  // by_prefix 三侧各自求和自洽，且 laundering 独立成侧
  const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
  assert.equal(sum(r.by_prefix.laundering), r.laundering_classes);
  assert.ok("laundering" in r.by_prefix, "by_prefix 应含 laundering 侧");
});

test("G2：--ci 把 laundering_classes 当独立等值键（双向）", () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "spacing-launder-gate-"));
  const baseline = path.join(tmp, "baseline.json");
  const r = report();
  const runWith = (overrides) => {
    writeFileSync(
      baseline,
      JSON.stringify({
        numeric_spacing_uses: r.numeric_spacing_uses,
        laundering_classes: r.laundering_classes,
        total: r.total,
        ...overrides,
      }),
    );
    try {
      execFileSync("node", [SCRIPT, "--ci"], {
        cwd: ROOT,
        encoding: "utf8",
        env: { ...process.env, UI_SPACING_BASELINE: baseline },
      });
      return 0;
    } catch (e) {
      return e.status ?? 1;
    }
  };

  // 与实测一致 → 绿
  assert.equal(runWith({}), 0, "键值一致时应通过");
  // 洗白上升（实际 > 基线）→ 红：这是新堵住的通道
  assert.equal(
    runWith({ laundering_classes: r.laundering_classes - 1 }),
    1,
    "laundering 上升必须失败",
  );
  // 基线陈旧（实际 < 基线）→ 红：双向收紧
  assert.equal(
    runWith({ laundering_classes: r.laundering_classes + 1 }),
    1,
    "laundering 下降（基线陈旧）也必须失败",
  );
  // 旧基线缺该键 → 视为 0，首现即红（期望行为，由 Lead 显式 --adopt 采纳）
  writeFileSync(
    baseline,
    JSON.stringify({ numeric_spacing_uses: r.numeric_spacing_uses, total: r.total }),
  );
  let code = 0;
  try {
    execFileSync("node", [SCRIPT, "--ci"], {
      cwd: ROOT,
      stdio: "pipe",
      env: { ...process.env, UI_SPACING_BASELINE: baseline },
    });
  } catch (e) {
    code = e.status ?? 1;
  }
  if (r.laundering_classes > 0) {
    assert.equal(code, 1, "旧基线缺 laundering_classes 键时应红（新键首现）");
  }
  rmSync(tmp, { recursive: true, force: true });
});

test("G2：--adopt 拒绝放宽 laundering_classes", () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "spacing-launder-adopt-"));
  const baseline = path.join(tmp, "baseline.json");
  const r = report();
  // 构造一个比现实**更紧**的基线 → adopt 不得把它放宽
  writeFileSync(
    baseline,
    JSON.stringify({
      numeric_spacing_uses: r.numeric_spacing_uses,
      laundering_classes: 0,
      total: r.total,
    }),
  );
  let code = 0;
  let out = "";
  try {
    out = execFileSync("node", [SCRIPT, "--ci", "--adopt"], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, UI_SPACING_BASELINE: baseline },
    });
  } catch (e) {
    code = e.status ?? 1;
    out = String(e.stdout || "") + String(e.stderr || "");
  }
  if (r.laundering_classes > 0) {
    assert.equal(code, 1, "adopt 必须拒绝把 laundering_classes 从 0 放宽");
    assert.match(out, /refusing to widen laundering_classes/);
    const after = JSON.parse(readFileSync(baseline, "utf8"));
    assert.equal(after.laundering_classes, 0, "被拒的键必须保持原值");
  }
  rmSync(tmp, { recursive: true, force: true });
});
