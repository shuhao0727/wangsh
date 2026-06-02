/**
 * 热点问题分析结果页 — 词云、时序图、课程序列、教学建议
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Hash, Lightbulb, Loader2, Target, Users } from "lucide-react";
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
import { wordColor, safeFilePart, buildDisplayTeacherQuestions, formatTimeRange } from "../normalize";
import { getAgentChartTheme } from "../components/chartTheme";
import type { WordCloudItem } from "../types";

const downloadBlob = (content: string, filename: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
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
        {/* 词云 */}
        <section className="rounded-2xl bg-white shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-border/30 p-8">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-text-base">学生关注点词云</h2>
            <p className="mt-1 text-sm text-text-tertiary">词云只用于热点问题分析，帮助观察学生提问中的课程关注点。</p>
          </div>
          <WordCloudChart data={wc} />
        </section>

        {/* 时序热点分析 */}
        <section className="rounded-2xl bg-white shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-border/30 p-8">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-text-base">时序热点分析</h2>
            <p className="mt-1 text-sm text-text-tertiary">按时间桶展示学生提问密度变化，红色柱表示爆发点，黄色虚线为教师提问时间。点击柱体查看详情。</p>
          </div>
          <TimelineChart
            buckets={(resultData as any).timeline_buckets || []}
            teacherMarks={(resultData as any).teacher_marks || []}
            burstPoints={(resultData as any).burst_points || []}
            height={420}
          />
        </section>

        {/* AI 主问题链 */}
        <MainQuestionChainFlow items={mainQuestionChain} />

        {/* 完整课程热点序列 */}
        {courseSequence.length > 0 && (
          <section className="rounded-2xl bg-white shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-border/30 p-8">
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

        {/* 热点主题证据 */}
        {hotThemes.length > 0 && (
          <section className="rounded-2xl bg-white shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-border/30 p-8">
            <h2 className="mb-3 text-base font-semibold text-text-base">热点主题证据</h2>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {hotThemes.map((theme, index) => (
                <TopicEvidenceCard key={`${theme.topic}-${index}`} item={theme} index={index} />
              ))}
            </div>
          </section>
        )}

        {/* 教学建议 */}
        <TeachingSuggestionsPanel suggestions={teachingSuggestions} />

        {detail.agent_id && (
          <TrendDashboard agentId={detail.agent_id} analysisType="hot_questions" />
        )}

        {/* 任务单对比 */}
        {(covered.length > 0 || uncovered.length > 0) && (
          <section className="rounded-2xl bg-white shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-border/30 p-8">
            <h2 className="mb-3 text-base font-semibold text-text-base">任务单对比</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {covered.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-medium text-[var(--ws-color-success)]">任务单覆盖 ({covered.length})</div>
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
                  <div className="mb-2 text-xs font-medium text-[var(--ws-color-warning)]">学生生成性问题 ({uncovered.length})</div>
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
    </SharedResultLayout>
  );
};

export default HotAnalysisResultPage;
