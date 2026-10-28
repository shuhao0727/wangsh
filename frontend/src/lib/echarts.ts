/**
 * ECharts 按需引入。
 *
 * 全量 `import * as echarts from "echarts"` 会把所有图表类型打进包（约 1MB），
 * 本项目只用到柱、线、散点、雷达四种，按需注册可显著缩小分析页首屏体积。
 * 新增图表类型时在这里补充注册即可。
 *
 * 两个容易踩的坑（都会静默失败，不报错）：
 *
 * 1. radar 需要同时注册 `RadarChart`（series 类型）和 `RadarComponent`
 *    （radar 坐标系容器），只注册其中一个会渲染出空白画布。
 *
 * 2. **必须注册 `SVGRenderer`**。`RadarChart.tsx` 通过
 *    `opts={{ renderer: "svg" }}` 指定 SVG 渲染，并把 `var(--ws-color-*)`
 *    直接作为 fill/stroke 传下去——SVG 的 CSS 属性由浏览器原生解析，所以能取到
 *    主题色。若缺少 SVGRenderer，echarts 会静默回落到 Canvas，而 Canvas 的
 *    `fillStyle` 不认 `var()`，赋值失败后一律回退成黑色，图会变成全黑。
 */
import * as echarts from "echarts/core";
import { BarChart, LineChart, RadarChart, ScatterChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  RadarComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  LineChart,
  RadarChart,
  ScatterChart,
  RadarComponent,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
  SVGRenderer,
]);

export type { ECharts, EChartsCoreOption } from "echarts/core";
export { echarts };

// Canvas 渲染器不认 CSS 变量，图表配色统一走这层桥接（见 cssTokens.ts）。
export {
  alphaColor,
  COLOR_TOKEN_FALLBACKS,
  formatRgba,
  parseColor,
  readChartPalette,
  readCssColor,
  resolveCssColor,
} from "./cssTokens";
export type { ChartPalette, ParsedColor } from "./cssTokens";
