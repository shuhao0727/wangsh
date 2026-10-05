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

// G2 盲区修复（task-27）：原尾锚 `px\]` 只认字面 px，导致 `w-[280px]` 的
// 等价改写 `w-[17.5rem]` / `w-[1.5em]` **完全不计数**——这正是计划 §3 G2 描述的
// 「改成 var()/其它单位即命中归零」通道。现补 rem/em 两个单位。
// 保留原 `px` 分支不合并的理由：px 是既有基线口径，改动它会让
// ui-audit 的历史 ratchet 值发生无意义漂移；新增单位只做**加宽匹配面**。
const TAILWIND_ARBITRARY_LENGTH =
  /\b(?:text|w|h|min-w|min-h|max-w|max-h|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|rounded|inset|top|right|bottom|left)-\[-?\d+(?:\.\d+)?(?:px|rem|em)\](?![\w-])/g;

const TAILWIND_ARBITRARY_PX =
  /\b(?:text|w|h|min-w|min-h|max-w|max-h|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|rounded|inset|top|right|bottom|left)-\[-?\d+(?:\.\d+)?px\](?![\w-])/g;

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
  "/admin/agent-data",
  "/admin/assessment",
  "/admin/users",
  "/admin/categories",
  "/admin/classroom-plan",
  "/admin/classroom-interaction",
  "/admin/group-discussion",
  "/admin/system",
];

