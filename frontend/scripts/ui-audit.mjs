#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const cwd = process.cwd();
const srcDir = path.join(cwd, "src");
const defaultBaselinePath = path.join(cwd, "scripts", "ui-audit-baseline.json");
const defaultRoutesPath = path.join(cwd, "scripts", "ui-visual-routes.json");

const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);

const CSS_PX_DECLARATION =
  /\b(?:font-size|line-height|padding(?:-(?:top|right|bottom|left))?|margin(?:-(?:top|right|bottom|left))?|gap|row-gap|column-gap|width|min-width|max-width|height|min-height|max-height|top|right|bottom|left|border-radius)\s*:\s*-?\d+(?:\.\d+)?px\b/g;

const TAILWIND_ARBITRARY_PX =
  /\b(?:text|w|h|min-w|min-h|max-w|max-h|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|rounded|inset|top|right|bottom|left)-\[-?\d+(?:\.\d+)?px\]/g;

const INLINE_STYLE_PX =
  /\b(?:width|minWidth|maxWidth|height|minHeight|maxHeight|padding(?:Top|Right|Bottom|Left)?|margin(?:Top|Right|Bottom|Left)?|gap|rowGap|columnGap|top|right|bottom|left|borderRadius)\s*:\s*["'`]-?\d+(?:\.\d+)?px["'`]/g;

const INLINE_STYLE_NUMBER =
  /\b(?:width|minWidth|maxWidth|height|minHeight|maxHeight|padding(?:Top|Right|Bottom|Left)?|margin(?:Top|Right|Bottom|Left)?|gap|rowGap|columnGap|top|right|bottom|left|borderRadius)\s*:\s*-?\d+(?:\.\d+)?(?=[,\s}])/g;

const KEY_ROUTES_FALLBACK = [
  "/home",
  "/ai-agents",
  "/articles",
  "/informatics",
  "/it-technology",
  "/admin/dashboard",
  "/admin/ai-agents",
  "/admin/informatics",
  "/admin/it-technology",
  "/admin/articles",
];

