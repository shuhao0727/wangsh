const FALLBACKS = {
  primary: "#0D9488",
  accent: "#7C3AED",
  info: "#3B82F6",
  warning: "#D97706",
  warningBright: "#F59E0B",
  success: "#10B981",
  danger: "#EF4444",
  dangerDeep: "#DC2626",
  pink: "#EC4899",
  cyan: "#06B6D4",
  violet: "#8B5CF6",
  rose: "#F43F5E",
  textBase: "#0F172A",
  textSecondary: "#64748B",
  textMuted: "#334155",
  surface: "rgba(255,255,255,0.96)",
  surfaceAlt: "#F8FAFC",
  border: "#E2E8F0",
  borderSoft: "rgba(148,163,184,0.12)",
  grid: "rgba(148,163,184,0.10)",
  primarySoft: "rgba(13,148,136,0.12)",
  primaryShadow: "rgba(13,148,136,0.2)",
  dangerSoft: "rgba(220,38,38,0.10)",
  dangerShadow: "rgba(220,38,38,0.3)",
  dangerGlow: "rgba(239,68,68,0.5)",
} as const;

const readCssVar = (name: string, fallback: string) => {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

const alphaColor = (color: string, alpha: number, fallback: string) => {
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
    beamColors: [
      primary,
      accent,
      readCssVar("--ws-color-info", FALLBACKS.info),
      readCssVar("--ws-color-warning", FALLBACKS.warningBright),
      FALLBACKS.pink,
      FALLBACKS.cyan,
      readCssVar("--ws-color-success", FALLBACKS.success),
      danger,
      FALLBACKS.violet,
      FALLBACKS.rose,
    ],
  };
};

export type AgentChartTheme = ReturnType<typeof getAgentChartTheme>;
