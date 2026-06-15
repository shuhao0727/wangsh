/**
 * 热点问题分析结果页 — 精简版：基本信息、核心图表、词云、LLM 总结
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Hash, Lightbulb, Loader2, Target, Users } from "lucide-react";
import * as echarts from "echarts";
import "echarts-wordcloud";
import SharedResultLayout from "./SharedResultLayout";
import { useAnalysisDetail } from "./hooks/useAnalysisDetail";
import { useNormalizedResult } from "./hooks/useNormalizedResult";
import SummaryCard from "../components/SummaryCard";
import dayjs from "dayjs";
import {
  escapeHtml,
  shortText,
  wordColor,
  safeFilePart,
  buildDisplayTeacherQuestions,
  formatTimeRange,
  normalizeTimelineBuckets,
  normalizeTimelineTeacherMarks,
} from "../normalize";
import { getAgentChartTheme } from "../components/chartTheme";
import type { HotDeepAnalysis, TopicItem, WordCloudItem } from "../types";

type HotTimelineBucket = ReturnType<typeof normalizeTimelineBuckets>[number];
type HotTimelineTeacherMark = ReturnType<typeof normalizeTimelineTeacherMarks>[number];
type HotDiagnosisTheme = TopicItem & { diagnosis?: string; overall_bloom_level?: string };

/* ─── helpers ─── */
const downloadBlob = (content: string, filename: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

/* ─────────────────────────────────────────────────────────────────── */
/* Section 1: Basic Info Bar                                          */
/* ─────────────────────────────────────────────────────────────────── */
const BasicInfoBar: React.FC<{
  detail: { title?: string; class_name?: string; start_at?: string; end_at?: string; created_at?: string };
  resultData: Record<string, unknown>;
  timelineBuckets: HotTimelineBucket[];
}> = ({ detail, resultData, timelineBuckets }) => {
  const bucketSeconds = resultData.bucket_seconds as number | undefined;
  const granularity = bucketSeconds
    ? `${Math.round(bucketSeconds / 60)} 分钟`
    : timelineBuckets.length > 0 ? "自动" : "—";

  const items = [
    { label: "课程/任务", value: detail.title || "未命名" },
    { label: "班级", value: detail.class_name || "—" },
    { label: "时间范围", value: (detail.start_at || detail.end_at) ? formatTimeRange(detail.start_at, detail.end_at) : "—" },
    { label: "时间桶粒度", value: granularity },
    { label: "分析时间", value: detail.created_at ? dayjs(detail.created_at).format("YYYY-MM-DD HH:mm") : "—" },
  ];

  return (
    <section className="rounded-2xl border border-border/70 bg-surface/90 p-4 shadow-sm">
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((item) => (
          <div key={item.label}>
            <div className="text-[11px] text-text-tertiary">{item.label}</div>
            <div className="mt-0.5 truncate text-sm font-medium text-text-base">{item.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

/* ─────────────────────────────────────────────────────────────────── */
/* Section 2: Core Chart — 教师提问点+区间+学生柱状图+趋势曲线       */
/* ─────────────────────────────────────────────────────────────────── */
const BUCKET_OPTIONS = [1, 3, 5] as const;
type BucketMinutes = (typeof BUCKET_OPTIONS)[number];

/** 将 timeline buckets 按更大颗粒度合并 */
function mergeBuckets(buckets: HotTimelineBucket[], targetMinutes: BucketMinutes): HotTimelineBucket[] {
  if (buckets.length === 0) return [];
  const targetMs = targetMinutes * 60000;
  const baseTime = dayjs(buckets[0].bucket_start).valueOf();
  const groups: Map<number, HotTimelineBucket[]> = new Map();
  for (const b of buckets) {
    const offset = dayjs(b.bucket_start).valueOf() - baseTime;
    const groupIdx = Math.floor(offset / targetMs);
    if (!groups.has(groupIdx)) groups.set(groupIdx, []);
    groups.get(groupIdx)!.push(b);
  }
  const merged: HotTimelineBucket[] = [];
  for (const [, group] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    merged.push({
      bucket_start: group[0].bucket_start,
      bucket_end: group[group.length - 1].bucket_end,
      question_count: group.reduce((s, b) => s + (b.question_count || 0), 0),
      unique_students: Math.max(...group.map((b) => b.unique_students || 0)),
      is_burst: group.some((b) => b.is_burst),
      top_questions: group.flatMap((b) => b.top_questions || []).slice(0, 4),
      near_teacher_mark: group.find((b) => b.near_teacher_mark)?.near_teacher_mark || null,
    });
  }
  return merged;
}

const HotCoreChart: React.FC<{
  themes: HotDiagnosisTheme[];
  buckets?: HotTimelineBucket[];
  teacherMarks?: HotTimelineTeacherMark[];
  questionCount?: number;
  studentCount?: number;
  burstCount?: number;
}> = ({ themes, buckets = [], teacherMarks = [], questionCount, studentCount, burstCount }) => {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [bucketMin, setBucketMin] = useState<BucketMinutes>(3);

  const rankedThemes = useMemo(
    () => themes.filter((t) => t.topic && (t.count || 0) > 0).slice(0, 10),
    [themes],
  );
  const rawTimeline = useMemo(
    () => buckets.filter((b) => dayjs(b.bucket_start).isValid() && ((b.question_count || 0) > 0 || (b.unique_students || 0) > 0)),
    [buckets],
  );
  // 前端按选定颗粒度合并 buckets
  const timeline = useMemo(() => mergeBuckets(rawTimeline, bucketMin), [rawTimeline, bucketMin]);
  const hasTimeline = timeline.length > 0;
  const totalQuestions = questionCount
    || timeline.reduce((s, b) => s + (b.question_count || 0), 0)
    || rankedThemes.reduce((s, t) => s + (t.count || 0), 0);
  const totalStudents = studentCount
    || Math.max(0, ...timeline.map((b) => b.unique_students || 0))
    || Math.max(0, ...rankedThemes.map((t) => t.unique_students || 0));
  const totalBursts = burstCount || timeline.filter((b) => b.is_burst).length;
  // 生成性问题总数（迁移 + 延伸）
  const totalGenerative = useMemo(() => timeline.reduce((sum, b) => {
    const dist = (b as Record<string, unknown>).question_type_distribution as Record<string, number> | undefined;
    if (!dist) return sum;
    return sum + (dist.transfer || 0) + (dist.extend || 0);
  }, 0), [timeline]);

  useEffect(() => {
    if (!ref.current || (!hasTimeline && rankedThemes.length === 0)) return;
    if (!chartRef.current) chartRef.current = echarts.init(ref.current);
    const theme = getAgentChartTheme();

    if (hasTimeline) {
      const compact = (ref.current?.clientWidth || 0) < 520;
      const baseTime = dayjs(timeline[0].bucket_start).valueOf();
      const timestamps = timeline.map((b) => dayjs(b.bucket_start).valueOf());
      const questionCounts = timeline.map((b) => b.question_count || 0);
      // 生成性问题（迁移+延伸）
      const generativeCounts = timeline.map((b) => {
        const dist = (b as Record<string, unknown>).question_type_distribution as Record<string, number> | undefined;
        if (!dist) return 0;
        return (dist.transfer || 0) + (dist.extend || 0);
      });
      const nonGenerativeCounts = questionCounts.map((total, i) => Math.max(0, total - generativeCounts[i]));
      const maxQuestions = Math.max(...questionCounts, 1);
      const burstIndices = timeline.map((b, i) => (b.is_burst ? i : -1)).filter((i) => i >= 0);
      const endTime = timestamps[timestamps.length - 1] || baseTime + 40 * 60000;

      // X 轴 label: 相对分钟
      const xLabels = timeline.map((b) => `${Math.round((dayjs(b.bucket_start).valueOf() - baseTime) / 60000)}'`);

      const nearestBucketIndex = (time: string) => {
        const t = dayjs(time).valueOf();
        if (!Number.isFinite(t)) return 0;
        return timeline.reduce((best, b, i) => (Math.abs(dayjs(b.bucket_start).valueOf() - t) < Math.abs(dayjs(timeline[best].bucket_start).valueOf() - t) ? i : best), 0);
      };

      // ─── 教师提问轨道（上区域）───
      const teacherTrackData: Array<{ value: number; question: string; idx: number } | null> = new Array(xLabels.length).fill(null);
      teacherMarks.forEach((m, i) => {
        const idx = nearestBucketIndex(m.time);
        teacherTrackData[idx] = { value: 1, question: m.question, idx: i + 1 };
      });

      // ─── 区间背景（markArea on bar series）───
      const teacherIndices = teacherMarks.map((m) => nearestBucketIndex(m.time)).sort((a, b) => a - b);
      const intervalColors = ["rgba(59,130,246,0.04)", "rgba(148,163,184,0.055)"];
      const markAreaData: Array<[{ xAxis: string; itemStyle: { color: string } }, { xAxis: string }]> = [];
      const bounds = [0, ...teacherIndices, xLabels.length - 1];
      for (let i = 0; i < bounds.length - 1; i++) {
        if (bounds[i] >= bounds[i + 1]) continue;
        markAreaData.push([
          { xAxis: xLabels[bounds[i]], itemStyle: { color: intervalColors[i % 2] } },
          { xAxis: xLabels[bounds[i + 1]] },
        ]);
      }

      // ─── Catmull-Rom 插值曲线（4x 颗粒度）───
      // category 轴 boundaryGap=true，柱子中心在 0.5, 1.5, 2.5...
      // value 轴需要对齐：加 0.5 偏移
      const INTERP = 4;
      const splineData: [number, number][] = [];
      for (let i = 0; i < questionCounts.length - 1; i++) {
        const v0 = questionCounts[i], v1 = questionCounts[i + 1];
        const vPrev = i > 0 ? questionCounts[i - 1] : v0;
        const vNext = i < questionCounts.length - 2 ? questionCounts[i + 2] : v1;
        const m0 = (v1 - vPrev) * 0.5, m1 = (vNext - v0) * 0.5;
        for (let k = 0; k < INTERP; k++) {
          const f = k / INTERP, f2 = f * f, f3 = f2 * f;
          const val = (2 * f3 - 3 * f2 + 1) * v0 + (f3 - 2 * f2 + f) * m0 + (-2 * f3 + 3 * f2) * v1 + (f3 - f2) * m1;
          splineData.push([i + f + 0.5, Math.max(0, Math.round(val * 100) / 100)]);
        }
      }
      splineData.push([questionCounts.length - 1 + 0.5, questionCounts[questionCounts.length - 1]]);

      chartRef.current.setOption({
        animationDuration: 800,
        grid: [
          { left: compact ? 42 : 52, right: compact ? 24 : 36, top: 30, height: 32 },   // 教师轨道
          { left: compact ? 42 : 52, right: compact ? 24 : 36, top: 86, bottom: timeline.length > 14 ? 62 : 38 }, // 主图
        ],
        // 3 个 xAxis: 0=教师轨道(category,隐藏), 1=主图category(柱子), 2=主图value(曲线叠加)
        xAxis: [
          { type: "category", gridIndex: 0, data: xLabels, show: false, boundaryGap: true },
          { type: "category", gridIndex: 1, data: xLabels, boundaryGap: true, axisLabel: { color: theme.textSecondary, fontSize: compact ? 10 : 11, hideOverlap: true }, axisLine: { lineStyle: { color: theme.border } }, axisTick: { show: false } },
          { type: "value", gridIndex: 1, min: 0, max: questionCounts.length, show: false },
        ],
        yAxis: [
          { gridIndex: 0, show: false, min: 0, max: 2 },
          { gridIndex: 1, type: "value", name: "提问数", minInterval: 1, nameTextStyle: { color: theme.textSecondary, fontSize: 11 }, axisLabel: { color: theme.textSecondary }, splitLine: { lineStyle: { type: "dashed", color: theme.grid } } },
        ],
        tooltip: {
          trigger: "axis", confine: true,
          backgroundColor: theme.surfaceElevated, borderColor: theme.border,
          textStyle: { color: theme.textBase, fontSize: 12 },
          formatter: (params: any) => {
            const idx = params?.[0]?.dataIndex ?? 0;
            const bucket = timeline[idx];
            if (!bucket) return "";
            const teacherHere = teacherMarks.filter((m) => nearestBucketIndex(m.time) === idx);
            const teacherLine = teacherHere.length > 0
              ? `<br/><span style="color:${theme.teacher || "#F59E0B"};font-weight:600">教师：${escapeHtml(shortText(teacherHere[0].question, 28))}</span>` : "";
            const topQ = (bucket.top_questions || []).slice(0, 2).map((q) => `<br/>· ${escapeHtml(shortText(q.question, 28))} (${q.count})`).join("");
            const genCount = generativeCounts[idx] || 0;
            return [`<b>${dayjs(bucket.bucket_start).format("HH:mm")} – ${dayjs(bucket.bucket_end).format("HH:mm")}</b>`,
              `学生提问：<b>${bucket.question_count || 0}</b>`,
              genCount > 0 ? `<span style="color:#10B981">生成性问题：<b>${genCount}</b> (迁移+延伸)</span>` : "",
              `独立学生：<b>${bucket.unique_students || 0}</b>`,
              bucket.is_burst ? `<span style="color:${theme.burst};font-weight:700">⚡ 脉冲</span>` : "",
              teacherLine, topQ].filter(Boolean).join("<br/>");
          },
        },
        legend: { top: 2, left: 4, itemWidth: 14, itemHeight: 10, data: ["学生提问", "生成性问题", "提问密度", "教师提问"], textStyle: { color: theme.textSecondary, fontSize: 11 } },
        dataZoom: timeline.length > 14 ? [{ type: "slider", height: 16, bottom: 8, xAxisIndex: [0, 1], start: 0, end: 100 }, { type: "inside", xAxisIndex: [0, 1] }] : [],
        series: [
          // ── 上区域：教师提问点轨道 ──
          {
            name: "教师提问", type: "scatter", xAxisIndex: 0, yAxisIndex: 0,
            symbol: "pin", symbolSize: compact ? 20 : 26,
            itemStyle: { color: theme.teacher || "#F59E0B" },
            label: { show: true, color: "#fff", fontSize: 9, fontWeight: 700, position: "inside", formatter: (p: any) => p.data?.idx ? `T${p.data.idx}` : "" },
            tooltip: { formatter: (p: any) => `<b>教师提问 T${p.data?.idx || ""}</b><br/>${escapeHtml(shortText(p.data?.question || "", 50))}` },
            data: teacherTrackData, z: 10,
          },
          // ── 下区域：学生提问柱状图（非生成性，堆叠）──
          {
            name: "学生提问", type: "bar", xAxisIndex: 1, yAxisIndex: 1,
            stack: "questions", barMaxWidth: 28,
            markArea: { silent: true, data: markAreaData },
            data: nonGenerativeCounts.map((v, i) => ({
              value: v,
              itemStyle: {
                color: burstIndices.includes(i) ? theme.burst : theme.primary,
                opacity: burstIndices.includes(i) ? 0.85 : 0.6,
                borderRadius: generativeCounts[i] > 0 ? [0, 0, 0, 0] : [5, 5, 0, 0],
              },
            })),
          },
          // ── 下区域：生成性问题（迁移+延伸，堆叠在学生提问上方）──
          {
            name: "生成性问题", type: "bar", xAxisIndex: 1, yAxisIndex: 1,
            stack: "questions", barMaxWidth: 28,
            data: generativeCounts.map((v) => ({
              value: v,
              itemStyle: {
                color: "#10B981",
                opacity: v > 0 ? 0.78 : 0,
                borderRadius: [5, 5, 0, 0],
              },
            })),
            z: 6,
          },
          // ── 下区域：提问密度曲线（value 轴, 细颗粒度）──
          {
            name: "提问密度", type: "line", xAxisIndex: 2, yAxisIndex: 1,
            smooth: 0.4, symbol: "none", showSymbol: false,
            lineStyle: { color: theme.primary, width: 2.2, opacity: 0.7 },
            areaStyle: { color: theme.primary, opacity: 0.04 },
            data: splineData.map(([x, y]) => [x, y]),
            z: 5,
          },
        ],
      }, true);
    } else {
      // 无时间线数据时：纯主题柱状图回退
      chartRef.current.setOption({
        animationDuration: 800,
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: theme.surfaceElevated, borderColor: theme.border, textStyle: { color: theme.textBase, fontSize: 12 } },
        grid: { left: 48, right: 30, top: 28, bottom: 84 },
        xAxis: { type: "category", data: rankedThemes.map((t) => shortText(t.topic, 10)), axisLine: { lineStyle: { color: theme.border } }, axisTick: { show: false }, axisLabel: { color: theme.textBase, fontSize: 11, fontWeight: 600, rotate: 24 } },
        yAxis: { type: "value", minInterval: 1, name: "提问次数", nameTextStyle: { color: theme.textSecondary, fontSize: 11 }, splitLine: { lineStyle: { type: "dashed", color: theme.grid } }, axisLabel: { color: theme.textSecondary } },
        series: [{ name: "热点主题", type: "bar", barMaxWidth: 34, data: rankedThemes.map((t, i) => ({ value: t.count, itemStyle: { color: i === 0 ? theme.uncoveredBorder : theme.beamColors[i % theme.beamColors.length], borderRadius: [10, 10, 2, 2] } })), label: { show: true, position: "top", color: theme.textBase, fontWeight: 700, formatter: (p: any) => `${rankedThemes[p.dataIndex]?.count || 0}问` } }],
      }, true);
    }
  }, [hasTimeline, rankedThemes, timeline, teacherMarks, questionCount, studentCount, burstCount, bucketMin]);

  useEffect(() => {
    const resize = () => chartRef.current?.resize();
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); chartRef.current?.dispose(); chartRef.current = null; };
  }, []);

  if (!hasTimeline && rankedThemes.length === 0) {
    return <section className="rounded-2xl border border-dashed border-border-secondary bg-surface/80 p-6 text-center text-sm text-text-tertiary">暂无课堂数据</section>;
  }

  return (
    <section className="rounded-2xl border border-primary/15 bg-surface/90 p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-base">课堂提问时序分析</h2>
          <p className="mt-1 text-xs text-text-tertiary">
            {hasTimeline ? "教师提问(顶部标记)形成教学区间，柱状图为学生提问分布，曲线为提问趋势。" : "按学生提问次数排序，直观看出哪些热点是全班共性问题。"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasTimeline && (
            <div className="flex items-center rounded-lg border border-border bg-surface-2 p-0.5">
              {BUCKET_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => setBucketMin(m)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    bucketMin === m
                      ? "bg-primary text-white shadow-sm"
                      : "text-text-secondary hover:text-text-base"
                  }`}
                >
                  {m}分钟
                </button>
              ))}
            </div>
          )}
          <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
            {hasTimeline ? `${timeline.length} 桶` : `Top ${rankedThemes.length}`}
          </span>
        </div>
      </div>
      <div ref={ref} className="h-[400px] w-full" aria-label="课堂提问时序分析图表" />
      {/* 底部统计摘要 */}
      <div className="mt-3 grid gap-2 rounded-xl border border-primary/10 bg-primary-soft/20 p-2 text-sm sm:grid-cols-5">
        {[
          { label: "全程问题数", value: `${totalQuestions || 0} 次` },
          { label: "生成性问题", value: totalGenerative > 0 ? `${totalGenerative} 次` : "—" },
          { label: "参与学生数", value: totalStudents ? `${totalStudents} 人` : "—" },
          { label: "热点脉冲", value: `${totalBursts || 0} 个` },
          { label: hasTimeline ? "教师锚点" : "热点主题", value: hasTimeline ? `${teacherMarks.length} 个` : `${rankedThemes.length} 个` },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border-secondary bg-surface/85 px-3 py-2">
            <div className="text-[11px] text-text-tertiary">{s.label}</div>
            <div className="mt-0.5 text-lg font-semibold text-primary">{s.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

/* ─────────────────────────────────────────────────────────────────── */
/* Section 3: Word Cloud                                              */
/* ─────────────────────────────────────────────────────────────────── */
const WordCloudChart: React.FC<{ data: WordCloudItem[] }> = ({ data }) => {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current || data.length === 0) return;
    if (!chartRef.current) chartRef.current = echarts.init(ref.current);
    const theme = getAgentChartTheme();
    chartRef.current.setOption({
      tooltip: {
        show: true,
        backgroundColor: theme.surfaceElevated,
        borderColor: theme.border,
        textStyle: { color: theme.textBase, fontSize: 13 },
        formatter: (params: any) => `${params.name}<br/>出现 <b>${params.value}</b> 次`,
      },
      series: [{
        type: "wordCloud",
        shape: "circle",
        sizeRange: [16, 72],
        rotationRange: [0, 0],
        gridSize: 8,
        drawOutOfBound: false,
        layoutAnimation: true,
        textStyle: { fontFamily: "sans-serif", fontWeight: "bold", color: (w: any) => wordColor(w.name || "") },
        emphasis: { focus: "self", scale: 1.2, textStyle: { textShadowBlur: 12, textShadowColor: "rgba(0,0,0,0.2)" } },
        data: data.map((item) => ({ name: item.word, value: item.count })),
      }],
    }, true);
  }, [data]);

  useEffect(() => {
    const resize = () => chartRef.current?.resize();
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); chartRef.current?.dispose(); chartRef.current = null; };
  }, []);

  if (data.length === 0) {
    return <div className="flex h-[400px] items-center justify-center rounded-lg bg-surface-2 text-sm text-text-tertiary">暂无词云数据</div>;
  }
  return <div ref={ref} className="h-[400px] w-full" aria-label="学生关注点词云图表" />;
};

/* ─────────────────────────────────────────────────────────────────── */
/* Section 4: LLM Summary (collapsible)                               */
/* ─────────────────────────────────────────────────────────────────── */
const LLMSummary: React.FC<{
  deepAnalysis: HotDeepAnalysis;
  teachingSuggestions: Array<{ theme?: string; priority?: string; reason?: string; suggestion?: string }>;
}> = ({ deepAnalysis, teachingSuggestions }) => {
  const [open, setOpen] = useState(false);
  const executive = deepAnalysis.executive_summary;
  const deepSuggestions = deepAnalysis.teaching_suggestions || [];
  const suggestions = deepSuggestions.length > 0 ? deepSuggestions : teachingSuggestions;

  if (!executive && suggestions.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border/70 bg-surface/90 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-5 py-4 text-left"
      >
        {open ? <ChevronDown className="h-4 w-4 text-text-tertiary" /> : <ChevronRight className="h-4 w-4 text-text-tertiary" />}
        <h2 className="text-base font-semibold text-text-base">LLM 教学建议</h2>
        <span className="ml-auto rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
          {suggestions.length} 条建议
        </span>
      </button>
      {open && (
        <div className="border-t border-border-secondary px-5 pb-5 pt-4 space-y-4">
          {executive && (
            <div className="rounded-xl bg-primary-soft/30 px-4 py-3">
              <div className="mb-1 text-xs font-semibold text-primary">总体摘要</div>
              <p className="text-sm leading-relaxed text-text-secondary">{executive}</p>
            </div>
          )}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              {suggestions.map((item, index) => {
                // 兼容 deep suggestions 和普通 suggestions 的不同字段
                const action = (item as any).suggested_action || (item as any).suggestion || "";
                const category = (item as any).category || (item as any).theme || "";
                const priority = (item as any).priority || "";
                const observation = (item as any).observation || (item as any).reason || "";
                return (
                  <div key={`sug-${index}`} className="rounded-xl border border-border-secondary bg-surface-2/70 p-3">
                    <div className="flex items-center gap-2 text-xs">
                      {priority && <span className="rounded-full bg-primary-soft px-2 py-0.5 font-semibold text-primary">{priority}</span>}
                      {category && <span className="text-text-tertiary">{category}</span>}
                    </div>
                    {observation && <p className="mt-1.5 text-xs text-text-tertiary">{observation}</p>}
                    <p className="mt-1.5 text-sm leading-relaxed text-text-base">{action}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

/* ─────────────────────────────────────────────────────────────────── */
/* Main Page Component                                                */
/* ─────────────────────────────────────────────────────────────────── */
const HotAnalysisResultPage: React.FC = () => {
  const { loading, detail } = useAnalysisDetail();
  const { wc, resultData, covered, uncovered, hotThemes, teachingSuggestions, savedMainQuestionChain } = useNormalizedResult(detail);

  const teacherQuestions = useMemo(
    () => buildDisplayTeacherQuestions(resultData, savedMainQuestionChain, detail),
    [resultData, savedMainQuestionChain, detail],
  );
  const timelineBuckets = useMemo(() => normalizeTimelineBuckets(resultData, detail), [resultData, detail]);
  const timelineTeacherMarks = useMemo(() => normalizeTimelineTeacherMarks(resultData, detail), [resultData, detail]);

  const hotDeepAnalysis = useMemo(() => (resultData.deep_analysis || {}) as HotDeepAnalysis, [resultData.deep_analysis]);

  // 合并热点主题（用于图表）
  const diagnosticThemes: HotDiagnosisTheme[] = useMemo(() => {
    const deepThemes = hotDeepAnalysis.theme_analysis || [];
    if (deepThemes.length > 0) {
      return deepThemes.map((t, i) => ({
        topic: t.theme || hotThemes[i]?.topic || `主题 ${i + 1}`,
        count: Number(t.question_count ?? hotThemes[i]?.count ?? 0),
        unique_students: Number(t.unique_students ?? hotThemes[i]?.unique_students ?? 0) || undefined,
        questions: t.representative_questions || hotThemes[i]?.questions || [],
        representative_question: (t.representative_questions || [])[0] || hotThemes[i]?.representative_question,
        diagnosis: t.diagnosis,
        overall_bloom_level: t.overall_bloom_level,
      })).sort((a, b) => (b.count || 0) - (a.count || 0));
    }
    return hotThemes;
  }, [hotDeepAnalysis, hotThemes]);

  const hotQuestionCount = useMemo(() => (
    resultData.summary?.question_count
    || timelineBuckets.reduce((s, b) => s + (b.question_count || 0), 0)
    || diagnosticThemes.reduce((s, t) => s + (t.count || 0), 0)
    || wc.reduce((s, w) => s + (w.count || 0), 0)
  ), [resultData.summary?.question_count, timelineBuckets, diagnosticThemes, wc]);
  const hotStudentCount = useMemo(() => (
    resultData.summary?.unique_students
    || Math.max(...timelineBuckets.map((b) => b.unique_students || 0), 0)
    || Math.max(...diagnosticThemes.map((t) => t.unique_students || 0), 0)
  ), [resultData.summary?.unique_students, timelineBuckets, diagnosticThemes]);
  const burstCount = useMemo(() => (
    resultData.summary?.burst_count
    || timelineBuckets.filter((b) => b.is_burst).length
    || (resultData.burst_points || []).length
  ), [resultData.summary?.burst_count, timelineBuckets, resultData.burst_points]);

  // 导出选项
  const exportOpts = useMemo(() => {
    if (!detail) return undefined;
    const title = detail.title || "任务分析";
    const safe = safeFilePart(title);
    const ts = dayjs(detail.created_at).format("YYYYMMDD");
    return [
      {
        label: "HTML 报告", ext: "html", action: () => {
          const lines = [`<html><meta charset="UTF-8"><title>${title}</title><body>`, `<h1>${title}</h1><p>${detail.created_at}</p>`,
            `<h2>热点词</h2><ul>${wc.map((w) => `<li>${w.word} (${w.count})</li>`).join("")}</ul>`,
            `<h2>覆盖主题</h2><ul>${covered.map((c) => `<li>${c.topic} (${c.count})</li>`).join("")}</ul>`,
            `<h2>生发问题</h2><ul>${uncovered.map((u) => `<li>${u.topic} (${u.count})</li>`).join("")}</ul>`, "</body></html>"];
          downloadBlob(lines.join("\n"), `任务分析_${safe}_${ts}.html`, "text/html;charset=utf-8");
        },
      },
      {
        label: "Markdown", ext: "md", action: () => {
          const md = [`# ${title}`, `> ${detail.created_at}`, ""];
          if (wc.length) { md.push("## 热点词"); wc.slice(0, 10).forEach((w) => md.push(`- **${w.word}** (${w.count})`)); md.push(""); }
          if (covered.length) { md.push("## 已覆盖"); covered.forEach((c) => md.push(`- ${c.topic} (${c.count})`)); md.push(""); }
          if (uncovered.length) { md.push("## 生发问题"); uncovered.forEach((u) => md.push(`- ${u.topic} (${u.count})`)); md.push(""); }
          downloadBlob(md.join("\n"), `任务分析_${safe}_${ts}.md`, "text/markdown;charset=utf-8");
        },
      },
    ];
  }, [detail, wc, covered, uncovered]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!detail) return <div className="flex min-h-screen items-center justify-center text-sm text-text-tertiary">记录不存在</div>;

  const summaryCards = (
    <div className="flex items-center gap-6 rounded-xl border border-border/50 bg-surface/80 px-5 py-3">
      {[
        { icon: <Hash className="h-3.5 w-3.5" />, label: "学生提问", value: hotQuestionCount || 0 },
        { icon: <Users className="h-3.5 w-3.5" />, label: "参与学生", value: hotStudentCount || 0 },
        { icon: <Lightbulb className="h-3.5 w-3.5" />, label: "教师提问", value: teacherQuestions.length },
        { icon: <Target className="h-3.5 w-3.5" />, label: "热点脉冲", value: burstCount || 0 },
      ].map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="text-primary">{item.icon}</span>
          <span className="text-xs text-text-tertiary">{item.label}</span>
          <span className="text-base font-bold tabular-nums text-text-base">{item.value}</span>
        </div>
      ))}
    </div>
  );

  return (
    <SharedResultLayout detail={detail} exportOptions={exportOpts} summaryCards={summaryCards}>
      <div className="space-y-5">
        {/* 1. Basic Info */}
        <BasicInfoBar detail={detail} resultData={resultData} timelineBuckets={timelineBuckets} />

        {/* 2. Core Chart */}
        <HotCoreChart
          themes={diagnosticThemes}
          buckets={timelineBuckets}
          teacherMarks={timelineTeacherMarks}
          questionCount={hotQuestionCount}
          studentCount={hotStudentCount}
          burstCount={burstCount}
        />

        {/* 3. Word Cloud */}
        <section className="rounded-2xl border border-border/70 bg-surface/90 p-5 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-text-base">学生关注点词云</h2>
              <p className="mt-1 text-xs text-text-tertiary">词越大，代表学生关注度越高，需回到原问确认是否为全班共性问题。</p>
            </div>
            <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{wc.length} 词</span>
          </div>
          <WordCloudChart data={wc} />
        </section>

        {/* 4. LLM Summary */}
        <LLMSummary deepAnalysis={hotDeepAnalysis} teachingSuggestions={teachingSuggestions} />
      </div>
    </SharedResultLayout>
  );
};

export default HotAnalysisResultPage;
