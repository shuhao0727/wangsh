/**
 * 学生参与热力图 — 时间 × 学生，颜色 = 提问量
 */
import React, { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts";
import { getAgentChartTheme } from "./chartTheme";
import type { BeamStudentChain } from "../types";

interface Props {
  studentChains: BeamStudentChain[];
  height?: number;
  bucketMinutes?: number;
}

const EngagementHeatmap: React.FC<Props> = ({ studentChains, height = 320, bucketMinutes = 5 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  const { heatData, students, timeLabels } = useMemo(() => {
    if (studentChains.length === 0) return { heatData: [] as [number, number, number][], students: [] as string[], timeLabels: [] as string[], minTime: 0 };

    const allTimes = studentChains.flatMap((c) => c.nodes.map((n) => new Date(n.time).getTime())).filter((t) => Number.isFinite(t));
    if (allTimes.length === 0) return { heatData: [], students: [] as string[], timeLabels: [] as string[], minTime: 0 };

    const tMin = Math.min(...allTimes);
    const tMax = Math.max(...allTimes);
    const bucketMs = bucketMinutes * 60 * 1000;
    const numBuckets = Math.max(2, Math.ceil((tMax - tMin) / bucketMs));

    const studentList = studentChains.map((c) => c.studentName);
    const timeLabelsArr = Array.from({ length: numBuckets }, (_, i) => {
      const t = new Date(tMin + i * bucketMs);
      return `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
    });

    const counts = new Map<string, number>();
    studentChains.forEach((c, si) => {
      c.nodes.forEach((n) => {
        const t = new Date(n.time).getTime();
        const bi = Math.min(Math.floor((t - tMin) / bucketMs), numBuckets - 1);
        const key = `${si}-${bi}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });

    const data: [number, number, number][] = [];
    counts.forEach((v, key) => {
      const [si, bi] = key.split("-").map(Number);
      data.push([bi, si, v]);
    });

    return { heatData: data, students: studentList, timeLabels: timeLabelsArr, minTime: tMin };
  }, [studentChains, bucketMinutes]);

  useEffect(() => {
    if (!ref.current || heatData.length === 0) return;
    if (!chartRef.current) chartRef.current = echarts.init(ref.current);
    const theme = getAgentChartTheme();

    chartRef.current.setOption({
      tooltip: {
        position: "top",
        formatter: (params: any) => {
          const [bi, si, v] = params.value || [0, 0, 0];
          return `${students[si]}<br/>${timeLabels[bi]} · <b>${v}</b> 个问题`;
        },
      },
      grid: { left: 90, right: 20, top: 10, bottom: 40 },
      xAxis: {
        type: "category",
        data: timeLabels,
        axisLabel: { color: theme.textSecondary, fontSize: 10, rotate: 45, interval: Math.max(0, Math.floor(timeLabels.length / 12)) },
        axisLine: { show: false },
        axisTick: { show: false },
        splitArea: { show: false },
      },
      yAxis: {
        type: "category",
        data: students,
        axisLabel: { color: theme.textBase, fontSize: 11, width: 80, overflow: "truncate" },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      visualMap: {
        min: 0,
        max: Math.max(...heatData.map((d) => d[2]), 1),
        calculable: true,
        orient: "horizontal",
        left: "center",
        bottom: 0,
        inRange: { color: ["#f0fdfa", "#99f6e4", "#0D9488", "#0f766e", "#115e59"] },
        textStyle: { color: theme.textSecondary, fontSize: 10 },
      },
      series: [{
        type: "heatmap",
        data: heatData,
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0, 0, 0, 0.25)" } },
        itemStyle: { borderColor: theme.surface, borderWidth: 1 },
      }],
    }, true);
  }, [heatData, students, timeLabels]);

  useEffect(() => {
    const r = () => chartRef.current?.resize();
    window.addEventListener("resize", r);
    return () => { window.removeEventListener("resize", r); chartRef.current?.dispose(); chartRef.current = null; };
  }, []);

  if (studentChains.length === 0 || heatData.length === 0) {
    return <div className="flex h-[200px] items-center justify-center text-sm text-text-tertiary">暂无足够数据绘制热力图</div>;
  }

  return (
    <div>
      <p className="mb-2 text-xs text-text-tertiary">横向为时间（每 {bucketMinutes} 分钟），纵向为学生，颜色越深提问越密集。一眼看出课堂沉默区与活跃学生。</p>
      <div ref={ref} style={{ height }} />
    </div>
  );
};

export default EngagementHeatmap;
