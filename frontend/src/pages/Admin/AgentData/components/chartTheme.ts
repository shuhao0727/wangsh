/** ECharts 共享配色主题 — 避免硬编码 hex 分散在多个文件中 */
export const CHART_COLORS = {
  primary: "#0D9488",
  purple: "#7C3AED",
  blue: "#3B82F6",
  amber: "#F59E0B",
  pink: "#EC4899",
  cyan: "#06B6D4",
  green: "#10B981",
  red: "#EF4444",
  violet: "#8B5CF6",
  rose: "#F43F5E",
} as const;

export const BEAM_COLORS = [
  CHART_COLORS.primary, CHART_COLORS.purple, CHART_COLORS.blue,
  CHART_COLORS.amber, CHART_COLORS.pink, CHART_COLORS.cyan,
  CHART_COLORS.green, CHART_COLORS.red, CHART_COLORS.violet, CHART_COLORS.rose,
] as const;

export const BURST_COLOR = CHART_COLORS.red;
export const TEACHER_MARK_COLOR = "#D97706";
export const COVERED_COLOR = CHART_COLORS.primary;
export const UNCOVERED_COLOR = CHART_COLORS.amber;
export const LANE_LINE_COLOR = "rgba(13,148,136,0.25)";
