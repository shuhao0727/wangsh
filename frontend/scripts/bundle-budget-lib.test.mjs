import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { loadConfigFromFile } from "vite";

import {
  collectJavaScriptFiles,
  collectChunks,
  collectStaticRuntimeChunks,
  classifyChunk,
  summarizeChunks,
} from "./bundle-budget-lib.mjs";

test("recursively discovers worker JavaScript without counting source maps", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-budget-"));
  fs.mkdirSync(path.join(root, "workers"), { recursive: true });
  fs.writeFileSync(path.join(root, "entry.js"), "entry");
  fs.writeFileSync(path.join(root, "runtime.mjs"), "runtime");
  fs.writeFileSync(path.join(root, "workers", "ts.worker.js"), "worker");
  fs.writeFileSync(path.join(root, "workers", "ts.worker.js.map"), "map");

  try {
    assert.deepEqual(collectJavaScriptFiles(root), [
      "entry.js",
      "runtime.mjs",
      "workers/ts.worker.js",
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("classifies entry and deferred chunks from the Vite manifest graph", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-budget-"));
  fs.mkdirSync(path.join(root, "workers"), { recursive: true });
  fs.writeFileSync(path.join(root, "index.js"), "entry");
  fs.writeFileSync(path.join(root, "monaco-vendor.js"), "static dependency");
  fs.writeFileSync(path.join(root, "feature.js"), "dynamic entry");
  fs.writeFileSync(path.join(root, "feature-shared.js"), "dynamic dependency");
  fs.writeFileSync(path.join(root, "workers", "editor.js"), "worker");

  const manifest = {
    "src/main.tsx": {
      file: "assets/index.js",
      isEntry: true,
      imports: ["_monaco.js"],
      dynamicImports: ["src/feature.tsx"],
    },
    "_monaco.js": {
      file: "assets/monaco-vendor.js",
      imports: [],
    },
    "src/feature.tsx": {
      file: "assets/feature.js",
      isDynamicEntry: true,
      imports: ["_feature-shared.js"],
    },
    "_feature-shared.js": {
      file: "assets/feature-shared.js",
      imports: [],
    },
  };

  try {
    const chunks = collectChunks(root, manifest);
    const byName = new Map(chunks.map((chunk) => [chunk.name, chunk]));

    assert.equal(byName.get("index.js").deferred, false);
    assert.equal(byName.get("monaco-vendor.js").deferred, false);
    assert.equal(byName.get("feature.js").deferred, true);
    assert.equal(byName.get("feature-shared.js").deferred, true);
    assert.equal(byName.get("workers/editor.js").deferred, true);
    assert.equal(byName.get("workers/editor.js").worker, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("keeps heavy vendor chunks limited to Monaco and ECharts core packages", async () => {
  const loadedConfig = await loadConfigFromFile(
    {
      command: "build",
      mode: "production",
      isSsrBuild: false,
      isPreview: false,
    },
    fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
  );

  assert.ok(loadedConfig, "Vite config should load through Vite's TS loader");
  const manualChunkForModule =
    loadedConfig.config.build.rollupOptions.output.manualChunks;

  assert.equal(
    manualChunkForModule(
      "/repo/node_modules/monaco-editor/esm/vs/editor/editor.api.js",
    ),
    undefined,
  );
  assert.equal(
    manualChunkForModule("/repo/node_modules/echarts/core.js"),
    "echarts-vendor",
  );
  assert.equal(
    manualChunkForModule(
      "/repo/node_modules/@monaco-editor/react/lib/index.js",
    ),
    undefined,
  );
  assert.equal(
    manualChunkForModule("/repo/node_modules/echarts-for-react/lib/core.js"),
    undefined,
  );
  assert.equal(
    manualChunkForModule("/repo/node_modules/zrender/lib/core.js"),
    undefined,
  );
});

test("fails when build/assets contains no JavaScript files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-budget-empty-"));
  const scriptPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "bundle-budget.mjs",
  );
  fs.mkdirSync(path.join(root, "build", "assets"), { recursive: true });
  fs.mkdirSync(path.join(root, "build", ".vite"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "build", ".vite", "manifest.json"),
    JSON.stringify({}),
  );

  try {
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: root,
      encoding: "utf8",
    });

    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.match(result.stderr, /ERROR: No JS files found/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("fails when static runtimes exist without an application entry", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-budget-no-entry-"));
  const scriptPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "bundle-budget.mjs",
  );
  fs.mkdirSync(path.join(root, "build", "assets"), { recursive: true });
  fs.mkdirSync(path.join(root, "build", ".vite"), { recursive: true });
  fs.mkdirSync(path.join(root, "build", "pyodide"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "build", ".vite", "manifest.json"),
    JSON.stringify({}),
  );
  fs.writeFileSync(
    path.join(root, "build", "pyodide", "pyodide.js"),
    "runtime",
  );

  try {
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: root,
      encoding: "utf8",
    });

    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.match(result.stderr, /ERROR: No application entry JavaScript found/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("marks every worker as deferred and reports Worker JS separately", () => {
  const entry = classifyChunk({
    name: "index.js",
    rawSize: 4,
    gzSize: 3,
    brSize: 2,
  });
  const worker = classifyChunk({
    name: "workers/custom-runtime.js",
    rawSize: 8,
    gzSize: 6,
    brSize: 5,
  });

  assert.equal(entry.deferred, false);
  assert.equal(entry.worker, false);
  assert.equal(worker.deferred, true);
  assert.equal(worker.worker, true);

  assert.deepEqual(summarizeChunks([entry, worker]), {
    totalRawSize: 12,
    totalGzSize: 9,
    totalBrSize: 7,
    entryRawSize: 4,
    entryGzSize: 3,
    entryBrSize: 2,
    deferredRawSize: 8,
    workerRawSize: 8,
    workerGzSize: 6,
    workerBrSize: 5,
  });
});

test("counts copied Pyodide JavaScript as deferred production runtime", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-budget-pyodide-"));
  fs.mkdirSync(path.join(root, "pyodide"), { recursive: true });
  fs.writeFileSync(path.join(root, "pyodide", "pyodide.js"), "pyodide-runtime");
  fs.writeFileSync(path.join(root, "pyodide", "python_stdlib.zip"), "archive");

  try {
    const chunks = collectStaticRuntimeChunks(root, "pyodide", "pyodide");

    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].name, "pyodide/pyodide.js");
    assert.equal(chunks[0].key, "pyodide");
    assert.equal(chunks[0].deferred, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
