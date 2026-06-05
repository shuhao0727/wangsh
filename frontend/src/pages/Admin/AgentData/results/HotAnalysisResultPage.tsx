/**
 * 热点问题分析结果页 — 词云、时序图、课程序列、教学建议
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpenCheck,
  Brain,
  ClipboardList,
  Gauge,
  Hash,
  Lightbulb,
  Loader2,
  MessageSquare,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import * as echarts from "echarts";
import "echarts-wordcloud";
import SharedResultLayout from "./SharedResultLayout";
import { useAnalysisDetail } from "./hooks/useAnalysisDetail";
import { useNormalizedResult } from "./hooks/useNormalizedResult";
import TimelineChart from "../components/TimelineChart";
import SummaryCard from "../components/SummaryCard";
import MainQuestionChainFlow from "../components/MainQuestionChainFlow";
import TopicEvidenceCard from "../components/TopicEvidenceCard";
import TeachingSuggestionsPanel from "../components/TeachingSuggestionsPanel";
import TrendDashboard from "../components/TrendDashboard";
import dayjs from "dayjs";
import {
  wordColor,
  safeFilePart,
  buildDisplayTeacherQuestions,
  formatTimeRange,
  normalizeTimelineBuckets,
  normalizeTimelineTeacherMarks,
} from "../normalize";
import { getAgentChartTheme } from "../components/chartTheme";
import type { DeepAnalysisStatus, HotDeepAnalysis, HotDeepThemeAnalysis, TopicItem, WordCloudItem, AnalysisAgentStatus } from "../types";

type HotTimelineBucket = ReturnType<typeof normalizeTimelineBuckets>[number];
type HotTimelineTeacherMark = ReturnType<typeof normalizeTimelineTeacherMarks>[number];
type HotDiagnosisTheme = TopicItem & Pick<HotDeepThemeAnalysis, "diagnosis" | "overall_bloom_level" | "covered_by_task_sheet" | "student_behavior" | "bloom_distribution">;

const downloadBlob = (content: string, filename: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const shortText = (value: string | undefined, max = 24) => {
  const text = String(value || "").trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const topicPedagogyType = (topic: string, index: number) => {
  const text = topic.toLowerCase();
  if (/错|错误|debug|调试|为什么|不会|不懂|困惑|问题/.test(text)) return "迷思概念";
  if (/边界|特殊|极限|0|空|初始|条件/.test(text)) return "认知冲突";
  if (/应用|实现|怎么写|输出|验证|测试|生成/.test(text)) return "迁移练习";
  if (/区别|关系|比较|判断|条件|循环/.test(text)) return "先备知识";
  return ["迷思概念", "先备知识", "认知冲突", "迁移练习"][index % 4];
};

const getPriorityTone = (index: number) => {
  if (index === 0) return "border-[var(--ws-color-danger)]/20 bg-[var(--ws-color-danger)]/8 text-[var(--ws-color-danger)]";
  if (index === 1) return "border-[var(--ws-color-warning)]/20 bg-[var(--ws-color-warning)]/10 text-[var(--ws-color-warning)]";
  return "border-primary/20 bg-primary-soft/50 text-primary";
};

const topicPedagogyAdvice = (type: string) => ({
  "迷思概念": "优先用反例澄清错误概念，再让学生重新解释关键条件。",
  "认知冲突": "保留冲突感，用边界例引导学生比较“何时成立、何时不成立”。",
  "迁移练习": "安排近迁移任务，观察学生能否把方法迁到相似新情境。",
  "先备知识": "先补最小必要知识，再回到原任务，避免直接加大练习量。",
}[type] || "用学生原问设计一次快速诊断，确认问题是否具有全班共性。");

const mergeTopicLists = (...groups: TopicItem[][]) => {
  const merged = new Map<string, TopicItem>();
  groups.flat().forEach((item) => {
    const key = item.topic.trim();
    if (!key) return;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, { ...item, questions: [...(item.questions || [])] });
      return;
    }
    const questions = [...(current.questions || [])];
    (item.questions || []).forEach((question) => {
      if (question && !questions.includes(question)) questions.push(question);
    });
    merged.set(key, {
      ...current,
      count: Math.max(current.count || 0, item.count || 0),
      unique_students: Math.max(current.unique_students || 0, item.unique_students || 0) || undefined,
      questions,
      representative_question: current.representative_question || item.representative_question,
    });
  });
  return [...merged.values()].sort((a, b) => (b.count || 0) - (a.count || 0));
};

const representativeQuestion = (theme: TopicItem) => theme.representative_question || theme.questions?.[0];

const hasHotDeepAnalysis = (deep: HotDeepAnalysis) => Boolean(
  deep.executive_summary
  || (deep.theme_analysis || []).length
  || (deep.teaching_suggestions || []).length
  || (deep.timeline_phases || []).length,
);

const normalizeHotDeepThemes = (deep: HotDeepAnalysis, fallback: TopicItem[]): HotDiagnosisTheme[] => {
  const deepThemes = deep.theme_analysis || [];
  if (deepThemes.length === 0) return fallback;
  return deepThemes.map((theme, index) => {
    const backup = fallback[index];
    const questions = theme.representative_questions || backup?.questions || [];
    return {
      topic: theme.theme || backup?.topic || `诊断主题 ${index + 1}`,
      count: Number(theme.question_count ?? backup?.count ?? 0),
      unique_students: Number(theme.unique_students ?? backup?.unique_students ?? 0) || undefined,
      questions,
      representative_question: questions[0] || backup?.representative_question,
      diagnosis: theme.diagnosis,
      overall_bloom_level: theme.overall_bloom_level,
      covered_by_task_sheet: theme.covered_by_task_sheet,
      student_behavior: theme.student_behavior,
      bloom_distribution: theme.bloom_distribution,
    };
  }).sort((a, b) => (b.count || 0) - (a.count || 0));
};

const AgentDiagnosisStatus: React.FC<{
  agent?: AnalysisAgentStatus;
  status?: DeepAnalysisStatus;
}> = ({ agent, status }) => {
  const isReady = status?.status === "completed" || agent?.status === "completed";
  const label = isReady ? "智能体诊断已接入" : status?.reason || agent?.reason || "未启用智能体诊断";
  return (
    <div className={`rounded-2xl border px-3 py-2 text-xs leading-relaxed ${
      isReady
        ? "border-primary/20 bg-primary-soft/40 text-primary"
        : "border-border-secondary bg-surface/80 text-text-tertiary"
    }`}>
      <div className="font-semibold">{label}</div>
      {agent?.name && <div className="mt-0.5 opacity-80">{agent.name}{agent.model_name ? ` · ${agent.model_name}` : ""}</div>}
    </div>
  );
};

const HotInsightHero: React.FC<{
  diagnosis: string;
  executiveSummary?: string;
  analysisAgent?: AnalysisAgentStatus;
  deepStatus?: DeepAnalysisStatus;
  hotThemes: TopicItem[];
  questionCount: number;
  studentCount: number;
  burstCount: number;
}> = ({ diagnosis, executiveSummary, analysisAgent, deepStatus, hotThemes, questionCount, studentCount, burstCount }) => (
  <section className="overflow-hidden rounded-[2rem] border border-primary/15 bg-surface/85 p-5 shadow-md backdrop-blur">
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(420px,0.65fr)]">
      <div className="rounded-[1.5rem] border border-primary/20 bg-[linear-gradient(135deg,var(--ws-color-primary-muted),var(--ws-color-surface))] p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-sm">
            <Brain className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">热点问题教学诊断</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-text-base">{diagnosis}</h1>
          </div>
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-text-secondary">
          {executiveSummary || "按形成性评价思路，热点不是“问得最多”这么简单，而是用来判断全班共同迷思、先备知识缺口和下一轮支架投放时机。"}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border/70 bg-surface/90 p-4 shadow-sm">
          <MessageSquare className="mb-3 h-4 w-4 text-primary" />
          <div className="text-xl font-bold text-text-base">{questionCount}</div>
          <div className="mt-1 text-xs text-text-tertiary">学生原问</div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-surface/90 p-4 shadow-sm">
          <Users className="mb-3 h-4 w-4 text-primary" />
          <div className="text-xl font-bold text-text-base">{studentCount}</div>
          <div className="mt-1 text-xs text-text-tertiary">参与学生</div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-surface/90 p-4 shadow-sm">
          <TrendingUp className="mb-3 h-4 w-4 text-[var(--ws-color-danger)]" />
          <div className="text-xl font-bold text-text-base">{burstCount}</div>
          <div className="mt-1 text-xs text-text-tertiary">升温时段</div>
        </div>
        <div className="col-span-3 rounded-2xl border border-primary/15 bg-primary-soft/35 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            本节课优先关注
          </div>
          <div className="flex flex-wrap gap-2">
            {hotThemes.slice(0, 4).map((theme, index) => (
              <span key={`${theme.topic}-${index}`} className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-text-secondary shadow-sm">
                {theme.topic}
              </span>
            ))}
          </div>
        </div>
        <div className="col-span-3">
          <AgentDiagnosisStatus agent={analysisAgent} status={deepStatus} />
        </div>
      </div>
    </div>
  </section>
);

const MisconceptionMap: React.FC<{ themes: HotDiagnosisTheme[] }> = ({ themes }) => {
  const visible = themes.slice(0, 6);
  const maxCount = Math.max(...visible.map((item) => item.count || 0), 1);
  return (
    <section className="rounded-[2rem] border border-border/70 bg-surface/90 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-base">共性迷思地图</h2>
          <p className="mt-1 text-xs text-text-tertiary">把热点主题转译成教育学诊断：是概念没建好、先备知识缺口，还是已经进入迁移。</p>
        </div>
        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{visible.length} 个诊断点</span>
      </div>
      <div className="space-y-3">
        {visible.map((theme, index) => {
          const width = `${Math.max(18, Math.round(((theme.count || 1) / maxCount) * 100))}%`;
          const type = theme.overall_bloom_level || topicPedagogyType(theme.topic, index);
          const coverage = typeof theme.covered_by_task_sheet === "boolean"
            ? theme.covered_by_task_sheet ? "任务单已覆盖" : "任务单盲区"
            : "需证据确认";
          return (
            <div key={`${theme.topic}-${index}`} className="rounded-2xl border border-border-secondary bg-surface-2/70 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getPriorityTone(index)}`}>{type}</span>
                    <h3 className="truncate text-sm font-semibold text-text-base">{theme.topic}</h3>
                  </div>
                  <p className="mt-1 text-xs text-text-tertiary">
                    {theme.count} 次提问{theme.unique_students ? ` · ${theme.unique_students} 位学生` : ""} · {coverage}
                  </p>
                </div>
                <span className="text-xs font-semibold tabular-nums text-primary">{theme.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface">
                <div className="h-full rounded-full bg-primary" style={{ width }} />
              </div>
              <p className="mt-2 rounded-xl bg-surface/80 px-2 py-1.5 text-xs leading-relaxed text-text-secondary">
                {theme.diagnosis || topicPedagogyAdvice(type)}
              </p>
              {theme.student_behavior && (
                <p className="mt-1 text-xs leading-relaxed text-text-tertiary">{theme.student_behavior}</p>
              )}
              {(theme.questions || [])[0] && (
                <div className="mt-2 border-l-2 border-primary/35 pl-2 text-xs leading-relaxed text-text-tertiary">
                  “{shortText(representativeQuestion(theme), 52)}”
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

const FormativeInterventionPanel: React.FC<{ themes: TopicItem[] }> = ({ themes }) => {
  const lead = themes[0]?.topic || "核心概念";
  const second = themes[1]?.topic || "先备知识";
  const third = themes[2]?.topic || "迁移应用";
  const steps = [
    {
      title: "即时诊断",
      focus: `用 1 道选择/判断题确认「${shortText(lead, 12)}」是否只是个别困惑。`,
      theory: "形成性评价",
      icon: <ClipboardList className="h-4 w-4" />,
    },
    {
      title: "支架重建",
      focus: `把「${shortText(second, 12)}」拆成示例、反例、边界例三步。`,
      theory: "脚手架",
      icon: <BookOpenCheck className="h-4 w-4" />,
    },
    {
      title: "迁移检验",
      focus: `让学生把「${shortText(third, 12)}」换到新情境，观察能否独立解释。`,
      theory: "近迁移",
      icon: <Gauge className="h-4 w-4" />,
    },
  ];
  return (
    <section className="rounded-[2rem] border border-[var(--ws-color-warning)]/20 bg-surface/90 p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-text-base">教学干预阶梯</h2>
        <p className="mt-1 text-xs text-text-tertiary">从“发现问题”走到“验证是否学会”，避免只凭热点词做经验判断。</p>
      </div>
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={step.title} className="rounded-2xl border border-border-secondary bg-surface-2/70 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-soft text-primary">{step.icon}</span>
                <h3 className="text-sm font-semibold text-text-base">{index + 1}. {step.title}</h3>
              </div>
              <span className="rounded-full bg-[var(--ws-color-warning-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ws-color-warning)]">{step.theory}</span>
            </div>
            <p className="text-xs leading-relaxed text-text-secondary">{step.focus}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

const FormativeWindowPanel: React.FC<{ buckets: HotTimelineBucket[]; teacherMarkCount: number }> = ({
  buckets,
  teacherMarkCount,
}) => {
  const ranked = [...buckets]
    .sort((a, b) => {
      if (a.is_burst !== b.is_burst) return a.is_burst ? -1 : 1;
      return (b.question_count || 0) - (a.question_count || 0);
    })
    .slice(0, 4);

  return (
    <section className="rounded-[2rem] border border-primary/15 bg-surface/90 p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-base">形成性评价时间窗</h2>
          <p className="mt-1 text-xs text-text-tertiary">优先复盘提问突然升温的时间段，判断教师讲解与学生理解是否错位。</p>
        </div>
        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{teacherMarkCount} 个教师锚点</span>
      </div>
      {ranked.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed border-border-secondary bg-surface-2/70 text-sm text-text-tertiary">
          暂无时间窗数据
        </div>
      ) : (
        <div className="space-y-3">
          {ranked.map((bucket, index) => (
            <div key={`${bucket.bucket_start}-${index}`} className="rounded-2xl border border-border-secondary bg-surface-2/70 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold ${
                    bucket.is_burst ? "bg-[var(--ws-color-danger)] text-white" : "bg-primary-soft text-primary"
                  }`}>
                    {index + 1}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-text-base">{formatTimeRange(bucket.bucket_start, bucket.bucket_end)}</div>
                    <div className="text-[11px] text-text-tertiary">{bucket.question_count} 问 · {bucket.unique_students} 人</div>
                  </div>
                </div>
                {bucket.is_burst && <span className="rounded-full bg-[var(--ws-color-warning-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ws-color-warning)]">需即时追问</span>}
              </div>
              {(bucket.top_questions || []).slice(0, 1).map((question, qIndex) => (
                <div key={`${question.question}-${qIndex}`} className="border-l-2 border-primary/35 pl-2 text-xs leading-relaxed text-text-tertiary">
                  “{shortText(question.question, 48)}”
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const TaskAlignmentPanel: React.FC<{ covered: TopicItem[]; uncovered: TopicItem[] }> = ({ covered, uncovered }) => (
  <section className="rounded-[2rem] border border-border/70 bg-surface/90 p-5 shadow-sm">
    <div className="mb-4">
      <h2 className="text-base font-semibold text-text-base">任务单盲区与生成性问题</h2>
      <p className="mt-1 text-xs text-text-tertiary">区分“任务内没掌握”和“学生自己生发出来”的问题，避免把所有热点都当成同一种补课。</p>
    </div>
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-2xl border border-[var(--ws-color-success)]/20 bg-[var(--ws-color-success-soft)] p-3">
        <div className="mb-2 text-xs font-semibold text-[var(--ws-color-success)]">任务单内仍需巩固</div>
        <div className="space-y-2">
          {covered.slice(0, 4).map((topic, index) => (
            <div key={`${topic.topic}-${index}`} className="rounded-xl bg-surface/80 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-medium text-text-base">{topic.topic}</span>
                <span className="shrink-0 text-xs text-text-tertiary">{topic.count} 次</span>
              </div>
            </div>
          ))}
          {covered.length === 0 && <div className="rounded-xl bg-surface/70 px-3 py-6 text-center text-xs text-text-tertiary">暂无明确覆盖项</div>}
        </div>
      </div>
      <div className="rounded-2xl border border-[var(--ws-color-warning)]/20 bg-[var(--ws-color-warning-soft)] p-3">
        <div className="mb-2 text-xs font-semibold text-[var(--ws-color-warning)]">学生生成性问题</div>
        <div className="space-y-2">
          {uncovered.slice(0, 4).map((topic, index) => (
            <div key={`${topic.topic}-${index}`} className="rounded-xl bg-surface/80 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate font-medium text-text-base">{topic.topic}</span>
                <span className="shrink-0 text-xs text-text-tertiary">{topic.count} 次</span>
              </div>
              {representativeQuestion(topic) && (
                <div className="mt-1 text-xs leading-relaxed text-text-tertiary">例：{shortText(representativeQuestion(topic), 42)}</div>
              )}
            </div>
          ))}
          {uncovered.length === 0 && <div className="rounded-xl bg-surface/70 px-3 py-6 text-center text-xs text-text-tertiary">暂无生成性问题</div>}
        </div>
      </div>
    </div>
  </section>
);

const HotDeepEvidencePanel: React.FC<{ deep: HotDeepAnalysis }> = ({ deep }) => {
  const profile = deep.data_profile;
  const blindSpots = deep.task_sheet_analysis?.blind_spots || [];
  const phases = deep.timeline_phases || [];
  const hasContent = Boolean(profile?.summary || blindSpots.length || phases.length || deep.task_sheet_analysis?.bloom_gap_analysis);
  if (!hasContent) return null;

  return (
    <section className="rounded-[2rem] border border-primary/15 bg-surface/90 p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-base">智能体深度证据面板</h2>
          <p className="mt-1 text-xs text-text-tertiary">来自分析诊断智能体：把数据画像、任务单盲区和课堂阶段转成可复盘的教学证据。</p>
        </div>
        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">deep analysis</span>
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        <div className="rounded-2xl border border-border-secondary bg-surface-2/70 p-4">
          <div className="mb-2 text-xs font-semibold text-primary">数据画像</div>
          <p className="text-sm leading-relaxed text-text-secondary">{profile?.summary || "暂无数据画像"}</p>
          {profile?.participation_pattern && (
            <p className="mt-2 rounded-xl bg-surface/80 px-2 py-1.5 text-xs leading-relaxed text-text-tertiary">{profile.participation_pattern}</p>
          )}
        </div>
        <div className="rounded-2xl border border-[var(--ws-color-warning)]/20 bg-[var(--ws-color-warning-soft)]/55 p-4">
          <div className="mb-2 text-xs font-semibold text-[var(--ws-color-warning)]">任务单盲区</div>
          <div className="space-y-2">
            {blindSpots.slice(0, 4).map((spot, index) => (
              <div key={`${spot.topic}-${index}`} className="rounded-xl bg-surface/85 px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-sm font-semibold text-text-base">
                  <span className="min-w-0 truncate">{spot.topic || `盲区 ${index + 1}`}</span>
                  {spot.actual_questions !== undefined && <span className="text-xs text-text-tertiary">{spot.actual_questions} 问</span>}
                </div>
                {spot.insight && <p className="mt-1 text-xs leading-relaxed text-text-secondary">{spot.insight}</p>}
              </div>
            ))}
            {blindSpots.length === 0 && <p className="text-sm text-text-tertiary">暂无明确盲区，建议结合原问继续复核。</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-border-secondary bg-surface-2/70 p-4">
          <div className="mb-2 text-xs font-semibold text-primary">课堂阶段洞察</div>
          <div className="space-y-2">
            {phases.slice(0, 3).map((phase, index) => (
              <div key={`${phase.phase_name}-${index}`} className="rounded-xl bg-surface/85 px-3 py-2">
                <div className="text-sm font-semibold text-text-base">{phase.phase_name || `阶段 ${index + 1}`}</div>
                <div className="mt-0.5 text-[11px] text-text-tertiary">{phase.time_range || "暂无时间"} · {phase.question_count || 0} 问</div>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">{phase.insight || phase.phase_description || "暂无阶段洞察"}</p>
              </div>
            ))}
            {phases.length === 0 && <p className="text-sm text-text-tertiary">暂无阶段洞察。</p>}
          </div>
        </div>
      </div>
      {deep.task_sheet_analysis?.bloom_gap_analysis && (
        <div className="mt-3 rounded-2xl border border-primary/15 bg-primary-soft/30 px-4 py-3 text-sm leading-relaxed text-primary">
          {deep.task_sheet_analysis.bloom_gap_analysis}
        </div>
      )}
    </section>
  );
};

const HotDeepSuggestionsPanel: React.FC<{ suggestions: HotDeepAnalysis["teaching_suggestions"] }> = ({ suggestions = [] }) => {
  if (suggestions.length === 0) return null;
  return (
    <section className="rounded-[2rem] border border-[var(--ws-color-warning)]/20 bg-surface/90 p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-text-base">智能体生成的教学行动建议</h2>
        <p className="mt-1 text-xs text-text-tertiary">每条建议包含观察、根因、具体行动和验证指标，便于直接转成下节课调整。</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {suggestions.slice(0, 6).map((item, index) => (
          <div key={`${item.category}-${index}`} className="rounded-2xl border border-border-secondary bg-surface-2/70 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="rounded-full bg-[var(--ws-color-warning-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ws-color-warning)]">
                {item.priority || "中"} · {item.category || "课堂教学"}
              </span>
              <span className="text-xs font-semibold text-primary">#{index + 1}</span>
            </div>
            {item.observation && <p className="text-xs leading-relaxed text-text-tertiary">{item.observation}</p>}
            {item.root_cause && <p className="mt-2 text-sm leading-relaxed text-text-secondary">根因：{item.root_cause}</p>}
            <p className="mt-2 rounded-xl bg-surface/85 px-3 py-2 text-sm leading-relaxed text-text-base">
              {item.suggested_action || "请结合学生原问设计一次即时诊断。"}
            </p>
            {item.verification_indicator && (
              <p className="mt-2 text-xs leading-relaxed text-primary">验证：{item.verification_indicator}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

const hotBucketTeachingInsight = (bucket: HotTimelineBucket, maxQuestions: number) => {
  const ratio = maxQuestions > 0 ? (bucket.question_count || 0) / maxQuestions : 0;
  if (bucket.is_burst && bucket.near_teacher_mark) {
    return {
      label: "教师锚点后的热点爆发",
      action: "先回看教师提问和学生原问，判断是否需要二次讲解或同伴解释。",
      check: "用 1 道即时诊断题验证：学生能否说清关键条件，而不只是复述答案。",
    };
  }
  if (bucket.is_burst || ratio >= 0.8) {
    return {
      label: "可能是全班共性迷思",
      action: "优先提取代表问题，设计反例或边界例，让学生暴露推理过程。",
      check: "若多名学生能在变式题中独立解释，才说明热点已被处理。",
    };
  }
  if ((bucket.question_count || 0) >= 3 && (bucket.unique_students || 0) <= 2) {
    return {
      label: "少数学生深度追问",
      action: "适合小组或个别追问，不宜直接改成全班补课。",
      check: "观察同类学生是否也有相同卡点，再决定是否扩大干预范围。",
    };
  }
  return {
    label: "观察性时间窗",
    action: "继续结合前后时间桶和学生原问判断，不把单个低峰当成稳定结论。",
    check: "若后续时间桶再次升温，再把它纳入形成性评价证据。",
  };
};

const hotThemeTeachingInsight = (theme: HotDiagnosisTheme, index: number, maxCount: number) => {
  const type = topicPedagogyType(theme.topic, index);
  const ratio = maxCount > 0 ? Math.round(((theme.count || 0) / maxCount) * 100) : 0;
  return {
    type,
    ratio,
    action: topicPedagogyAdvice(type),
    check: type === "迁移练习"
      ? "看学生能否换一个相似情境独立解释，而不是只会原题。"
      : "看学生能否用自己的话解释关键条件，并指出一个反例或边界例。",
  };
};

const HotTopicBarChart: React.FC<{
  themes: HotDiagnosisTheme[];
  buckets?: HotTimelineBucket[];
  teacherMarks?: HotTimelineTeacherMark[];
  questionCount?: number;
  studentCount?: number;
  burstCount?: number;
}> = ({ themes, buckets = [], teacherMarks = [], questionCount, studentCount, burstCount }) => {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [selectedTimelineIndex, setSelectedTimelineIndex] = useState<number | null>(null);
  const [selectedThemeIndex, setSelectedThemeIndex] = useState(0);
  const rankedThemes = useMemo(
    () => themes.filter((item) => item.topic && (item.count || 0) > 0).slice(0, 10),
    [themes],
  );
  const timeline = useMemo(
    () => buckets.filter((item) => dayjs(item.bucket_start).isValid() && ((item.question_count || 0) > 0 || (item.unique_students || 0) > 0)),
    [buckets],
  );
  const hasTimeline = timeline.length > 0;
  const totalQuestions = questionCount
    || timeline.reduce((sum, item) => sum + (item.question_count || 0), 0)
    || rankedThemes.reduce((sum, item) => sum + (item.count || 0), 0);
  const totalStudents = studentCount
    || Math.max(0, ...timeline.map((item) => item.unique_students || 0))
    || Math.max(0, ...rankedThemes.map((item) => item.unique_students || 0));
  const totalBursts = burstCount || timeline.filter((item) => item.is_burst).length;
  const maxTimelineQuestions = useMemo(
    () => Math.max(0, ...timeline.map((item) => item.question_count || 0)),
    [timeline],
  );
  const focusBucketIndex = useMemo(() => {
    if (!hasTimeline) return -1;
    if (selectedTimelineIndex !== null && timeline[selectedTimelineIndex]) return selectedTimelineIndex;
    const burstIndex = timeline.findIndex((item) => item.is_burst);
    if (burstIndex >= 0) return burstIndex;
    return timeline.reduce((best, item, index) => ((item.question_count || 0) > (timeline[best]?.question_count || 0) ? index : best), 0);
  }, [hasTimeline, selectedTimelineIndex, timeline]);
  const focusBucket = hasTimeline ? timeline[focusBucketIndex] : undefined;
  const bucketInsight = focusBucket ? hotBucketTeachingInsight(focusBucket, maxTimelineQuestions) : null;
  const resolvedThemeIndex = rankedThemes[selectedThemeIndex] ? selectedThemeIndex : 0;
  const selectedTheme = rankedThemes[resolvedThemeIndex];
  const maxThemeCount = Math.max(0, ...rankedThemes.map((item) => item.count || 0));
  const themeInsight = selectedTheme ? hotThemeTeachingInsight(selectedTheme, resolvedThemeIndex, maxThemeCount) : null;

  useEffect(() => {
    if (!ref.current || (!hasTimeline && rankedThemes.length === 0)) return;
    if (!chartRef.current) chartRef.current = echarts.init(ref.current);
    const theme = getAgentChartTheme();

    if (hasTimeline) {
      const compact = (ref.current?.clientWidth || 0) < 520;
      const xData = timeline.map((item) => dayjs(item.bucket_start).format("HH:mm"));
      const questionCounts = timeline.map((item) => item.question_count || 0);
      const studentCounts = timeline.map((item) => item.unique_students || 0);
      const maxQuestions = Math.max(...questionCounts, 1);
      const xLabelInterval = compact ? Math.max(0, Math.ceil(xData.length / 4) - 1) : Math.max(0, Math.floor(xData.length / 9) - 1);
      const burstIndices = timeline.map((item, index) => (item.is_burst ? index : -1)).filter((index) => index >= 0);
      const peakIndex = questionCounts.indexOf(maxQuestions);
      const focusIndex = burstIndices[0] ?? peakIndex;
      const focusStart = Math.max(0, focusIndex - 1);
      const focusEnd = Math.min(timeline.length - 1, focusIndex + 1);
      const nearestBucketIndex = (time: string) => {
        const markTime = dayjs(time).valueOf();
        if (!Number.isFinite(markTime)) return 0;
        return timeline.reduce((bestIndex, bucket, index) => {
          const bestDistance = Math.abs(dayjs(timeline[bestIndex].bucket_start).valueOf() - markTime);
          const currentDistance = Math.abs(dayjs(bucket.bucket_start).valueOf() - markTime);
          return currentDistance < bestDistance ? index : bestIndex;
        }, 0);
      };
      const teacherData = teacherMarks.map((mark, index) => {
        const bucketIndex = nearestBucketIndex(mark.time);
        return {
          value: [xData[bucketIndex], Math.min(maxQuestions * 1.18, (questionCounts[bucketIndex] || 0) + maxQuestions * 0.16), mark.question],
          label: { formatter: `T${index + 1}` },
        };
      });
      const burstScatterData = burstIndices.map((index) => ({
        value: [xData[index], questionCounts[index], timeline[index]?.top_questions?.[0]?.question || "热点脉冲", index],
      }));

      chartRef.current.setOption({
        animationDuration: 900,
        animationEasing: "cubicOut",
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "cross" },
          confine: true,
          backgroundColor: theme.surfaceElevated,
          borderColor: theme.border,
          textStyle: { color: theme.textBase, fontSize: 12 },
          formatter: (params: any) => {
            const idx = params?.[0]?.dataIndex ?? 0;
            const bucket = timeline[idx];
            if (!bucket) return "";
            const topQuestions = (bucket.top_questions || []).slice(0, 3)
              .map((item) => `<br/>· ${escapeHtml(shortText(item.question, 32))} (${item.count})`)
              .join("");
            return [
              `<b>${dayjs(bucket.bucket_start).format("HH:mm")} - ${dayjs(bucket.bucket_end).format("HH:mm")}</b>`,
              `提问数：<b>${bucket.question_count || 0}</b> 次`,
              `独立学生：<b>${bucket.unique_students || 0}</b> 人`,
              bucket.is_burst ? `<span style="color:${theme.burst};font-weight:700">热点脉冲</span>` : "",
              bucket.near_teacher_mark ? `<span style="color:${theme.teacher}">靠近教师提问：${escapeHtml(bucket.near_teacher_mark)}</span>` : "",
              topQuestions ? `<span style="color:${theme.textSecondary}">代表问题</span>${topQuestions}` : "",
            ].filter(Boolean).join("<br/>");
          },
        },
        legend: {
          top: compact ? 8 : 4,
          left: 4,
          itemWidth: 16,
          itemHeight: 10,
          itemGap: compact ? 8 : 14,
          data: ["提问数（次）", "独立学生数（人）", "教师提问", "热点脉冲"],
          textStyle: { color: theme.textSecondary, fontSize: 11 },
        },
        grid: { left: compact ? 42 : 52, right: compact ? 36 : 52, top: compact ? 86 : 62, bottom: timeline.length > 12 ? 66 : 42 },
        xAxis: {
          type: "category",
          data: xData,
          axisLabel: { color: theme.textSecondary, fontSize: compact ? 10 : 11, interval: xLabelInterval, hideOverlap: true },
          axisLine: { lineStyle: { color: theme.border } },
          axisTick: { show: false },
        },
        yAxis: [
          {
            type: "value",
            name: "提问数（次）",
            minInterval: 1,
            nameTextStyle: { color: theme.textSecondary, fontSize: 11 },
            axisLabel: { color: theme.textSecondary },
            splitLine: { lineStyle: { type: "dashed", color: theme.grid } },
          },
          {
            type: "value",
            name: "学生数（人）",
            minInterval: 1,
            nameTextStyle: { color: theme.textSecondary, fontSize: 11 },
            axisLabel: { color: theme.textSecondary },
            splitLine: { show: false },
          },
        ],
        dataZoom: timeline.length > 12 ? [
          { type: "slider", height: 18, bottom: 10, start: 0, end: 100, fillerColor: theme.primarySoft, borderColor: theme.border, handleStyle: { color: theme.primary }, textStyle: { color: theme.textSecondary, fontSize: 10 } },
          { type: "inside" },
        ] : [],
        series: [
          {
            name: "提问数（次）",
            type: "bar",
            barMaxWidth: 26,
            data: questionCounts.map((value, index) => ({
              value,
              itemStyle: {
                color: burstIndices.includes(index) ? theme.burst : theme.primary,
                opacity: burstIndices.includes(index) ? 0.78 : 0.62,
                borderRadius: [6, 6, 1, 1],
                shadowBlur: burstIndices.includes(index) ? 10 : 0,
                shadowColor: burstIndices.includes(index) ? theme.burstGlow : "transparent",
              },
            })),
            label: {
              show: true,
              position: "top",
              color: theme.textSecondary,
              fontSize: 10,
              formatter: (params: any) => (timeline[params.dataIndex]?.is_burst ? `${params.value}问` : ""),
            },
            markArea: totalBursts > 0 ? {
              silent: true,
              itemStyle: {
                color: theme.burstSoft,
                borderColor: theme.burstBorder,
                borderWidth: 1,
                borderType: "dashed",
              },
              label: {
                show: true,
                position: "insideTop",
                color: theme.burst,
                fontSize: compact ? 11 : 12,
                fontWeight: 700,
                formatter: () => (compact ? "热点爆发" : `${xData[focusStart]} - ${xData[focusEnd]}\n热点集中爆发`),
              },
              data: [[{ xAxis: xData[focusStart] }, { xAxis: xData[focusEnd] }]],
            } : undefined,
            markLine: teacherData.length > 0 ? {
              silent: true,
              symbol: ["none", "none"],
              lineStyle: { color: theme.teacherSoft, type: "dashed", width: 1.4 },
              label: { show: false },
              data: teacherData.map((item) => ({ xAxis: item.value[0] })),
            } : undefined,
          },
          {
            name: "独立学生数（人）",
            type: "line",
            yAxisIndex: 1,
            data: studentCounts,
            smooth: true,
            symbol: "circle",
            symbolSize: 6,
            lineStyle: { color: theme.primary, width: 2.6, shadowBlur: 6, shadowColor: theme.primarySoft },
            itemStyle: { color: theme.primary, borderColor: theme.surface, borderWidth: 2 },
          },
          {
            name: "教师提问",
            type: "scatter",
            data: teacherData,
            symbol: "pin",
            symbolSize: compact ? 20 : 24,
            itemStyle: { color: theme.teacher, shadowBlur: 8, shadowColor: theme.teacherSoft },
            label: { show: true, color: theme.surface, fontSize: 10, fontWeight: 700, position: "inside" },
            tooltip: {
              formatter: (param: any) => `<b style="color:${theme.teacher}">教师提问</b><br/>${escapeHtml(String(param?.value?.[2] || "").slice(0, 80))}`,
            },
            z: 8,
          },
          {
            name: "热点脉冲",
            type: "scatter",
            data: burstScatterData,
            symbol: "circle",
            symbolSize: compact ? 12 : 14,
            itemStyle: { color: theme.burst, shadowBlur: 12, shadowColor: theme.burstGlow, borderColor: theme.surface, borderWidth: 2 },
            z: 9,
          },
        ],
      }, true);
      chartRef.current.off("click");
      chartRef.current.on("click", (params: any) => {
        const bucketIndex = params.seriesName === "热点脉冲"
          ? Number(params.value?.[3])
          : Number(params.dataIndex);
        if (Number.isFinite(bucketIndex) && timeline[bucketIndex]) {
          setSelectedTimelineIndex(bucketIndex);
        }
      });
      return;
    }

    const maxCount = Math.max(...rankedThemes.map((item) => item.count || 0), 1);
    chartRef.current.setOption({
      animationDuration: 800,
      animationEasing: "cubicOut",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: theme.surfaceElevated,
        borderColor: theme.border,
        textStyle: { color: theme.textBase, fontSize: 12 },
        formatter: (params: any) => {
          const item = rankedThemes[params?.[0]?.dataIndex || 0];
          return [
            `<b>${item?.topic || ""}</b>`,
            `提问次数：${item?.count || 0}`,
            `参与学生：${item?.unique_students || "未统计"}`,
            item?.overall_bloom_level ? `Bloom：${item.overall_bloom_level}` : "",
          ].filter(Boolean).join("<br/>");
        },
      },
      grid: { left: 48, right: 30, top: 28, bottom: 84 },
      xAxis: {
        type: "category",
        data: rankedThemes.map((item) => shortText(item.topic, 10)),
        axisLine: { lineStyle: { color: theme.border } },
        axisTick: { show: false },
        axisLabel: { color: theme.textBase, fontSize: 11, fontWeight: 600, rotate: 24 },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        name: "提问次数",
        nameTextStyle: { color: theme.textSecondary, fontSize: 11 },
        splitLine: { lineStyle: { type: "dashed", color: theme.grid } },
        axisLabel: { color: theme.textSecondary, fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [{
        name: "热点主题",
        type: "bar",
        data: rankedThemes.map((item, index) => ({
          value: item.count,
          itemStyle: {
            color: index === 0 ? theme.uncoveredBorder : theme.beamColors[index % theme.beamColors.length],
            opacity: index === 0 ? 0.86 : 0.72,
            borderRadius: [10, 10, 2, 2],
            shadowBlur: index === 0 ? 12 : 0,
            shadowColor: index === 0 ? theme.uncoveredShadow : "transparent",
          },
        })),
        barMaxWidth: 34,
        showBackground: true,
        backgroundStyle: { color: theme.primarySoft, borderRadius: [10, 10, 2, 2] },
        label: {
          show: true,
          position: "top",
          color: theme.textBase,
          fontWeight: 700,
          formatter: (params: any) => {
            const item = rankedThemes[params.dataIndex];
            const ratio = Math.round(((item.count || 0) / maxCount) * 100);
            return `${item.count || 0}问${item.unique_students ? `/${item.unique_students}人` : ""} · ${ratio}%`;
          },
        },
      }],
    }, true);
    chartRef.current.off("click");
    chartRef.current.on("click", (params: any) => {
      const index = Number(params.dataIndex);
      if (Number.isFinite(index) && rankedThemes[index]) setSelectedThemeIndex(index);
    });
  }, [hasTimeline, rankedThemes, timeline, teacherMarks, questionCount, studentCount, burstCount]);

  useEffect(() => {
    const resize = () => chartRef.current?.resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  if (!hasTimeline && rankedThemes.length === 0) {
    return (
      <section className="rounded-[2rem] border border-dashed border-border-secondary bg-surface/80 p-6 text-center text-sm text-text-tertiary">
        暂无热点柱状图数据
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-primary/15 bg-surface/90 p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-base">学生热点问题柱状图</h2>
          <p className="mt-1 text-xs text-text-tertiary">
            {hasTimeline ? "按课堂时间桶绘制提问柱状脉冲，叠加独立学生数、教师提问和热点爆发区。" : "按学生提问次数排序，直观看出哪些热点已经成为全班共性问题。"}
          </p>
        </div>
        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
          {hasTimeline ? `${timeline.length} 个时间桶` : `Top ${rankedThemes.length}`}
        </span>
      </div>
      <div ref={ref} className="h-[390px] w-full" />
      <div className="mt-3 rounded-2xl border border-border-secondary bg-surface/85 p-4">
        {hasTimeline && focusBucket && bucketInsight ? (
          <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr_1.1fr]">
            <div>
              <div className="text-[11px] font-semibold text-primary">当前解读时间窗</div>
              <div className="mt-1 text-base font-semibold text-text-base">
                {dayjs(focusBucket.bucket_start).format("HH:mm")} - {dayjs(focusBucket.bucket_end).format("HH:mm")}
              </div>
              <div className="mt-1 text-xs text-text-tertiary">
                {focusBucket.question_count || 0} 问 · {focusBucket.unique_students || 0} 人
                {focusBucket.is_burst ? " · 热点脉冲" : ""}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-[var(--ws-color-warning)]">{bucketInsight.label}</div>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">{bucketInsight.action}</p>
              {focusBucket.top_questions?.[0]?.question && (
                <p className="mt-2 border-l-2 border-primary/30 pl-2 text-[11px] leading-relaxed text-text-tertiary">
                  代表问题：“{shortText(focusBucket.top_questions[0].question, 46)}”
                </p>
              )}
            </div>
            <div>
              <div className="text-[11px] font-semibold text-primary">形成性评价校验</div>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">{bucketInsight.check}</p>
              <p className="mt-2 text-[11px] leading-relaxed text-text-tertiary">点击柱体或红点可切换时间窗，避免只凭最高峰做判断。</p>
            </div>
          </div>
        ) : selectedTheme && themeInsight ? (
          <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr_1.1fr]">
            <div>
              <div className="text-[11px] font-semibold text-primary">当前热点主题</div>
              <div className="mt-1 text-base font-semibold text-text-base">{selectedTheme.topic}</div>
              <div className="mt-1 text-xs text-text-tertiary">{selectedTheme.count || 0} 问 · {selectedTheme.unique_students || 0} 人 · {themeInsight.ratio}%</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-[var(--ws-color-warning)]">{themeInsight.type}</div>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">{themeInsight.action}</p>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-primary">校验方式</div>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">{themeInsight.check}</p>
              <p className="mt-2 text-[11px] text-text-tertiary">点击柱体可切换主题。</p>
            </div>
          </div>
        ) : null}
      </div>
      <div className="mt-4 grid gap-2 rounded-2xl border border-primary/10 bg-primary-soft/20 p-2 text-sm sm:grid-cols-4">
        {[
          { label: "全程问题数", value: `${totalQuestions || 0} 次` },
          { label: "参与学生数", value: totalStudents ? `${totalStudents} 人` : "未统计" },
          { label: "热点脉冲", value: `${totalBursts || 0} 个` },
          { label: hasTimeline ? "教师锚点" : "热点主题", value: hasTimeline ? `${teacherMarks.length} 个` : `${rankedThemes.length} 个` },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border-secondary bg-surface/85 px-3 py-2">
            <div className="text-[11px] text-text-tertiary">{item.label}</div>
            <div className="mt-1 text-lg font-semibold text-primary">{item.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

const WordCloudChart: React.FC<{ data: WordCloudItem[] }> = ({ data }) => {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState<WordCloudItem | null>(null);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  useEffect(() => {
    if (!ref.current || data.length === 0) return;
    if (!chartRef.current) chartRef.current = echarts.init(ref.current);
    const maxCount = Math.max(...data.map((item) => item.count), 1);
    const theme = getAgentChartTheme();
    chartRef.current.off("mouseover");
    chartRef.current.off("mouseout");
    chartRef.current.on("mouseover", (params: any) => {
      if (params.seriesType === "wordCloud" && params.name) setHovered({ word: params.name, count: Number(params.value || 0) });
    });
    chartRef.current.on("mouseout", () => setHovered(null));
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
        sizeRange: [16, 78],
        rotationRange: [0, 0],
        gridSize: 8,
        drawOutOfBound: false,
        layoutAnimation: true,
        animation: true,
        animationDuration: 1400,
        animationEasing: "cubicOut",
        animationDelay: (index: number) => Math.max(0, (index / Math.max(data.length, 1)) * 900 - (data[index].count / maxCount) * 380),
        textStyle: { fontFamily: "sans-serif", fontWeight: "bold", color: (word: any) => wordColor(word.name || "") },
        emphasis: { focus: "self", scale: 1.22, textStyle: { textShadowBlur: 16, textShadowColor: "rgba(0,0,0,0.25)", color: "inherit" } },
        data: data.map((item) => ({ name: item.word, value: item.count })),
      }],
    }, true);
  }, [data]);

  useEffect(() => {
    const resize = () => chartRef.current?.resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  if (data.length === 0) {
    return <div className="flex h-[460px] items-center justify-center rounded-lg bg-surface-2 text-sm text-text-tertiary">暂无词云数据，请重新分析或检查该任务分析记录</div>;
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <button type="button" onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }} className="rounded border border-border px-2 py-0.5 text-xs text-text-tertiary transition-colors hover:bg-surface-2">重置</button>
        <span className="text-xs text-text-tertiary/60">滚轮缩放 · 拖拽平移 · {Math.round(scale * 100)}%</span>
        <div className="flex-1" />
        {hovered ? <div className="flex items-center gap-1.5 rounded-md bg-primary-soft px-2.5 py-1 text-xs"><span className="max-w-[120px] truncate font-semibold text-primary">{hovered.word}</span><span className="tabular-nums text-primary/70">{hovered.count}次</span></div> : <span className="text-xs text-text-tertiary/40">悬停查看词频</span>}
      </div>
      <div
        className="overflow-hidden select-none rounded-lg"
        onWheel={(event) => { event.preventDefault(); setScale((current) => Math.max(0.5, Math.min(3, current + (event.deltaY > 0 ? -0.08 : 0.08)))); }}
        onMouseDown={(event) => { if (event.button !== 0) return; setDragging(true); dragStart.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y }; }}
        onMouseMove={(event) => { if (!dragging) return; setOffset({ x: dragStart.current.ox + event.clientX - dragStart.current.x, y: dragStart.current.oy + event.clientY - dragStart.current.y }); }}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
        style={{ cursor: dragging ? "grabbing" : "grab", height: 460 }}
      >
        <div ref={ref} className="h-[460px] w-full origin-center transition-transform duration-75" style={{ transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)` }} />
      </div>
    </div>
  );
};

const HotAnalysisResultPage: React.FC = () => {
  const { loading, detail } = useAnalysisDetail();
  const {
    wc, resultData, covered, uncovered,
    hotThemes, courseSequence, teachingSuggestions,
    mainQuestionChain, savedMainQuestionChain,
  } = useNormalizedResult(detail);

  const teacherQuestions = useMemo(
    () => buildDisplayTeacherQuestions(resultData, savedMainQuestionChain, detail),
    [resultData, savedMainQuestionChain, detail],
  );
  const timelineBuckets = useMemo(
    () => normalizeTimelineBuckets(resultData, detail),
    [resultData, detail],
  );
  const timelineTeacherMarks = useMemo(
    () => normalizeTimelineTeacherMarks(resultData, detail),
    [resultData, detail],
  );
  const pedagogyThemes = useMemo(
    () => mergeTopicLists(hotThemes, uncovered, covered),
    [hotThemes, uncovered, covered],
  );
  const hotDeepAnalysis = useMemo(
    () => (resultData.deep_analysis || {}) as HotDeepAnalysis,
    [resultData.deep_analysis],
  );
  const hotDeepAnalysisReady = useMemo(
    () => hasHotDeepAnalysis(hotDeepAnalysis),
    [hotDeepAnalysis],
  );
  const diagnosticThemes = useMemo(
    () => normalizeHotDeepThemes(hotDeepAnalysis, pedagogyThemes),
    [hotDeepAnalysis, pedagogyThemes],
  );
  const hotQuestionCount = useMemo(() => (
    resultData.summary?.question_count
      || timelineBuckets.reduce((sum, bucket) => sum + (bucket.question_count || 0), 0)
      || pedagogyThemes.reduce((sum, theme) => sum + (theme.count || 0), 0)
      || wc.reduce((sum, word) => sum + (word.count || 0), 0)
  ), [resultData.summary?.question_count, timelineBuckets, pedagogyThemes, wc]);
  const hotStudentCount = useMemo(() => (
    resultData.summary?.unique_students
      || Math.max(...timelineBuckets.map((bucket) => bucket.unique_students || 0), 0)
      || Math.max(...pedagogyThemes.map((theme) => theme.unique_students || 0), 0)
  ), [resultData.summary?.unique_students, timelineBuckets, pedagogyThemes]);
  const burstCount = useMemo(() => (
    resultData.summary?.burst_count
      || timelineBuckets.filter((bucket) => bucket.is_burst).length
      || (resultData.burst_points || []).length
  ), [resultData.summary?.burst_count, timelineBuckets, resultData.burst_points]);
  const hotDiagnosis = useMemo(() => {
    if (hotDeepAnalysis.executive_summary) return shortText(hotDeepAnalysis.executive_summary, 54);
    const lead = diagnosticThemes[0]?.topic || wc[0]?.word || "课堂热点";
    const second = diagnosticThemes[1]?.topic || uncovered[0]?.topic || "先备知识";
    const leadType = topicPedagogyType(lead, 0);
    return `${shortText(lead, 14)}呈现${leadType}，${shortText(second, 14)}需要支架化追问`;
  }, [hotDeepAnalysis.executive_summary, diagnosticThemes, uncovered, wc]);

  const exportOpts = useMemo(() => {
    if (!detail) return undefined;
    const title = detail.title || "任务分析";
    const safe = safeFilePart(title);
    const ts = dayjs(detail.created_at).format("YYYYMMDD");

    return [
      {
        label: "HTML 报告", ext: "html", action: () => {
          const lines: string[] = [];
          lines.push(`<html><meta charset="UTF-8"><title>${title}</title><body>`);
          lines.push(`<h1>${title}</h1><p>${detail.created_at}</p>`);
          if (detail.task_sheet) lines.push(`<h2>任务单</h2><pre>${detail.task_sheet}</pre>`);
          lines.push(`<h2>热点词</h2><ul>${wc.map((w) => `<li>${w.word} (${w.count})</li>`).join("")}</ul>`);
          lines.push(`<h2>覆盖主题</h2><ul>${covered.map((c) => `<li>${c.topic} (${c.count})</li>`).join("")}</ul>`);
          lines.push(`<h2>生发问题</h2><ul>${uncovered.map((u) => `<li>${u.topic} (${u.count})</li>`).join("")}</ul>`);
          lines.push("</body></html>");
          downloadBlob(lines.join("\n"), `任务分析_${safe}_${ts}.html`, "text/html;charset=utf-8");
        },
      },
      {
        label: "Markdown", ext: "md", action: () => {
          const md: string[] = [];
          md.push(`# ${title}`);
          md.push(`> ${detail.created_at}`);
          md.push("");
          if (wc.length) { md.push("## 热点词"); wc.slice(0, 10).forEach((w) => md.push(`- **${w.word}** (${w.count})`)); md.push(""); }
          if (covered.length) { md.push("## 已覆盖"); covered.forEach((c) => md.push(`- ${c.topic} (${c.count})`)); md.push(""); }
          if (uncovered.length) { md.push("## 生发问题"); uncovered.forEach((u) => { md.push(`- ${u.topic} (${u.count})`); (u.questions || []).forEach((q) => md.push(`  - ${q}`)); }); md.push(""); }
          downloadBlob(md.join("\n"), `任务分析_${safe}_${ts}.md`, "text/markdown;charset=utf-8");
        },
      },
    ];
  }, [detail, wc, covered, uncovered]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!detail) return <div className="flex min-h-screen items-center justify-center text-sm text-text-tertiary">记录不存在</div>;

  const summaryCards = (
    <>
      <SummaryCard icon={<Hash className="h-4 w-4" />} label="热点词" value={wc.length} hint="从学生问题中提取" />
      <SummaryCard icon={<Target className="h-4 w-4" />} label="热点主题" value={hotThemes.length || uncovered.length} hint="课程中聚合出的主题" />
      <SummaryCard icon={<Lightbulb className="h-4 w-4" />} label="教师锚点" value={teacherQuestions.length} hint="自动识别 + 手动标记" />
      <SummaryCard icon={<Users className="h-4 w-4" />} label="阶段序列" value={courseSequence.length} hint="完整课程热点时序" />
    </>
  );

  return (
    <SharedResultLayout detail={detail} exportOptions={exportOpts} summaryCards={summaryCards}>
      <div className="space-y-6">
        <HotInsightHero
          diagnosis={hotDiagnosis}
          executiveSummary={hotDeepAnalysis.executive_summary}
          analysisAgent={resultData.analysis_agent}
          deepStatus={resultData.deep_analysis_status}
          hotThemes={diagnosticThemes}
          questionCount={hotQuestionCount}
          studentCount={hotStudentCount}
          burstCount={burstCount}
        />

        <HotTopicBarChart
          themes={diagnosticThemes}
          buckets={timelineBuckets}
          teacherMarks={timelineTeacherMarks}
          questionCount={hotQuestionCount}
          studentCount={hotStudentCount}
          burstCount={burstCount}
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">
          <MisconceptionMap themes={diagnosticThemes} />
          <section className="rounded-[2rem] border border-border/70 bg-surface/90 p-5 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-text-base">学生关注点词云</h2>
                <p className="mt-1 text-xs text-text-tertiary">用作热点证据入口：词越大，越需要回到学生原问确认是否是全班共性问题。</p>
              </div>
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{wc.length} 个关键词</span>
            </div>
            <WordCloudChart data={wc} />
          </section>
        </div>

        {hotDeepAnalysisReady && <HotDeepEvidencePanel deep={hotDeepAnalysis} />}

        <div className="grid gap-5 xl:grid-cols-[0.9fr_0.95fr_1.15fr]">
          <FormativeInterventionPanel themes={diagnosticThemes} />
          <FormativeWindowPanel buckets={timelineBuckets} teacherMarkCount={timelineTeacherMarks.length} />
          <TaskAlignmentPanel covered={covered} uncovered={uncovered} />
        </div>

        {/* 时序热点分析 */}
        <section className="rounded-[2rem] border border-primary/15 bg-surface/90 p-6 shadow-sm">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-text-base">形成性评价时序证据</h2>
            <p className="mt-1 text-sm text-text-tertiary">按时间桶观察全班提问密度变化，重点看升温点是否紧随教师锚点出现，从而判断讲解、支架或任务难度是否需要调整。</p>
          </div>
          <TimelineChart
            buckets={timelineBuckets}
            teacherMarks={timelineTeacherMarks}
            burstPoints={timelineBuckets.filter((bucket) => bucket.is_burst)}
            height={420}
          />
        </section>

        {/* AI 主问题链 */}
        <MainQuestionChainFlow items={mainQuestionChain} />

        {/* 完整课程热点序列 */}
        {courseSequence.length > 0 && (
          <section className="rounded-[2rem] border border-border/70 bg-surface/90 p-6 shadow-sm">
            <div className="mb-3">
              <h2 className="text-base font-semibold text-text-base">整课热点演化序列</h2>
              <p className="mt-1 text-sm text-text-tertiary">按教师提问、学生集中生发、主题扩散/收敛组织整节课的问题演化，用于复盘哪一段需要再诊断、再示范或再迁移。</p>
            </div>
            <div className="space-y-3">
              {courseSequence.map((item, index) => (
                <div key={`${item.stage}-${index}`} className="rounded-lg border border-border-secondary bg-surface-2 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">{item.stage}</span>
                    <span className="text-xs text-text-tertiary">{formatTimeRange(item.start_at, item.end_at)}</span>
                    <span className="rounded-full bg-[var(--ws-color-warning-soft)] px-2 py-0.5 text-xs text-[var(--ws-color-warning)]">{item.phase_type || "主题扩散"}</span>
                    <span className="text-xs text-text-tertiary">{item.question_count || 0} 问题 · {item.unique_students || 0} 学生</span>
                  </div>
                  {item.teacher_question && <div className="mt-2 text-sm text-text-secondary">教师提问：{item.teacher_question}</div>}
                  <div className="mt-1 text-sm font-medium text-text-base">热点主题：{item.dominant_theme || "未聚类"}</div>
                  {(item.representative_questions || []).slice(0, 3).map((question, qIndex) => (
                    <div key={qIndex} className="mt-1 border-l-2 border-primary/30 pl-2 text-xs text-text-tertiary">{question}</div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 热点主题证据 */}
        {hotThemes.length > 0 && (
          <section className="rounded-[2rem] border border-border/70 bg-surface/90 p-6 shadow-sm">
            <div className="mb-3">
              <h2 className="text-base font-semibold text-text-base">迷思证据索引</h2>
              <p className="mt-1 text-sm text-text-tertiary">保留学生原问作为判断依据，方便教师把热点主题改写成下节课的诊断题或同伴解释题。</p>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {hotThemes.map((theme, index) => (
                <TopicEvidenceCard key={`${theme.topic}-${index}`} item={theme} index={index} />
              ))}
            </div>
          </section>
        )}

        {/* 教学建议 */}
        <HotDeepSuggestionsPanel suggestions={hotDeepAnalysis.teaching_suggestions} />
        {!(hotDeepAnalysis.teaching_suggestions || []).length && (
          <TeachingSuggestionsPanel suggestions={teachingSuggestions} />
        )}

        {detail.agent_id && (
          <TrendDashboard agentId={detail.agent_id} analysisType="hot_questions" />
        )}
      </div>
    </SharedResultLayout>
  );
};

export default HotAnalysisResultPage;
