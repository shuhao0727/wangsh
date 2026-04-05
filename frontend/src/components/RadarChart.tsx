/**
 * 雷达图组件 - 支持单组或多组数据对比
 */
import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";

interface RadarChartProps {
  /** 单组数据 */
  dimensions?: Record<string, number>;
  /** 多组数据对比 */
  series?: { name: string; data: Record<string, number>; color?: string }[];
  size?: number;
  color?: string;
}

const COLORS = [
  "var(--ws-color-primary)",
  "var(--ws-color-warning)",
  "var(--ws-color-accent)",
  "var(--ws-color-purple)",
  "var(--ws-color-error-light)",
  "var(--ws-color-info)",
];

const RadarChart: React.FC<RadarChartProps> = ({
  dimensions,
  series,
  size = 280,
  color = "var(--ws-color-primary)",
}) => {
  const option = useMemo(() => {
    // 收集所有维度 key
    let allKeys: string[] = [];
    if (series && series.length > 0) {
      const keySet = new Set<string>();
      series.forEach(s => Object.keys(s.data).forEach(k => keySet.add(k)));
      allKeys = Array.from(keySet);
    } else if (dimensions) {
      allKeys = Object.keys(dimensions);
    }
    allKeys.sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));
    if (allKeys.length === 0) return null;
    const padCount = Math.max(0, 3 - allKeys.length);
    const paddedKeys = [...allKeys, ...Array.from({ length: padCount }, (_, i) => `__pad_${i}`)];
    const visibleKeys = new Set(allKeys);

    const indicator = paddedKeys.map(k => ({ name: visibleKeys.has(k) ? k : "", max: 100 }));

    const seriesData = series && series.length > 0
      ? series.map((s, i) => ({
          value: paddedKeys.map(k => {
            if (visibleKeys.has(k)) return s.data[k] ?? 0;
            const vals = allKeys.map(kk => s.data[kk] ?? 0);
            const avg = vals.length ? vals.reduce((acc, n) => acc + n, 0) / vals.length : 0;
            return Number(avg.toFixed(1));
          }),
          name: s.name,
          areaStyle: { color: `${s.color || COLORS[i % COLORS.length]}22` },
          lineStyle: { color: s.color || COLORS[i % COLORS.length], width: 2 },
          itemStyle: { color: s.color || COLORS[i % COLORS.length] },
        }))
      : [{
          value: paddedKeys.map(k => {
            if (visibleKeys.has(k)) return dimensions![k] ?? 0;
            const vals = allKeys.map(kk => dimensions![kk] ?? 0);
            const avg = vals.length ? vals.reduce((acc, n) => acc + n, 0) / vals.length : 0;
            return Number(avg.toFixed(1));
          }),
          name: "掌握率",
          areaStyle: { color: `${color}22` },
          lineStyle: { color, width: 2 },
          itemStyle: { color },
        }];
    return {
      radar: {
        indicator,
        radius: "55%",
        axisName: { fontSize: 12, color: "var(--ws-color-text-secondary)" },
        splitArea: { areaStyle: { color: ["var(--ws-color-surface)", "var(--ws-color-surface-2)"] } },
      },
      legend: series && series.length > 1 ? {
        data: series.map(s => s.name),
        bottom: 0,
        textStyle: { fontSize: 12 },
      } : undefined,
      series: [{
        type: "radar",
        data: seriesData,
      }],
      tooltip: {
        trigger: "item",
        formatter: (params: any) => {
          const data = params.data?.value as number[];
          const name = params.data?.name || "";
          if (!data) return "";
          const lines = allKeys.map((k, i) => `${k}: ${data[i]}`).join("<br/>");
          return name ? `<strong>${name}</strong><br/>${lines}` : lines;
        },
      },
    };
  }, [dimensions, series, color]);

  if (!option) return null;

  return (
    <ReactECharts
      option={option}
      style={{ width: size, height: size, margin: "0 auto" }}
      opts={{ renderer: "svg" }}
    />
  );
};

export default RadarChart;
