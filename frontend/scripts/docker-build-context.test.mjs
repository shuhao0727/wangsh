import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptsDir, "..");
const mindmapRoot = path.join(frontendRoot, "public", "mindmap-demo");

function localMindmapAssetReferences() {
  const references = [];
  const indexPath = path.join(mindmapRoot, "index.html");
  const index = fs.readFileSync(indexPath, "utf8");
  for (const match of index.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const reference = match[1].split(/[?#]/, 1)[0];
    if (!reference || /^(?:data:|https?:|#)/.test(reference)) continue;
    if (reference.startsWith("/mindmap-demo/")) {
      references.push(path.join(mindmapRoot, reference.slice("/mindmap-demo/".length)));
    } else if (!reference.startsWith("/")) {
      references.push(path.resolve(mindmapRoot, reference));
    }
  }

  for (const name of fs.readdirSync(path.join(mindmapRoot, "css"))) {
    if (!name.endsWith(".css")) continue;
    const file = path.join(mindmapRoot, "css", name);
    const css = fs.readFileSync(file, "utf8");
    for (const match of css.matchAll(/url\((['"]?)([^)'"]+)\1\)/g)) {
      if (match[2].startsWith("data:")) continue;
      references.push(path.resolve(path.dirname(file), match[2].split(/[?#]/, 1)[0]));
    }
  }

  for (const name of fs.readdirSync(path.join(mindmapRoot, "js"))) {
    if (!name.endsWith(".js")) continue;
    const js = fs.readFileSync(path.join(mindmapRoot, "js", name), "utf8");
    for (const match of js.matchAll(
      /\.p\+"((?:img|fonts)\/[^"]+\.(?:svg|png|jpe?g|ico|woff2?|ttf))"/g,
    )) {
      references.push(path.join(mindmapRoot, match[1]));
    }
  }

  return [...new Set(references)];
}

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

test("tracked public assets are not hidden by a broad ignore rule", () => {
  const gitignore = fs.readFileSync(
    path.join(frontendRoot, "..", ".gitignore"),
    "utf8",
  );
  const patterns = gitignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  assert.ok(
    !patterns.includes("frontend/public"),
    ".gitignore must not hide the complete frontend/public directory",
  );
  assert.ok(
    patterns.includes("frontend/public/pyodide/"),
    ".gitignore must keep generated frontend/public/pyodide ignored",
  );
  assert.ok(
    patterns.includes("!frontend/public/mindmap-demo/**"),
    ".gitignore must keep every bundled mindmap runtime asset versionable",
  );
  assert.ok(
    fs.existsSync(path.join(frontendRoot, "public", "favicon.svg")),
    "tracked frontend/public/favicon.svg must exist",
  );
  assert.ok(
    fs.existsSync(path.join(frontendRoot, "public", "mindmap-demo", "index.html")),
    "tracked mindmap demo entrypoint must exist",
  );
  assert.ok(
    fs.existsSync(
      path.join(frontendRoot, "public", "mindmap-demo", "img", "classic8.png"),
    ),
    "tracked mindmap demo PNG themes must exist",
  );
});

test("bundled mindmap runtime has every referenced local asset", () => {
  const missing = localMindmapAssetReferences()
    .filter((file) => !fs.existsSync(file))
    .map((file) => path.relative(mindmapRoot, file));

  assert.deepEqual(
    missing,
    [],
    `mindmap runtime has missing local assets: ${missing.join(", ")}`,
  );
});

test("standalone mindmap save reads the active takeover runtime", () => {
  const index = fs.readFileSync(path.join(mindmapRoot, "index.html"), "utf8");

  assert.doesNotMatch(
    index,
    /window\._mmData/,
    "the bundled save button must not depend on the removed _mmData global",
  );
  assert.match(
    index,
    /api=window\.takeOverAppMethods/,
    "the bundled save button must resolve the takeover runtime",
  );
  assert.match(
    index,
    /api\.getMindMapData\(\)/,
    "the bundled save button must read the current tree from the takeover runtime",
  );
});
