import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const checkerPath = path.join(scriptsDir, "token-check.mjs");

function createFixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "token-check-"));
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  }
  return root;
}

function runChecker(root) {
  return spawnSync(process.execPath, [checkerPath, "--root", root], {
    encoding: "utf8",
  });
}

test("passes when every referenced WangSh token is defined", () => {
  const root = createFixture({
    "src/styles/index.css": ":root { --ws-color-primary: #0d9488; }\n",
    "src/example.tsx":
      'export const color = "var(--ws-color-primary)";\n',
  });

  try {
    const result = runChecker(root);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /0 undefined token/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("fails and reports an undefined token even when it has a fallback", () => {
  const root = createFixture({
    "src/styles/index.css": ":root { --ws-color-primary: #0d9488; }\n",
    "src/example.tsx":
      'export const color = "var(--ws-color-missing, #ffffff)";\n',
  });

  try {
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /--ws-color-missing/);
    assert.match(result.stdout, /src\/example\.tsx:1/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ignores commented references and does not accept commented definitions", () => {
  const root = createFixture({
    "src/styles/index.css":
      ":root { /* --ws-color-missing: #fff; */ --ws-color-primary: #0d9488; }\n",
    "src/example.tsx": [
      "/* var(--ws-comment-only) */",
      'export const color = "var(--ws-color-missing)";',
      "",
    ].join("\n"),
  });

  try {
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /--ws-color-missing/);
    assert.doesNotMatch(result.stdout, /--ws-comment-only/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("checks Tailwind mappings and reports the token line for multiline references", () => {
  const root = createFixture({
    "src/styles/index.css": ":root { --ws-color-primary: #0d9488; }\n",
    "src/example.tsx": 'export const color = "var(--ws-color-primary)";\n',
    "tailwind.config.js": [
      "export default {",
      "  colors: `var(",
      "    --ws-tailwind-missing",
      "  )`,",
      "};",
      "",
    ].join("\n"),
  });

  try {
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /tailwind\.config\.js:3 --ws-tailwind-missing/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("does not treat quoted CSS content as a token definition", () => {
  const root = createFixture({
    "src/styles/index.css": [
      ":root { --ws-color-primary: #0d9488; }",
      ".badge::before {",
      '  content: "--ws-color-fake: #fff;',
      '    --ws-color-multiline: #000";',
      "}",
      "",
    ].join("\n"),
    "src/example.tsx": [
      'export const color = "var(--ws-color-fake)";',
      'export const other = "var(--ws-color-multiline)";',
      "",
    ].join("\n"),
  });

  try {
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /--ws-color-fake/);
    assert.match(result.stdout, /--ws-color-multiline/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ignores comment tokens after apostrophes in JSX text", () => {
  const root = createFixture({
    "src/styles/index.css": ":root { --ws-color-primary: #0d9488; }\n",
    "src/example.tsx": [
      "export const Example = () => <div>Don't render this token.</div>;",
      "/* var(--ws-comment-only) */",
      "",
    ].join("\n"),
  });

  try {
    const result = runChecker(root);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.doesNotMatch(result.stdout, /--ws-comment-only/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("does not let regular expressions hide real token references", () => {
  const root = createFixture({
    "src/styles/index.css": ":root { --ws-color-primary: #0d9488; }\n",
    "src/example.ts": [
      "export const pattern = /[/*]/;",
      'export const color = "var(--ws-color-missing)";',
      "",
    ].join("\n"),
  });

  try {
    const result = runChecker(root);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /src\/example\.ts:2 --ws-color-missing/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
