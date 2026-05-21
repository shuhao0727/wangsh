/**
 * 任务分析结果页 — 学生问题证据 | 问题链 | 辅助图表
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Clock, Download, GitBranch, Hash, Lightbulb, Loader2, MessageSquare, Target, Users } from "lucide-react";
import dayjs from "dayjs";
import * as echarts from "echarts";
import "echarts-wordcloud";
import { Button } from "@/components/ui/button";
import { showMessage } from "@/lib/toast";
import { agentDataApi } from "@services/znt/api";
import StudentBeamChart from "./components/StudentBeamChart";
import TimelineChart from "./components/TimelineChart";

const WC_COLORS = ["#0D9488", "#7C3AED", "#3B82F6", "#06B6D4", "#EC4899", "#F59E0B", "#10B981", "#8B5CF6"];

type WordCloudItem = { word: string; count: number };
type TopicItem = { topic: string; questions?: string[]; count: number };
type MainQuestionChainItem = { stage: string; question: string; reason?: string; evidence?: string[] };
type TaskAnalysisResult = {
  word_cloud?: WordCloudItem[];
  wordCloud?: WordCloudItem[];
  keywords?: WordCloudItem[];
  hot_words?: WordCloudItem[];
  covered?: TopicItem[];
  uncovered?: TopicItem[];
  main_question_chain?: MainQuestionChainItem[];
  result?: TaskAnalysisResult;
};
type TaskAnalysisDetail = {
  id?: number;
  title?: string;
  task_sheet?: string;
  created_at?: string;
  agent_id?: number;
  start_at?: string;
  end_at?: string;
  class_name?: string;
  result?: TaskAnalysisResult;
  word_cloud?: WordCloudItem[];
  covered?: TopicItem[];
  uncovered?: TopicItem[];
};
type ChainMessage = { id?: number; message_type: string; content: string; created_at: string };
type ChainSession = {
  session_id: string;
  user_name?: string;
  class_name?: string;
  last_at: string;
  turns: number;
  messages: ChainMessage[];
};
type ChainSummary = {
  sessionId: string;
  studentName: string;
  className?: string;
  questionCount: number;
  startAt?: string;
  endAt?: string;
  questions: ChainMessage[];
};

const wordColor = (word: string) => {
  let hash = 0;
  for (let i = 0; i < word.length; i += 1) hash = (hash * 31 + word.charCodeAt(i)) | 0;
  return WC_COLORS[Math.abs(hash) % WC_COLORS.length];
};

const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const safeFilePart = (value: string) => value.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_").slice(0, 80) || "report";

const normalizeTopics = (value: unknown): TopicItem[] => Array.isArray(value)
  ? value.map((item: any) => ({ topic: String(item.topic || "未命名主题"), questions: Array.isArray(item.questions) ? item.questions : [], count: Number(item.count || 0) }))
  : [];

const normalizeWords = (detail: TaskAnalysisDetail | null): WordCloudItem[] => {
  const result = detail?.result?.result || detail?.result;
  const raw = result?.word_cloud || result?.wordCloud || result?.keywords || result?.hot_words || detail?.word_cloud || [];
  const words = raw
    .map((item: any) => ({ word: String(item.word || item.name || "").trim(), count: Number(item.count ?? item.value ?? 0) }))
    .filter((item) => item.word && item.count > 0)
    .sort((a, b) => b.count - a.count);

  if (words.length > 0) return words;

  const topicItems = normalizeTopics(result?.covered || detail?.covered).concat(normalizeTopics(result?.uncovered || detail?.uncovered));
  return topicItems
    .flatMap((item) => [item.topic, ...(item.questions || [])].map((word) => ({ word: word.slice(0, 18), count: Math.max(item.count, 1) })))
    .filter((item) => item.word.trim())
    .slice(0, 50);
};

const normalizeMainQuestionChain = (detail: TaskAnalysisDetail | null, covered: TopicItem[], uncovered: TopicItem[], chains: ChainSummary[]): MainQuestionChainItem[] => {
  const result = detail?.result?.result || detail?.result;
  const aiChain = Array.isArray(result?.main_question_chain) ? result.main_question_chain : [];
  const normalized = aiChain
    .map((item: any) => ({
      stage: String(item.stage || item.title || "主线阶段").trim(),
      question: String(item.question || item.topic || "").trim(),
      reason: item.reason ? String(item.reason) : undefined,
      evidence: Array.isArray(item.evidence) ? item.evidence.map((text: unknown) => String(text)).filter(Boolean).slice(0, 2) : [],
    }))
    .filter((item) => item.question);
  if (normalized.length > 0) return normalized;

  const topicFallback = uncovered.concat(covered).slice(0, 5).map((item, index) => ({
    stage: index === 0 ? "核心困惑" : `延伸问题 ${index + 1}`,
    question: item.topic,
    reason: index === 0 ? "学生提问中最值得优先处理的方向" : "由学生提问延伸出的后续理解路径",
    evidence: (item.questions || []).slice(0, 2),
  }));
  if (topicFallback.length > 0) return topicFallback;

  return chains.slice(0, 5).map((chain, index) => ({
    stage: index === 0 ? "起始问题" : `追问 ${index + 1}`,
    question: chain.questions[0]?.content || chain.studentName,
    reason: `${chain.studentName} 的连续提问形成了一个可追踪的问题路径`,
    evidence: chain.questions.slice(0, 2).map((question) => question.content),
  }));
};

const deriveChainSummaries = (sessions: ChainSession[]): ChainSummary[] => sessions
  .map((session) => {
    const questions = session.messages
      .filter((message) => message.message_type === "question" && message.content.trim())
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return {
      sessionId: session.session_id,
      studentName: session.user_name || session.session_id,
      className: session.class_name,
      questionCount: questions.length,
      startAt: questions[0]?.created_at,
      endAt: questions[questions.length - 1]?.created_at || session.last_at,
      questions,
    };
  })
  .filter((session) => session.questionCount > 0)
  .sort((a, b) => b.questionCount - a.questionCount);

const formatTimeRange = (startAt?: string, endAt?: string) => {
  if (!startAt && !endAt) return "暂无时间";
  if (!startAt || !endAt || startAt === endAt) return dayjs(startAt || endAt).format("HH:mm");
  return `${dayjs(startAt).format("HH:mm")} - ${dayjs(endAt).format("HH:mm")}`;
};

const SummaryCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; hint: string }> = ({ icon, label, value, hint }) => (
  <div className="flex items-center gap-3 rounded-lg border border-border-secondary bg-surface px-3 py-2 shadow-sm">
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">{icon}</span>
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-medium text-text-tertiary">{label}</span>
        <span className="text-lg font-semibold leading-none tabular-nums text-text-base">{value}</span>
      </div>
      <div className="mt-0.5 truncate text-[11px] text-text-tertiary">{hint}</div>
    </div>
  </div>
);

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

const MainQuestionChainFlow: React.FC<{ items: MainQuestionChainItem[] }> = ({ items }) => (
  <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-text-base">AI 主问题链</h2>
        <p className="mt-1 text-sm text-text-tertiary">AI 在分析阶段总结出的全班问题递进主线，下面用真实代表问题做证据。</p>
      </div>
      <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{items.length} 个阶段</span>
    </div>
    {items.length > 0 ? (
      <div className="flex flex-col gap-3 overflow-x-auto pb-2 lg:flex-row lg:items-stretch lg:gap-4">
        {items.map((item, index) => (
          <div key={`${item.stage}-${index}`} className="group relative flex w-full flex-col rounded-xl border border-border-secondary bg-surface-2 px-4 py-3 shadow-sm transition-all hover:border-primary/30 hover:shadow-md lg:min-w-[280px] lg:max-w-[340px] lg:flex-1">
            <div className="mb-3 flex items-start gap-3">
              <div className="flex shrink-0 flex-col items-center">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white shadow-sm ring-4 ring-primary-soft">{index + 1}</span>
                {index < items.length - 1 && <span className="mt-2 h-8 w-px bg-border-secondary lg:hidden" />}
                {index < items.length - 1 && <ChevronRight className="mt-2 hidden h-4 w-4 text-text-tertiary lg:block" />}
              </div>
              <div className="min-w-0 flex-1">
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">{item.stage}</span>
                <h3 className="mt-2 text-sm font-semibold leading-relaxed text-text-base">{item.question}</h3>
              </div>
            </div>
            {item.reason && <p className="mt-2 text-xs leading-relaxed text-text-tertiary">{item.reason}</p>}
            {(item.evidence || []).length > 0 && (
              <div className="mt-3 space-y-1.5">
                {(item.evidence || []).slice(0, 2).map((evidence, eIndex) => (
                  <div key={`${evidence}-${eIndex}`} className="flex gap-2 rounded-lg border border-border-secondary bg-surface px-2.5 py-1.5 text-xs leading-relaxed text-text-secondary">
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
      <div className="flex h-[160px] items-center justify-center rounded-lg border border-dashed border-border-secondary text-sm text-text-tertiary">暂无 AI 主问题链</div>
    )}
  </section>
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
    chartRef.current.off("mouseover");
    chartRef.current.off("mouseout");
    chartRef.current.on("mouseover", (params: any) => {
      if (params.seriesType === "wordCloud" && params.name) setHovered({ word: params.name, count: Number(params.value || 0) });
    });
    chartRef.current.on("mouseout", () => setHovered(null));
    chartRef.current.setOption({
      tooltip: {
        show: true,
        backgroundColor: "rgba(15,23,42,0.86)",
        borderColor: "transparent",
        textStyle: { color: "#fff", fontSize: 13 },
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

const TaskAnalysisResultPage: React.FC = () => {
  const { analysisId } = useParams<{ analysisId?: string }>();
  const [searchParams] = useSearchParams();
  const view = (searchParams.get("view") || "timeline") as "timeline" | "beam" | "wordcloud";
  const isBeamView = view === "beam";
  const isTimelineView = view === "timeline";
  const [loading, setLoading] = useState(true);
  const [loadingBeam, setLoadingBeam] = useState(false);
  const [detail, setDetail] = useState<TaskAnalysisDetail | null>(null);
  const [beamSessions, setBeamSessions] = useState<ChainSession[]>([]);

  const wc = useMemo(() => normalizeWords(detail), [detail]);
  const covered = useMemo(() => normalizeTopics((detail?.result?.result || detail?.result)?.covered || detail?.covered), [detail]);
  const uncovered = useMemo(() => normalizeTopics((detail?.result?.result || detail?.result)?.uncovered || detail?.uncovered), [detail]);
  const chainSummaries = useMemo(() => deriveChainSummaries(beamSessions), [beamSessions]);
  const mainQuestionChain = useMemo(() => normalizeMainQuestionChain(detail, covered, uncovered, chainSummaries), [detail, covered, uncovered, chainSummaries]);
  const questionTotal = useMemo(() => chainSummaries.reduce((sum, chain) => sum + chain.questionCount, 0), [chainSummaries]);
  const studentTotal = useMemo(() => new Set(chainSummaries.map((chain) => chain.studentName)).size, [chainSummaries]);

  useEffect(() => {
    const id = Number.parseInt(analysisId || "", 10);
    if (Number.isNaN(id)) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    void agentDataApi.getTaskAnalysis(id)
      .then((response: any) => {
        if (cancelled) return;
        if (response.success) setDetail(response.data as TaskAnalysisDetail);
        else showMessage.error(response.message || "记录不存在");
      })
      .catch(() => {
        if (!cancelled) showMessage.error("获取任务分析失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [analysisId]);

  useEffect(() => {
    if (!isBeamView || !detail?.agent_id) {
      setBeamSessions([]);
      setLoadingBeam(false);
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
  }, [detail, isBeamView]);

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
                <SummaryCard icon={<Target className="h-4 w-4" />} label="主题聚类" value={covered.length + uncovered.length} hint="AI 识别的问题主题" />
                <SummaryCard icon={<Lightbulb className="h-4 w-4" />} label="生发问题" value={uncovered.length} hint="任务单外的新方向" />
              </>
            ) : (
              <>
                <SummaryCard icon={<Hash className="h-4 w-4" />} label="热点词" value={wc.length} hint="从学生问题中提取" />
                <SummaryCard icon={<Target className="h-4 w-4" />} label="已覆盖" value={covered.length} hint="任务单命中的主题" />
                <SummaryCard icon={<Lightbulb className="h-4 w-4" />} label="新问题" value={uncovered.length} hint="学生自发延伸方向" />
                <SummaryCard icon={<Users className="h-4 w-4" />} label="学生/问题" value={`${studentTotal}/${questionTotal}`} hint="参与学生 / 提问数" />
              </>
            )}
          </div>

          {isTimelineView ? (
            <div className="space-y-5">
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
              {/* ② AI 主问题链（认知递进流程） */}
              <MainQuestionChainFlow items={mainQuestionChain} />

              {/* ③ 语义光束图（核心主视觉） */}
              <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-text-base">语义光束图</h2>
                    <p className="mt-1 text-sm text-text-tertiary">同类问题汇聚到同一主题 lane，观察学生问题链的交汇与分化。</p>
                  </div>
                  {loadingBeam && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                </div>
                {loadingBeam ? <div className="flex h-[520px] items-center justify-center text-sm text-text-tertiary">正在加载链条数据...</div> : (
                  <StudentBeamChart
                    sessions={beamSessions}
                    height={520}
                    mainQuestionChain={mainQuestionChain}
                    teacherMarks={((detail?.result?.result || detail?.result) as any)?.teacher_marks || []}
                    burstPoints={((detail?.result?.result || detail?.result) as any)?.burst_points || []}
                    covered={covered}
                    uncovered={uncovered}
                  />
                )}
              </section>

              {/* ④ 教学发现（学生生发性问题） */}
              {uncovered.length > 0 && (
                <section className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 shadow-sm">
                  <div className="mb-3">
                    <h2 className="text-base font-semibold text-text-base flex items-center gap-2">
                      <span className="text-lg">🔥</span> 学生生发性问题
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{uncovered.length} 个方向</span>
                    </h2>
                    <p className="mt-1 text-sm text-text-tertiary">任务单未覆盖但学生高频追问的主题 — 生产性失败信号（Productive Failure）</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                    {uncovered.map((t, i) => (
                      <div key={i} className={`rounded-lg border px-3.5 py-3 ${t.count >= 3 ? "border-red-200 bg-red-50/40" : "border-border-secondary bg-surface"}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-medium text-sm text-text-base">{t.topic}</span>
                          <span className={`text-xs font-semibold ${t.count >= 3 ? "text-red-600" : "text-text-tertiary"}`}>{t.count}次</span>
                        </div>
                        {t.questions && t.questions.length > 0 && (
                          <div className="space-y-1">
                            {t.questions.slice(0, 2).map((q, qi) => (
                              <div key={qi} className="text-xs text-text-secondary pl-2 border-l-2 border-amber-300">"{q}"</div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-lg bg-primary-soft/50 px-3 py-2 text-xs text-primary">
                    💡 教学建议：以上问题为任务单未预料的方向，反映学生真实认知需求，建议纳入下次教学设计。
                  </div>
                </section>
              )}

              {/* ⑤ 学生问题链摘要 */}
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-text-base">学生问题链摘要</h2>
                    <p className="mt-1 text-sm text-text-tertiary">最活跃的链路，辅助理解光束图中的路径。</p>
                  </div>
                  <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">Top {Math.min(chainSummaries.length, 4)}</span>
                </div>
                {chainSummaries.length > 0 ? (
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