// 按 *实际路由* 一一对应到 src/pages/** 目录。新增路由时必须同时在此补 matcher，
// 否则该路由的所有命中会静默落进 "shared" 桶（无阈值 → 无监管）。
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
  { route: "/admin/agent-data", test: /^pages\/Admin\/AgentData\// },
  { route: "/admin/assessment", test: /^pages\/Admin\/Assessment\// },
  { route: "/admin/users", test: /^pages\/Admin\/Users\// },
  { route: "/admin/categories", test: /^pages\/Admin\/Categories\// },
  { route: "/admin/classroom-plan", test: /^pages\/Admin\/ClassroomPlan\// },
  {
    route: "/admin/classroom-interaction",
    test: /^pages\/Admin\/ClassroomInteraction\//,
  },
  { route: "/admin/group-discussion", test: /^pages\/Admin\/GroupDiscussion\// },
  { route: "/admin/system", test: /^pages\/Admin\/System\// },
];

const PATTERN_CONFIGS = [
  { name: "css_px_declaration", re: CSS_PX_DECLARATION },
  // 既有键保持不变：tailwind_arbitrary_px 仍是 **px 专属**口径，历史基线不回退。
  { name: "tailwind_arbitrary_px", re: TAILWIND_ARBITRARY_PX },
  // G2 新增：px/rem/em 全长口径（超集）。px 部分与上一键重叠，由
  // tailwindArbitraryNonPxCount() 做差集后**只把非 px 的增量**补进计数，
  // 避免污染既有 px 键与 hits_total。
  { name: "tailwind_arbitrary_length", re: TAILWIND_ARBITRARY_LENGTH },
  { name: "inline_style_px_string", re: INLINE_STYLE_PX },
  { name: "inline_style_numeric", re: INLINE_STYLE_NUMBER },
];


// ---------------------------------------------------------------- G5 不可动命中
// 计划 3.1 G5：分母被「物理上不可迁移」的命中污染，让迁移率虚低、也让 ratchet
// 永远不可能归零。这里把两类命中单独归出 actionable 口径，
// 使「门禁管的」始终等于「真能改的」。
//
// 1) 媒体查询断点：断点里的视口宽度由 Tailwind 断点表决定，不是可 token 化的
//    设计决策（本仓断点全是 px 视口宽度：430/576/640/768/1366/1920/2560）。
// 2) 0 值复位：minWidth: 0 / minHeight: 0 / margin: 0 等无单位 0，
//    对应 Tailwind 的 min-w-0 / m-0，是几何复位而非间距欠账，
//    迁成语义 token 反而有害。

// 标记媒体查询块内的字符区间（含条件本身与其整块内容）
function mediaQueryRanges(text) {
  const ranges = [];
  const re = /@media[^{]*/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    const open = text.indexOf("{", start);
    if (open === -1) break;
    let depth = 0;
    let end = open;
    for (let i = open; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    ranges.push([start, end]);
  }
  return ranges;
}

function inRanges(ranges, index) {
  for (const [a, b] of ranges) {
    if (index >= a && index <= b) return true;
  }
  return false;
}

// 无单位 0（含 -0、0.00）：几何复位，不可迁移
// match[0] 形如 "minWidth: 0"（INLINE_STYLE_NUMBER 已用前瞻裁掉了结尾的 , } 等），
// 所以这里只需判断「冒号后的值是否为 0」，锚在串尾即可。
// ⚠️ 不能同时用 (?=[,s}]) 前瞻 + $ 锚：二者互斥，正则永不匹配。
const ZERO_NUMERIC = /:\s*-?0+(?:\.0+)?\s*$/;

// ---------------------------------------------------------------- by_scope
// 分口径（计划 §3.1 / §4.1 B0-②）：route 桶回答"哪个页面"，scope 桶回答"责任人是谁"。
// 二者正交：page 桶 = 页面自身可直接 token 化；shared_components 桶 = 组件被 N 个页面共用，
// 改动风险是全站；infrastructure 桶 = 全局 CSS/布局，一次改动影响所有页面。
// "shared" route 桶把这三类混为一谈，导致最难的 styles/index.css 与最易的页面组件同权。
//
// 判定顺序（按路径稳定性，不按目录猜测）：
//   1. 测试文件优先 -> test   （与 src/ 共址，其余分类对它们无意义）
//   2. src/pages/**  -> page  （页面私有，含同目录 .css）
//   3. 其余 .css     -> infrastructure（全局样式表；本仓不存在非 pages 的页面级 css）
//   4. 其余非 pages  -> shared_components（src/components、src/layouts、src/hooks 等）
const SCOPE_ORDER = ["page", "shared_components", "infrastructure", "test"];

function getScopeFromRelativePath(relPath) {
  const isTest = /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(relPath);
  if (isTest) return "test";
  if (relPath.startsWith("pages/")) return "page";
  const ext = path.extname(relPath);
  if (ext === ".css") return "infrastructure";
  return "shared_components";
}

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
const adoptMode = hasFlag("--adopt");
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
  const byTypeActionable = {};
  const mediaRanges = mediaQueryRanges(text);

  for (const cfg of PATTERN_CONFIGS) {
    const re = new RegExp(cfg.re.source, cfg.re.flags);
    let match;
    while ((match = re.exec(text)) !== null) {
      const key = `${match.index}:${match[0]}`;
      if (hitSet.has(key)) continue;
      hitSet.add(key);
      byType[cfg.name] = (byType[cfg.name] || 0) + 1;

      // G5：媒体查询断点不可迁移
      if (cfg.name === "css_px_declaration" && inRanges(mediaRanges, match.index)) {
        continue;
      }
      // G5：无单位 0 值不可迁移
      if (cfg.name === "inline_style_numeric" && ZERO_NUMERIC.test(match[0])) {
        continue;
      }
      byTypeActionable[cfg.name] = (byTypeActionable[cfg.name] || 0) + 1;
    }
  }

  const actionable = Object.values(byTypeActionable).reduce((a, b) => a + b, 0);

  return {
    totalHits: hitSet.size,
    actionableHits: actionable,
    byType,
    byTypeActionable,
  };
}

function buildReport() {
  if (!fs.existsSync(srcDir)) {
    throw new Error(`src dir not found: ${srcDir}`);
  }

  const files = walkFiles(srcDir);
  const byType = {};
  const byTypeActionable = {};
  const byFile = {};
  const byRoute = {};
  const byRouteFiles = {};
  const byRouteFileHits = {};
  const byScope = {};
  const byScopeFiles = {};
  const byScopeFileHits = {};
  // 实际含「可迁移命中」的文件数（files_with_hits 是含不可动命中的文件数，两者口径不同）
  const filesWithActionable = new Set();
  // 真实全量命中（含 @media 断点 / 0 值这类不可动项），与 byFile 的 actionable 口径分开累加。
  // 若复用 byFile 求和，hits_total 会退化成 actionable，口径分层就名存实亡。
  let totalHitsRaw = 0;

  for (const file of files) {
    const rel = toPosix(path.relative(srcDir, file));
    const route = getRouteFromRelativePath(rel);
    const scope = getScopeFromRelativePath(rel);
    const result = auditFile(file);

    if (result.totalHits <= 0) continue;

    totalHitsRaw += result.totalHits;

    // G5：所有 ratchet 维度（file / route / scope）一律用 actionable 口径，
    // 使"门禁管的"与"真能改的"始终相等。totalHits 只留在 by_type 与 totals 里做对照，
    // 便于审计时看清"这次虚低了多少"。
    const n = result.actionableHits;
    byFile[`src/${rel}`] = n;
    if (n > 0) filesWithActionable.add(`src/${rel}`);
    byRoute[route] = (byRoute[route] || 0) + n;
    byRouteFiles[route] = (byRouteFiles[route] || 0) + 1;
    if (!byRouteFileHits[route]) byRouteFileHits[route] = {};
    byRouteFileHits[route][`src/${rel}`] = n;
    byScope[scope] = (byScope[scope] || 0) + n;
    byScopeFiles[scope] = (byScopeFiles[scope] || 0) + 1;
    if (!byScopeFileHits[scope]) byScopeFileHits[scope] = {};
    byScopeFileHits[scope][`src/${rel}`] = n;

    for (const [name, count] of Object.entries(result.byType)) {
      byType[name] = (byType[name] || 0) + count;
    }
    for (const [name, count] of Object.entries(result.byTypeActionable || {})) {
      byTypeActionable[name] = (byTypeActionable[name] || 0) + count;
    }
  }

  const actionableTotal = Object.values(byTypeActionable).reduce((a, b) => a + b, 0);

  const totalHits = totalHitsRaw;
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
      files_with_actionable_hits: filesWithActionable.size,
    },
    totals: {
      hits_total: totalHits,
      actionable_hits: actionableTotal,
      non_actionable_hits: totalHits - actionableTotal,
    },
    by_type: sortObjectDesc(byType),
    by_route: sortObjectDesc(byRoute),
    by_route_files: sortObjectDesc(byRouteFiles),
    by_route_top_files: byRouteTopFiles,
    by_scope: Object.fromEntries(
      SCOPE_ORDER.filter((s) => byScope[s] !== undefined).map((s) => [s, byScope[s]]),
    ),
    by_scope_files: Object.fromEntries(
      SCOPE_ORDER.filter((s) => byScopeFiles[s] !== undefined).map((s) => [s, byScopeFiles[s]]),
    ),
    by_scope_top_files: Object.fromEntries(
      SCOPE_ORDER.filter((s) => byScopeFileHits[s]).map((s) => [
        s,
        Object.entries(byScopeFileHits[s])
          .sort((m, n) => n[1] - m[1])
          .slice(0, 20)
          .map(([file, hits]) => ({ file, hits })),
      ]),
    ),
    // full per-file map: key_route_top_files / top_files 都有截断，
    // 该字段用于「基线只降不升」的重放校验（可证明收紧只针对已列入的键）。
    by_file: Object.fromEntries(Object.entries(byFile).sort((a, b) => b[1] - a[1])),
    key_route_hits: keyRouteHits,
    top_files: Object.entries(byFile)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([file, hits]) => ({ file, hits })),
  };
}

// ------------------------------------------------------------- ratchet 核心
// 计划 §5.3 / §4.1-⑤ / §三 G4：基线 = 上次绿构建的实测值，是**等式**而非上界。
//   - actual > baseline  -> 回归，红（原有行为）
//   - actual < baseline  -> 基线松弛（stale baseline），同样红，并给出可复制的收紧命令
// route 值取 report.by_route（全量聚合），不取 key_route_hits —— 后者只覆盖
// ui-visual-routes.json 里的 12 条，会漏掉 /admin/agent-data 等 10 条待审桶。
const TIGHTEN_CMD = "npm run -s ui:audit -- --ci --adopt";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function runCiGate(report) {
  const baseline = readJsonSafe(baselinePath, null);
  if (!baseline) {
    console.error(`[ui-audit] baseline not found: ${baselinePath}`);
    process.exit(2);
  }

  // G5 后口径分层（计划 §3.1）：
  //   hits_total        —— 扫描到的全部命中（含不可动），**不是**门禁的主口径
  //   actionable_hits   —— 真能改的命中，才是 ratchet 的主口径
  //   non_actionable_hits —— @media 断点 + 无单位 0 值，永不迁移，不纳入主口径
  // 旧基线（无 actionable_hits）回退到 hits_total，保持向后兼容。
  const baselineActionable =
    baseline?.thresholds?.max_actionable_hits ??
    baseline?.totals?.actionable_hits;
  const baselineTotal =
    baseline?.thresholds?.max_total_hits ??
    baseline?.totals?.hits_total ??
    baseline?.hits_total;

  if (typeof baselineActionable !== "number" && typeof baselineTotal !== "number") {
    console.error("[ui-audit] invalid baseline: no actionable_hits nor hits_total");
    process.exit(2);
  }

  let hasError = false;
  const regressions = [];
  const loosenings = [];

  const compare = (label, actual, expected, tightenHint) => {
    if (typeof expected !== "number") return;
    if (actual > expected) {
      hasError = true;
      regressions.push(`[ui-audit] ${label} hits increased: ${actual} > ${expected}`);
      return;
    }
    if (actual < expected) {
      hasError = true;
      loosenings.push(tightenHint || `[ui-audit] ${label} tighten hint: actual ${actual} < ${expected}`);
    }
  };

  // G5 后主口径：actionable（可迁移）命中。这是 ratchet 的唯一真口径。
  // 同时仍比对 hits_total，防止有人把"不可动"比例调高来洗白（口径不变则该值不变）。
  if (typeof baselineActionable === "number") {
    compare("actionable", report.totals.actionable_hits, baselineActionable);
  }
  if (typeof baselineTotal === "number") {
    compare("total", report.totals.hits_total, baselineTotal);
  }

  // ② by_type 四类**分别** ratchet：防 "CSS 命中换 TSX 命中" 腾挪。
  //    baseline.by_type 缺失（旧基线）时跳过，不发明阈值。
  const baselineByType = baseline?.thresholds?.max_by_type ?? baseline?.by_type;
  if (isPlainObject(baselineByType)) {
    for (const [type, maxHits] of Object.entries(baselineByType)) {
      compare(`type ${type}`, report.by_type?.[type] || 0, maxHits);
    }
  }

  // ③ by_scope 分口径（page / shared_components / infrastructure / test）
  const baselineByScope = baseline?.thresholds?.max_by_scope ?? baseline?.by_scope;
  if (isPlainObject(baselineByScope)) {
    for (const [scope, maxHits] of Object.entries(baselineByScope)) {
      compare(`scope ${scope}`, report.by_scope?.[scope] || 0, maxHits);
    }
  }

  // ④ route：以 thresholds.max_route_hits 为准；如果 baseline 仍保留 key_route_hits
  //    中但 thresholds 未覆盖的键（任务 1 审计出的盲区），按实测补齐比较，不再静默放行。
  const baselineRouteThresholds = {
    ...(baseline?.key_route_hits || {}),
    ...(baseline?.thresholds?.max_route_hits || {}),
  };
  for (const [route, maxHits] of Object.entries(baselineRouteThresholds)) {
    if (typeof maxHits !== "number") continue;
    const cur = report.by_route?.[route] ?? report.key_route_hits?.[route] ?? 0;
    compare(`route ${route}`, cur, maxHits);
  }

  if (loosenings.length > 0) {
    console.error(
      "[ui-audit] baseline is looser than reality (stale/regressed baseline) — tighten it:",
    );
    for (const line of loosenings) console.error(`  ${line}`);
    console.error(`[ui-audit] 收紧方式: ${TIGHTEN_CMD}`);
    console.error(
      "[ui-audit] 说明：基线只降不升。实测低于基线时 CI 必须红，否则迁移收益会被静默浪费，历史值只升不降（G4）。",
    );
    console.error(
      "[ui-audit] 如为有意的临时豁免，请在 baseline 中删除对应键并记录理由，而不是保留松弛阈值。",
    );
  }

  // ⑤ 同源灵敏性证明：把"删掉文件"这种**基线里没有键、但正是最该被看见的倒退**
  //    也纳入检测。比对 baseline.by_file 与本次实测 by_file 的全量并集，
  //    任何键的下降都视为"基线可收紧"，避免"从未列入基线的文件"成为第二个 shared 黑洞。
  const baselineByFile = baseline?.by_file;
  if (isPlainObject(baselineByFile)) {
    const liveByFile = report.by_file || {};
    const files = new Set([...Object.keys(baselineByFile), ...Object.keys(liveByFile)]);
    for (const file of [...files].sort()) {
      const actual = liveByFile[file] || 0;
      const expected = baselineByFile[file];
      if (typeof expected !== "number") continue;
      if (actual > expected) {
        hasError = true;
        regressions.push(`[ui-audit] file ${file} hits increased: ${actual} > ${expected}`);
      } else if (actual < expected) {
        hasError = true;
        loosenings.push(
          `[ui-audit] file ${file} tighten hint: actual ${actual} < ${expected}`,
        );
      }
    }
  }

  for (const line of regressions) console.error(line);

  return { hasError, regressions, loosenings };
}

// ------------------------------------------------------------ baseline 更新
// 收紧是唯一允许的自动写基线路径：对 baseline 里每个数值键取 min(baseline, live)。
// 任何键想要变大都会被拒绝并打印，必须走 reference.ratchet_debt 显式登记。
function adoptBaseline(report) {
  const baseline = readJsonSafe(baselinePath, null);
  if (!baseline) {
    console.error(`[ui-audit] baseline not found: ${baselinePath}`);
    process.exit(2);
  }

  const refused = [];
  const applied = [];

  // ── 机器可读的「加宽授权」：reference.ratchet_debt 里带 grant_* 字段的条目。
  //
  // 背景：此前 ratchet_debt 只出现在**注释与错误提示**里，代码从不读取它——
  // 也就是说「按提示登记理由」这条路**根本走不通**，--adopt 照样会被拒。
  // 而「新增一个指标类型」必然会抬高 max_total_hits/by_scope/by_route/by_file
  // 这些**存量聚合键**（新类型的命中被计入聚合），若一律拒绝，任何新指标都无法接入。
  //
  // 因此授权必须可机读、且**精确到键与额度**，避免变成无限放宽：
  //   { grant_key: "max_total_hits", grant_from: 724, grant_to: 733, recorded_at, reason }
  // 只有 label 精确匹配、且 current===grant_from、liveValue===grant_to 时才放行一次。
  const grants = new Map();
  for (const e of (baseline.reference && baseline.reference.ratchet_debt) || []) {
    if (e && typeof e.grant_key === "string" && typeof e.grant_to === "number") {
      grants.set(e.grant_key, e);
    }
  }

  const takeMin = (container, key, liveValue, label) => {
    if (typeof liveValue !== "number") return;
    const current = container[key];
    if (typeof current !== "number") {
      container[key] = liveValue;
      applied.push(`${label} = ${liveValue} (new)`);
      return;
    }
    if (liveValue > current) {
      const g = grants.get(label);
      if (g && g.grant_from === current && g.grant_to === liveValue) {
        container[key] = liveValue;
        applied.push(`${label}: ${current} -> ${liveValue} (granted: ${g.reason || "no reason"})`);
        return;
      }
      refused.push(`${label}: ${current} -> ${liveValue} (+${liveValue - current})`);
      return;
    }
    if (liveValue < current) {
      applied.push(`${label}: ${current} -> ${liveValue}`);
      container[key] = liveValue;
    }
  };

  if (typeof report.totals.actionable_hits === "number") {
    takeMin(baseline.thresholds, "max_actionable_hits", report.totals.actionable_hits, "max_actionable_hits");
    takeMin(baseline.totals, "actionable_hits", report.totals.actionable_hits, "totals.actionable_hits");
  }
  takeMin(baseline.thresholds, "max_total_hits", report.totals.hits_total, "max_total_hits");
  for (const [type, hits] of Object.entries(report.by_type || {})) {
    takeMin(baseline.thresholds.max_by_type || (baseline.thresholds.max_by_type = {}), type, hits, `max_by_type.${type}`);
    takeMin(baseline.by_type || (baseline.by_type = {}), type, hits, `by_type.${type}`);
  }
  for (const [scope, hits] of Object.entries(report.by_scope || {})) {
    takeMin(baseline.thresholds.max_by_scope || (baseline.thresholds.max_by_scope = {}), scope, hits, `max_by_scope.${scope}`);
    takeMin(baseline.by_scope || (baseline.by_scope = {}), scope, hits, `by_scope.${scope}`);
  }
  for (const [route, hits] of Object.entries(report.by_route || {})) {
    takeMin(baseline.thresholds.max_route_hits || (baseline.thresholds.max_route_hits = {}), route, hits, `max_route_hits.${route}`);
  }
  for (const [file, hits] of Object.entries(report.by_file || {})) {
    takeMin(baseline.by_file || (baseline.by_file = {}), file, hits, `by_file.${file}`);
  }
  for (const file of Object.keys(baseline.by_file || {})) {
    if (!(file in (report.by_file || {})) && baseline.by_file[file] !== 0) {
      applied.push(`by_file.${file}: ${baseline.by_file[file]} -> 0 (file gone)`);
      baseline.by_file[file] = 0;
    }
  }

  // baseline.generated_at 记录"基线被采纳的时间"，不是"本次审计运行的时间"；
  // 只有阈值真的变化时才刷新，否则每次 --adopt 都会产生无意义的文件抖动。
  // generated_at 用 baseline 内容本身的 mtime，保证"同一份内容"不因运行时间漂移，
  // 否则每次 --adopt 都会改一行，破坏"还原后逐字节相同"的可验证性。
  baseline.scope = report.scope;
  baseline.totals = report.totals;
  baseline.by_route = report.by_route;
  baseline.by_route_files = report.by_route_files;
  baseline.key_route_hits = report.key_route_hits;

  if (applied.length > 0) baseline.generated_at = report.generated_at;
  fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");

  console.log(`[ui-audit] adopted live snapshot into ${baselinePath} (${applied.length} change(s))`);
  for (const line of applied) console.log(`  tightened ${line}`);
  if (refused.length > 0) {
    console.error("[ui-audit] REFUSED to widen the following thresholds:");
    for (const line of refused) console.error(`  ${line}`);
    console.error("[ui-audit] 如需放宽容差，必须在 baseline.reference.ratchet_debt 中登记理由，不得静默放宽。");
    process.exit(1);
  }
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
  console.log("By Scope:");
  Object.entries(report.by_scope || {}).forEach(([scope, hits]) => {
    console.log(`  ${scope}: ${hits}`);
  });
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

  if (adoptMode) {
    adoptBaseline(report);
  } else if (ciMode) {
    const result = runCiGate(report);
    if (result?.hasError) process.exit(1);
    console.log(`[ui-audit] gate passed (ratchet exact). total hits: ${report.totals.hits_total}`);
  }
} catch (error) {
  console.error("[ui-audit] failed:", error?.message || error);
  process.exit(1);
}
