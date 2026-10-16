/**
 * 学生问题链分析结果页 — 精简版：基本信息、光束图（占位）、问题类型分布、LLM 总结
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Hash, Lightbulb, Loader2, Target, Users } from "lucide-react";
import * as echarts from "echarts";
import dayjs from "dayjs";
import SharedResultLayout from "./SharedResultLayout";
import { useAnalysisDetail } from "./hooks/useAnalysisDetail";
import { useNormalizedResult } from "./hooks/useNormalizedResult";
import { useBeamData } from "./hooks/useBeamData";
import {
  escapeHtml,
  safeFilePart,
  formatTimeRange,
  normalizeTimelineBuckets,
  normalizeTimelineTeacherMarks,
} from "../normalize";
import { getAgentChartTheme } from "../components/chartTheme";
import ChainBeamChart from "../components/ChainBeamChart";
import type { ChainDeepAnalysis } from "../types";

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
}> = ({ detail, resultData }) => {
  const agentName = (resultData.agent_name as string) || ((resultData.analysis_agent as Record<string, unknown>)?.name as string) || "—";
  const items = [
    { label: "课程/任务", value: detail.title || "未命名" },
    { label: "智能体", value: agentName },
    { label: "班级", value: detail.class_name || "—" },
    { label: "时间范围", value: (detail.start_at || detail.end_at) ? formatTimeRange(detail.start_at, detail.end_at) : "—" },
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
/* Section 2: Core Chart — ChainBeamChart wrapper                     */
/* ─────────────────────────────────────────────────────────────────── */
interface BeamChartSectionProps {
  resultData: any;
  studentChains: any[];
  teacherMarks: ReturnType<typeof normalizeTimelineTeacherMarks>;
  startTime?: string;
}

const BeamChartSection: React.FC<BeamChartSectionProps> = ({ resultData, studentChains, teacherMarks, startTime }) => {
  // 从 resultData 提取 merged_groups（后端 analyze_student_chains_v2 输出）
  const mergedGroups = useMemo(() => (resultData.merged_groups || []) as any[], [resultData.merged_groups]);

  // 将 studentChains 转换为 ChainBeamChart 需要的格式
  const formattedChains = useMemo(() => {
    if (!studentChains || studentChains.length === 0) return [];
    return studentChains.map((chain: any) => ({
      user_id: chain.user_id ?? chain.student_id ?? null,
      user_name: chain.user_name ?? chain.student_name ?? "未知",
      questions: (chain.questions || chain.nodes || []).map((q: any) => ({
        message_id: q.message_id ?? q.id ?? Math.random(),
        content: q.content ?? q.question ?? q.text ?? "",
        created_at: q.created_at ?? q.time ?? "",
      })),
    }));
  }, [studentChains]);

  // 格式化教师标记
  const formattedTeacherMarks = useMemo(() =>
    teacherMarks.map((m: any) => ({ time: m.time, question: m.question || "" })),
    [teacherMarks],
  );

  return (
    <ChainBeamChart
      mergedGroups={mergedGroups}
      studentChains={formattedChains}
      teacherMarks={formattedTeacherMarks}
      startTime={startTime}
    />
  );
};

