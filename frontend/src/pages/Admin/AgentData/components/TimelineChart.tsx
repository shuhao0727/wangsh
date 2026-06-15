/**
 * TimelineChart — 时序热点问题分析图表
 * 使用 ECharts 绘制：折线图(提问量) + 教师标记(垂直线) + 爆发点(红点)
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import dayjs from "dayjs";
import { Flame, Users, MessageSquare } from "lucide-react";
import { getAgentChartTheme } from "./chartTheme";

type TopQuestion = { question: string; count: number };
type TimelineBucket = {
  bucket_start: string;
  bucket_end: string;
  question_count: number;
  unique_students: number;
  top_questions: TopQuestion[];
  is_burst: boolean;
  near_teacher_mark?: string | null;
};
type TeacherMark = { time: string; question: string };

interface TimelineChartProps {
  buckets: TimelineBucket[];
  teacherMarks?: TeacherMark[];
  burstPoints?: TimelineBucket[];
  height?: number;
}

const TimelineChart: React.FC<TimelineChartProps> = ({
  buckets,
  teacherMarks = [],
  burstPoints = [],
  height = 360,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<TimelineBucket | null>(null);
  const theme = useMemo(() => getAgentChartTheme(), []);

  useEffect(() => {
    if (!chartRef.current || buckets.length === 0) return;

    // 每次都重新创建实例（兼容 React Strict Mode 的 double-mount）
    if (chartInstance.current) {
      chartInstance.current.dispose();
      chartInstance.current = null;
    }
    chartInstance.current = echarts.init(chartRef.current);
    const chart = chartInstance.current;

    // 数据准备
    const xData = buckets.map((b) => dayjs(b.bucket_start).format("HH:mm"));
    const questionCounts = buckets.map((b) => b.question_count);
    const studentCounts = buckets.map((b) => b.unique_students);

    // 爆发点标记
    const burstIndices = buckets
      .map((b, i) => (b.is_burst ? i : -1))
      .filter((i) => i >= 0);

    const burstBucketIndices = new Map<number, number>();
    burstIndices.forEach((bucketIndex, scatterIndex) => {
      burstBucketIndices.set(scatterIndex, bucketIndex);
    });
    // 教师标记线
    const markLines = teacherMarks.map((tm, index) => ({
      xAxis: dayjs(tm.time).format("HH:mm"),
      label: { formatter: `教师 #${index + 1}`, fontSize: 10, color: theme.teacher },
    }));

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
        backgroundColor: theme.surfaceElevated,
        borderColor: theme.border,
        textStyle: { color: theme.textBase, fontSize: 12 },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const idx = params[0].dataIndex;
          const bucket = buckets[idx];
          if (!bucket) return "";
          let html = `<div style="font-size:12px"><b style="color:${theme.textBase}">${dayjs(bucket.bucket_start).format("HH:mm")} - ${dayjs(bucket.bucket_end).format("HH:mm")}</b>`;
          html += `<br/>提问数: <b>${bucket.question_count}</b>`;
          html += `<br/>独立学生: <b>${bucket.unique_students}</b>`;
          if (bucket.is_burst) html += `<br/><span style="color:${theme.burst}">🔥 爆发点</span>`;
          if (bucket.near_teacher_mark) html += `<br/><span style="color:${theme.teacher}">📌 教师提问已触发</span>`;
          if (bucket.top_questions?.length > 0) {
            html += `<br/><br/><b style="color:${theme.textBase}">热点问题:</b>`;
            bucket.top_questions.slice(0, 3).forEach((q) => {
              html += `<br/>• <span style="color:${theme.textMuted}">${q.question.slice(0, 30)}${q.question.length > 30 ? "..." : ""}</span> (${q.count})`;
            });
          }
          html += "</div>";
          return html;
        },
      },
      legend: {
        data: ["提问数", "独立学生数"],
        top: 8,
        textStyle: { fontSize: 11, color: theme.textSecondary },
      },
      grid: { left: 50, right: 30, top: 50, bottom: 40 },
      xAxis: {
        type: "category",
        data: xData,
        axisLabel: { fontSize: 10, rotate: xData.length > 12 ? 30 : 0, color: theme.textSecondary },
        axisLine: { lineStyle: { color: theme.border } },
      },
      yAxis: [
        { type: "value", name: "提问数", nameTextStyle: { fontSize: 10, color: theme.textSecondary }, axisLabel: { color: theme.textSecondary }, splitLine: { lineStyle: { type: "dashed", color: theme.grid } } },
        { type: "value", name: "学生数", nameTextStyle: { fontSize: 10, color: theme.textSecondary }, axisLabel: { color: theme.textSecondary }, splitLine: { show: false } },
      ],
      series: [
        {
          name: "提问数",
          type: "bar",
          data: questionCounts,
          label: {
            show: true,
            position: "top",
            color: theme.textSecondary,
            fontSize: 10,
            formatter: (params: any) => {
              const bucket = buckets[params.dataIndex];
              return bucket?.is_burst ? `${params.value} 问` : "";
            },
          },
          itemStyle: {
            color: (params: any) =>
              burstIndices.includes(params.dataIndex) ? theme.burst : theme.primary,
            borderRadius: [3, 3, 0, 0],
          },
          barMaxWidth: 28,
        },
        {
          name: "独立学生数",
          type: "line",
          yAxisIndex: 1,
          data: studentCounts,
          smooth: true,
          lineStyle: { color: theme.accent, width: 2 },
          itemStyle: { color: theme.accent },
          symbol: "circle",
          symbolSize: 5,
        },
        {
          name: "爆发点",
          type: "scatter",
          data: burstIndices.map((i) => [i, questionCounts[i]]),
          symbolSize: 14,
          itemStyle: { color: theme.burst, shadowBlur: 6, shadowColor: theme.burstGlow },
          z: 10,
        },
      ],
      ...(markLines.length > 0
        ? {
            markLine: {
              silent: true,
              symbol: ["none", "none"],
              lineStyle: { type: "dashed", color: theme.teacherSoft, width: 2 },
              data: markLines,
            },
          }
        : {}),
    };

    // 将 markLine 放到第一个 series 上
    if (markLines.length > 0) {
      (option.series as any[])[0].markLine = {
        silent: true,
        symbol: ["none", "triangle"],
        symbolSize: 8,
        lineStyle: { type: "dashed", color: theme.teacherSoft, width: 1.5 },
        label: { fontSize: 9, color: theme.teacher, position: "start" },
        data: markLines,
      };
    }

    chart.setOption(option, true);

    // 点击事件
    chart.off("click");
    chart.on("click", (params: any) => {
      if (params.dataIndex === undefined) return;
      const bucketIndex = params.seriesName === "爆发点"
        ? burstBucketIndices.get(params.dataIndex)
        : params.dataIndex;
      if (bucketIndex !== undefined && buckets[bucketIndex]) {
        setSelectedBucket(buckets[bucketIndex]);
      }
    });

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
      chartInstance.current = null;
    };
  }, [buckets, teacherMarks, burstPoints, theme]);

  if (buckets.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-border-secondary bg-surface-2 text-sm text-text-tertiary" style={{ height }}>
        暂无时序数据，可重新生成热点分析或缩小时间范围
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 图表 */}
      <div ref={chartRef} style={{ width: "100%", height }} aria-label="时序热点问题分析图表" />

      {/* 选中桶的详情 */}
      {selectedBucket && (
        <div className="rounded-xl border border-border-secondary bg-surface p-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-text-base">
                {dayjs(selectedBucket.bucket_start).format("HH:mm")} - {dayjs(selectedBucket.bucket_end).format("HH:mm")}
              </span>
              {selectedBucket.is_burst && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--ws-color-danger)]/20 bg-[var(--ws-color-danger)]/10 px-2 py-0.5 text-xs font-medium text-[var(--ws-color-danger)]">
                  <Flame className="h-3 w-3" /> 爆发点
                </span>
              )}
              {selectedBucket.near_teacher_mark && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--ws-color-warning)]/20 bg-[var(--ws-color-warning)]/10 px-2 py-0.5 text-xs text-[var(--ws-color-warning)]">
                  📌 {selectedBucket.near_teacher_mark}
                </span>
              )}
            </div>
            <button onClick={() => setSelectedBucket(null)} className="text-xs text-text-tertiary hover:text-text-secondary">
              关闭
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs text-text-secondary mb-3">
            <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {selectedBucket.question_count} 条提问</span>
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {selectedBucket.unique_students} 位学生</span>
          </div>

          {selectedBucket.top_questions.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-text-tertiary">🔥 热点问题</div>
              {selectedBucket.top_questions.map((q, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                  <span className="shrink-0 text-xs text-text-tertiary font-mono">#{i + 1}</span>
                  <span className="flex-1 text-text-base">{q.question}</span>
                  <span className="shrink-0 text-xs text-text-tertiary">{q.count}次</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TimelineChart;
