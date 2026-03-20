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

const COLORS = ["#4096ff", "#ff7a45", "#36cfc9", "#9254de", "#f759ab", "#fadb14"];

const RadarChart: React.FC<RadarChartProps> = ({
  dimensions,
  series,
  size = 280,
  color = "#4096ff",
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
    if (allKeys.length < 3) return null;

    const indicator = allKeys.map(k => ({ name: k, max: 100 }));

    const seriesData = series && series.length > 0
      ? series.map((s, i) => ({
          value: allKeys.map(k => s.data[k] ?? 0),
          name: s.name,
          areaStyle: { color: `${s.color || COLORS[i % COLORS.length]}22` },
          lineStyle: { color: s.color || COLORS[i % COLORS.length], width: 2 },
          itemStyle: { color: s.color || COLORS[i % COLORS.length] },
        }))
      : [{
          value: allKeys.map(k => dimensions![k]),
          name: "掌握率",
          areaStyle: { color: `${color}22` },
          lineStyle: { color, width: 2 },
          itemStyle: { color },
        }];
    return {
      radar: {
        indicator,
        radius: "55%",
        axisName: { fontSize: 12, color: "#666" },
        splitArea: { areaStyle: { color: ["#fff", "#f5f5f5"] } },
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
