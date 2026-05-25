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
    surfaceElevated: `color-mix(in srgb, ${surface} 96%, transparent)`,
    surfaceAlt,
    border,
    grid: `color-mix(in srgb, ${border} 55%, transparent)`,
    laneLine: `color-mix(in srgb, ${primary} 28%, transparent)`,
    laneLineMuted: `color-mix(in srgb, ${border} 55%, transparent)`,
    teacher: warning,
    teacherSoft: `color-mix(in srgb, ${warning} 35%, transparent)`,
    burst: danger,
    burstGlow: `color-mix(in srgb, ${danger} 45%, transparent)`,
    uncovered: readCssVar("--ws-color-warning", FALLBACKS.warningBright),
    uncoveredBorder: readCssVar("--ws-color-danger", FALLBACKS.dangerDeep),
    uncoveredSoft: `color-mix(in srgb, ${danger} 14%, ${surface})`,
    uncoveredShadow: `color-mix(in srgb, ${danger} 30%, transparent)`,
    primary,
    accent,
    primarySoft,
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
