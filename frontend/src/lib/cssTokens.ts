/**
 * CSS 语义色 token → 具体色值桥接层
 *
 * 为什么需要这一层：
 *   `--ws-color-*` CSS 变量只能在 DOM/CSS 语境里生效。ECharts 的 Canvas 渲染器、
 *   以及任何直接写 `fillStyle` 的绘图代码都拿不到 `var(--ws-...)`——Canvas 的
 *   `fillStyle` 赋值失败后会静默回退成黑色，图表整块变黑且不报错。
 *
 * 设计原则（2026-10 现行浅色主题）：
 *   1. `frontend/src/styles/index.css` 的 `:root` 是**唯一真源**；本文件里的
 *      `COLOR_TOKEN_FALLBACKS` 只是"非 CSS 环境/读取失败时的镜像"，
 *      `cssTokens.contract.test.ts` 会逐项比对，值一旦漂移测试立即失败。
 *   2. 只收录真正需要在 JS 里转成具体色值的 token（语义色 + 标签色），
 *      不为旧版深色/模块壳层 palette 预留，也不做整棵 ECharts option 的深度改写。
 *   3. 解析失败必须显式告警（`console.warn`），不静默返回黑色。
 *
 * 与 531e323 原实现（2026-10-15）的差异见文件末尾注释。
 */

/** 非 CSS 语境下的具体色值镜像；必须与 index.css 的 :root 一致（有契约测试）。 */
export const COLOR_TOKEN_FALLBACKS = Object.freeze({
  /* 背景 */
  "--ws-color-bg": "#F0FDFA",
  "--ws-color-surface": "#FFFFFF",
  "--ws-color-surface-2": "#E6F5F3",
  // color-mix(in srgb, var(--ws-color-text) 3%, var(--ws-color-surface)) 的等价结果
  "--ws-color-workspace-muted": "#F8F9F9",
  "--ws-color-overlay": "rgba(0, 0, 0, 0.4)",

  /* 边框 */
  "--ws-color-border": "rgba(0, 0, 0, 0.08)",
  "--ws-color-border-secondary": "rgba(0, 0, 0, 0.05)",

  /* 文字 */
  "--ws-color-text": "#1E293B",
  "--ws-color-text-secondary": "#475569",
  "--ws-color-text-tertiary": "#64748B",

  /* 主色 */
  "--ws-color-primary": "#0D9488",
  "--ws-color-primary-hover": "#14B8A6",
  "--ws-color-primary-active": "#0F766E",

  /* 辅色 / 强调 */
  "--ws-color-secondary": "#7C3AED",
  "--ws-color-secondary-active": "#6D28D9",
  "--ws-color-accent": "#7C3AED",

  /* 语义色 */
  "--ws-color-success": "#059669",
  "--ws-color-warning": "#D97706",
  "--ws-color-error": "#DC2626",
  "--ws-color-error-dark": "#B91C1C",
  "--ws-color-error-light": "#FCA5A5",
  "--ws-color-danger": "#DC2626",
  "--ws-color-info": "#0EA5E9",

  /* 交互 */
  "--ws-color-hover-bg": "rgba(13, 148, 136, 0.08)",
  "--ws-color-focus-ring": "#7C3AED",

  /* 柔和背景 */
  "--ws-color-primary-soft": "rgba(13, 148, 136, 0.08)",
  "--ws-color-primary-light": "rgba(13, 148, 136, 0.12)",
  "--ws-color-primary-muted": "#CCFBF1",
  "--ws-color-success-soft": "rgba(5, 150, 105, 0.08)",
  "--ws-color-warning-soft": "rgba(217, 119, 6, 0.08)",
  "--ws-color-error-soft": "rgba(220, 38, 38, 0.08)",
  "--ws-color-info-soft": "rgba(14, 165, 233, 0.08)",

  /* 课堂互动 / 评测 */
  "--ws-color-purple": "#C026D3",
  "--ws-color-purple-hover": "#A21CAF",
  "--ws-color-purple-active": "#86198F",
  "--ws-color-purple-soft": "rgba(192, 38, 211, 0.08)",

  /* 代码块 / 浮层 */
  "--ws-color-code-bg": "#1e1e1e",
  "--ws-color-code-text": "#d4d4d4",
  "--ws-color-code-purple": "#722ed1",
  "--ws-color-tooltip": "rgba(15, 23, 42, 0.92)",

  /* 数据标签 palette */
  "--ws-tag-blue": "#2563EB",
  "--ws-tag-teal": "#0D9488",
  "--ws-tag-green": "#059669",
  "--ws-tag-amber": "#D97706",
  "--ws-tag-orange": "#F97316",
  "--ws-tag-red": "#DC2626",
  "--ws-tag-pink": "#DB2777",
  "--ws-tag-purple": "#C026D3",
  "--ws-tag-indigo": "#4F46E5",
  "--ws-tag-sky": "#0284C7",
  "--ws-tag-gray": "#64748B",

  "--ws-color-scrollbar": "rgba(0, 0, 0, 0.08)",
} as Record<string, string>);

