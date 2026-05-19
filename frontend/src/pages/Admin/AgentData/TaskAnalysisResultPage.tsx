/**
 * 任务分析结果页 — 报告式布局
 * 顶部元信息 → 词云（全宽）→ 覆盖/未覆盖分栏
 */
import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, ArrowLeft, Lightbulb, ChevronRight, Download } from "lucide-react";
import dayjs from "dayjs";
import * as echarts from "echarts";
import "echarts-wordcloud";
import { Button } from "@/components/ui/button";
import { agentDataApi } from "@services/znt/api";
import { showMessage } from "@/lib/toast";

const WC_COLORS = ["#0D9488", "#7C3AED", "#3B82F6", "#06B6D4", "#EC4899", "#F59E0B", "#10B981", "#8B5CF6"];

/** 用词的 hash 确定颜色，同一词汇始终保持相同颜色 */
const wordColor = (word: string) => {
  let h = 0;
  for (let i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) | 0;
  return WC_COLORS[Math.abs(h) % WC_COLORS.length];
};

const WordCloudChart: React.FC<{ data: Array<{ word: string; count: number }> }> = ({ data }) => {
  const ref = useRef<HTMLDivElement>(null);
  const cRef = useRef<echarts.ECharts | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [hovered, setHovered] = useState<{ word: string; count: number } | null>(null);

  useEffect(() => {
    if (!ref.current || data.length === 0) return;
    if (!cRef.current) cRef.current = echarts.init(ref.current);
    renderWordCloud(cRef.current, data);
  }, [data]);

  useEffect(() => {
    if (!cRef.current) return;
    // Hover: update info badge
    cRef.current.on("mouseover", (p: any) => {
      if (p.seriesType === "wordCloud" && p.name) {
        setHovered({ word: p.name, count: p.value });
      }
    });
    cRef.current.on("mouseout", () => setHovered(null));
  }, [data]);

  useEffect(() => {
    const onResize = () => cRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); cRef.current?.dispose(); cRef.current = null; };
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setScale((s) => Math.max(0.5, Math.min(3, s + delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset({ x: dragStart.current.ox + (e.clientX - dragStart.current.x), y: dragStart.current.oy + (e.clientY - dragStart.current.y) });
  };
  const handleMouseUp = () => setDragging(false);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
          className="rounded border border-border px-2 py-0.5 text-xs text-text-tertiary hover:bg-surface-2 transition-colors">重置</button>
        <span className="text-xs text-text-tertiary/50">滚轮缩放 · 拖拽平移 · {Math.round(scale * 100)}%</span>
        <div className="flex-1" />
        {hovered ? (
          <div className="flex items-center gap-1.5 rounded-md bg-primary-soft px-2.5 py-1 text-xs animate-in fade-in duration-150">
            <span className="font-semibold text-primary truncate max-w-[120px]">{hovered.word}</span>
            <span className="text-primary/60 tabular-nums">{hovered.count}次</span>
          </div>
        ) : (
          <span className="text-xs text-text-tertiary/30">悬停查看词频</span>
        )}
      </div>
      <div
        className="overflow-hidden select-none rounded-lg"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: dragging ? "grabbing" : "grab", height: 360 }}
      >
        <div
          ref={ref}
          className="h-[360px] w-full origin-center transition-transform duration-75"
          style={{ transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)` }}
        />
      </div>
    </div>
  );
};

/** 渲染词云——可独立调用用于动画刷新 */
function renderWordCloud(chart: echarts.ECharts, data: Array<{ word: string; count: number }>) {
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  chart.setOption({
    series: [{
      type: "wordCloud",
      shape: "circle",
      sizeRange: [12, 60],
      rotationRange: [0, 0],
      gridSize: 8,
      drawOutOfBound: false,
      layoutAnimation: true,
      animation: true,
      animationDuration: 1800,
      animationEasing: "cubicOut",
      animationDelay(idx: number) {
        // 词越重要越先出现，其他逐个浮现
        const total = data.length || 1;
        const delay = (idx / total) * 1200;
        // 高频词提前
        const boost = (data[idx]?.count || 0) / maxVal;
        return Math.max(0, delay - boost * 600);
      },
      textStyle: {
        fontFamily: "sans-serif",
        fontWeight: "bold",
        color(word: any) { return wordColor(word.name || ""); },
      },
      emphasis: {
        focus: "self",
        scale: 1.25,
        textStyle: {
          textShadowBlur: 16,
          textShadowColor: "rgba(0,0,0,0.25)",
          color: "inherit",
        },
      },
      data: data.map((d) => ({ name: d.word, value: d.count })),
    }],
    tooltip: {
      show: true,
      backgroundColor: "rgba(0,0,0,0.75)",
      borderColor: "transparent",
      textStyle: { color: "#fff", fontSize: 13 },
      formatter(p: any) {
        return `${p.name}<br/>出现 <b>${p.value}</b> 次`;
      },
    },
  }, true);
}

const TaskAnalysisResultPage: React.FC = () => {
  const { analysisId } = useParams<{ analysisId?: string }>();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);

  const handleDownload = () => {
    if (!detail) return;
    const r = detail.result || {};
    const wc = r.word_cloud || [];
    const cov = r.covered || [];
    const uncov = r.uncovered || [];

    const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><title>任务分析报告</title>
<style>
  body { font-family: -apple-system, "Noto Sans SC", sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 24px; color: #1e293b; background: #fff; }
  h1 { font-size: 22px; color: #0D9488; margin-bottom: 4px; }
  .meta { color: #94a3b8; font-size: 13px; margin-bottom: 24px; }
  .section { margin: 24px 0; padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; }
  .section h2 { font-size: 16px; color: #334155; margin: 0 0 12px 0; }
  .words { display: flex; flex-wrap: wrap; gap: 8px; }
  .word { background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-size: 13px; }
  .word b { color: #0D9488; }
  .item { padding: 8px 0; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; }
  .item:last-child { border: none; }
  .count { color: #f59e0b; font-weight: 600; font-size: 13px; }
  .uncovered-card { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin-bottom: 8px; }
  .uncovered-card .topic { font-weight: 600; margin-bottom: 4px; }
  .uncovered-card .question { font-size: 13px; color: #64748b; padding-left: 12px; }
  .suggestion { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 12px; font-size: 14px; color: #0f766e; margin-top: 16px; }
</style></head><body>
<h1>任务分析报告: ${detail.title}</h1>
<div class="meta">${dayjs(detail.created_at).format("YYYY-MM-DD HH:mm")}</div>
<div class="section"><h2>任务单</h2><p>${(detail.task_sheet || "").replace(/\n/g, "<br>")}</p></div>
<div class="section"><h2>词云 (前30)</h2><div class="words">${wc.slice(0, 30).map((w: any) => `<span class="word">${w.word} <b>${w.count}</b></span>`).join("")}</div></div>
<div class="section"><h2>任务单已覆盖 (${cov.length})</h2>${cov.map((c: any) => `<div class="item"><span>${c.topic}</span><span class="count">${c.count}次</span></div>`).join("")}</div>
<div class="section"><h2>学生自发新问题 (${uncov.length})</h2>${uncov.map((u: any) => `<div class="uncovered-card"><div class="topic">${u.topic} <span class="count">${u.count}次</span></div>${(u.questions || []).map((q: string) => `<div class="question">· ${q}</div>`).join("")}</div>`).join("")}</div>
<div class="suggestion">以上自发问题为任务单未覆盖的方向，建议补充到下节课任务单中。这些是学生在任务单之外自然追问的内容，反映了学生真正的兴趣和困惑所在。</div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `任务分析_${detail.title}_${dayjs(detail.created_at).format("YYYYMMDD")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const id = parseInt(analysisId || "", 10);
    if (isNaN(id)) { setLoading(false); return; }
    void agentDataApi.getTaskAnalysis(id).then((r: any) => {
      if (r.success) setDetail(r.data); else showMessage.error("记录不存在");
      setLoading(false);
    });
  }, [analysisId]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!detail) return <div className="flex items-center justify-center min-h-screen text-text-tertiary text-sm">记录不存在</div>;

  const r = detail.result || {};
  const wc = r.word_cloud || [];
  const covered = r.covered || [];
  const uncovered = r.uncovered || [];
  const bloom = r.bloom || {};
  const bloomMax = Math.max(...(Object.values(bloom) as number[]), 1);
  const bloomLabels: Record<string, string> = { "记忆": "记忆", "理解": "理解", "应用": "应用", "分析": "分析", "评价": "评价", "创造": "创造" };

  return (
    <div className="h-screen flex flex-col bg-[var(--ws-color-bg)]">
      {/* Header */}
      <header className="shrink-0 border-b border-border-secondary bg-surface px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => window.close()}>
            <ArrowLeft className="h-4 w-4 mr-1" />关闭
          </Button>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold truncate">{detail.title}</h1>
            <p className="text-xs text-text-tertiary">{dayjs(detail.created_at).format("YYYY-MM-DD HH:mm")}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-1" />下载
        </Button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-5">

          {/* Task sheet — collapsible */}
          {detail.task_sheet && (
            <details className="mb-5 rounded-lg border border-border-secondary bg-surface-2 px-4 py-2.5">
              <summary className="cursor-pointer text-xs font-medium text-text-tertiary select-none hover:text-text-secondary transition-colors">
                任务单<span className="ml-2 text-text-tertiary/60 font-normal">{(detail.task_sheet || "").slice(0, 60)}{(detail.task_sheet || "").length > 60 ? "..." : ""}</span>
              </summary>
              <div className="mt-2 text-sm text-text-base whitespace-pre-wrap leading-relaxed">{detail.task_sheet}</div>
            </details>
          )}

          {/* Bloom taxonomy */}
          {Object.keys(bloom).length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-4 mb-5 animate-in fade-in duration-500">
              <h3 className="text-sm font-semibold mb-3">Bloom 认知层级分布</h3>
              <div className="space-y-2">
                {Object.entries(bloomLabels).map(([key, label]) => {
                  const count = bloom[key] || 0;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-10 text-xs text-text-tertiary text-right">{label}</span>
                      <div className="flex-1 h-5 rounded-full bg-surface-2 overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all duration-1000 ease-out"
                          style={{ width: `${bloomMax > 0 ? (count / bloomMax) * 100 : 0}%` }} />
                      </div>
                      <span className="w-8 text-xs tabular-nums font-medium text-text-secondary">{count}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-text-tertiary">记忆→理解→应用→分析→评价→创造，认知层级逐步递升</p>
            </div>
          )}

          {/* Main section: word cloud left + uncovered right */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-5">
            {/* Word Cloud — left 3 columns */}
            {wc.length > 0 && (
              <div className="lg:col-span-3 rounded-xl border border-border bg-surface p-4 animate-in fade-in duration-500">
                <WordCloudChart data={wc} />
              </div>
            )}

            {/* Uncovered — right 2 columns, main focus */}
            {uncovered.length > 0 && (
              <div className={`${wc.length > 0 ? "lg:col-span-2" : "lg:col-span-5"} animate-in fade-in slide-in-from-right-4 duration-600 delay-300`}>
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4" style={{ color: "var(--ws-color-warning)" }} />
                  <h3 className="text-sm font-semibold">学生自发产生的新问题</h3>
                  <span className="text-xs text-text-tertiary">{uncovered.length} 个方向</span>
                </div>
                <p className="text-xs text-text-tertiary mb-3">建议补充到下节课任务单中</p>
                <div className="space-y-2">
                  {uncovered.map((item: any, i: number) => (
                    <div key={i}
                      className="rounded-lg border border-border-secondary bg-surface p-3 hover:border-[var(--ws-color-warning)]/30 hover:shadow-sm transition-all duration-200 cursor-default"
                      style={{ animationDelay: `${i * 80}ms` }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold truncate">{item.topic}</span>
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ml-2"
                          style={{ background: "var(--ws-color-warning-soft)", color: "var(--ws-color-warning)" }}>
                          {item.count}次
                        </span>
                      </div>
                      {(item.questions || []).slice(0, 2).map((q: string, j: number) => (
                        <div key={j} className="flex items-start gap-1 text-xs text-text-secondary leading-relaxed mt-1">
                          <ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-text-tertiary/40" />
                          <span>{q}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Covered — collapsible */}
          {covered.length > 0 && (
            <details className="rounded-xl border border-border bg-surface-2 p-4 animate-in fade-in duration-500 delay-400">
              <summary className="cursor-pointer text-sm font-semibold text-text-secondary select-none">
                任务单已覆盖（{covered.length} 个知识点）
              </summary>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {covered.map((item: any, i: number) => (
                  <span key={i} className="inline-flex items-center rounded-md bg-surface px-2.5 py-1 text-xs font-medium">
                    {item.topic}<span className="ml-1.5 text-text-tertiary">{item.count}次</span>
                  </span>
                ))}
              </div>
            </details>
          )}

        </div>
      </div>
    </div>
  );
};

export default TaskAnalysisResultPage;