/* ─────────────────────────────────────────────────────────────────── */
/* Section 2.5: Merge Review Panel                                     */
/* ─────────────────────────────────────────────────────────────────── */
const MergeReviewPanel: React.FC<{ resultData: any }> = ({ resultData }) => {
  const [expanded, setExpanded] = useState(false);
  const mergedGroups = (resultData.merged_groups || []) as any[];
  const deepAnalysis = (resultData.deep_analysis || {}) as any;
  const review = deepAnalysis.merged_groups_review as {
    confirmed?: number[]; split?: Array<{ group_id: number; reason: string }>; new_merges?: Array<{ topic_label: string; reason: string }>;
  } | undefined;
  const rawGroupCount = mergedGroups.filter((g: any) => g.member_count > 1).length;
  const confirmedCount = review?.confirmed?.length || 0;
  const splitCount = review?.split?.length || 0;
  const newMergeCount = review?.new_merges?.length || 0;

  if (rawGroupCount === 0 && !review) return null;

  return (
    <section className="rounded-2xl border border-border/60 bg-surface/90 p-5 shadow-sm">
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between text-left">
        <div>
          <h2 className="text-sm font-semibold text-text-base">合并审查详情</h2>
          <p className="mt-0.5 text-xs text-text-tertiary">
            粗筛 {rawGroupCount} 组 {review ? `→ 确认${confirmedCount} / 拆分${splitCount} / 新增${newMergeCount}` : "（LLM 未审查）"}
          </p>
        </div>
        <ChevronDown className={`h-4 w-4 text-text-tertiary transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="mt-4 space-y-4">
          <div>
            <div className="text-xs font-medium text-text-secondary mb-2">📋 规则粗筛 (阈值: {resultData.merge_threshold || 0.30})</div>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {mergedGroups.filter((g: any) => g.member_count > 1).slice(0, 15).map((g: any, i: number) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-border/40 bg-surface-2/30 px-3 py-1.5 text-xs">
                  <span className="rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">{g.member_count}人</span>
                  <span className="font-medium text-text-base">{g.topic_label || `组${g.group_id}`}</span>
                  <span className="truncate text-text-tertiary">「{g.representative_question?.slice(0, 30) || ""}」</span>
                </div>
              ))}
            </div>
          </div>
          {review && (
            <div className="space-y-3 border-t border-border/30 pt-3">
              <div className="text-xs font-medium text-text-secondary">🤖 LLM 审查</div>
              {confirmedCount > 0 && <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2 text-xs text-green-700">✅ 确认 {confirmedCount} 组</div>}
              {splitCount > 0 && <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700">✂️ 拆分 {splitCount} 组{(review.split || []).map((s, i) => <span key={i} className="block mt-0.5 text-[11px]">组{s.group_id}: {s.reason}</span>)}</div>}
              {newMergeCount > 0 && <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">➕ 新增 {newMergeCount} 组{(review.new_merges || []).map((m, i) => <span key={i} className="block mt-0.5 text-[11px]">「{m.topic_label}」{m.reason}</span>)}</div>}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

/* ─────────────────────────────────────────────────────────────────── */
/* Section 3: Question Type Distribution                              */
/* ─────────────────────────────────────────────────────────────────── */
/** 问题类型标签及其中文名 */
const QUESTION_TYPES = [
  { key: "clarify", label: "澄清" },
  { key: "follow_up", label: "跟进" },
  { key: "apply", label: "应用" },
  { key: "debug", label: "调试" },
  { key: "challenge", label: "质疑" },
  { key: "transfer", label: "迁移" },
  { key: "extend", label: "延伸" },
  { key: "off_track", label: "偏离" },
] as const;

const QuestionTypeDistribution: React.FC<{
  buckets: ReturnType<typeof normalizeTimelineBuckets>;
  resultData: Record<string, unknown>;
}> = ({ buckets, resultData }) => {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  // 从 timeline_buckets 的 question_type_distribution 字段聚合
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    // 优先从 buckets 聚合
    for (const b of buckets) {
      const dist = (b as any).question_type_distribution as Record<string, number> | undefined;
      if (!dist) continue;
      for (const [key, val] of Object.entries(dist)) {
        counts[key] = (counts[key] || 0) + (val || 0);
      }
    }
    // 如果 buckets 里没有，尝试从 resultData.question_type_distribution 读取
    if (Object.keys(counts).length === 0) {
      const topLevel = resultData.question_type_distribution as Record<string, number> | undefined;
      if (topLevel) Object.assign(counts, topLevel);
    }
    return counts;
  }, [buckets, resultData]);

  const chartData = useMemo(
    () => QUESTION_TYPES.map((t) => ({ label: t.label, value: typeCounts[t.key] || 0 })).filter((d) => d.value > 0),
    [typeCounts],
  );

  useEffect(() => {
    if (!ref.current || chartData.length === 0) return;
    if (!chartRef.current) chartRef.current = echarts.init(ref.current);
    const theme = getAgentChartTheme();

    chartRef.current.setOption({
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: theme.surfaceElevated,
        borderColor: theme.border,
        textStyle: { color: theme.textBase, fontSize: 12 },
      },
      grid: { left: 72, right: 32, top: 12, bottom: 20 },
      xAxis: {
        type: "value",
        minInterval: 1,
        axisLabel: { color: theme.textSecondary, fontSize: 11 },
        splitLine: { lineStyle: { type: "dashed", color: theme.grid } },
      },
      yAxis: {
        type: "category",
        data: chartData.map((d) => d.label),
        axisLine: { lineStyle: { color: theme.border } },
        axisTick: { show: false },
        axisLabel: { color: theme.textBase, fontSize: 12, fontWeight: 600 },
      },
      series: [{
        type: "bar",
        barMaxWidth: 22,
        data: chartData.map((d, i) => ({
          value: d.value,
          itemStyle: {
            color: theme.beamColors[i % theme.beamColors.length],
            borderRadius: [0, 6, 6, 0],
          },
        })),
        label: { show: true, position: "right", color: theme.textBase, fontWeight: 700, fontSize: 11 },
      }],
    }, true);
  }, [chartData]);

  useEffect(() => {
    const resize = () => chartRef.current?.resize();
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); chartRef.current?.dispose(); chartRef.current = null; };
  }, []);

  if (chartData.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border-secondary bg-surface/80 p-6 text-center text-sm text-text-tertiary">
        暂无问题类型分布数据
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border/70 bg-surface/90 p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-base">问题类型分布</h2>
          <p className="mt-1 text-xs text-text-tertiary">学生问题按关系类型统计，辅助判断课堂追问的认知深度分布。</p>
        </div>
        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
          {chartData.reduce((s, d) => s + d.value, 0)} 条
        </span>
      </div>
      <div ref={ref} className="h-[260px] w-full" aria-label="问题类型分布图表" />
    </section>
  );
};

/* ─────────────────────────────────────────────────────────────────── */
/* Section 4: LLM Summary (collapsible)                               */
/* ─────────────────────────────────────────────────────────────────── */
const ChainLLMSummary: React.FC<{ deep: ChainDeepAnalysis }> = ({ deep }) => {
  const [open, setOpen] = useState(false);
  const executive = deep.executive_summary;
  const interventions = [
    ...(deep.intervention_plan?.whole_class || []).map((i) => ({ tag: "全班", text: i.action || i.target_gap || "" })),
    ...(deep.intervention_plan?.small_group || []).map((i) => ({ tag: "小组", text: i.action || i.common_issue || "" })),
    ...(deep.intervention_plan?.individual || []).map((i) => ({ tag: `个体${i.student ? `·${i.student}` : ""}`, text: i.action || i.goal || "" })),
  ].filter((i) => i.text);

  if (!executive && interventions.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border/70 bg-surface/90 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-5 py-4 text-left"
      >
        {open ? <ChevronDown className="h-4 w-4 text-text-tertiary" /> : <ChevronRight className="h-4 w-4 text-text-tertiary" />}
        <h2 className="text-base font-semibold text-text-base">LLM 认知诊断摘要</h2>
        <span className="ml-auto rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">
          {interventions.length} 条干预建议
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
          {interventions.length > 0 && (
            <div className="space-y-2">
              {interventions.map((item, index) => (
                <div key={`int-${index}`} className="rounded-xl border border-border-secondary bg-surface-2/70 p-3">
                  <span className="mr-2 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">{item.tag}</span>
                  <span className="text-sm leading-relaxed text-text-base">{item.text}</span>
                </div>
              ))}
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
const ChainAnalysisResultPage: React.FC = () => {
  const { loading, detail, isBeamView } = useAnalysisDetail();
  const {
    resultData,
    chainCount,
    teacherAnchorCount,
    questionTotal,
    studentTotal,
    savedStudentChains,
  } = useBeamData(detail, isBeamView);
  // 保留 hook 引用，后续光束图组件可能需要
  useNormalizedResult(detail);

  const chainDeepAnalysis = useMemo(
    () => (resultData.deep_analysis || {}) as ChainDeepAnalysis,
    [resultData.deep_analysis],
  );

  const timelineBuckets = useMemo(() => normalizeTimelineBuckets(resultData, detail), [resultData, detail]);
  const timelineTeacherMarks = useMemo(() => normalizeTimelineTeacherMarks(resultData, detail), [resultData, detail]);

  // 平均链长
  const avgChainLength = useMemo(() => {
    if (chainCount === 0) return 0;
    return Math.round((questionTotal / chainCount) * 10) / 10;
  }, [questionTotal, chainCount]);

  // 导出选项
  const exportOpts = useMemo(() => {
    if (!detail) return undefined;
    const title = detail.title || "问题链分析";
    const safe = safeFilePart(title);
    const ts = dayjs(detail.created_at).format("YYYYMMDD");
    return [
      {
        label: "HTML 报告", ext: "html", action: () => {
          const summary = chainDeepAnalysis.executive_summary || "暂无摘要";
          const lines = [
            `<html><meta charset="UTF-8"><title>${escapeHtml(title)}</title><body>`,
            `<h1>${escapeHtml(title)}</h1><p>${detail.created_at}</p>`,
            `<h2>总体摘要</h2><p>${escapeHtml(summary)}</p>`,
            `<h2>统计</h2><ul><li>学生数: ${studentTotal}</li><li>问题链: ${chainCount}</li><li>教师提问: ${teacherAnchorCount}</li><li>平均链长: ${avgChainLength}</li></ul>`,
            "</body></html>",
          ];
          downloadBlob(lines.join("\n"), `问题链分析_${safe}_${ts}.html`, "text/html;charset=utf-8");
        },
      },
      {
        label: "Markdown", ext: "md", action: () => {
          const md = [
            `# ${title}`, `> ${detail.created_at}`, "",
            "## 统计",
            `- 学生数: ${studentTotal}`,
            `- 问题链: ${chainCount}`,
            `- 教师提问: ${teacherAnchorCount}`,
            `- 平均链长: ${avgChainLength}`,
            "",
          ];
          if (chainDeepAnalysis.executive_summary) {
            md.push("## 总体摘要", chainDeepAnalysis.executive_summary, "");
          }
          downloadBlob(md.join("\n"), `问题链分析_${safe}_${ts}.md`, "text/markdown;charset=utf-8");
        },
      },
    ];
  }, [detail, chainDeepAnalysis, studentTotal, chainCount, teacherAnchorCount, avgChainLength]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!detail) return <div className="flex min-h-screen items-center justify-center text-sm text-text-tertiary">记录不存在</div>;

  const summaryCards = (
    <div className="flex items-center gap-6 rounded-xl border border-border/50 bg-surface/80 px-5 py-3">
      {[
        { icon: <Users className="h-3.5 w-3.5" />, label: "学生数", value: studentTotal || 0 },
        { icon: <Hash className="h-3.5 w-3.5" />, label: "问题链数", value: chainCount || 0 },
        { icon: <Lightbulb className="h-3.5 w-3.5" />, label: "教师提问数", value: teacherAnchorCount || 0 },
        { icon: <Target className="h-3.5 w-3.5" />, label: "平均链长", value: avgChainLength || 0 },
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
        <BasicInfoBar detail={detail} resultData={resultData} />

        {/* 2. Core Chart — 光束图 */}
        <BeamChartSection
          resultData={resultData}
          studentChains={savedStudentChains || []}
          teacherMarks={timelineTeacherMarks}
          startTime={detail?.start_at}
        />

        {/* 2.5 Merge Review */}
        <MergeReviewPanel resultData={resultData} />

        {/* 3. Question Type Distribution */}
        <QuestionTypeDistribution buckets={timelineBuckets} resultData={resultData} />

        {/* 4. LLM Summary */}
        <ChainLLMSummary deep={chainDeepAnalysis} />
      </div>
    </SharedResultLayout>
  );
};

export default ChainAnalysisResultPage;
