#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import process from "node:process";

const cwd = process.cwd();
const assetsDir = path.join(cwd, "build", "assets");

// ---- Thresholds (in bytes) ----
const CHUNK_WARN = 500 * 1024; // 500 KB
const CHUNK_ERROR = 1024 * 1024; // 1 MB
const DEFERRED_CHUNK_WARN = 2 * 1024 * 1024; // 2 MB
const DEFERRED_CHUNK_ERROR = 6 * 1024 * 1024; // 6 MB
const ENTRY_JS_WARN = 5 * 1024 * 1024; // 5 MB
const ENTRY_JS_ERROR = 8 * 1024 * 1024; // 8 MB
const TOTAL_JS_WARN = 10 * 1024 * 1024; // 10 MB
const TOTAL_JS_ERROR = 15 * 1024 * 1024; // 15 MB

// ---- Chunk name mappings for key libraries ----
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

const DEFERRED_KEY_CHUNKS = new Set([
  "echarts",
  "graphviz",
  "monaco",
  "pdfjs",
  "pyodide",
  "typst",
  "xterm",
]);

/**
 * Identify if a filename belongs to a key chunk category.
 * Returns the category name or null.
 */
function identifyKeyChunk(filename) {
  const lower = filename.toLowerCase();
  for (const [category, patterns] of Object.entries(KEY_CHUNKS)) {
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        return category;
      }
    }
  }
  return null;
}

/**
 * Get gzip size of a buffer.
 */
function gzipSize(buf) {
  return zlib.gzipSync(buf).length;
}

/**
 * Get brotli size of a buffer.
 */
function brotliSize(buf) {
  return zlib.brotliCompressSync(buf).length;
}

/**
 * Format bytes to KB string with one decimal.
 */
function formatKB(bytes) {
  return (bytes / 1024).toFixed(1);
}

/**
 * Determine status for an individual chunk.
 */
function chunkStatus(size) {
  if (size >= CHUNK_ERROR) return "ERROR";
  if (size >= CHUNK_WARN) return "WARN";
  return "OK";
}

function isDeferredChunk(chunk) {
  return chunk.key && DEFERRED_KEY_CHUNKS.has(chunk.key);
}

function chunkBudgetStatus(chunk) {
  const warn = isDeferredChunk(chunk) ? DEFERRED_CHUNK_WARN : CHUNK_WARN;
  const error = isDeferredChunk(chunk) ? DEFERRED_CHUNK_ERROR : CHUNK_ERROR;
  if (chunk.rawSize >= error) return "ERROR";
  if (chunk.rawSize >= warn) return "WARN";
  return "OK";
}

