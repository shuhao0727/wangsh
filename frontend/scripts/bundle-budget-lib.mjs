import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const KEY_CHUNKS = {
  monaco: ["monaco", "editor.api2", "editor.worker"],
  echarts: ["echarts"],
  graphviz: ["graphviz"],
  pyodide: ["pyodide"],
  xterm: ["terminal"],
  pdfjs: ["pdf", "pdf.worker"],
  markdown: ["markdown"],
  typst: ["typst"],
};

function normalizePath(value) {
  return value.replaceAll("\\", "/");
}

function manifestAssetName(file) {
  const normalized = normalizePath(file);
  const assetsMarker = "/assets/";
  const markerIndex = normalized.lastIndexOf(assetsMarker);
  if (markerIndex !== -1) {
    return normalized.slice(markerIndex + assetsMarker.length);
  }
  return normalized.startsWith("assets/")
    ? normalized.slice("assets/".length)
    : normalized;
}

export function createManifestGraph(manifest = {}) {
  const chunks = new Map(
    Object.entries(manifest)
      .filter(([, chunk]) => chunk && typeof chunk.file === "string")
      .map(([key, chunk]) => [key, {
        ...chunk,
        assetName: manifestAssetName(chunk.file),
      }]),
  );
  const entryFiles = new Set();
  const deferredFiles = new Set();
  const visitedEntryKeys = new Set();
  const visitedDeferredKeys = new Set();

  const visitDeferred = (key) => {
    if (visitedDeferredKeys.has(key)) return;
    const chunk = chunks.get(key);
    if (!chunk) return;

    visitedDeferredKeys.add(key);
    deferredFiles.add(chunk.assetName);
    for (const importedKey of chunk.imports ?? []) {
      visitDeferred(importedKey);
    }
    for (const dynamicKey of chunk.dynamicImports ?? []) {
      visitDeferred(dynamicKey);
    }
  };

  const visitEntry = (key) => {
    if (visitedEntryKeys.has(key)) return;
    const chunk = chunks.get(key);
    if (!chunk) return;

    visitedEntryKeys.add(key);
    entryFiles.add(chunk.assetName);
    for (const importedKey of chunk.imports ?? []) {
      visitEntry(importedKey);
    }
    for (const dynamicKey of chunk.dynamicImports ?? []) {
      visitDeferred(dynamicKey);
    }
  };

  for (const [key, chunk] of chunks) {
    if (chunk.isEntry && !chunk.isDynamicEntry) {
      visitEntry(key);
    }
  }
  for (const [key, chunk] of chunks) {
    if (chunk.isDynamicEntry) {
      visitDeferred(key);
    }
  }

  return { entryFiles, deferredFiles };
}

export function collectJavaScriptFiles(rootDir) {
  const files = [];

  const visit = (currentDir) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (
        [".js", ".mjs"].includes(path.extname(entry.name)) &&
        !entry.name.endsWith(".map")
      ) {
        files.push(path.relative(rootDir, absolutePath).split(path.sep).join("/"));
      }
    }
  };

  visit(rootDir);
  return files;
}

export function identifyKeyChunk(filename) {
  const lower = filename.toLowerCase();
  for (const [category, patterns] of Object.entries(KEY_CHUNKS)) {
    if (patterns.some((pattern) => lower.includes(pattern))) {
      return category;
    }
  }
  return null;
}

export function isWorkerChunk(filename) {
  const normalized = filename.toLowerCase().replaceAll("\\", "/");
  return normalized.includes("/workers/") ||
    normalized.startsWith("workers/") ||
    normalized.includes(".worker-") ||
    normalized.includes(".worker.");
}

export function classifyChunk(chunk, manifestGraph) {
  const key = chunk.key ?? identifyKeyChunk(chunk.name);
  const worker = isWorkerChunk(chunk.name);
  const entry = manifestGraph?.entryFiles?.has(chunk.name) ?? false;
  const deferredFromManifest =
    manifestGraph?.deferredFiles?.has(chunk.name) ?? false;
  return {
    ...chunk,
    key,
    worker,
    deferred: worker || (deferredFromManifest && !entry),
  };
}

export function collectChunks(assetsDir, manifest = {}) {
  const manifestGraph = createManifestGraph(manifest);
  return collectJavaScriptFiles(assetsDir).map((name) => {
    const raw = fs.readFileSync(path.join(assetsDir, name));
    return classifyChunk({
      name,
      rawSize: raw.length,
      gzSize: zlib.gzipSync(raw).length,
      brSize: zlib.brotliCompressSync(raw).length,
    }, manifestGraph);
  });
}

export function collectStaticRuntimeChunks(buildDir, runtimeDir, key) {
  const rootDir = path.join(buildDir, runtimeDir);
  if (!fs.existsSync(rootDir)) return [];

  return collectJavaScriptFiles(rootDir).map((relativeName) => {
    const raw = fs.readFileSync(path.join(rootDir, relativeName));
    const chunk = classifyChunk({
      name: normalizePath(path.join(runtimeDir, relativeName)),
      rawSize: raw.length,
      gzSize: zlib.gzipSync(raw).length,
      brSize: zlib.brotliCompressSync(raw).length,
      key,
    });
    return {
      ...chunk,
      deferred: true,
    };
  });
}

export function summarizeChunks(chunks) {
  const sum = (predicate, field) =>
    chunks.filter(predicate).reduce((total, chunk) => total + chunk[field], 0);
  const all = () => true;
  const entry = (chunk) => !chunk.deferred;
  const deferred = (chunk) => chunk.deferred;
  const worker = (chunk) => chunk.worker;

  return {
    totalRawSize: sum(all, "rawSize"),
    totalGzSize: sum(all, "gzSize"),
    totalBrSize: sum(all, "brSize"),
    entryRawSize: sum(entry, "rawSize"),
    entryGzSize: sum(entry, "gzSize"),
    entryBrSize: sum(entry, "brSize"),
    deferredRawSize: sum(deferred, "rawSize"),
    workerRawSize: sum(worker, "rawSize"),
    workerGzSize: sum(worker, "gzSize"),
    workerBrSize: sum(worker, "brSize"),
  };
}