/** 最后兜底色：文本主色，保证任何解析失败都不会画出纯黑。 */
const SAFE_COLOR_FALLBACK = "#1E293B";
/** 允许的最长 var() 解引用层数，防止误配置成环。 */
const MAX_VAR_DEPTH = 8;
/** 非 CSS 渲染器无法消费的表达式（var()/color-mix()）。 */
const NON_CONCRETE_EXPRESSION = /\b(?:var|color-mix)\s*\(/i;

export type ParsedColor = { red: number; green: number; blue: number; alpha: number };

const warn = (message: string): void => {
  if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(`[cssTokens] ${message}`);
  }
};

const clampAlpha = (alpha: number): number =>
  Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;

/** 解析 #RGB / #RGBA / #RRGGBB / #RRGGBBAA / rgb() / rgba() → 通道值 */
export function parseColor(input: string): ParsedColor | null {
  const value = input.trim();
  if (!value) return null;
  if (value.toLowerCase() === "transparent") return { red: 0, green: 0, blue: 0, alpha: 0 };

  const hex = value.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i)?.[1];
  if (hex) {
    const full = hex.length <= 4 ? hex.split("").map((part) => part + part).join("") : hex;
    return {
      red: Number.parseInt(full.slice(0, 2), 16),
      green: Number.parseInt(full.slice(2, 4), 16),
      blue: Number.parseInt(full.slice(4, 6), 16),
      alpha: full.length === 8 ? Number.parseInt(full.slice(6, 8), 16) / 255 : 1,
    };
  }

  const parts = value.match(/^rgba?\(\s*([^)]+)\)$/i)?.[1];
  if (!parts) return null;
  // 同时接受 comma 语法 `rgb(1,2,3,0.5)` 与空格斜杠语法 `rgb(1 2 3 / 50%)`。
  const tokens = parts.replace(/\//g, " ").split(/[\s,]+/).filter(Boolean);
  if (tokens.length !== 3 && tokens.length !== 4) return null;
  const channel = (token: string, max: number): number | null => {
    const percent = token.endsWith("%");
    const raw = Number(percent ? token.slice(0, -1) : token);
    if (!Number.isFinite(raw)) return null;
    return Math.round(percent ? Math.max(0, Math.min(100, raw)) * max / 100 : Math.max(0, Math.min(max, raw)));
  };
  const red = channel(tokens[0], 255);
  const green = channel(tokens[1], 255);
  const blue = channel(tokens[2], 255);
  const alpha = tokens[3] === undefined
    ? 1
    : (() => {
        const percent = tokens[3].endsWith("%");
        const raw = Number(percent ? tokens[3].slice(0, -1) : tokens[3]);
        if (!Number.isFinite(raw)) return null;
        return clampAlpha(percent ? raw / 100 : raw);
      })();
  if (red === null || green === null || blue === null || alpha === null) return null;
  return { red, green, blue, alpha };
}

export const formatRgba = ({ red, green, blue, alpha }: ParsedColor): string =>
  `rgba(${red}, ${green}, ${blue}, ${Number(alpha.toFixed(4))})`;

const isConcreteColor = (value: string): boolean =>
  Boolean(parseColor(value)) && !NON_CONCRETE_EXPRESSION.test(value);

const normalizeTokenName = (name: string): string =>
  name.trim().startsWith("--") ? name.trim() : `--${name.trim()}`;

/** 读取浏览器里 CSS 变量的当前计算值（SSR/测试环境返回空串）。 */
export function readCssTokenRaw(name: string): string {
  if (typeof document === "undefined" || !document.documentElement) return "";
  const tokenName = normalizeTokenName(name);
  try {
    const computed = getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
    if (computed) return computed;
  } catch {
    warn(`无法计算样式 ${tokenName}，改用内联值/镜像值`);
  }
  try {
    return document.documentElement.style.getPropertyValue(tokenName).trim();
  } catch {
    warn(`无法读取内联 ${tokenName}，改用镜像值`);
    return "";
  }
}

const unwrapVar = (value: string): { name: string; fallback?: string } | null => {
  const match = value.trim().match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.*))?\)$/);
  return match ? { name: match[1], fallback: match[2]?.trim() } : null;
};

/**
 * 把 `var(--x)` 或任何 CSS 颜色表达式解析成非 CSS 渲染器可用的具体色值。
 *
 * 解析顺序：实时计算值 → var() 内联 fallback → 调用方 fallback → 镜像表 → 安全兜底。
 * 遇到 color-mix() 这类无法离线求值的表达式时，直接使用镜像表里的等价色值。
 */
