/* 图表主题 — 把 index.css 的 --ws-* token 解析为 ECharts 可用的实际色值。
 *
 * 重要：ECharts(zrender) 的 canvas 渲染器无法解析 "var(--ws-*)" 形式的颜色字符串，
 * 会被当作非法颜色回退成默认灰，因此这里统一用 readCssVar 在运行时读出 token 值，
 * 再转成 hex/rgba 交给图表。下面的 FALLBACKS 只是非浏览器环境（jsdom/SSR）或 token
 * 缺失时的最后防线，取值镜像 src/styles/index.css 的 :root，不作为正式配色来源。 */

const FALLBACKS = {
  primary: "#36776F",
  accent: "#7164A1",
  warning: "#976135",
  warningBright: "#976135",
  success: "#39795D",
  danger: "#A25850",
  dangerDeep: "#A25850",
  textBase: "#1E293B",
  textSecondary: "#475569",
  textMuted: "#626F82",
  surface: "rgba(255,255,255,0.96)",
  surfaceAlt: "#E6F5F3",
  border: "rgba(0, 0, 0, 0.08)",
  grid: "rgba(148,163,184,0.10)",
  primarySoft: "rgba(54,119,111,0.08)",
  primaryShadow: "rgba(54,119,111,0.2)",
  dangerSoft: "rgba(162,88,80,0.10)",
  dangerShadow: "rgba(162,88,80,0.3)",
  dangerGlow: "rgba(162,88,80,0.5)",
} as const;

/* 数据标签色板兜底 — 与 index.css 的 --ws-tag-* 一一对应。
 * 与上文语义色同值的项直接复用，避免同一色值出现两份字面量。 */
const TAG_FALLBACKS = {
  blue: "#2563EB",
  teal: FALLBACKS.primary,
  green: FALLBACKS.success,
  amber: FALLBACKS.warning,
  orange: "#F97316",
  red: FALLBACKS.danger,
  pink: "#DB2777",
  purple: "#C026D3",
  indigo: "#4F46E5",
  sky: "#0284C7",
  gray: FALLBACKS.textMuted,
} as const;

const readCssVar = (name: string, fallback: string) => {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

/** 把色值（hex/rgb/rgba）按给定透明度转成 rgba，供图表半透明填充使用。 */
export const alphaColor = (color: string, alpha: number, fallback = "") => {
  const value = color.trim();
  const safeAlpha = Math.max(0, Math.min(1, alpha));

  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const full = hex.length === 3 ? hex.split("").map((char) => char + char).join("") : hex;
    const intValue = Number.parseInt(full, 16);
    const red = (intValue >> 16) & 255;
    const green = (intValue >> 8) & 255;
    const blue = intValue & 255;
    return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
  }

  const rgb = value.match(/^rgba?\(([^)]+)\)$/i)?.[1];
  if (rgb) {
    const channels = rgb.split(",").map((part) => Number.parseFloat(part.trim())).slice(0, 3);
    if (channels.length === 3 && channels.every((channel) => Number.isFinite(channel))) {
      return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${safeAlpha})`;
    }
  }

  return fallback;
};

export const getAgentChartTheme = () => {
  const primary = readCssVar("--ws-color-primary", FALLBACKS.primary);
  const accent = readCssVar("--ws-color-accent", FALLBACKS.accent);
  const warning = readCssVar("--ws-color-warning", FALLBACKS.warning);
  const danger = readCssVar("--ws-color-danger", FALLBACKS.danger);
  const textBase = readCssVar("--ws-color-text", FALLBACKS.textBase);
  const textSecondary = readCssVar("--ws-color-text-secondary", FALLBACKS.textSecondary);
  const textMuted = readCssVar("--ws-color-text-tertiary", FALLBACKS.textMuted);
  const surface = readCssVar("--ws-color-surface", FALLBACKS.surface);
  const surfaceAlt = readCssVar("--ws-color-surface-2", FALLBACKS.surfaceAlt);
  const border = readCssVar("--ws-color-border", FALLBACKS.border);
  const primarySoft = readCssVar("--ws-color-primary-muted", FALLBACKS.primarySoft);

  // 图表分类色统一取自 index.css 的数据标签色板，保证与全站数据色一致
  const tag = (name: keyof typeof TAG_FALLBACKS) =>
    readCssVar(`--ws-tag-${name}`, TAG_FALLBACKS[name]);

  return {
    textBase,
    textSecondary,
    textMuted,
    surface,
    surfaceElevated: alphaColor(surface, 0.96, FALLBACKS.surface),
    surfaceAlt,
    border,
    grid: alphaColor(border, 0.55, FALLBACKS.grid),
    laneLine: alphaColor(primary, 0.28, FALLBACKS.primarySoft),
    laneLineMuted: alphaColor(border, 0.55, FALLBACKS.grid),
    teacher: warning,
    teacherSoft: alphaColor(warning, 0.35, FALLBACKS.primaryShadow),
    burst: danger,
    burstGlow: alphaColor(danger, 0.45, FALLBACKS.dangerGlow),
    burstSoft: alphaColor(danger, 0.08, FALLBACKS.dangerSoft),
    burstBorder: alphaColor(danger, 0.38, FALLBACKS.dangerShadow),
    uncovered: readCssVar("--ws-color-warning", FALLBACKS.warningBright),
    uncoveredBorder: readCssVar("--ws-color-danger", FALLBACKS.dangerDeep),
    uncoveredSoft: alphaColor(danger, 0.14, FALLBACKS.dangerSoft),
    uncoveredShadow: alphaColor(danger, 0.3, FALLBACKS.dangerShadow),
    primary,
    accent,
    primarySoft,
    primaryBand: alphaColor(primary, 0.07, FALLBACKS.primarySoft),
    primaryBrush: alphaColor(primary, 0.08, FALLBACKS.primarySoft),
    // 多序列分类色：优先走 --ws-tag-* 数据标签色板，与全站数据色保持一致
    beamColors: [
      tag("teal"),
      tag("purple"),
      tag("blue"),
      tag("amber"),
      tag("pink"),
      tag("sky"),
      tag("green"),
      tag("red"),
      tag("indigo"),
      tag("orange"),
    ],
  };
};

export type AgentChartTheme = ReturnType<typeof getAgentChartTheme>;
