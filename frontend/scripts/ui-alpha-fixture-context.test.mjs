import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { compilerFixtureRanges } from "./ui-alpha-fixture-context.mjs";
import { loadColorMap, scanSourceDetails } from "./ui-alpha-modifiers.mjs";

const source = `import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { it } from "vitest";
it("negative compiler contract", async () => {
  const compiled = await postcss([tailwindcss({ ...config,
    content: [{ raw: '<span class="flex border-border/50"></span>', extension: "html" }],
  })]).process("@tailwind utilities;", { from: undefined });
});`;
const ranges = (text, name = "negative.test.ts") => compilerFixtureRanges(text, name);

test("direct trusted compiler input is classified, with original byte range", () => {
  const [range] = ranges(source);
  assert.equal(ranges(source).length, 1);
  assert.equal(range.rule, "tailwind-compile-only-v1");
  assert.equal(source.slice(range.start, range.end), "'<span class=\"flex border-border/50\"></span>'");
  assert.equal(ranges(source + '\nconst root = postcss.parse(stylesheet);').length, 1);
});

test("test filename is not an exemption; runtime JSX and ordinary strings stay actionable", () => {
  assert.deepEqual(ranges('const cls = "border-border/50"; const node = <div className={cls}/>;'), []);
  assert.deepEqual(ranges(source, "page.tsx"), []);
  assert.deepEqual(ranges(source.replace('import tailwindcss from "tailwindcss";', 'const tailwindcss = (config) => render(config);')), []);
});

test("compiler mock, shadow, identity escape and dynamic execution fail closed", () => {
  for (const text of [
    source + '\nvi.mock("tailwindcss", () => ({ default: render }));',
    source + '\nvi["mock"]("tailwindcss", () => ({ default: render }));',
    source + '\nconst mockCompiler = vi.mock; mockCompiler("tailwindcss", () => ({default: render}));',
    source + '\nconst escaped = tailwindcss;',
    source + '\ntailwindcss.extra = render;',
    source + '\npostcss.parse = render;',
    source + '\nconst escapedParser = postcss.parse;',
    source + '\neval("runtime");',
    source.replace('const compiled =', 'const tailwindcss = render; const compiled ='),
    source.replace('const compiled =', 'const postcss = render; const compiled ='),
    source.replace('import { it } from "vitest";', 'const it = render;'),
    source.replace('import { it } from "vitest";', 'import type { it } from "vitest";'),
    source.replace('import { it } from "vitest";', 'import { type it } from "vitest";'),
    source.replace('import tailwindcss from "tailwindcss";', 'import type tailwindcss from "tailwindcss";'),
    source.replace('content: [{ raw:', 'content: [{ extra: render, raw:'),
  ]) assert.deepEqual(ranges(text), []);
});

test("raw variable can escape to DOM, so only inline compiler literals qualify", () => {
  const variable = source.replace('it("negative', 'const html = \'<span class="border-border/50"></span>\';\nit("negative')
    .replace("raw: '<span class=\"flex border-border/50\"></span>'", 'raw: html');
  assert.deepEqual(ranges(variable + '\nrender(<div dangerouslySetInnerHTML={{__html:html}}/>);'), []);
  assert.deepEqual(ranges(source.replace('...config,', '...config, other: render,')), []);
  assert.deepEqual(ranges(source.replace('postcss([tailwindcss', 'render([tailwindcss')), []);
});

test("renamed imports bind to the real compiler; property and local shadows do not", () => {
  assert.equal(ranges(source.replaceAll('postcss', 'pc').replace('from "pc"', 'from "postcss"')
    .replaceAll('tailwindcss', 'tw').replace('from "tw"', 'from "tailwindcss"')).length, 1);
  assert.deepEqual(ranges(source.replace('tailwindcss({', 'compiler.tailwindcss({')), []);
});

test("scanner retains raw negative evidence while detecting a real class in the same test", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ws-alpha-fixture-"));
  try {
    fs.writeFileSync(path.join(dir, "mixed.test.tsx"), source + '\nconst rendered = <div className="border-border/40"/>;');
    const report = scanSourceDetails(loadColorMap(), dir);
    assert.deepEqual(report.rawViolations.map((row) => row.token), ["border-border/50", "border-border/40"]);
    assert.deepEqual(report.compilerFixtures.map((row) => row.token), ["border-border/50"]);
    assert.deepEqual(report.violations.map((row) => row.token), ["border-border/40"]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
