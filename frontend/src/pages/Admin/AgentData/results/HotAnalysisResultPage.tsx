/**
 * 热点问题分析结果页 — 精简版：基本信息、核心图表、词云、LLM 总结
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BarChart3, ChevronDown, ChevronRight, Hash, Info, Lightbulb, Link2, Loader2, Target, Users } from "lucide-react";
import * as echarts from "echarts";
import "echarts-wordcloud";
import SharedResultLayout from "./SharedResultLayout";
import { useAnalysisDetail } from "./hooks/useAnalysisDetail";
import { useNormalizedResult } from "./hooks/useNormalizedResult";
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
import type { HotAnalysisAudit, HotDataQuality, HotDeepAnalysis, HotStudentQuestionEvent, TaskAnalysisResult, TopicItem, WordCloudItem } from "../types";

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

const toFiniteNumber = (...values: Array<unknown>) => {
  for (const value of values) {
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const signalPercent = (value: unknown) => `${Math.round(Math.max(0, Math.min(1, toFiniteNumber(value))) * 100)}%`;
const scoreText = (value: unknown) => {
  const parsed = toFiniteNumber(value);
  return parsed > 0 || value === 0 ? `${Math.round(parsed * 100) / 100}` : "—";
};

const confidenceLabel = (value?: string | null) => ({
  high: "高",
  medium: "中",
  low: "低",
  unknown: "未知",
}[String(value || "unknown")] || String(value || "未知"));

const confidenceClass = (value?: string | null) => {
  if (value === "low") return "border-warning/30 bg-warning-soft text-warning";
  if (value === "high") return "border-primary/20 bg-primary-soft text-primary";
  return "border-border-secondary bg-surface-2 text-text-secondary";
};

const matchTypeLabel = (value?: string | null) => ({
  same_session_semantic: "同会话 + 语义",
  semantic_time: "语义 + 时间",
  same_session_time: "同会话 + 时间",
  time_only: "仅时间",
}[String(value || "")] || (value ? String(value) : "未说明"));

const formatTriggerDelay = (value?: number | null) => {
  if (value == null || !Number.isFinite(Number(value))) return "时间差未记录";
  const seconds = Number(value);
  if (Math.abs(seconds) < 1) return "约同时发生";
  return seconds > 0
    ? `教师问题后 ${Math.round(seconds)} 秒`
    : `学生问题早于教师 ${Math.round(Math.abs(seconds))} 秒（容错）`;
};

/* ─────────────────────────────────────────────────────────────────── */
/* Section 1.5: Data quality and scoring method                         */
/* ─────────────────────────────────────────────────────────────────── */
const DataQualityPanel: React.FC<{
  dataQuality?: HotDataQuality;
  analysisAudit?: HotAnalysisAudit;
  summary?: TaskAnalysisResult["summary"];
  analysisVersion?: string;
  validQuestionCount?: number;
  fallbackRawQuestionCount?: number;
}> = ({ dataQuality, analysisAudit, summary, analysisVersion, validQuestionCount = 0, fallbackRawQuestionCount = 0 }) => {
  const validCount = Math.max(0, toFiniteNumber(dataQuality?.valid_question_count, summary?.valid_question_count, validQuestionCount));
  // 旧记录可能只有 question_count / student_question_events，没有保存 raw_count。
  // 这种情况下不能把“原始问题”渲染成 0，否则会制造 raw < valid 的伪矛盾。
  const savedRawCount = [dataQuality?.raw_count, dataQuality?.raw_event_count, summary?.raw_count]
    .map((value) => Number(value))
    .find((value) => Number.isFinite(value) && value > 0);
  const rawCount = Math.max(0, savedRawCount ?? 0, fallbackRawQuestionCount, validCount);
  const excludedCount = Math.max(0, toFiniteNumber(
    dataQuality?.excluded_count,
    rawCount > 0 ? rawCount - validCount : 0,
  ));
  const promptEchoCount = Math.max(0, toFiniteNumber(dataQuality?.prompt_echo_count, summary?.prompt_echo_count));
  const duplicateCount = Math.max(0, toFiniteNumber(dataQuality?.duplicate_count, summary?.duplicate_count));
  const noiseCount = Math.max(0, toFiniteNumber(dataQuality?.noise_count, summary?.noise_count));
  const offTrackCount = Math.max(0, toFiniteNumber(dataQuality?.off_track_count));
  const tooShortCount = Math.max(0, toFiniteNumber(dataQuality?.too_short_count));

  const hasAudit = Boolean(analysisAudit?.audit_version);
  if (rawCount === 0 && validCount === 0 && excludedCount === 0 && !hasAudit) return null;

  const auditWarnings = analysisAudit?.warnings || [];
  const warningLabel: Record<string, string> = {
    raw_count_less_than_valid_count: "原始学生事件数小于有效问题数",
    excluded_count_mismatch: "排除事件数与原始/有效差值不一致",
    anchor_denominator_mismatch: "教师锚点分母与有效问题数不一致",
    anchor_match_exceeds_valid_count: "教师锚点匹配数超过有效问题数",
    confidence_distribution_mismatch: "教师锚点置信度分布与匹配数不一致",
  };

  const cards = [
    { label: "原始学生问题", value: rawCount, hint: "先保留，再做质量筛选" },
    { label: "进入分析", value: validCount, hint: "主题、词云、时间线和评分" },
    { label: "排除/待核查", value: excludedCount, hint: "不参与热点主统计" },
    { label: "疑似复制/回声", value: promptEchoCount, hint: "任务单或题干回显" },
    { label: "重复提交", value: duplicateCount, hint: "同一学生短时间重复" },
  ];

  return (
    <section className="rounded-2xl border border-border/70 bg-surface/90 p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <BarChart3 className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-text-base">数据质量与统计口径</h2>
            <p className="mt-1 text-xs leading-relaxed text-text-tertiary">
              原始问题不会被删除；只有通过质量筛选的问题进入热点识别，避免把复制、重复或偏题消息直接当成学习困难。
            </p>
          </div>
        </div>
        {analysisVersion && (
          <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">规则 {analysisVersion}</span>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border-secondary bg-surface-2/70 px-3 py-2.5">
            <div className="text-[11px] text-text-tertiary">{card.label}</div>
            <div className="mt-1 text-xl font-bold tabular-nums text-text-base">{card.value}</div>
            <div className="mt-0.5 text-[11px] text-text-tertiary">{card.hint}</div>
          </div>
        ))}
      </div>
      {(noiseCount > 0 || offTrackCount > 0 || tooShortCount > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
          <span className="font-medium text-text-base">噪声拆分：</span>
          {noiseCount > 0 && <span className="rounded-full border border-border-secondary bg-surface-2 px-2 py-1">噪声 {noiseCount}</span>}
          {offTrackCount > 0 && <span className="rounded-full border border-border-secondary bg-surface-2 px-2 py-1">偏离任务 {offTrackCount}</span>}
          {tooShortCount > 0 && <span className="rounded-full border border-border-secondary bg-surface-2 px-2 py-1">过短 {tooShortCount}</span>}
        </div>
      )}
      {hasAudit ? (
        <div className="mt-4 rounded-xl border border-border-secondary bg-surface-2/40 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-text-base">统计口径审计</span>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] ${analysisAudit?.teacher_anchor_statistics_consistent === false || auditWarnings.length > 0 ? "border-warning/30 bg-warning-soft text-warning" : "border-primary/20 bg-primary-soft text-primary"}`}>
              {analysisAudit?.teacher_anchor_statistics_consistent === false || auditWarnings.length > 0 ? "需复核" : "自洽"}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["分析原始事件", analysisAudit?.raw_event_count],
              ["原始学生事件", analysisAudit?.raw_student_event_count],
              ["有效问题", analysisAudit?.valid_question_count],
              ["排除事件", analysisAudit?.excluded_event_count],
              ["锚点统计分母", analysisAudit?.teacher_anchor_denominator],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <div className="text-[10px] text-text-tertiary">{label}</div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums text-text-base">{value == null ? "未记录" : String(value)}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[11px] leading-relaxed text-text-tertiary">
            教师锚点匹配 {analysisAudit?.teacher_anchor_match_count ?? "未记录"} 条，置信度统计 {analysisAudit?.teacher_anchor_confidence_total ?? "未记录"} 条；该关联是统计复盘线索，不代表因果关系。
          </div>
          {auditWarnings.length > 0 && (
            <div className="mt-2 space-y-1 text-[11px] text-warning">
              {auditWarnings.map((warning) => <div key={warning}>• {warningLabel[warning] || warning}</div>)}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft px-3 py-2.5 text-xs leading-relaxed text-warning">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>本记录未保存结构化统计口径审计信息；上方兼容展示可能来自旧字段或前端回退，不视为后端审计结论。建议重新生成 hot_v2。</span>
        </div>
      )}
    </section>
  );
};

/* ─────────────────────────────────────────────────────────────────── */
/* Section 1.6: Explainable hotness ranking                            */
/* ─────────────────────────────────────────────────────────────────── */
const HotnessRankingPanel: React.FC<{ themes: HotDiagnosisTheme[]; analysisVersion?: string }> = ({ themes, analysisVersion }) => {
  const rankedThemes = useMemo(
    () => themes
      .filter((theme) => theme.topic && (theme.hotness_score != null || theme.hotness_components))
      .sort((a, b) => toFiniteNumber(b.hotness_score) - toFiniteNumber(a.hotness_score) || (b.count || 0) - (a.count || 0))
      .slice(0, 8),
    [themes],
  );

  if (themes.length === 0) return null;

  if (rankedThemes.length === 0) {
    return (
      <section className="rounded-2xl border border-warning/25 bg-surface/90 p-5 shadow-sm">
        <div className="mb-3 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning">
            <Info className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-text-base">热点形成解释</h2>
            <p className="mt-1 text-xs leading-relaxed text-text-tertiary">
              当前记录识别到了主题，但没有保存可解释热点分数，不能把“提问次数多”直接解释为“学习困难严重”。
            </p>
          </div>
          {analysisVersion && (
            <span className="ml-auto rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">规则 {analysisVersion}</span>
          )}
        </div>
        <div className="rounded-xl border border-warning/20 bg-warning-soft/50 px-3 py-2.5 text-xs leading-relaxed text-warning">
          这是旧记录或不完整结果：下面只保留主题和问题数量作为原始证据，不参与热点困难度排序。请重新生成分析后查看“共性覆盖、困难信号、持续性”三项评分。
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {themes.slice(0, 8).map((theme, index) => (
            <span key={`${theme.topic}-${index}`} className="rounded-full border border-border-secondary bg-surface-2 px-2.5 py-1 text-xs text-text-secondary">
              {theme.topic} · {theme.count || 0} 问
            </span>
          ))}
        </div>
      </section>
    );
  }

  const componentDefinitions = [
    { key: "commonness", label: "共性覆盖", fallback: (theme: HotDiagnosisTheme) => theme.commonness_score, hint: "有效学生覆盖" },
    { key: "difficulty", label: "困难信号", fallback: (theme: HotDiagnosisTheme) => theme.difficulty_signal_score, hint: "可观察提问形态" },
    { key: "persistence", label: "持续性", fallback: (theme: HotDiagnosisTheme) => theme.persistence_score, hint: "非空时间桶覆盖" },
  ] as const;

  return (
    <section className="rounded-2xl border border-border/70 bg-surface/90 p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Target className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-text-base">热点形成解释</h2>
          <p className="mt-1 text-xs leading-relaxed text-text-tertiary">
            排名不是“提问越多就越困难”，而是综合共性覆盖、困难信号和持续性；分数用于确定性排序，不等同于真实学习困难。
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {rankedThemes.map((theme, index) => {
          const components = theme.hotness_components || {};
          return (
            <details key={`${theme.theme_id || theme.topic}-${index}`} className="group rounded-xl border border-border-secondary bg-surface-2/50" open={index === 0}>
              <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3 [&::-webkit-details-marker]:hidden">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-xs font-bold text-primary">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-text-base">{theme.topic}</span>
                    {theme.heat_profile && <span className="rounded-full border border-primary/15 bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">{theme.heat_profile}</span>}
                  </div>
                  <div className="mt-1 text-[11px] text-text-tertiary">{theme.count || 0} 个问题 · {theme.unique_students || 0} 位有效学生</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-bold tabular-nums text-primary">{scoreText(theme.hotness_score)}</div>
                  <div className="text-[10px] text-text-tertiary">热点分 / 100</div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary transition-transform group-open:rotate-90" />
              </summary>
              <div className="border-t border-border-secondary px-3 pb-3 pt-3">
                <div className="grid gap-2 md:grid-cols-3">
                  {componentDefinitions.map((definition) => {
                    const component = components[definition.key];
                    const signal = component?.score ?? definition.fallback(theme);
                    return (
                      <div key={definition.key} className="rounded-lg border border-border-secondary bg-surface/80 px-3 py-2">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium text-text-base">{definition.label}</span>
                          <span className="font-semibold text-primary">{signalPercent(signal)}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary-soft">
                          <div className="h-full rounded-full bg-primary" style={{ width: signalPercent(signal) }} />
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-text-tertiary">
                          <span>{definition.hint}</span>
                          <span>贡献 {scoreText(component?.contribution)} 分</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {theme.hotness_explanation && theme.hotness_explanation.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs leading-relaxed text-text-secondary">
                    {theme.hotness_explanation.slice(0, 3).map((explanation) => <li key={explanation}>· {explanation}</li>)}
                  </ul>
                )}
                {theme.score_basis && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/10 bg-primary-soft/20 px-3 py-2 text-[11px] leading-relaxed text-text-tertiary">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{theme.score_basis}</span>
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
};

/* ─────────────────────────────────────────────────────────────────── */
/* Section 1.7: Teacher-anchor evidence review                         */
/* ─────────────────────────────────────────────────────────────────── */
const TeacherAnchorEvidencePanel: React.FC<{
  resultData: TaskAnalysisResult;
  timelineBuckets: HotTimelineBucket[];
  validQuestionCount: number;
  teacherAnchorCoverage?: number;
}> = ({ resultData, timelineBuckets, validQuestionCount, teacherAnchorCoverage }) => {
  const summary = resultData.summary;
  const sourceEvents = (resultData.student_question_events || [])
    .filter((event) => event.teacher_anchor_id || event.teacher_anchor_question)
    .map((event) => ({ ...event, content: event.content || event.question }))
    .filter((event) => event.content);
  const fallbackEvents: HotStudentQuestionEvent[] = timelineBuckets
    .filter((bucket) => bucket.teacher_anchor_id || bucket.teacher_anchor_question || bucket.near_teacher_mark)
    .map((bucket) => ({
      created_at: bucket.bucket_start,
      content: bucket.top_questions?.[0]?.question,
      teacher_anchor_id: bucket.teacher_anchor_id,
      teacher_anchor_question: bucket.near_teacher_mark,
      teacher_anchor_score: bucket.teacher_anchor_score,
      teacher_anchor_confidence: bucket.teacher_anchor_confidence,
      teacher_anchor_match_type: bucket.teacher_anchor_match_type,
      teacher_anchor_reason: bucket.teacher_anchor_reason,
      trigger_delay_seconds: bucket.trigger_delay_seconds,
    }))
    .filter((event) => event.content || event.teacher_anchor_question);
  const events = (sourceEvents.length > 0 ? sourceEvents : fallbackEvents)
    .sort((a, b) => {
      const confidenceOrder = { low: 0, medium: 1, high: 2 };
      const confidenceDelta = (confidenceOrder[String(a.teacher_anchor_confidence) as keyof typeof confidenceOrder] ?? 3)
        - (confidenceOrder[String(b.teacher_anchor_confidence) as keyof typeof confidenceOrder] ?? 3);
      return confidenceDelta || toFiniteNumber(a.teacher_anchor_score) - toFiniteNumber(b.teacher_anchor_score);
    })
    .slice(0, 8);
  const matchedCount = Math.max(0, toFiniteNumber(summary?.teacher_anchor_match_count, sourceEvents.length || fallbackEvents.length));
  const coverageValue = toFiniteNumber(teacherAnchorCoverage, summary?.teacher_anchor_coverage, validQuestionCount > 0 ? matchedCount / validQuestionCount : 0);
  const coverageDataInconsistent = matchedCount > 0 && validQuestionCount > 0 && coverageValue <= 0;
  const coverage = coverageDataInconsistent ? null : Math.max(0, Math.min(1, coverageValue));
  const distribution = summary?.teacher_anchor_confidence_distribution || {};
  const lowConfidenceCount = Math.max(0, toFiniteNumber(distribution.low, events.filter((event) => event.teacher_anchor_confidence === "low").length));
  const hasSavedConfidenceDistribution = ["low", "medium", "high"].some((key) => Number.isFinite(Number(distribution[key as keyof typeof distribution])));
  const unknownConfidenceCount = events.filter((event) => !event.teacher_anchor_confidence).length;
  const confidenceDataMissing = unknownConfidenceCount > 0 && !hasSavedConfidenceDistribution;

  if (events.length === 0 && matchedCount === 0) return null;

  return (
    <section className="rounded-2xl border border-border/70 bg-surface/90 p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Link2 className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-text-base">教师提问关联证据</h2>
            <p className="mt-1 text-xs leading-relaxed text-text-tertiary">
              关联用于定位“哪个教学区间值得复盘”，不是教师提问导致学生困难的因果证明。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full border px-2.5 py-1 text-text-secondary ${coverageDataInconsistent ? "border-warning/30 bg-warning-soft text-warning" : "border-border-secondary bg-surface-2"}`}>
            覆盖 {coverage == null ? "未记录" : `${Math.round(coverage * 100)}%`}
          </span>
          <span className="rounded-full border border-border-secondary bg-surface-2 px-2.5 py-1 text-text-secondary">匹配 {matchedCount} 条</span>
          {lowConfidenceCount > 0 && <span className="rounded-full border border-warning/30 bg-warning-soft px-2.5 py-1 font-medium text-warning">低置信度 {lowConfidenceCount}</span>}
          {confidenceDataMissing && <span className="rounded-full border border-warning/30 bg-warning-soft px-2.5 py-1 font-medium text-warning">置信度 未知</span>}
        </div>
      </div>
      {lowConfidenceCount > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft px-3 py-2.5 text-xs leading-relaxed text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>低置信度关联必须回到学生原话和证据索引复核；页面不会把它渲染成“教师提问引发了困难”的确定结论。</span>
        </div>
      )}
      {confidenceDataMissing && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft px-3 py-2.5 text-xs leading-relaxed text-warning">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>该记录没有保存教师关联置信度分布；“未知”不代表高或低，当前匹配只能作为复盘线索，需回到证据索引人工复核。</span>
        </div>
      )}
      {coverageDataInconsistent && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft px-3 py-2.5 text-xs leading-relaxed text-warning">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>该记录的匹配条数与覆盖率字段不一致；页面不自动把它推算成可靠比例，请重新生成分析或核对原始证据。</span>
        </div>
      )}
      <div className="space-y-2">
        {events.map((event, index) => {
          const confidence = event.teacher_anchor_confidence || "unknown";
          const question = String(event.content || event.question || "").trim();
          const reasons = (event.teacher_anchor_reason || []).filter(Boolean);
          return (
            <div key={`${event.message_id || event.created_at || "anchor"}-${index}`} className="rounded-xl border border-border-secondary bg-surface-2/50 p-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="text-text-tertiary">学生原话</span>
                {event.created_at && <span className="text-text-tertiary">{dayjs(event.created_at).format("HH:mm:ss")}</span>}
                {event.theme && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-primary">{event.theme}</span>}
                <span className={`rounded-full border px-2 py-0.5 font-medium ${confidenceClass(confidence)}`}>置信度 {confidenceLabel(confidence)}</span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-text-base">{question || "未保存学生原话"}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-secondary">
                <span>教师关联：{shortText(event.teacher_anchor_question || "未匹配", 54)}</span>
                <span>匹配方式：{matchTypeLabel(event.teacher_anchor_match_type)}</span>
                {event.teacher_anchor_score != null && <span>分数：{signalPercent(event.teacher_anchor_score)}</span>}
                <span>{formatTriggerDelay(event.trigger_delay_seconds)}</span>
              </div>
              {reasons.length > 0 && <div className="mt-1 text-[11px] text-text-tertiary">依据：{reasons.join("、")}</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
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

const sumDistributions = (groups: Array<Record<string, number> | undefined>) => {
  const merged: Record<string, number> = {};
  groups.forEach((group) => {
    Object.entries(group || {}).forEach(([key, value]) => {
      const numericValue = Number(value);
      if (Number.isFinite(numericValue)) merged[key] = (merged[key] || 0) + numericValue;
    });
  });
  return Object.keys(merged).length > 0 ? merged : undefined;
};

/** 将 timeline buckets 按更大颗粒度合并。仅用于展示，不改变后端 180 秒分析口径。 */
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
    const anchor = [...group]
      .filter((bucket) => bucket.teacher_anchor_id || bucket.teacher_anchor_question || bucket.near_teacher_mark)
      .sort((a, b) => toFiniteNumber(b.teacher_anchor_score) - toFiniteNumber(a.teacher_anchor_score))[0];
    const burstReasons = [...new Set(group.flatMap((bucket) => bucket.burst_reasons || []).filter(Boolean))];
    const teacherReasons = [...new Set(group.flatMap((bucket) => bucket.teacher_anchor_reason || []).filter(Boolean))];
    const burstScore = Math.max(...group.map((bucket) => toFiniteNumber(bucket.burst_score)), 0);
    const anchorScore = anchor?.teacher_anchor_score ?? undefined;
    const anchorConfidence = anchor?.teacher_anchor_confidence || null;
    merged.push({
      ...group[0],
      bucket_start: group[0].bucket_start,
      bucket_end: group[group.length - 1].bucket_end,
      question_count: group.reduce((s, b) => s + (b.question_count || 0), 0),
      unique_students: Math.max(...group.map((b) => b.unique_students || 0)),
      is_burst: group.some((b) => b.is_burst),
      top_questions: group.flatMap((b) => b.top_questions || []).sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 4),
      near_teacher_mark: anchor?.near_teacher_mark || anchor?.teacher_anchor_question || null,
      question_type_distribution: sumDistributions(group.map((bucket) => bucket.question_type_distribution)),
      theme_distribution: sumDistributions(group.map((bucket) => bucket.theme_distribution)),
      volume_signal: Math.max(...group.map((bucket) => toFiniteNumber(bucket.volume_signal)), 0),
      growth_signal: Math.max(...group.map((bucket) => toFiniteNumber(bucket.growth_signal)), 0),
      student_diversity_signal: Math.max(...group.map((bucket) => toFiniteNumber(bucket.student_diversity_signal)), 0),
      burst_score: burstScore || undefined,
      burst_reasons: burstReasons,
      teacher_anchor_id: anchor?.teacher_anchor_id || null,
      teacher_anchor_question: anchor?.teacher_anchor_question || anchor?.near_teacher_mark || null,
      teacher_anchor_score: anchorScore,
      teacher_anchor_confidence: anchorConfidence,
      teacher_anchor_match_type: anchor?.teacher_anchor_match_type || null,
      teacher_anchor_reason: teacherReasons,
      trigger_delay_seconds: anchor?.trigger_delay_seconds,
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
            const burstSignal = bucket.burst_score != null ? `爆发信号：<b>${scoreText(bucket.burst_score)} / 100</b>` : "";
            const burstReasons = (bucket.burst_reasons || []).slice(0, 3).map((reason) => escapeHtml(reason)).join("、");
            const anchorConfidence = bucket.teacher_anchor_confidence
              ? `教师锚点置信度：<b>${confidenceLabel(bucket.teacher_anchor_confidence)}</b>`
              : "";
            const anchorMatch = bucket.teacher_anchor_match_type
              ? `匹配方式：${escapeHtml(matchTypeLabel(bucket.teacher_anchor_match_type))}`
              : "";
            const anchorReason = (bucket.teacher_anchor_reason || []).slice(0, 2).map((reason) => escapeHtml(reason)).join("、");
            const anchorLine = bucket.teacher_anchor_question
              ? `<span style="color:${theme.teacher || "#F59E0B"}">教师锚点：${escapeHtml(shortText(bucket.teacher_anchor_question, 28))}</span>`
              : "";
            return [`<b>${dayjs(bucket.bucket_start).format("HH:mm")} – ${dayjs(bucket.bucket_end).format("HH:mm")}</b>`,
              `学生提问：<b>${bucket.question_count || 0}</b>`,
              genCount > 0 ? `<span style="color:#10B981">生成性问题：<b>${genCount}</b> (迁移+延伸)</span>` : "",
              `独立学生：<b>${bucket.unique_students || 0}</b>`,
              bucket.is_burst ? `<span style="color:${theme.burst};font-weight:700">⚡ 脉冲</span>` : "",
              burstSignal,
              burstReasons ? `爆发原因：${burstReasons}` : "",
              anchorLine,
              anchorConfidence,
              anchorMatch,
              anchorReason ? `关联依据：${anchorReason}` : "",
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
            {hasTimeline ? "教师提问作为时间/语义锚点用于复盘定位；柱状图为学生提问分布，曲线为提问趋势，不代表因果关系。" : "按可解释热点分数排序，直观看出哪些主题值得优先复核。"}
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

  // 合并热点主题（用于图表和解释面板）：深度分析补充诊断，但不覆盖 hot_v2 的确定性评分。
  const diagnosticThemes: HotDiagnosisTheme[] = useMemo(() => {
    const deepThemes = hotDeepAnalysis.theme_analysis || [];
    if (deepThemes.length === 0) return [...hotThemes].sort((a, b) => toFiniteNumber(b.hotness_score) - toFiniteNumber(a.hotness_score) || (b.count || 0) - (a.count || 0));

    const hotByTopic = new Map(hotThemes.map((theme) => [theme.topic.trim(), theme]));
    const usedTopics = new Set<string>();
    const merged = deepThemes.map((deepTheme, index) => {
      const deepTopic = String(deepTheme.theme || "").trim();
      const base = hotByTopic.get(deepTopic) || hotThemes[index];
      const topic = deepTopic || base?.topic || `主题 ${index + 1}`;
      usedTopics.add(base?.topic || topic);
      return {
        ...base,
        topic,
        count: Number(deepTheme.question_count ?? base?.count ?? 0),
        unique_students: Number(deepTheme.unique_students ?? base?.unique_students ?? 0) || undefined,
        questions: deepTheme.representative_questions || base?.questions || [],
        representative_question: deepTheme.representative_questions?.[0] || base?.representative_question,
        diagnosis: deepTheme.diagnosis,
        overall_bloom_level: deepTheme.overall_bloom_level,
        hotness_score: deepTheme.hotness_score ?? base?.hotness_score,
        heat_profile: deepTheme.heat_profile ?? base?.heat_profile,
      };
    });
    const unmatchedHotThemes = hotThemes.filter((theme) => !usedTopics.has(theme.topic));
    return [...merged, ...unmatchedHotThemes]
      .sort((a, b) => toFiniteNumber(b.hotness_score) - toFiniteNumber(a.hotness_score) || (b.count || 0) - (a.count || 0));
  }, [hotDeepAnalysis, hotThemes]);

  const validQuestionCount = useMemo(() => {
    const eventCount = (resultData.student_question_events || []).filter((event) => event.included_in_analysis !== false).length;
    return Math.max(0, toFiniteNumber(resultData.data_quality?.valid_question_count, resultData.summary?.valid_question_count, eventCount));
  }, [resultData]);
  const teacherAnchorCoverage = useMemo(() => (
    toFiniteNumber(resultData.summary?.teacher_anchor_coverage, validQuestionCount > 0
      ? toFiniteNumber(resultData.summary?.teacher_anchor_match_count) / validQuestionCount
      : 0)
  ), [resultData.summary?.teacher_anchor_coverage, resultData.summary?.teacher_anchor_match_count, validQuestionCount]);

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

        {/* 2. Data quality and explainable scoring */}
        <DataQualityPanel
          dataQuality={resultData.data_quality}
          analysisAudit={resultData.analysis_audit}
          summary={resultData.summary}
          analysisVersion={resultData.analysis_version}
          validQuestionCount={validQuestionCount}
          fallbackRawQuestionCount={Math.max(
            resultData.student_question_events?.length || 0,
            toFiniteNumber(resultData.summary?.question_count),
          )}
        />
        <HotCoreChart
          themes={diagnosticThemes}
          buckets={timelineBuckets}
          teacherMarks={timelineTeacherMarks}
          questionCount={hotQuestionCount}
          studentCount={hotStudentCount}
          burstCount={burstCount}
        />
        <HotnessRankingPanel themes={diagnosticThemes} analysisVersion={resultData.analysis_version} />
        <TeacherAnchorEvidencePanel
          resultData={resultData}
          timelineBuckets={timelineBuckets}
          validQuestionCount={validQuestionCount}
          teacherAnchorCoverage={teacherAnchorCoverage}
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