export function resolveCssColor(value: string, fallback = ""): string {
  const attempt = (candidate: string, depth: number, seen: Set<string>): string | null => {
    const trimmed = candidate.trim();
    if (!trimmed) return null;
    const reference = unwrapVar(trimmed);
    if (!reference) return isConcreteColor(trimmed) ? trimmed : null;
    if (depth >= MAX_VAR_DEPTH || seen.has(reference.name)) {
      warn(`检测到 ${reference.name} 的循环引用或过深解引用，改用镜像值`);
      return null;
    }
    const nextSeen = new Set(seen).add(reference.name);
    const live = readCssTokenRaw(reference.name);
    // color-mix() 在 JS 侧无法可靠求值，跳过实时值直接用镜像表。
    const liveUsable = live && !NON_CONCRETE_EXPRESSION.test(live) ? live : "";
    const mirrored = COLOR_TOKEN_FALLBACKS[reference.name] ?? "";
    return (
      attempt(liveUsable, depth + 1, nextSeen) ??
      attempt(reference.fallback ?? "", depth + 1, nextSeen) ??
      attempt(mirrored, depth + 1, nextSeen)
    );
  };

  const resolved = attempt(value, 0, new Set()) ?? attempt(fallback, 0, new Set());
  if (resolved) return resolved;
  warn(`无法解析颜色 "${value}"，改用兜底色 ${SAFE_COLOR_FALLBACK}`);
  return SAFE_COLOR_FALLBACK;
}

/** 按 token 名取具体色值，`readCssColor("--ws-color-primary")`。 */
export const readCssColor = (name: string, fallback = ""): string =>
  resolveCssColor(`var(${normalizeTokenName(name)})`, fallback);

/**
 * 在已有颜色上叠加透明度：与原 alpha **相乘**而不是替换。
 * 这样 `rgba(...)` 半透明 token（如 --ws-color-border）不会因为再次投影而变实。
 */
export function alphaColor(color: string, alpha: number, fallback = ""): string {
  const resolved = resolveCssColor(color, fallback);
  const parsed = parseColor(resolved);
  if (!parsed) {
    warn(`不支持的颜色字面量 ${resolved}，改用兜底色`);
    return parseColor(fallback) ? formatRgba(parseColor(fallback)!) : SAFE_COLOR_FALLBACK;
  }
  return formatRgba({ ...parsed, alpha: parsed.alpha * clampAlpha(alpha) });
}

/** 图表/Canvas 场景常用的语义调色板（每次调用都按当前主题重新解析）。 */
export function readChartPalette() {
  return {
    primary: readCssColor("--ws-color-primary"),
    primarySoft: readCssColor("--ws-color-primary-muted"),
    accent: readCssColor("--ws-color-accent"),
    secondary: readCssColor("--ws-color-secondary"),
    success: readCssColor("--ws-color-success"),
    warning: readCssColor("--ws-color-warning"),
    danger: readCssColor("--ws-color-danger"),
    error: readCssColor("--ws-color-error"),
    info: readCssColor("--ws-color-info"),
    purple: readCssColor("--ws-color-purple"),
    focusRing: readCssColor("--ws-color-focus-ring"),
    text: readCssColor("--ws-color-text"),
    textSecondary: readCssColor("--ws-color-text-secondary"),
    textTertiary: readCssColor("--ws-color-text-tertiary"),
    surface: readCssColor("--ws-color-surface"),
    surfaceAlt: readCssColor("--ws-color-surface-2"),
    page: readCssColor("--ws-color-bg"),
    border: readCssColor("--ws-color-border"),
    borderSecondary: readCssColor("--ws-color-border-secondary"),
    hoverBg: readCssColor("--ws-color-hover-bg"),
    tags: {
      blue: readCssColor("--ws-tag-blue"),
      teal: readCssColor("--ws-tag-teal"),
      green: readCssColor("--ws-tag-green"),
      amber: readCssColor("--ws-tag-amber"),
      orange: readCssColor("--ws-tag-orange"),
      red: readCssColor("--ws-tag-red"),
      pink: readCssColor("--ws-tag-pink"),
      purple: readCssColor("--ws-tag-purple"),
      indigo: readCssColor("--ws-tag-indigo"),
      sky: readCssColor("--ws-tag-sky"),
      gray: readCssColor("--ws-tag-gray"),
    },
  };
}

export type ChartPalette = ReturnType<typeof readChartPalette>;

/**
 * 与 531e323 原实现的差异：
 * - 镜像表按当前 Tech Cyan 主题重写（原表是旧 teal/indigo 主题，#0F766E/#4F46E5 等已废弃）。
 * - 删除模块壳层/终端/编辑器/调试等 150+ 条深色时代 token：永久浅色主题下没有消费者。
 * - 删除 `resolveEChartsOptionColors` 深度改写 option：它会遍历用户数据并重写 key，
 *   风险大于收益；Canvas 场景改为显式取具体色（`readCssColor`/`readChartPalette`）。
 * - 新增 color-mix() 感知：`--ws-color-workspace-muted` 用镜像等价色，不做在线求值。
 * - 保留 `parseColor`/`formatRgba`/`alphaColor`：`chartTheme.ts` 正在等这套能力。
 */
