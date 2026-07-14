import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptsDir, "..");

test("Docker context excludes the generated Pyodide runtime", () => {
  const dockerignore = fs.readFileSync(
    path.join(frontendRoot, ".dockerignore"),
    "utf8"
  );
  const patterns = dockerignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.replace(/^\/|\/$/g, ""));

  assert.ok(
    patterns.includes("public/pyodide"),
    "frontend/.dockerignore must exclude public/pyodide so host symlinks and stale runtime files cannot overwrite container-generated assets"
  );
});