// ---- Main ----
function main() {
  if (!fs.existsSync(assetsDir)) {
    console.error(
      `ERROR: Build output directory not found: ${assetsDir}\n` +
        `Run 'npm run build' first.`
    );
    process.exit(1);
  }

  const files = fs.readdirSync(assetsDir);
  const jsFiles = files.filter((f) => f.endsWith(".js") && !f.endsWith(".js.map"));

  if (jsFiles.length === 0) {
    console.warn("WARNING: No JS files found in build/assets/");
    process.exit(0);
  }

  // Collect data for each chunk
  const chunks = [];
  let totalJsSize = 0;

  for (const file of jsFiles) {
    const filePath = path.join(assetsDir, file);
    const raw = fs.readFileSync(filePath);
    const rawSize = raw.length;
    const gzSize = gzipSize(raw);
    const brSize = brotliSize(raw);
    const key = identifyKeyChunk(file);

    totalJsSize += rawSize;

    const chunk = {
      name: file,
      key,
      rawSize,
      gzSize,
      brSize,
    };
    chunk.status = chunkBudgetStatus(chunk);
    chunk.deferred = isDeferredChunk(chunk);
    chunks.push(chunk);
  }

  // Sort: key chunks first (alphabetically by category), then by size descending
  chunks.sort((a, b) => {
    if (a.key && !b.key) return -1;
    if (!a.key && b.key) return 1;
    if (a.key && b.key) return a.key.localeCompare(b.key);
    return b.rawSize - a.rawSize;
  });

  // ---- Console table: All chunks ----
  console.log("\n=== Bundle Budget Report ===\n");

  const tableData = chunks.map((c) => ({
    "Chunk": c.name,
    "Size (KB)": formatKB(c.rawSize),
    "Gzip (KB)": formatKB(c.gzSize),
    "Brotli (KB)": formatKB(c.brSize),
    "Scope": c.deferred ? "Deferred" : "Entry",
    "Status": c.status,
  }));

  // Find max column widths for pretty-printing
  const cols = [
    "Chunk",
    "Size (KB)",
    "Gzip (KB)",
    "Brotli (KB)",
    "Scope",
    "Status",
  ];
  const widths = {};
  for (const col of cols) {
    widths[col] = Math.max(
      col.length,
      ...tableData.map((r) => String(r[col]).length)
    );
  }

  // Print header
  const header = cols.map((c) => c.padEnd(widths[c])).join("  ");
  const separator = cols.map((c) => "-".repeat(widths[c])).join("  ");
  console.log(header);
  console.log(separator);

  for (const row of tableData) {
    const line = cols.map((c) => String(row[c]).padEnd(widths[c])).join("  ");
    console.log(line);
  }

  // ---- Summary ----
  const totalGz = chunks.reduce((s, c) => s + c.gzSize, 0);
  const totalBr = chunks.reduce((s, c) => s + c.brSize, 0);
  const entryChunks = chunks.filter((c) => !c.deferred);
  const deferredChunks = chunks.filter((c) => c.deferred);
  const entryJsSize = entryChunks.reduce((s, c) => s + c.rawSize, 0);
  const entryGz = entryChunks.reduce((s, c) => s + c.gzSize, 0);
  const entryBr = entryChunks.reduce((s, c) => s + c.brSize, 0);
  const deferredJsSize = deferredChunks.reduce((s, c) => s + c.rawSize, 0);

  console.log(`\n--- Summary ---`);
  console.log(`Total chunks:     ${chunks.length}`);
  console.log(`Entry JS (raw):   ${formatKB(entryJsSize)} KB (${(entryJsSize / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Entry JS (gzip):  ${formatKB(entryGz)} KB (${(entryGz / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Entry JS (brotli):${formatKB(entryBr)} KB (${(entryBr / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Deferred JS raw:  ${formatKB(deferredJsSize)} KB (${(deferredJsSize / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Total JS (raw):   ${formatKB(totalJsSize)} KB (${(totalJsSize / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Total JS (gzip):  ${formatKB(totalGz)} KB (${(totalGz / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Total JS (brotli):${formatKB(totalBr)} KB (${(totalBr / 1024 / 1024).toFixed(2)} MB)`);

  // ---- Key chunk gzip/brotli summary ----
  console.log(`\n--- Key Library Chunks ---`);
  const keyChunkSummary = {};
  for (const c of chunks) {
    if (c.key) {
      if (!keyChunkSummary[c.key]) {
        keyChunkSummary[c.key] = { rawSize: 0, gzSize: 0, brSize: 0 };
      }
      keyChunkSummary[c.key].rawSize += c.rawSize;
      keyChunkSummary[c.key].gzSize += c.gzSize;
      keyChunkSummary[c.key].brSize += c.brSize;
    }
  }

  const keySummaryData = Object.entries(keyChunkSummary).map(
    ([name, sizes]) => ({
      "Library": name,
      "Size (KB)": formatKB(sizes.rawSize),
      "Gzip (KB)": formatKB(sizes.gzSize),
      "Brotli (KB)": formatKB(sizes.brSize),
    })
  );

  const keyCols = ["Library", "Size (KB)", "Gzip (KB)", "Brotli (KB)"];
  const keyWidths = {};
  for (const col of keyCols) {
    keyWidths[col] = Math.max(
      col.length,
      ...keySummaryData.map((r) => String(r[col]).length)
    );
  }

  const keyHeader = keyCols.map((c) => c.padEnd(keyWidths[c])).join("  ");
  const keySeparator = keyCols
    .map((c) => "-".repeat(keyWidths[c]))
    .join("  ");
  console.log(keyHeader);
  console.log(keySeparator);

  for (const row of keySummaryData) {
    const line = keyCols
      .map((c) => String(row[c]).padEnd(keyWidths[c]))
      .join("  ");
    console.log(line);
  }

  // ---- Threshold checks ----
  let hasError = false;
  let hasWarning = false;

  const errorChunks = chunks.filter((c) => c.status === "ERROR");
  const warnChunks = chunks.filter((c) => c.status === "WARN");

  if (errorChunks.length > 0) {
    hasError = true;
    console.log(`\n*** CHUNK SIZE ERRORS ***`);
    console.log(`Entry threshold: ${formatKB(CHUNK_ERROR)} KB; deferred threshold: ${formatKB(DEFERRED_CHUNK_ERROR)} KB`);
    for (const c of errorChunks) {
      console.log(
        `  ${c.name}: ${formatKB(c.rawSize)} KB (gzip: ${formatKB(c.gzSize)} KB)`
      );
    }
  }

  if (warnChunks.length > 0) {
    hasWarning = true;
    console.log(`\n* CHUNK SIZE WARNINGS *`);
    console.log(`Entry threshold: ${formatKB(CHUNK_WARN)} KB; deferred threshold: ${formatKB(DEFERRED_CHUNK_WARN)} KB`);
    for (const c of warnChunks) {
      console.log(
        `  ${c.name}: ${formatKB(c.rawSize)} KB (gzip: ${formatKB(c.gzSize)} KB)`
      );
    }
  }

  if (entryJsSize >= ENTRY_JS_ERROR) {
    hasError = true;
    console.log(
      `\n*** ENTRY JS SIZE ERROR: ${(entryJsSize / 1024 / 1024).toFixed(2)} MB (threshold: 8 MB) ***`
    );
  } else if (entryJsSize >= ENTRY_JS_WARN) {
    hasWarning = true;
    console.log(
      `\n* ENTRY JS SIZE WARNING: ${(entryJsSize / 1024 / 1024).toFixed(2)} MB (threshold: 5 MB) *`
    );
  }

  if (totalJsSize >= TOTAL_JS_ERROR) {
    hasError = true;
    console.log(
      `\n*** TOTAL JS SIZE ERROR: ${(totalJsSize / 1024 / 1024).toFixed(2)} MB (threshold: 15 MB) ***`
    );
  } else if (totalJsSize >= TOTAL_JS_WARN) {
    hasWarning = true;
    console.log(
      `\n* TOTAL JS SIZE WARNING: ${(totalJsSize / 1024 / 1024).toFixed(2)} MB (threshold: 10 MB) *`
    );
  }

  let totalStatus = "OK";
  if (hasError) {
    totalStatus = "ERROR";
  } else if (hasWarning) {
    totalStatus = "WARN";
  }

  console.log(`\n=== Overall Status: ${totalStatus} ===\n`);

  if (hasError) {
    process.exit(1);
  }
}

main();
