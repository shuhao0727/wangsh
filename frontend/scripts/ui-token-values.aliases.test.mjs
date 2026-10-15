/**
 * Independent alias regressions: only buildReport({ cssPath }) and the public CLI.
 * Every CSS/baseline fixture lives outside the checkout and is removed in finally.
 * Baselines are handwritten from fixture.values; no real CSS/baseline or --adopt.
 * Scope: existing hex/rgb(a) literals and whole-var chains, not a CSS engine.
 * Run: node --test frontend/scripts/ui-token-values.aliases.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildReport } from "./ui-token-values.mjs";

const SCRIPT = fileURLToPath(new URL("./ui-token-values.mjs", import.meta.url));
const DEFAULT_VALUES = {
  "--ws-color-surface": "#FFFFFF",
  "--ws-color-bg": "#FFFFFF",
  "--ws-color-code-bg": "#111111",
  "--ws-color-primary": "#111111",
  "--ws-color-primary-rgb": "17 17 17",
  "--ws-color-text": "#111111",
  "--ws-color-code-text": "#FFFFFF",
};
const ALIAS_VALUES = {
  "--ws-color-primary": "var( --ws-color-primary-mid )",
  "--ws-color-primary-mid": "var(--ws-color-primary-fill)",
  "--ws-color-primary-fill": "#111111",
  "--ws-color-primary-rgb": "var(--ws-color-primary-mid-rgb)",
  "--ws-color-primary-mid-rgb": "var(--ws-color-primary-fill-rgb)",
  "--ws-color-primary-fill-rgb": "17 17 17",
};
const ACCENT_SCENARIOS = [
  "white_text_on_color",
  "color_text_on_surface",
  "color_text_on_page_bg",
];

function withFixture(overrides, fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "ws-token-alias-tests-"));
  try {
    const fixture = {
      dir,
      cssPath: path.join(dir, "index.css"),
      baselinePath: path.join(dir, "baseline.json"),
      values: { ...DEFAULT_VALUES, ...overrides },
    };
    fixture.writeCss = () => {
      const declarations = Object.entries(fixture.values)
        .map(([token, value]) => `  ${token}: ${value};`)
        .join("\n");
      writeFileSync(fixture.cssPath, `:root {\n${declarations}\n}\n`);
    };
    fixture.setValue = (token, value) => {
      assert.ok(Object.hasOwn(fixture.values, token), `injection target exists: ${token}`);
      assert.notEqual(fixture.values[token], value, `injection changes ${token}`);
      fixture.values[token] = value;
      fixture.writeCss();
      assert.ok(
        readFileSync(fixture.cssPath, "utf8").includes(`  ${token}: ${value};`),
        `negative injection must reach CSS: ${token}=${value}`,
      );
    };
    fixture.writeBaseline = () => {
      // Match the fixture's raw declarations, never adopt a checker-generated report.
      writeFileSync(fixture.baselinePath, JSON.stringify({
        source: "isolated-alias-fixture",
        min_contrast: 4.5,
        values: { ...fixture.values },
        contrast_failures: [],
        rgb_mismatches: [],
        resolution_errors: [],
      }, null, 2) + "\n");
    };
    fixture.writeCss();
    fixture.writeBaseline();
    return fn(fixture);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function reportFor(fixture) {
  let report;
  assert.doesNotThrow(() => {
    report = buildReport({ cssPath: fixture.cssPath });
  }, "alias resolution failures must be reported, not thrown");
  assert.deepEqual(report.values, fixture.values, "report.values keeps every raw declaration");
  assert.equal(report.min_contrast, 4.5, "the existing contrast threshold is unchanged");
  return report;
}

function runCli(fixture, args = ["--ci"]) {
  const cssBefore = readFileSync(fixture.cssPath, "utf8");
  const baselineBefore = readFileSync(fixture.baselinePath, "utf8");
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: fixture.dir,
    encoding: "utf8",
    timeout: 10_000,
    env: {
      ...process.env,
      UI_TOKEN_VALUES_CSS: fixture.cssPath,
      UI_TOKEN_VALUES_BASELINE: fixture.baselinePath,
    },
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, "CLI must finish normally");
  assert.equal(readFileSync(fixture.cssPath, "utf8"), cssBefore, "CLI leaves fixture CSS intact");
  assert.equal(
    readFileSync(fixture.baselinePath, "utf8"), baselineBefore,
    "CLI leaves the handwritten baseline intact",
  );
  return { code: result.status, out: result.stdout + result.stderr, stdout: result.stdout };
}

function contrastFor(report, token) {
  const check = report.contrast.find((entry) => entry.token === token);
  assert.ok(check, `${token} must enter contrast checks instead of being silently skipped`);
  assert.ok(!report.skipped.some((entry) => entry.token === token), `${token} is not skipped`);
  return check;
}

function assertResolved(report) {
  assert.deepEqual(report.resolution_errors, [], "healthy aliases have no resolution errors");
  assert.equal(report.counts.resolution_errors, 0);
}

function assertResolutionRejected(fixture, token) {
  const report = reportFor(fixture);
  assert.ok(Array.isArray(report.resolution_errors), "report.resolution_errors must be an array");
  assert.ok(report.resolution_errors.length > 0, "bad aliases cannot disappear into skipped");
  assert.equal(report.counts.resolution_errors, report.resolution_errors.length);
  for (const error of report.resolution_errors) {
    assert.equal(typeof error.token, "string");
    assert.ok(error.token.trim().length > 0);
    assert.equal(typeof error.reason, "string");
    assert.ok(error.reason.trim().length > 0, `${error.token} needs an actionable reason`);
  }
  assert.ok(
    report.resolution_errors.some((error) => error.token === token),
    `the injected failure must be attributed to ${token}`,
  );
  fixture.writeBaseline(); // Same bad raw values: ratchet drift cannot cause this red result.
  const result = runCli(fixture);
  assert.equal(result.code, 1, `resolution errors must make --ci red: ${result.out}`);
  assert.match(result.out, /resolution/i, "CLI must diagnose resolution, not merely fail");
  assert.ok(result.out.includes(token), `CLI identifies the failing token ${token}`);
  assert.doesNotMatch(result.out, /token (?:value changed|added|removed)/);
  return report;
}

test("multi-hop whole-var content aliases enter all three contrast scenarios", () => {
  withFixture(ALIAS_VALUES, (fixture) => {
    const report = reportFor(fixture);
    for (const token of ["--ws-color-primary", "--ws-color-primary-mid", "--ws-color-primary-fill"]) {
      const check = contrastFor(report, token);
      assert.deepEqual(check.scenarios_checked, ACCENT_SCENARIOS);
      assert.equal(check.passes, true);
      assert.ok(check.min_ratio >= 4.5);
    }
    assert.equal(report.counts.contrast_checked, 5);
    assert.deepEqual(report.contrast_failures, []);
    assertResolved(report);
    const result = runCli(fixture);
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /gate passed/);
  });
});

test("hex/rgb/rgba base aliases and multi-hop RGB triplet aliases agree", () => {
  for (const terminal of ["#111", "#111111FF", "rgb(17, 17, 17)", "rgba(17, 17, 17, 1)"]) {
    withFixture({ ...ALIAS_VALUES, "--ws-color-primary-fill": terminal }, (fixture) => {
      const report = reportFor(fixture);
      assert.equal(report.counts.rgb_triplets, 3, terminal);
      assert.equal(report.counts.rgb_mismatches, 0, terminal);
      assert.deepEqual(report.rgb_mismatches, [], terminal);
      assert.equal(contrastFor(report, "--ws-color-primary").passes, true, terminal);
      assertResolved(report);
      const result = runCli(fixture);
      assert.equal(result.code, 0, `${terminal}: ${result.out}`);
    });
  }
});

test("changing the terminal RGB triplet exposes drift through every alias and makes CI red", () => {
  withFixture(ALIAS_VALUES, (fixture) => {
    assert.equal(runCli(fixture).code, 0, "healthy fixture establishes the CLI control");
    fixture.setValue("--ws-color-primary-fill-rgb", "17 17 18");
    const report = reportFor(fixture);
    assert.equal(report.values["--ws-color-primary-fill-rgb"], "17 17 18");
    assert.equal(report.counts.rgb_mismatches, 3);
    for (const token of ["--ws-color-primary-rgb", "--ws-color-primary-mid-rgb", "--ws-color-primary-fill-rgb"]) {
      const mismatch = report.rgb_mismatches.find((entry) => entry.rgb_token === token);
      assert.ok(mismatch, `drift must reach ${token}`);
      assert.equal(mismatch.expected, "17 17 17");
    }
    assert.deepEqual(report.contrast_failures, []);
    assertResolved(report);
    fixture.writeBaseline();
    const result = runCli(fixture);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /rgb triplet out of sync: --ws-color-primary-rgb/);
    assert.doesNotMatch(result.out, /token value changed|contrast regression/);
  });
});

test("surface and page background aliases use their terminals, not white fallbacks", () => {
  withFixture({
    "--ws-color-primary": "#000000",
    "--ws-color-primary-rgb": "0 0 0",
    "--ws-color-text": "#000000",
    "--ws-color-surface": "var(--ws-color-surface-2)",
    "--ws-color-surface-2": "var(--ws-color-primary-muted)",
    "--ws-color-primary-muted": "#EEEEEE",
    "--ws-color-bg": "var(--ws-color-scrollbar)",
    "--ws-color-scrollbar": "var(--ws-color-error-light)",
    "--ws-color-error-light": "#CCCCCC",
  }, (fixture) => {
    const report = reportFor(fixture);
    for (const token of ["--ws-color-primary", "--ws-color-text"]) {
      const check = contrastFor(report, token);
      assert.equal(check.ratios.color_text_on_surface, 18.10);
      assert.equal(check.ratios.color_text_on_page_bg, 13.08);
      assert.equal(check.passes, true);
    }
    assertResolved(report);
    const result = runCli(fixture);
    assert.equal(result.code, 0, result.out);
  });
});

test("code background alias chains calculate contrast and detect a bright terminal regression", () => {
  withFixture({
    "--ws-color-code-bg": "var(--ws-color-tooltip)",
    "--ws-color-tooltip": "var(--ws-color-overlay)",
    "--ws-color-overlay": "#444444",
  }, (fixture) => {
    const before = reportFor(fixture);
    const check = contrastFor(before, "--ws-color-code-text");
    assert.deepEqual(check.scenarios_checked, ["color_text_on_code_bg"]);
    assert.equal(check.ratios.color_text_on_code_bg, 9.74);
    assert.equal(check.passes, true);
    assertResolved(before);
    assert.equal(runCli(fixture).code, 0);
    fixture.setValue("--ws-color-overlay", "#F8F8F8");
    const after = reportFor(fixture);
    assert.equal(after.values["--ws-color-overlay"], "#F8F8F8");
    assert.equal(contrastFor(after, "--ws-color-code-text").ratios.color_text_on_code_bg, 1.06);
    assert.deepEqual(after.contrast_failures.map((entry) => entry.token), ["--ws-color-code-text"]);
    assertResolved(after);
    fixture.writeBaseline();
    const result = runCli(fixture);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /contrast regression: --ws-color-code-text/);
    assert.doesNotMatch(result.out, /token value changed|rgb triplet out of sync/);
  });
});

test("missing color alias targets produce structured errors without throwing and always fail CI", () => {
  withFixture(ALIAS_VALUES, (fixture) => {
    fixture.setValue("--ws-color-primary-mid", "var(--ws-color-does-not-exist)");
    assertResolutionRejected(fixture, "--ws-color-primary");
  });
});

test("multi-token and self color alias cycles produce structured errors and fail CI", () => {
  for (const target of ["--ws-color-primary", "--ws-color-primary-fill"]) {
    withFixture(ALIAS_VALUES, (fixture) => {
      fixture.setValue("--ws-color-primary-fill", `var(${target})`);
      assertResolutionRejected(fixture, "--ws-color-primary");
    });
  }
});

test("invalid literal colors are resolution errors both directly and through alias chains", () => {
  for (const token of ["--ws-color-primary", "--ws-color-primary-fill"]) {
    withFixture(ALIAS_VALUES, (fixture) => {
      fixture.setValue(token, "#GGGGGG");
      const report = assertResolutionRejected(fixture, "--ws-color-primary");
      assert.equal(report.values[token], "#GGGGGG");
    });
  }
});

test("unresolvable surface/page/code backgrounds never throw or silently fall back", () => {
  const cases = [
    ["--ws-color-surface", "var(--ws-color-missing-surface)"],
    ["--ws-color-bg", "var(--ws-color-bg)"],
    ["--ws-color-code-bg", "rgb(not-a-color)"],
  ];
  for (const [token, value] of cases) {
    withFixture({}, (fixture) => {
      fixture.setValue(token, value);
      assertResolutionRejected(fixture, token);
    });
  }
});

test("missing/cyclic/invalid RGB triplet aliases cannot silently bypass consistency or CI", () => {
  const cases = [
    "var(--ws-color-missing-rgb)",
    "var(--ws-color-primary-mid-rgb)",
    "17 17",
  ];
  for (const value of cases) {
    withFixture(ALIAS_VALUES, (fixture) => {
      fixture.setValue("--ws-color-primary-fill-rgb", value);
      const report = assertResolutionRejected(fixture, "--ws-color-primary-rgb");
      assert.equal(report.values["--ws-color-primary-fill-rgb"], value);
    });
  }
});

test("a bright color terminal triggers contrast and RGB negatives through unchanged aliases", () => {
  withFixture(ALIAS_VALUES, (fixture) => {
    const before = reportFor(fixture);
    assert.deepEqual(before.contrast_failures, []);
    assert.deepEqual(before.rgb_mismatches, []);
    assert.equal(runCli(fixture).code, 0);
    fixture.setValue("--ws-color-primary-fill", "#EEEEEE");
    const after = reportFor(fixture);
    assert.equal(after.values["--ws-color-primary-fill"], "#EEEEEE");
    assert.equal(after.values["--ws-color-primary"], before.values["--ws-color-primary"]);
    assertResolved(after);
    for (const token of ["--ws-color-primary", "--ws-color-primary-mid", "--ws-color-primary-fill"]) {
      const check = contrastFor(after, token);
      assert.equal(check.passes, false, token);
      assert.ok(check.min_ratio < 4.5, token);
      assert.ok(after.contrast_failures.some((entry) => entry.token === token), token);
      const mismatch = after.rgb_mismatches.find((entry) => entry.base_token === token);
      assert.ok(mismatch, `bright terminal must expose RGB drift for ${token}`);
      assert.equal(mismatch.expected, "238 238 238");
    }
    assert.equal(after.counts.contrast_failures, 3);
    assert.equal(after.counts.rgb_mismatches, 3);
    const result = runCli(fixture);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /token value changed: --ws-color-primary-fill/);
    assert.match(result.out, /contrast regression: --ws-color-primary\b/);
    assert.match(result.out, /rgb triplet out of sync: --ws-color-primary-rgb/);
  });
});

test("raw aliases survive report/JSON and equivalent alias rewrites still fail the value ratchet", () => {
  withFixture({ ...ALIAS_VALUES, "--ws-color-overlay": "rgba(0, 0, 0, 0.4)" }, (fixture) => {
    const before = reportFor(fixture);
    assert.equal(before.values["--ws-color-primary"], "var( --ws-color-primary-mid )");
    assert.equal(before.values["--ws-color-primary-rgb"], "var(--ws-color-primary-mid-rgb)");
    assert.ok(before.skipped.some((entry) =>
      entry.token === "--ws-color-overlay" && entry.reason === "translucent"));
    assertResolved(before);
    assert.equal(runCli(fixture).code, 0);
    fixture.setValue("--ws-color-primary", "var(--ws-color-primary-fill)");
    const after = reportFor(fixture);
    assert.deepEqual(
      contrastFor(after, "--ws-color-primary").ratios,
      contrastFor(before, "--ws-color-primary").ratios,
      "the alias rewrite preserves the resolved color",
    );
    assert.deepEqual(after.contrast_failures, []);
    assert.deepEqual(after.rgb_mismatches, []);
    assertResolved(after);
    const jsonResult = runCli(fixture, ["--json"]);
    assert.equal(jsonResult.code, 0, jsonResult.out);
    const json = JSON.parse(jsonResult.stdout);
    assert.deepEqual(json.values, fixture.values);
    assert.deepEqual(json.counts, after.counts);
    assert.deepEqual(json.resolution_errors, []);
    const result = runCli(fixture);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /token value changed: --ws-color-primary:/);
    assert.doesNotMatch(result.out, /contrast regression|rgb triplet out of sync/);
  });
});

test("inverse text uses primary-fill rather than the light surface and rejects dark inverse text", () => {
  withFixture({
    "--ws-color-primary-fill": "#000000",
    "--ws-color-text-inverse": "var(--ws-color-surface)",
  }, (fixture) => {
    const before = reportFor(fixture);
    const inverse = contrastFor(before, "--ws-color-text-inverse");
    assert.equal(inverse.role, "inverse_text");
    assert.deepEqual(inverse.scenarios_checked, ["color_text_on_primary_fill"]);
    assert.equal(inverse.min_ratio, 21, "use primary-fill, not the different primary/surface");
    assert.equal(inverse.passes, true);
    assertResolved(before);
    assert.equal(runCli(fixture).code, 0);
    fixture.setValue("--ws-color-text-inverse", "#000000");
    const after = reportFor(fixture);
    assert.equal(contrastFor(after, "--ws-color-text-inverse").min_ratio, 1);
    assert.ok(after.contrast_failures.some((entry) => entry.token === "--ws-color-text-inverse"));
    fixture.writeBaseline();
    const result = runCli(fixture);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /contrast regression: --ws-color-text-inverse/);
    assert.doesNotMatch(result.out, /token value changed|rgb triplet out of sync/);
  });
});

test("page and real module shell aliases inherit surface/text roles without false accent checks", () => {
  const surfaceAliases = {
    "--ws-color-page": "var(--ws-color-bg)",
    "--ws-color-chart-surface": "var(--ws-color-surface)",
    "--ws-color-debug-idle-soft": "var(--ws-color-surface-2)",
    "--ws-color-diagram-canvas": "var(--ws-color-module-shell-canvas)",
    "--ws-color-editor-background": "var(--ws-color-surface)",
    "--ws-color-module-shell": "var(--ws-color-surface)",
    "--ws-color-module-shell-canvas": "var(--ws-color-surface)",
    "--ws-color-terminal-background": "var(--ws-color-surface)",
  };
  const textAliases = {
    "--ws-color-text-placeholder": "var(--ws-color-text-tertiary)",
    "--ws-color-chart-tooltip-text": "var(--ws-color-text)",
    "--ws-color-debug-idle": "var(--ws-color-text-secondary)",
    "--ws-color-diagram-text": "var(--ws-color-editor-foreground)",
    "--ws-color-editor-foreground": "var(--ws-color-text)",
    "--ws-color-module-shell-text": "var(--ws-color-text)",
    "--ws-color-terminal-foreground": "var(--ws-color-module-shell-text)",
  };
  withFixture({
    "--ws-color-surface-2": "#F8F8F8",
    "--ws-color-text-secondary": "#111111",
    "--ws-color-text-tertiary": "#111111",
    ...surfaceAliases,
    ...textAliases,
  }, (fixture) => {
    const report = reportFor(fixture);
    for (const token of Object.keys(surfaceAliases)) {
      assert.ok(!report.contrast.some((entry) => entry.token === token), token);
      assert.ok(report.skipped.some((entry) =>
        entry.token === token && entry.reason === "not-a-content-color:surface"), token);
    }
    for (const token of Object.keys(textAliases)) {
      const check = contrastFor(report, token);
      assert.equal(check.role, "text", token);
      assert.deepEqual(check.scenarios_checked, ["color_text_on_surface", "color_text_on_page_bg"]);
      assert.equal(check.passes, true, token);
    }
    assertResolved(report);
    assert.deepEqual(report.contrast_failures, []);
    const result = runCli(fixture);
    assert.equal(result.code, 0, result.out);
  });
});

test("module code-text aliases preserve the canonical code_text role across further var hops", () => {
  const observations = [];
  for (const source of ["--ws-color-surface", "--ws-color-text"]) {
    withFixture({
      "--ws-color-module-shell-code-text": "var(--ws-color-code-text)",
    }, (fixture) => {
      fixture.setValue("--ws-color-code-text", `var(${source})`);
      const report = reportFor(fixture);
      assertResolved(report);
      const canonical = contrastFor(report, "--ws-color-code-text");
      fixture.writeBaseline();
      observations.push({
        source,
        canonical,
        alias: report.contrast.find((entry) => entry.token === "--ws-color-module-shell-code-text"),
        skipped: report.skipped.filter((entry) => entry.token === "--ws-color-module-shell-code-text"),
        cli: runCli(fixture),
      });
    });
  }
  for (const { source, canonical, alias, skipped, cli } of observations) {
    assert.ok(alias, `code alias must be checked for ${source}; skipped=${JSON.stringify(skipped)}`);
    assert.equal(alias.role, "code_text", `canonical role survives the terminal ${source}`);
    assert.deepEqual(alias.scenarios_checked, ["color_text_on_code_bg"]);
    assert.deepEqual(alias.ratios, canonical.ratios);
    assert.equal(alias.passes, source === "--ws-color-surface");
    assert.equal(cli.code, alias.passes ? 0 : 1, cli.out);
    if (!alias.passes) {
      assert.match(cli.out, /contrast regression: --ws-color-module-shell-code-text/);
    }
  }
});

test("a public accent targeting a surface through a module alias still fails all contrast contexts", () => {
  withFixture({
    "--ws-color-module-shell-canvas": "var(--ws-color-surface)",
    "--ws-color-primary": "var(--ws-color-module-shell-canvas)",
    "--ws-color-primary-rgb": "255 255 255",
  }, (fixture) => {
    const report = reportFor(fixture);
    const check = contrastFor(report, "--ws-color-primary");
    assert.equal(check.role, "accent");
    assert.deepEqual(check.scenarios_checked, ACCENT_SCENARIOS);
    assert.deepEqual(Object.values(check.ratios), [1, 1, 1]);
    assert.equal(check.passes, false);
    assertResolved(report);
    assert.deepEqual(report.rgb_mismatches, []);
    const result = runCli(fixture);
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /contrast regression: --ws-color-primary/);
    assert.doesNotMatch(result.out, /token value changed|rgb triplet out of sync/);
  });
});

test("malformed RGB/alpha numeric literals cannot be truncated into colors or skipped as translucent", () => {
  const malformed = [
    "rgb(17..5, 17, 17)",
    "rgba(17, 17, 17, 0..5)",
    "rgba(17, 17, 17, 1..5)",
  ];
  const observations = [];
  for (const value of malformed) {
    withFixture(ALIAS_VALUES, (fixture) => {
      fixture.setValue("--ws-color-primary-fill", value);
      const report = reportFor(fixture);
      fixture.writeBaseline();
      observations.push({ value, report, cli: runCli(fixture) });
    });
  }
  for (const { value, report, cli } of observations) {
    assert.ok(
      report.resolution_errors.some((entry) => entry.token === "--ws-color-primary"),
      `invalid numeric grammar must propagate an error through the alias: ${value}; CLI=${cli.out}`,
    );
    assert.equal(report.counts.resolution_errors, report.resolution_errors.length);
    assert.ok(!report.contrast.some((entry) => entry.token === "--ws-color-primary"), value);
    assert.ok(!report.skipped.some((entry) =>
      entry.token === "--ws-color-primary" && entry.reason === "translucent"), value);
    assert.equal(cli.code, 1, `${value}: ${cli.out}`);
    assert.match(cli.out, /token resolution failed: --ws-color-primary/);
    assert.doesNotMatch(cli.out, /token value changed/);
  }
});

test("RGB triplet range and syntax errors propagate through aliases and make matched-baseline CI red", () => {
  for (const value of ["256 17 17", "-1 17 17", "17.5 17 17", "17 17 17 trailing"]) {
    withFixture(ALIAS_VALUES, (fixture) => {
      fixture.setValue("--ws-color-primary-fill-rgb", value);
      assertResolutionRejected(fixture, "--ws-color-primary-rgb");
    });
  }
});

test("invalid RGB triplets are rejected even when their counterpart base token is absent", () => {
  withFixture({ "--ws-color-probe-rgb": "17 17 17" }, (fixture) => {
    fixture.setValue("--ws-color-probe-rgb", "256 0 0");
    assert.equal(Object.hasOwn(fixture.values, "--ws-color-probe"), false);
    assertResolutionRejected(fixture, "--ws-color-probe-rgb");
  });
});
