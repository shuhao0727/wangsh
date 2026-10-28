/**
 * 学情分析图表配色（Canvas 渲染器专用）。
 *
 * ECharts 在这里用默认 Canvas 渲染器，`var(--ws-color-*)` 传进去不生效
 * （fillStyle 赋值失败会静默变黑），所以必须先用 `@/lib/cssTokens` 解析成具体色值。
 * 镜像值与 index.css 的一致性由 `cssTokens.contract.test.ts` 守住。
 */
import { alphaColor, parseColor, readChartPalette } from "@/lib/cssTokens";

/** 多系列区分色：按 COLORS.md 约定一律取自 --ws-tag-* palette，不新增硬编码色。 */
const beamPalette = (tags: ReturnType<typeof readChartPalette>["tags"]): string[] => [
  tags.teal,
  tags.indigo,
  tags.sky,
  tags.amber,
  tags.pink,
  tags.blue,
  tags.green,
  tags.red,
  tags.purple,
  tags.orange,
];

export const getAgentChartTheme = () => {
  const palette = readChartPalette();
  const { primary, accent, warning, danger, border, surface } = palette;

  return {
    textBase: palette.text,
    textSecondary: palette.textSecondary,
    textMuted: palette.textTertiary,
    surface,
    surfaceElevated: alphaColor(surface, 0.96),
    surfaceAlt: palette.surfaceAlt,
    border,
    grid: alphaColor(border, 0.55),
    laneLine: alphaColor(primary, 0.28),
    laneLineMuted: alphaColor(border, 0.55),
    teacher: warning,
    teacherSoft: alphaColor(warning, 0.35),
    burst: danger,
    burstGlow: alphaColor(danger, 0.45),
    burstSoft: alphaColor(danger, 0.08),
    burstBorder: alphaColor(danger, 0.38),
    uncovered: warning,
    uncoveredBorder: danger,
    uncoveredSoft: alphaColor(danger, 0.14),
    uncoveredShadow: alphaColor(danger, 0.3),
    primary,
    accent,
    info: palette.info,
    primarySoft: palette.primarySoft,
    primaryBand: alphaColor(primary, 0.07),
    primaryBrush: alphaColor(primary, 0.08),
    beamColors: beamPalette(palette.tags),
  };
};

export type AgentChartTheme = ReturnType<typeof getAgentChartTheme>;

/** 组件内需要“白色描边”时用它，避免硬编码 #fff。 */
export const chartSurfaceStroke = (): string => readChartPalette().surface;

/** 校验工具：确保某值已是具体色（用于把 option 交给 Canvas 前自检）。 */
export const isConcreteChartColor = (value: string): boolean => parseColor(value) !== null;
