/**
 * 雷达图组件 - 支持单组或多组数据对比
 */
import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react/lib/core";
import { echarts } from "@/lib/echarts";

interface RadarChartProps {
  /** 单组数据 */
  dimensions?: Record<string, number>;
  /** 多组数据对比 */
  series?: { name: string; data: Record<string, number>; color?: string }[];
  size?: number;
  width?: number;
  height?: number;
  color?: string;
}

const COLORS = [
  "var(--ws-color-primary)",
  "var(--ws-color-success)",
  "var(--ws-color-warning)",
  "var(--ws-color-purple)",
  "var(--ws-color-error)",
  "var(--ws-color-secondary)",
];

const RadarChart: React.FC<RadarChartProps> = ({
  dimensions,
  series,
  size = 280,
  width,
  height,
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
          areaStyle: { color: s.color || COLORS[i % COLORS.length], opacity: 0.16 },
          lineStyle: { color: s.color || COLORS[i % COLORS.length], width: 2.5 },
          itemStyle: { color: s.color || COLORS[i % COLORS.length], borderColor: "var(--ws-color-surface)", borderWidth: 1 },
        }))
      : [{
          value: paddedKeys.map(k => {
            if (visibleKeys.has(k)) return dimensions![k] ?? 0;
            const vals = allKeys.map(kk => dimensions![kk] ?? 0);
            const avg = vals.length ? vals.reduce((acc, n) => acc + n, 0) / vals.length : 0;
            return Number(avg.toFixed(1));
          }),
          name: "掌握率",
          areaStyle: { color, opacity: 0.18 },
          lineStyle: { color, width: 2.5 },
          itemStyle: { color, borderColor: "var(--ws-color-surface)", borderWidth: 1 },
        }];
    return {
      color: seriesData.map((item) => item.itemStyle.color),
      radar: {
        indicator,
        center: ["50%", series && series.length > 1 ? "46%" : "50%"],
        radius: "44%",
        axisName: {
          fontSize: 12,
          color: "var(--ws-color-text)",
          lineHeight: 16,
          overflow: "none",
        },
        axisLine: {
          lineStyle: { color: "var(--ws-color-border-secondary)", opacity: 0.9 },
        },
        splitLine: {
          lineStyle: { color: "var(--ws-color-border-secondary)", opacity: 0.9 },
        },
        splitArea: {
          areaStyle: {
            color: ["var(--ws-color-surface)", "var(--ws-color-surface-2)"],
            opacity: 0.68,
          },
        },
      },
      legend: series && series.length > 1 ? {
        data: series.map(s => s.name),
        bottom: 0,
        icon: "roundRect",
        itemWidth: 12,
        itemHeight: 8,
        textStyle: { fontSize: 12, color: "var(--ws-color-text-secondary)" },
      } : undefined,
      series: [{
        type: "radar",
        data: seriesData,
      }],
      tooltip: {
        trigger: "item",
        backgroundColor: "var(--ws-color-surface)",
        borderColor: "var(--ws-color-border)",
        textStyle: { color: "var(--ws-color-text)" },
        formatter: (params: { data?: { value?: number[]; name?: string } }) => {
          const data = params.data?.value as number[] | undefined;
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
      echarts={echarts}
      option={option}
      style={{ width: width ?? size, height: height ?? size, margin: "0 auto" }}
      opts={{ renderer: "svg" }}
      notMerge
      lazyUpdate
    />
  );
};

export default RadarChart;