const ROUTE_MATCHERS = [
  { route: "/home", test: /^pages\/Home\// },
  { route: "/ai-agents", test: /^pages\/AIAgents\// },
  { route: "/articles", test: /^pages\/Articles\// },
  { route: "/informatics", test: /^pages\/Informatics\// },
  { route: "/it-technology", test: /^pages\/ITTechnology\// },
  { route: "/admin/dashboard", test: /^pages\/Admin\/Dashboard\// },
  { route: "/admin/ai-agents", test: /^pages\/Admin\/AIAgents\// },
  { route: "/admin/informatics", test: /^pages\/Admin\/Informatics\// },
  { route: "/admin/it-technology", test: /^pages\/Admin\/ITTechnology\// },
  { route: "/admin/articles", test: /^pages\/Admin\/Articles\// },
];

const PATTERN_CONFIGS = [
  { name: "css_px_declaration", re: CSS_PX_DECLARATION },
  { name: "tailwind_arbitrary_px", re: TAILWIND_ARBITRARY_PX },
  { name: "inline_style_px_string", re: INLINE_STYLE_PX },
  { name: "inline_style_numeric", re: INLINE_STYLE_NUMBER },
];

const argv = process.argv.slice(2);
const hasFlag = (flag) => argv.includes(flag);
const getArgValue = (flag, fallback = "") => {
  const idx = argv.indexOf(flag);
  if (idx === -1) return fallback;
  const val = argv[idx + 1];
  return val && !val.startsWith("--") ? val : fallback;
};

const outputJson = hasFlag("--json");
const ciMode = hasFlag("--ci");
const outputPath = getArgValue("--output", "");
const baselinePath = getArgValue("--baseline", defaultBaselinePath);
const routesPath = getArgValue("--routes", defaultRoutesPath);
const targetRoute = getArgValue("--route", "");

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function loadRoutes() {
  const fromFile = readJsonSafe(routesPath, null);
  if (Array.isArray(fromFile?.routes) && fromFile.routes.length > 0) {
    return fromFile.routes;
  }
  return KEY_ROUTES_FALLBACK;
}

function walkFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    if (ent.name === "node_modules" || ent.name === "build" || ent.name === "dist") continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkFiles(full, out);
      continue;
    }
    const ext = path.extname(ent.name);
    if (SCAN_EXTENSIONS.has(ext)) out.push(full);
  }
  return out;
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function getRouteFromRelativePath(relPath) {
  for (const matcher of ROUTE_MATCHERS) {
    if (matcher.test.test(relPath)) return matcher.route;
  }
  return "shared";
}

function sortObjectDesc(obj) {
  return Object.fromEntries(
    Object.entries(obj).sort((a, b) => b[1] - a[1]),
  );
}

function auditFile(absPath) {
  const text = fs.readFileSync(absPath, "utf8");
  const hitSet = new Set();
  const byType = {};

  for (const cfg of PATTERN_CONFIGS) {
    const re = new RegExp(cfg.re.source, cfg.re.flags);
    let match;
    while ((match = re.exec(text)) !== null) {
      const key = `${match.index}:${match[0]}`;
      if (hitSet.has(key)) continue;
      hitSet.add(key);
      byType[cfg.name] = (byType[cfg.name] || 0) + 1;
    }
  }

  return {
    totalHits: hitSet.size,
    byType,
  };
}

function buildReport() {
  if (!fs.existsSync(srcDir)) {
    throw new Error(`src dir not found: ${srcDir}`);
  }

  const files = walkFiles(srcDir);
  const byType = {};
  const byFile = {};
  const byRoute = {};
  const byRouteFiles = {};
  const byRouteFileHits = {};

  for (const file of files) {
    const rel = toPosix(path.relative(srcDir, file));
    const route = getRouteFromRelativePath(rel);
    const result = auditFile(file);

    if (result.totalHits <= 0) continue;

    byFile[`src/${rel}`] = result.totalHits;
    byRoute[route] = (byRoute[route] || 0) + result.totalHits;
    byRouteFiles[route] = (byRouteFiles[route] || 0) + 1;
    if (!byRouteFileHits[route]) byRouteFileHits[route] = {};
    byRouteFileHits[route][`src/${rel}`] = result.totalHits;

    for (const [name, count] of Object.entries(result.byType)) {
      byType[name] = (byType[name] || 0) + count;
    }
  }

  const totalHits = Object.values(byFile).reduce((sum, n) => sum + n, 0);
  const keyRoutes = loadRoutes();
  const keyRouteHits = Object.fromEntries(
    keyRoutes.map((route) => [route, byRoute[route] || 0]),
  );

  const byRouteTopFiles = Object.fromEntries(
    Object.entries(byRouteFileHits).map(([route, fileHits]) => [
      route,
      Object.entries(fileHits)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([file, hits]) => ({ file, hits })),
    ]),
  );

  return {
    generated_at: new Date().toISOString(),
    scope: {
      root: cwd,
      src: "src",
      extensions: Array.from(SCAN_EXTENSIONS),
      files_scanned: files.length,
      files_with_hits: Object.keys(byFile).length,
    },
    totals: {
      hits_total: totalHits,
    },
    by_type: sortObjectDesc(byType),
    by_route: sortObjectDesc(byRoute),
    by_route_files: sortObjectDesc(byRouteFiles),
    by_route_top_files: byRouteTopFiles,
    key_route_hits: keyRouteHits,
    top_files: Object.entries(byFile)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([file, hits]) => ({ file, hits })),
  };
}

function runCiGate(report) {
  const baseline = readJsonSafe(baselinePath, null);
  if (!baseline) {
    console.error(`[ui-audit] baseline not found: ${baselinePath}`);
    process.exit(2);
  }

  const baselineTotal =
    baseline?.thresholds?.max_total_hits ??
    baseline?.totals?.hits_total ??
    baseline?.hits_total;

  if (typeof baselineTotal !== "number") {
    console.error("[ui-audit] invalid baseline total hits");
    process.exit(2);
  }

  let hasError = false;

  if (report.totals.hits_total > baselineTotal) {
    hasError = true;
    console.error(
      `[ui-audit] total hits increased: ${report.totals.hits_total} > ${baselineTotal}`,
    );
  }

  const baselineRouteThresholds = baseline?.thresholds?.max_route_hits || {};
  for (const [route, maxHits] of Object.entries(baselineRouteThresholds)) {
    const cur = report.key_route_hits?.[route] || 0;
    if (typeof maxHits === "number" && cur > maxHits) {
      hasError = true;
      console.error(`[ui-audit] route ${route} hits increased: ${cur} > ${maxHits}`);
    }
  }

  if (hasError) {
    process.exit(1);
  }

  console.log(`[ui-audit] gate passed. total hits: ${report.totals.hits_total}`);
}

function printSummary(report, route = "") {
  console.log("UI Audit Report");
  console.log("===============");
  console.log(`generated_at: ${report.generated_at}`);
  console.log(`files_scanned: ${report.scope.files_scanned}`);
  console.log(`files_with_hits: ${report.scope.files_with_hits}`);
  console.log(`hits_total: ${report.totals.hits_total}`);

  if (route) {
    const routeHits = report.by_route?.[route] || 0;
    const routeFiles = report.by_route_files?.[route] || 0;
    console.log("");
    console.log(`Route: ${route}`);
    console.log(`route_hits: ${routeHits}`);
    console.log(`route_files_with_hits: ${routeFiles}`);
    console.log("");
    console.log("Route Top Files:");
    const routeTopFiles = report.by_route_top_files?.[route] || [];
    routeTopFiles.slice(0, 15).forEach((it) => {
      console.log(`  ${it.file}: ${it.hits}`);
    });
    return;
  }

  console.log("");
  console.log("Top Routes:");
  Object.entries(report.by_route)
    .slice(0, 10)
    .forEach(([route, hits]) => {
      console.log(`  ${route}: ${hits}`);
    });
  console.log("");
  console.log("Top Files:");
  report.top_files.slice(0, 10).forEach((it) => {
    console.log(`  ${it.file}: ${it.hits}`);
  });
}

try {
  const report = buildReport();

  if (outputPath) {
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  if (outputJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printSummary(report, targetRoute);
  }

  if (ciMode) {
    runCiGate(report);
  }
} catch (error) {
  console.error("[ui-audit] failed:", error?.message || error);
  process.exit(1);
}
