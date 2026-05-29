/**
 * 任务分析结果页 — 学生问题证据 | 问题链 | 辅助图表
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Clock, Download, Hash, Lightbulb, Loader2, MessageSquare, Target, Users } from "lucide-react";
import dayjs from "dayjs";
import * as echarts from "echarts";
import "echarts-wordcloud";
import { Button } from "@/components/ui/button";
import { showMessage } from "@/lib/toast";
import { agentDataApi } from "@services/znt/api";
import StudentBeamChart from "./components/StudentBeamChart";
import TimelineChart from "./components/TimelineChart";
import SummaryCard from "./components/SummaryCard";
import MainQuestionChainFlow from "./components/MainQuestionChainFlow";
import { getAgentChartTheme } from "./components/chartTheme";
import type {
  WordCloudItem, TopicItem, MainQuestionChainItem, TeacherQuestionItem,
  TaskAnalysisResult, TaskAnalysisDetail, ChainSession, ChainSummary, BeamRangeSelection,
} from "./types";
import {
  WC_COLORS, escapeHtml, safeFilePart, wordColor, normalizeTopics, normalizeWords,
  normalizeMainQuestionChain, deriveChainSummaries, formatTimeRange,
  buildDisplayTeacherQuestions, buildDisplayStudentChains, buildBeamTeacherAnchors,
  buildBeamStudentChains, positiveNumber,
} from "./normalize";



const TopicEvidenceCard: React.FC<{ item: TopicItem; index: number }> = ({ item, index }) => (
  <div className="rounded-xl border border-border-secondary bg-surface px-4 py-3 shadow-sm transition-all hover:border-[var(--ws-color-warning)]/40 hover:shadow-md">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--ws-color-warning-soft)] text-xs font-semibold text-[var(--ws-color-warning)]">{index + 1}</span>
          <h3 className="min-w-0 break-words text-base font-semibold leading-snug text-text-base">{item.topic}</h3>
        </div>
        <p className="text-xs text-text-tertiary">任务单之外的学生自发问题方向，建议补充到后续任务设计中。</p>
      </div>
      <span className="shrink-0 rounded-full bg-[var(--ws-color-warning-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--ws-color-warning)]">{item.count} 次</span>
    </div>
    {(item.questions || [])[0] && (
      <div className="mt-2 flex gap-2 rounded-lg bg-surface-2/80 px-3 py-2 text-sm leading-relaxed text-text-secondary">
        <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span className="whitespace-pre-wrap break-words">{item.questions?.[0]}</span>
      </div>
    )}
  </div>
);


const ChainCard: React.FC<{ chain: ChainSummary; index: number }> = ({ chain, index }) => {
  const visibleQuestions = chain.questions.slice(0, 3);
  const hiddenCount = Math.max(chain.questions.length - visibleQuestions.length, 0);
  return (
    <div className="rounded-xl border border-border-secondary bg-surface px-4 py-3 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">{index + 1}</span>
            <h3 className="font-semibold text-text-base">{chain.studentName}</h3>
            {chain.className && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-tertiary">{chain.className}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatTimeRange(chain.startAt, chain.endAt)}</span>
            <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{chain.questionCount} 个问题</span>
          </div>
        </div>
        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">流程摘要</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {visibleQuestions.map((question, qIndex) => (
          <React.Fragment key={`${question.created_at}-${qIndex}`}>
            <span className="max-w-[220px] truncate rounded-lg bg-surface-2 px-3 py-1.5 text-xs text-text-secondary" title={question.content}>{question.content}</span>
            {qIndex < visibleQuestions.length - 1 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />}
          </React.Fragment>
        ))}
        {hiddenCount > 0 && <span className="rounded-full border border-dashed border-border-secondary px-2 py-1 text-xs text-text-tertiary">+{hiddenCount}</span>}
      </div>
    </div>
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

const formatInputTime = (value?: string) => (value ? dayjs(value).format("HH:mm") : "");

const mergeDateAndTime = (baseIso: string | undefined, timeText: string) => {
  const match = timeText.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  // treat bare time as local, convert to ISO for backend comparison
  const local = dayjs().hour(hour).minute(minute).second(0).millisecond(0);
  return local.toISOString();
};

const ChainThoughtPathCard: React.FC<{
  chain: { studentName: string; percentage: number; questions: NonNullable<BeamRangeSelection["questions"]> };
  index: number;
  isEvidenceOnly: boolean;
}> = ({ chain, index, isEvidenceOnly }) => (
  <details className="group rounded-xl border border-border-secondary bg-surface px-4 py-3 shadow-sm" open={index === 0}>
    <summary className="flex cursor-pointer select-none items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">#{index + 1}</span>
          <span className="font-semibold text-text-base">{chain.studentName}</span>
          {isEvidenceOnly && <span className="rounded-full border border-primary/20 bg-primary-soft/40 px-2 py-0.5 text-[11px] text-primary">旧记录证据链</span>}
        </div>
        <div className="mt-1 text-xs text-text-tertiary">
          {formatTimeRange(chain.questions[0]?.time, chain.questions[chain.questions.length - 1]?.time)} · {chain.questions.length} 个问题 · 占比 {chain.percentage}%
        </div>
      </div>
      <span className="shrink-0 text-xs text-text-tertiary group-open:hidden">展开思维链</span>
      <span className="hidden shrink-0 text-xs text-text-tertiary group-open:inline">收起</span>
    </summary>
    <div className="mt-3 space-y-3 border-t border-border-secondary pt-3">
      {chain.questions.map((question, questionIndex) => (
        <div key={`${question.chainId}-${question.time}-${questionIndex}`} className="grid gap-2 rounded-lg bg-surface-2 px-3 py-2.5 sm:grid-cols-[82px_1fr]">
          <div className="flex items-center gap-2 text-xs text-text-tertiary sm:block">
            <div className="font-semibold text-primary">{dayjs(question.time).format("HH:mm")}</div>
            <div className="mt-0.5">{question.relationLabel || "问题"}</div>
          </div>
          <div className="min-w-0">
            <div className="text-sm leading-relaxed text-text-base">{question.content}</div>
            {question.teacherQuestion && (
              <div className="mt-1 rounded-md border border-[var(--ws-color-warning)]/20 bg-[var(--ws-color-warning)]/8 px-2 py-1 text-xs leading-relaxed text-text-tertiary">
                关联教师主线：{question.teacherQuestion}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  </details>
);

const CollapsibleTeacherMainline: React.FC<{ items: TeacherQuestionItem[] }> = ({ items }) => (
  <details className="group rounded-xl border border-border bg-surface shadow-sm">
    <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3">
      <div>
        <h2 className="text-base font-semibold text-text-base">教师主线</h2>
        <p className="mt-1 text-sm text-text-tertiary">课堂中教师/admin 提问形成的中心轴，光束图里的橙色粗线与锚点来自这里。</p>
      </div>
      <span className="shrink-0 rounded-full bg-[var(--ws-color-warning-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--ws-color-warning)]">{items.length} 个锚点</span>
    </summary>
    <div className="border-t border-border-secondary px-4 py-3">
      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {items.map((item, index) => (
            <div key={`${item.id || item.time}-${index}`} className="rounded-lg border border-[var(--ws-color-warning)]/20 bg-[var(--ws-color-warning)]/8 px-3 py-2">
              <div className="mb-1 text-xs font-semibold text-[var(--ws-color-warning)]">T{index + 1}{item.time ? ` · ${dayjs(item.time).format("HH:mm")}` : ""}</div>
              <div className="text-sm font-medium leading-relaxed text-text-base">{item.question}</div>
              {item.user_name && <div className="mt-1 text-[11px] text-text-tertiary">{item.user_name}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed border-border-secondary text-sm text-text-tertiary">暂无教师主线锚点</div>
      )}
    </div>
  </details>
);

const CollapsibleAiMainline: React.FC<{ items: MainQuestionChainItem[] }> = ({ items }) => (
  <details className="group rounded-xl border border-border bg-surface shadow-sm">
    <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3">
      <div>
        <h2 className="text-base font-semibold text-text-base">AI 主问题链</h2>
        <p className="mt-1 text-sm text-text-tertiary">AI 基于学生问题归纳出的课堂认知推进链，和教师主线分开阅读，避免混成一套逻辑。</p>
      </div>
      <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{items.length} 个阶段</span>
    </summary>
    <div className="border-t border-border-secondary px-4 py-3">
      {items.length > 0 ? (
        <div className="flex flex-col gap-3 overflow-x-auto pb-2 lg:flex-row lg:items-stretch lg:gap-4">
          {items.map((item, index) => (
            <div key={`${item.stage}-${index}`} className="flex w-full flex-col rounded-xl border border-border-secondary bg-surface-2 px-4 py-3 shadow-sm lg:min-w-[260px] lg:max-w-[330px] lg:flex-1">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white ring-4 ring-primary-soft">{index + 1}</span>
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">{item.stage}</span>
              </div>
              <h3 className="text-sm font-semibold leading-relaxed text-text-base">{item.question}</h3>
              {item.reason && <p className="mt-2 text-xs leading-relaxed text-text-tertiary">{item.reason}</p>}
              {(item.evidence || []).length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {(item.evidence || []).slice(0, 2).map((evidence, evidenceIndex) => (
                    <div key={`${evidence}-${evidenceIndex}`} className="flex gap-2 rounded-lg border border-border-secondary bg-surface px-2.5 py-1.5 text-xs leading-relaxed text-text-secondary">
                      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="break-words">{evidence}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed border-border-secondary text-sm text-text-tertiary">暂无 AI 主问题链</div>
      )}
    </div>
  </details>
);

const TaskAnalysisResultPage: React.FC = () => {
  const { analysisId } = useParams<{ analysisId?: string }>();
  const [searchParams] = useSearchParams();
  const view = (searchParams.get("view") || "timeline") as "timeline" | "beam" | "wordcloud";
  const typeParam = searchParams.get("type");
  const isBeamView = view === "beam" || typeParam === "chains";
  const isTimelineView = view === "timeline" && !isBeamView;
  const [loading, setLoading] = useState(true);
  const [loadingBeam, setLoadingBeam] = useState(false);
  const [detail, setDetail] = useState<TaskAnalysisDetail | null>(null);
  const [beamSessions, setBeamSessions] = useState<ChainSession[]>([]);
  const [beamRange, setBeamRange] = useState<BeamRangeSelection | null>(null);
  const [beamManualRange, setBeamManualRange] = useState<{ startAt?: string; endAt?: string } | null>(null);
  const [beamRangeInputs, setBeamRangeInputs] = useState({ start: "", end: "" });

  const wc = useMemo(() => normalizeWords(detail), [detail]);
  const covered = useMemo(() => normalizeTopics((detail?.result?.result || detail?.result)?.covered || detail?.covered), [detail]);
  const uncovered = useMemo(() => normalizeTopics((detail?.result?.result || detail?.result)?.uncovered || detail?.uncovered), [detail]);
  const chainSummaries = useMemo(() => deriveChainSummaries(beamSessions), [beamSessions]);
  const mainQuestionChain = useMemo(() => normalizeMainQuestionChain(detail, covered, uncovered, chainSummaries), [detail, covered, uncovered, chainSummaries]);
  const resultData = useMemo(() => (detail?.result?.result || detail?.result || {}) as TaskAnalysisResult, [detail]);
  const hotThemes = useMemo(() => normalizeTopics(resultData.themes || uncovered), [resultData, uncovered]);
  const courseSequence = useMemo(() => resultData.course_hotspot_sequence || [], [resultData]);
  const teachingSuggestions = useMemo(() => resultData.teaching_suggestions || [], [resultData]);
  const studentChainSummary = useMemo(() => resultData.student_chain_summary || {}, [resultData]);
  const savedMainQuestionChain = useMemo(() => {
    const items = resultData.ai_main_question_chain || [];
    if (items.length === 0) return mainQuestionChain;
    return items.map((item, index) => ({
      stage: item.stage || `主线 ${index + 1}`,
      question: item.next_ai_question || item.question || "",
      reason: item.student_response_summary || item.reason,
      evidence: item.evidence || [],
    })).filter((item) => item.question);
  }, [resultData, mainQuestionChain]);
  const teacherQuestions = useMemo(() => buildDisplayTeacherQuestions(resultData, savedMainQuestionChain, detail), [resultData, savedMainQuestionChain, detail]);
  const savedStudentChains = useMemo(
    () => buildDisplayStudentChains(resultData, uncovered, savedMainQuestionChain, chainSummaries, detail),
    [resultData, uncovered, savedMainQuestionChain, chainSummaries, detail],
  );
  const beamTeacherAnchors = useMemo(
    () => buildBeamTeacherAnchors(teacherQuestions, detail),
    [teacherQuestions, detail],
  );
  const beamStudentChains = useMemo(
    () => buildBeamStudentChains(savedStudentChains, detail),
    [savedStudentChains, detail],
  );
  const activeBeamQuestions = useMemo(() => beamRange?.questions || [], [beamRange]);
  const activeUncoveredQuestions = useMemo(
    () => activeBeamQuestions.filter((question) => question.isUncovered),
    [activeBeamQuestions],
  );
  const activeBeamStudentPaths = useMemo(() => {
    const grouped = new Map<string, typeof activeBeamQuestions>();
    activeBeamQuestions.forEach((question) => {
      grouped.set(question.studentName, [...(grouped.get(question.studentName) || []), question]);
    });
    const total = Math.max(activeBeamQuestions.length, 1);
    return [...grouped.entries()]
      .map(([studentName, questions]) => ({
        studentName,
        questions: questions.sort((a, b) => dayjs(a.time).valueOf() - dayjs(b.time).valueOf()),
        percentage: Math.round((questions.length / total) * 100),
      }))
      .sort((a, b) => b.questions.length - a.questions.length);
  }, [activeBeamQuestions]);
  const visibleBeamTeacherAnchors = useMemo(() => beamRange?.teacherAnchors || [], [beamRange]);
  const hasEvidenceOnlyChains = useMemo(
    () => savedStudentChains.some((chain) => chain.is_evidence_only || chain.source === "evidence"),
    [savedStudentChains],
  );
  const canRenderBeamFromSavedResult = useMemo(
    () => (resultData.student_question_chains || []).length > 0
      || (resultData.beam_nodes || []).some((node) => node.kind !== "teacher_anchor")
      || savedStudentChains.length > 0,
    [resultData, savedStudentChains],
  );
  const questionTotal = useMemo(() => {
    const liveTotal = chainSummaries.reduce((sum, chain) => sum + chain.questionCount, 0);
    const savedTotal = savedStudentChains.reduce((sum, chain) => sum + positiveNumber(chain.question_count, chain.nodes?.length), 0);
    return positiveNumber(studentChainSummary.question_count, liveTotal, savedTotal);
  }, [chainSummaries, savedStudentChains, studentChainSummary]);
  const studentTotal = useMemo(() => {
    if (hasEvidenceOnlyChains && chainSummaries.length === 0 && !(resultData.student_question_chains || []).length) return 0;
    const liveTotal = new Set(chainSummaries.map((chain) => chain.studentName)).size;
    const savedTotal = new Set(savedStudentChains
      .filter((chain) => !(chain.is_evidence_only || chain.source === "evidence"))
      .map((chain) => chain.student_name || chain.session_id)).size;
    return positiveNumber(studentChainSummary.unique_students, liveTotal, savedTotal);
  }, [chainSummaries, hasEvidenceOnlyChains, resultData, savedStudentChains, studentChainSummary]);
  const chainCount = useMemo(() => positiveNumber(studentChainSummary.chain_count, savedStudentChains.length, chainSummaries.length), [studentChainSummary, savedStudentChains, chainSummaries]);
  const teacherAnchorCount = useMemo(() => positiveNumber(studentChainSummary.teacher_anchor_count, teacherQuestions.length), [studentChainSummary, teacherQuestions]);

  useEffect(() => {
    if (!beamRange?.startAt || !beamRange?.endAt || beamRange.source === "manual") return;
    setBeamRangeInputs({
      start: formatInputTime(beamRange.startAt),
      end: formatInputTime(beamRange.endAt),
    });
  }, [beamRange]);

  const handleApplyBeamRange = () => {
    const base = beamRange?.startAt || beamStudentChains[0]?.startAt || detail?.start_at || detail?.created_at;
    const startAt = mergeDateAndTime(base, beamRangeInputs.start);
    const endAt = mergeDateAndTime(base, beamRangeInputs.end);
    if (!startAt || !endAt) {
      showMessage.error("请输入正确的时间，例如 10:14");
      return;
    }
    setBeamManualRange({ startAt, endAt });
    setBeamRangeInputs({ start: formatInputTime(startAt), end: formatInputTime(endAt) });
  };

  const handleResetBeamRange = () => {
    setBeamManualRange(null);
    setBeamRangeInputs({
      start: formatInputTime(beamRange?.startAt),
      end: formatInputTime(beamRange?.endAt),
    });
  };

  useEffect(() => {
    const id = Number.parseInt(analysisId || "", 10);
    if (Number.isNaN(id)) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    // 根据视图类型选择正确的数据源
    const fetchApi = isBeamView ? agentDataApi.getChainAnalysis : agentDataApi.getHotAnalysis;
    void fetchApi(id)
      .then((response: any) => {
        if (cancelled) return;
        if (response.success) { setDetail(response.data as TaskAnalysisDetail); return; }
        // 404 fallback: 尝试旧表
        return (isBeamView ? agentDataApi.getHotAnalysis(id) : agentDataApi.getChainAnalysis(id))
          .then((r2: any) => {
            if (cancelled) return;
            if (r2.success) { setDetail(r2.data as TaskAnalysisDetail); return; }
            return agentDataApi.getTaskAnalysis(id);
          })
          .then((r3: any) => {
            if (cancelled) return;
            if (r3?.success) { setDetail(r3.data as TaskAnalysisDetail); return; }
            showMessage.error("记录不存在");
          });
      })
      .catch(() => {
        if (!cancelled) showMessage.error("获取任务分析失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [analysisId, isBeamView]);

  useEffect(() => {
    if (!isBeamView || !detail?.agent_id || canRenderBeamFromSavedResult) {
      setBeamSessions((current) => (current.length > 0 ? [] : current));
      setLoadingBeam((current) => (current ? false : current));
      return;
    }
    let cancelled = false;
    setBeamSessions([]);
    setLoadingBeam(true);
    void agentDataApi.analyzeStudentChains({
      agent_id: detail.agent_id,
      start_at: detail.start_at,
      end_at: detail.end_at,
      class_name: detail.class_name || undefined,
      limit_sessions: 20,
    }).then((response) => {
      if (cancelled) return;
      if (response.success) setBeamSessions((response.data || []) as ChainSession[]);
      else {
        setBeamSessions([]);
        showMessage.error(response.message || "获取链条失败");
      }
    }).catch(() => {
      if (!cancelled) {
        setBeamSessions([]);
        showMessage.error("获取链条失败");
      }
    }).finally(() => {
      if (!cancelled) setLoadingBeam(false);
    });
    return () => { cancelled = true; };
  }, [canRenderBeamFromSavedResult, detail, isBeamView]);

  const handleDownload = () => {
    if (!detail) return;
    const wordData = JSON.stringify(wc.map((item) => ({ name: item.word, value: item.count })));
    const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>任务分析报告</title>
<style>body{font-family:-apple-system,"Noto Sans SC",sans-serif;max-width:860px;margin:0 auto;padding:40px 24px;color:#1e293b;background:#fff}h1{font-size:24px;color:#0D9488}.meta{color:#94a3b8;font-size:13px;margin-bottom:24px}.section{margin:24px 0;padding:16px;border:1px solid #e2e8f0;border-radius:12px}.section h2{font-size:16px;color:#334155;margin:0 0 12px}.item{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9}.count{color:#f59e0b;font-weight:600;font-size:13px}.uc{border:1px solid #fde68a;border-left:3px solid #f59e0b;border-radius:8px;padding:12px;margin-bottom:8px;background:#fffbeb}.uc .tp{font-weight:600;margin-bottom:4px}.uc .q{font-size:13px;color:#64748b;padding-left:8px}.tip{background:#f0fdfa;border:1px solid #99f6e4;border-left:3px solid #0D9488;border-radius:8px;padding:14px 16px;font-size:14px;color:#0f766e;margin-top:24px}.footer{text-align:center;color:#cbd5e1;font-size:12px;margin-top:40px}#wordcloud{height:360px;width:100%}.empty{height:180px;display:flex;align-items:center;justify-content:center;color:#94a3b8;background:#f8fafc;border-radius:10px}</style></head><body>
<h1>任务分析报告</h1><div class="meta">${escapeHtml(detail.title || "任务分析")} · ${escapeHtml(detail.created_at || "")}</div>
<div class="section"><h2>任务单</h2><p>${escapeHtml(detail.task_sheet || "").replace(/\n/g, "<br>")}</p></div>
<div class="section"><h2>词云热点</h2>${wc.length > 0 ? '<div id="wordcloud"></div>' : '<div class="empty">暂无词云数据</div>'}</div>
<div class="section"><h2>已覆盖 (${covered.length})</h2>${covered.map((item) => `<div class="item"><span>${escapeHtml(item.topic)}</span><span class="count">${item.count}次</span></div>`).join("") || "暂无"}</div>
<div class="section"><h2>学生自发新问题 (${uncovered.length})</h2>${uncovered.map((item) => `<div class="uc"><div class="tp">${escapeHtml(item.topic)} <span class="count">${item.count}次</span></div>${(item.questions || []).map((question) => `<div class="q">· ${escapeHtml(question)}</div>`).join("")}</div>`).join("") || "暂无"}</div>
<div class="tip">以上自发问题为任务单未覆盖的方向，建议补充到下节课任务单中。</div><div class="footer">WangSh 任务分析 · 自动生成</div>
${wc.length > 0 ? `<script src="https://cdn.jsdelivr.net/npm/echarts@6.0.0/dist/echarts.min.js"><\/script><script src="https://cdn.jsdelivr.net/npm/echarts-wordcloud@2.1.0/dist/echarts-wordcloud.min.js"><\/script><script>var d=${wordData};var c=${JSON.stringify(WC_COLORS)};function wcColor(w){var h=0;for(var i=0;i<w.length;i++)h=(h*31+w.charCodeAt(i))|0;return c[Math.abs(h)%c.length];}var el=document.getElementById("wordcloud");if(el){echarts.init(el).setOption({series:[{type:"wordCloud",shape:"circle",sizeRange:[14,56],rotationRange:[0,0],gridSize:10,drawOutOfBound:false,layoutAnimation:true,animationDuration:1400,animationEasing:"cubicOut",textStyle:{fontFamily:"sans-serif",fontWeight:"bold",color:function(p){return wcColor(p.name)}},emphasis:{focus:"self",scale:1.25,textStyle:{textShadowBlur:16,textShadowColor:"rgba(0,0,0,0.25)"}},data:d}]});}<\/script>` : ""}</body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `任务分析_${safeFilePart(detail.title || String(detail.id || "report"))}_${dayjs(detail.created_at).format("YYYYMMDD")}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!detail) return <div className="flex min-h-screen items-center justify-center text-sm text-text-tertiary">记录不存在</div>;

  return (
    <div className="flex h-screen flex-col bg-[var(--ws-color-bg)]">
      <header className="flex shrink-0 items-center justify-between border-b border-border-secondary bg-surface px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => window.close()}><ArrowLeft className="mr-1 h-4 w-4" />关闭</Button>
          <div className="min-w-0"><h1 className="truncate text-sm font-semibold">{detail.title || "任务分析"}</h1><p className="text-xs text-text-tertiary">{detail.created_at ? dayjs(detail.created_at).format("YYYY-MM-DD HH:mm") : ""}</p></div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleDownload}><Download className="mr-1 h-4 w-4" />下载</Button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-5">
          {detail.task_sheet && (
            <details className="mb-5 rounded-lg border border-border-secondary bg-surface-2 px-4 py-2.5">
              <summary className="cursor-pointer select-none text-xs font-medium text-text-tertiary hover:text-text-secondary">任务单<span className="ml-2 font-normal text-text-tertiary/60">{detail.task_sheet.slice(0, 60)}{detail.task_sheet.length > 60 ? "..." : ""}</span></summary>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-base">{detail.task_sheet}</div>
            </details>
          )}

          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {isBeamView ? (
              <>
                <SummaryCard icon={<Users className="h-4 w-4" />} label="参与学生" value={studentTotal} hint="提交问题的学生数" />
                <SummaryCard icon={<MessageSquare className="h-4 w-4" />} label="提问总数" value={questionTotal} hint="学生提问总条数" />
                <SummaryCard icon={<Target className="h-4 w-4" />} label="问题链" value={chainCount} hint="可追踪的学生链路" />
                <SummaryCard icon={<Lightbulb className="h-4 w-4" />} label="教师锚点" value={teacherAnchorCount} hint="教师主线问题数" />
              </>
            ) : (
              <>
                <SummaryCard icon={<Hash className="h-4 w-4" />} label="热点词" value={wc.length} hint="从学生问题中提取" />
                <SummaryCard icon={<Target className="h-4 w-4" />} label="热点主题" value={hotThemes.length || uncovered.length} hint="课程中聚合出的主题" />
                <SummaryCard icon={<Lightbulb className="h-4 w-4" />} label="教师锚点" value={teacherQuestions.length} hint="自动识别 + 手动标记" />
                <SummaryCard icon={<Users className="h-4 w-4" />} label="阶段序列" value={courseSequence.length} hint="完整课程热点时序" />
              </>
            )}
          </div>

          {isTimelineView ? (
            <div className="space-y-5">
              <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                <div className="mb-3">
                  <h2 className="text-base font-semibold text-text-base">学生关注点词云</h2>
                  <p className="mt-1 text-sm text-text-tertiary">词云只用于热点问题分析，帮助观察学生提问中的课程关注点。</p>
                </div>
                <WordCloudChart data={wc} />
              </section>

              <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                <div className="mb-3">
                  <h2 className="text-base font-semibold text-text-base">时序热点分析</h2>
                  <p className="mt-1 text-sm text-text-tertiary">按时间桶展示学生提问密度变化，红色柱表示爆发点，黄色虚线为教师提问时间。点击柱体查看详情。</p>
                </div>
                <TimelineChart
                  buckets={((detail?.result?.result || detail?.result) as any)?.timeline_buckets || []}
                  teacherMarks={((detail?.result?.result || detail?.result) as any)?.teacher_marks || []}
                  burstPoints={((detail?.result?.result || detail?.result) as any)?.burst_points || []}
                  height={420}
                />
              </section>

              <MainQuestionChainFlow items={mainQuestionChain} />

              {courseSequence.length > 0 && (
                <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                  <div className="mb-3">
                    <h2 className="text-base font-semibold text-text-base">完整课程热点序列</h2>
                    <p className="mt-1 text-sm text-text-tertiary">按教师提问、学生集中生发、主题扩散/收敛组织整节课的问题演化。</p>
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

              {hotThemes.length > 0 && (
                <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                  <h2 className="mb-3 text-base font-semibold text-text-base">热点主题证据</h2>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {hotThemes.map((theme, index) => (
                      <TopicEvidenceCard key={`${theme.topic}-${index}`} item={theme} index={index} />
                    ))}
                  </div>
                </section>
              )}

              {teachingSuggestions.length > 0 && (
                <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                  <h2 className="mb-3 text-base font-semibold text-text-base">教学建议</h2>
                  <div className="space-y-2">
                    {teachingSuggestions.map((item, index) => (
                      <div key={index} className="rounded-lg bg-primary-soft/50 px-3 py-2 text-sm text-primary">
                        <span className="font-semibold">{item.theme || "建议"}：</span>{item.suggestion || item.reason}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {(covered.length > 0 || uncovered.length > 0) && (
                <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                  <h2 className="mb-3 text-base font-semibold text-text-base">任务单对比</h2>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {covered.length > 0 && (
                      <div>
                        <div className="mb-2 text-xs font-medium text-[var(--ws-color-success)]">✅ 任务单覆盖 ({covered.length})</div>
                        <div className="space-y-1.5">
                          {covered.map((t, i) => (
                            <div key={i} className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
                              <span className="font-medium text-text-base">{t.topic}</span>
                              <span className="ml-2 text-xs text-text-tertiary">{t.count}次</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {uncovered.length > 0 && (
                      <div>
                        <div className="mb-2 text-xs font-medium text-[var(--ws-color-warning)]">💡 学生生成性问题 ({uncovered.length})</div>
                        <div className="space-y-1.5">
                          {uncovered.map((t, i) => (
                            <div key={i} className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
                              <span className="font-medium text-text-base">{t.topic}</span>
                              <span className="ml-2 text-xs text-text-tertiary">{t.count}次</span>
                              {t.questions && t.questions.length > 0 && (
                                <div className="mt-1 text-xs text-text-tertiary">例: {t.questions[0]}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          ) : isBeamView ? (
            <div className="space-y-5">
              <div className="space-y-3">
                <CollapsibleTeacherMainline items={teacherQuestions} />
                <CollapsibleAiMainline items={savedMainQuestionChain} />
              </div>

              {/* ③ 语义光束图（核心主视觉） */}
              <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-text-base">语义光束图</h2>
                    <p className="mt-1 text-sm text-text-tertiary">橙色粗线是教师问题链中轴，彩色波形是真实学生问题链。拖动底部时间条、框选或输入精准时间可查看区间趋势。</p>
                  </div>
                  {loadingBeam && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                </div>
                {!loadingBeam && hasEvidenceOnlyChains ? (
                  <div className="mb-3 rounded-lg border border-primary/20 bg-primary-soft/45 px-3 py-2 text-xs leading-relaxed text-primary">
                    当前记录缺少逐学生真实链，已使用已保存代表问题绘制“课堂证据链”；不会伪造学生身份。新生成的问题链记录会优先显示真实学生路径。
                  </div>
                ) : !loadingBeam && beamStudentChains.length < 5 && (
                  <div className="mb-3 rounded-lg border border-[var(--ws-color-warning)]/25 bg-[var(--ws-color-warning)]/8 px-3 py-2 text-xs text-[var(--ws-color-warning)]">
                    当前真实学生链{beamStudentChains.length}条，不足 5 条，未使用模拟链补足。
                  </div>
                )}
                <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-border-secondary bg-surface-2/70 px-3 py-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-text-tertiary">开始时间</label>
                    <input
                      type="time"
                      value={beamRangeInputs.start}
                      onChange={(event) => setBeamRangeInputs((current) => ({ ...current, start: event.target.value }))}
                      className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-text-base outline-none transition-colors focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-text-tertiary">结束时间</label>
                    <input
                      type="time"
                      value={beamRangeInputs.end}
                      onChange={(event) => setBeamRangeInputs((current) => ({ ...current, end: event.target.value }))}
                      className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-text-base outline-none transition-colors focus:border-primary"
                    />
                  </div>
                  <Button type="button" size="sm" variant="secondary" onClick={handleApplyBeamRange}>应用区间</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={handleResetBeamRange}>同步当前选择</Button>
                  <div className="min-w-[180px] flex-1 text-xs text-text-tertiary">
                    当前区间：{beamRange?.startAt && beamRange?.endAt ? `${dayjs(beamRange.startAt).format("HH:mm")} - ${dayjs(beamRange.endAt).format("HH:mm")}` : "暂无"}
                    {beamRange?.source === "manual" && <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-primary">精准时间</span>}
                  </div>
                </div>
                {loadingBeam ? <div className="flex h-[520px] items-center justify-center text-sm text-text-tertiary">正在加载链条数据...</div> : (
                    <StudentBeamChart
                      height={520}
                      teacherAnchors={beamTeacherAnchors}
                      studentChains={beamStudentChains}
                      burstPoints={resultData.burst_points || []}
                      manualRange={beamManualRange}
                      onRangeChange={setBeamRange}
                    />
                )}
              </section>

              {/* ④ 教学发现（学生生发性问题） */}
              {(uncovered.length > 0 || activeBeamQuestions.length > 0) && (
                <section className="rounded-xl border border-[var(--ws-color-warning)]/20 bg-[var(--ws-color-warning)]/8 p-4 shadow-sm">
                  <div className="mb-3">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-text-base">
                      <span className="text-lg">🔥</span> 区间内学生生发性问题
                      <span className="rounded-full bg-[var(--ws-color-warning)]/12 px-2 py-0.5 text-xs font-medium text-[var(--ws-color-warning)]">
                        {activeUncoveredQuestions.length || uncovered.length} 条/方向
                      </span>
                    </h2>
                    <p className="mt-1 text-sm text-text-tertiary">
                      {beamRange?.startAt && beamRange?.endAt
                        ? `${dayjs(beamRange.startAt).format("HH:mm")} - ${dayjs(beamRange.endAt).format("HH:mm")} 内的学生问题随光束图时间区间变化。`
                        : "拖动光束图底部时间条后，这里会只显示当前时间段里的学生问题。"}
                    </p>
                  </div>
                  {activeBeamQuestions.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                      {(activeUncoveredQuestions.length > 0 ? activeUncoveredQuestions : activeBeamQuestions).slice(0, 8).map((question, index) => (
                        <div key={`${question.time}-${question.studentName}-${index}`} className={`rounded-lg border px-3.5 py-3 ${question.isUncovered ? "border-[var(--ws-color-danger)]/20 bg-[var(--ws-color-danger)]/8" : "border-border-secondary bg-surface"}`}>
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate text-sm font-medium text-text-base">{question.studentName}</span>
                            <span className="shrink-0 text-xs text-text-tertiary">{dayjs(question.time).format("HH:mm")}</span>
                          </div>
                          <div className="text-sm leading-relaxed text-text-secondary">{question.content}</div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs text-text-tertiary">
                            {question.relationLabel && <span>关系：{question.relationLabel}</span>}
                            {question.teacherQuestion && <span>关联教师：{question.teacherQuestion}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                      {uncovered.map((t, i) => (
                        <div key={i} className={`rounded-lg border px-3.5 py-3 ${t.count >= 3 ? "border-[var(--ws-color-danger)]/20 bg-[var(--ws-color-danger)]/8" : "border-border-secondary bg-surface"}`}>
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-sm font-medium text-text-base">{t.topic}</span>
                            <span className={`text-xs font-semibold ${t.count >= 3 ? "text-[var(--ws-color-danger)]" : "text-text-tertiary"}`}>{t.count}次</span>
                          </div>
                          {t.questions && t.questions.length > 0 && (
                            <div className="space-y-1">
                              {t.questions.slice(0, 2).map((q, qi) => (
                                <div key={qi} className="border-l-2 border-[var(--ws-color-warning)]/35 pl-2 text-xs text-text-secondary">"{q}"</div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 rounded-lg bg-primary-soft/50 px-3 py-2 text-xs text-primary">
                    教学建议：优先关注当前区间里学生集中转向、追问或偏离教师主线的节点，它们更能反映实时认知需求。
                  </div>
                </section>
              )}

              {/* ⑤ 学生问题链摘要 */}
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-text-base">学生问题链摘要</h2>
                    <p className="mt-1 text-sm text-text-tertiary">
                      {beamRange?.startAt && beamRange?.endAt
                        ? `当前区间 ${dayjs(beamRange.startAt).format("HH:mm")} - ${dayjs(beamRange.endAt).format("HH:mm")} · ${activeBeamStudentPaths.length} 条${hasEvidenceOnlyChains ? "课堂证据链" : "真实学生链"} · ${activeBeamQuestions.length} 个问题 · ${visibleBeamTeacherAnchors.length} 个教师锚点`
                        : studentChainSummary.chain_count !== undefined
                        ? `${chainCount} 条链 · ${questionTotal} 个问题 · ${teacherAnchorCount} 个教师锚点`
                        : "最活跃的链路，辅助理解光束图中的路径。"}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                    {Math.min(activeBeamStudentPaths.length || savedStudentChains.length || chainSummaries.length, 5) > 0
                      ? `Top ${Math.min(activeBeamStudentPaths.length || savedStudentChains.length || chainSummaries.length, 5)}`
                      : "暂无真实链"}
                  </span>
                </div>
                {visibleBeamTeacherAnchors.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {visibleBeamTeacherAnchors.map((anchor, index) => (
                      <span key={`${anchor.id}-${index}`} className="rounded-full border border-[var(--ws-color-warning)]/25 bg-[var(--ws-color-warning)]/8 px-2.5 py-1 text-xs text-[var(--ws-color-warning)]" title={anchor.question}>
                        {anchor.label || `T${index + 1}`} · {dayjs(anchor.time).format("HH:mm")}
                      </span>
                    ))}
                  </div>
                )}
                {activeBeamStudentPaths.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {activeBeamStudentPaths.slice(0, 5).map((chain, index) => (
                      <ChainThoughtPathCard key={chain.studentName} chain={chain} index={index} isEvidenceOnly={hasEvidenceOnlyChains} />
                    ))}
                  </div>
                ) : savedStudentChains.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {savedStudentChains.slice(0, 5).map((chain, index) => (
                      <details key={chain.session_id} className="group rounded-xl border border-border-secondary bg-surface px-4 py-3 shadow-sm" open={index === 0}>
                        <summary className="flex cursor-pointer select-none items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-text-base">{chain.student_name || chain.session_id}</div>
                            <div className="text-xs text-text-tertiary">{formatTimeRange(chain.start_at, chain.end_at)} · {chain.question_count || chain.nodes?.length || 0} 个问题</div>
                          </div>
                          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">#{index + 1}</span>
                        </summary>
                        {chain.summary && <div className="mt-3 text-sm text-text-secondary">{chain.summary}</div>}
                        <div className="mt-3 space-y-2 border-t border-border-secondary pt-3">
                          {(chain.nodes || []).map((node, nodeIndex) => (
                            <div key={`${chain.session_id}-${node.time}-${nodeIndex}`} className="rounded-lg bg-surface-2 px-3 py-2">
                              <div className="mb-1 text-xs font-semibold text-primary">{node.time ? dayjs(node.time).format("HH:mm") : `节点 ${nodeIndex + 1}`}</div>
                              <div className="text-sm leading-relaxed text-text-base">{node.question}</div>
                            </div>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                ) : chainSummaries.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">{chainSummaries.slice(0, 4).map((chain, index) => <ChainCard key={chain.sessionId} chain={chain} index={index} />)}</div>
                ) : (
                  <div className="flex h-[180px] items-center justify-center rounded-xl border border-dashed border-border-secondary bg-surface text-sm text-text-tertiary">暂无可阅读的问题链</div>
                )}
              </section>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
              <section className="xl:col-span-5">
                <div className="mb-3 flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-[var(--ws-color-warning)]" />
                  <div>
                    <h2 className="text-base font-semibold text-text-base">学生自发新问题</h2>
                    <p className="mt-1 text-sm text-text-tertiary">这些问题直接反映任务单之外的兴趣、困惑和补充方向。</p>
                  </div>
                </div>
                {uncovered.length > 0 ? <div className="space-y-2">{uncovered.map((item, index) => <TopicEvidenceCard key={`${item.topic}-${index}`} item={item} index={index} />)}</div> : <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-border-secondary bg-surface text-sm text-text-tertiary">暂无未覆盖的新问题</div>}
              </section>
              <aside className="space-y-4 xl:col-span-7">
                <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                  <div className="mb-3">
                    <h2 className="text-base font-semibold text-text-base">问题热点词云</h2>
                    <p className="mt-1 text-sm text-text-tertiary">辅助观察学生提问中的高频概念。</p>
                  </div>
                  <WordCloudChart data={wc} />
                </div>
                <div className="rounded-xl border border-border-secondary bg-surface p-4">
                  <h3 className="mb-3 text-sm font-semibold text-text-base">热点词 Top 10</h3>
                  <div className="space-y-2">
                    {wc.slice(0, 10).map((item) => <div key={item.word} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm"><span className="min-w-0 truncate text-text-secondary">{item.word}</span><span className="ml-3 shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">{item.count}</span></div>)}
                    {wc.length === 0 && <div className="rounded-lg bg-surface-2 px-3 py-3 text-center text-sm text-text-tertiary">暂无热点词</div>}
                  </div>
                </div>
                {covered.length > 0 && <div className="rounded-xl border border-border-secondary bg-surface p-4"><h3 className="mb-3 text-sm font-semibold text-text-base">任务单已覆盖</h3><div className="flex flex-wrap gap-1.5">{covered.map((item, index) => <span key={`${item.topic}-${index}`} className="inline-flex items-center rounded-md bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-secondary">{item.topic}<span className="ml-1.5 text-text-tertiary">{item.count}次</span></span>)}</div></div>}
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskAnalysisResultPage;
