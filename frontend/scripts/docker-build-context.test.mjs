import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptsDir, "..");
const repoRoot = path.resolve(frontendRoot, "..");
const reviewedStaticAssets = new Map([
  ["frontend/public/favicon.svg", 64 * 1024],
]);
const reviewedStaticExtension =
  /\.(?:ttf|otf|woff2?|eot|svg|png|jpe?g|gif|webp|wasm|map)$/i;

function activePatterns(file) {
  return fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

test("Docker context excludes local-only public runtimes", () => {
  const patterns = activePatterns(path.join(frontendRoot, ".dockerignore")).map(
    (line) => line.replace(/^\/|\/$/g, ""),
  );

  assert.ok(
    patterns.includes("public/pyodide"),
    "Docker context must exclude host-generated Pyodide assets",
  );
  assert.ok(
    patterns.includes("public/mindmap-demo"),
    "Docker context must exclude the local-only Mindmap runtime",
  );
  assert.ok(
    !patterns.some((line) => line.startsWith("!public/mindmap-demo")),
    "Docker context must not re-include Mindmap assets",
  );
});

test("backend Docker context excludes cached Docker CLI binaries", () => {
  const patterns = activePatterns(path.join(repoRoot, "backend", ".dockerignore")).map(
    (line) => line.replace(/^\/|\/$/g, ""),
  );

  assert.ok(
    patterns.includes("docker/bin"),
    "backend Docker context must exclude host-cached Docker CLI binaries",
  );
});

test("Git ignores local Codex coordination files", () => {
  const gitignore = activePatterns(path.join(repoRoot, ".gitignore"));
  assert.ok(
    gitignore.includes("/.codex/"),
    ".gitignore must keep local Codex handoff files out of release commits",
  );
});

test("Git ignores the complete local Mindmap runtime", () => {
  const gitignore = activePatterns(path.join(repoRoot, ".gitignore"));
  assert.ok(
    gitignore.includes("frontend/public/mindmap-demo/"),
    ".gitignore must exclude the complete local Mindmap runtime",
  );
  assert.ok(
    !gitignore.some((line) => line.startsWith("!frontend/public/mindmap-demo")),
    "Mindmap assets must not be re-enabled by per-file allowlists",
  );

  const probes = [
    "frontend/public/mindmap-demo/index.html",
    "frontend/public/mindmap-demo/js/app.js",
    "frontend/public/mindmap-demo/fonts/font.ttf",
    "frontend/public/mindmap-demo/fonts/font.woff2",
    "frontend/public/mindmap-demo/img/icon.svg",
    "frontend/public/mindmap-demo/img/theme.png",
  ];
  const result = spawnSync("git", ["check-ignore", "--no-index", "--", ...probes], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim().split(/\r?\n/).sort(), probes.sort());

  const tracked = spawnSync(
    "git",
    ["ls-files", "--", "frontend/public/mindmap-demo"],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );
  assert.equal(tracked.error, undefined);
  assert.equal(tracked.status, 0, tracked.stderr);
  assert.equal(tracked.stdout.trim(), "", "Mindmap runtime must not be tracked");
});

test("tracked public assets are not hidden by a broad ignore rule", () => {
  const gitignore = activePatterns(path.join(repoRoot, ".gitignore"));

  assert.ok(
    !gitignore.includes("frontend/public"),
    ".gitignore must not hide the complete frontend/public directory",
  );
  assert.ok(
    gitignore.includes("frontend/public/pyodide/"),
    ".gitignore must keep generated Pyodide assets ignored",
  );
  assert.ok(
    fs.existsSync(path.join(frontendRoot, "public", "favicon.svg")),
    "tracked frontend/public/favicon.svg must exist",
  );
});

test("Git tracks only explicitly reviewed binary and generated-style assets", () => {
  const result = spawnSync("git", ["ls-files"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);

  const trackedAssets = result.stdout
    .split(/\r?\n/)
    .filter((name) => reviewedStaticExtension.test(name))
    .sort();
  assert.deepEqual(trackedAssets, [...reviewedStaticAssets.keys()].sort());

  for (const [name, maxBytes] of reviewedStaticAssets) {
    const size = fs.statSync(path.join(repoRoot, name)).size;
    assert.ok(
      size <= maxBytes,
      `${name} is ${size} bytes and exceeds its reviewed ${maxBytes}-byte limit`,
    );
  }
});

test("production builds remove the local-only Mindmap runtime after Vite copies public assets", () => {
  const viteConfig = fs.readFileSync(
    path.join(frontendRoot, "vite.config.ts"),
    "utf8",
  );

  assert.match(viteConfig, /name:\s*"exclude-local-mindmap-runtime"/);
  assert.match(viteConfig, /const isProductionBuild = mode === "production"/);
  assert.match(viteConfig, /apply:\s*\(\) => isProductionBuild/);
  assert.match(
    viteConfig,
    /rmSync\(join\(__dirname,\s*"build\/mindmap-demo"\),\s*\{[\s\S]*?recursive:\s*true,[\s\S]*?force:\s*true/,
  );
});

test("production Caddy returns an explicit uncached 404 for local-only Mindmap paths", () => {
  const caddyfile = fs.readFileSync(
    path.join(frontendRoot, "caddy", "Caddyfile.prod"),
    "utf8",
  );
  const mindmapHandler = caddyfile.match(
    /@mindmap_runtime\s+path[^\n]+\n\s*handle @mindmap_runtime \{([\s\S]*?)\n\s*\}/,
  );

  assert.ok(mindmapHandler, "Caddyfile must define the Mindmap production boundary");
  assert.match(mindmapHandler[1], /Cache-Control "no-store"/);
  assert.match(mindmapHandler[1], /respond "" 404/);
  assert.match(
    caddyfile,
    /@static_assets path[^\n]*\/favicon\.svg/,
    "Caddy must serve favicon.svg as a real static file instead of SPA fallback",
  );
  assert.ok(
    caddyfile.indexOf("handle @mindmap_runtime") < caddyfile.indexOf("\thandle {"),
    "Mindmap 404 handling must run before the SPA fallback",
  );
});
