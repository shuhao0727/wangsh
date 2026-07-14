import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const { hasCompleteRuntime, replaceRuntime } = require("./copy-pyodide.js");

test("pyodide copy only skips a complete runtime directory", () => {
  const directory = mkdtempSync(join(tmpdir(), "wangsh-pyodide-copy-"));
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "pyodide.js"), "runtime");

  assert.equal(hasCompleteRuntime(directory), false);

  for (const file of [
    "pyodide.mjs",
    "pyodide.asm.wasm",
    "python_stdlib.zip",
    "pyodide-lock.json",
  ]) {
    writeFileSync(join(directory, file), "runtime");
  }

  assert.equal(hasCompleteRuntime(directory), false);

  writeFileSync(join(directory, "pyodide.asm.js"), "");

  assert.equal(hasCompleteRuntime(directory), false);

  writeFileSync(join(directory, "pyodide.asm.js"), "runtime");

  assert.equal(hasCompleteRuntime(directory), true);
});

test("pyodide copy rejects a complete runtime from another package version", () => {
  const directory = mkdtempSync(join(tmpdir(), "wangsh-pyodide-version-"));
  for (const file of [
    "pyodide.js",
    "pyodide.mjs",
    "pyodide.asm.js",
    "pyodide.asm.wasm",
    "python_stdlib.zip",
    "pyodide-lock.json",
  ]) {
    writeFileSync(join(directory, file), "runtime");
  }
  writeFileSync(join(directory, ".wangsh-pyodide-version"), "0.24.0\n");

  assert.equal(hasCompleteRuntime(directory, "0.25.1"), false);

  writeFileSync(join(directory, ".wangsh-pyodide-version"), "0.25.1\n");
  assert.equal(hasCompleteRuntime(directory, "0.25.1"), true);
});

test("pyodide replacement restores the previous runtime when activation fails", () => {
  const root = mkdtempSync(join(tmpdir(), "wangsh-pyodide-rollback-"));
  const destination = join(root, "pyodide");
  const temporary = join(root, "pyodide.tmp");
  mkdirSync(destination);
  mkdirSync(temporary);
  writeFileSync(join(destination, "version.txt"), "old-runtime");
  writeFileSync(join(temporary, "version.txt"), "new-runtime");

  const operations = {
    existsSync,
    rmSync(source, options) {
      require("node:fs").rmSync(source, options);
    },
    renameSync(source, target) {
      if (source === temporary && target === destination) {
        throw new Error("simulated activation failure");
      }
      renameSync(source, target);
    },
  };

  assert.throws(
    () => replaceRuntime(temporary, destination, operations),
    /simulated activation failure/,
  );
  assert.equal(readFileSync(join(destination, "version.txt"), "utf8"), "old-runtime");
});
