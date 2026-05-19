/**
 * 任务分析结果页 — 热点=词云 | 链条=光束图
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Download, Lightbulb, Loader2 } from "lucide-react";
import dayjs from "dayjs";
import * as echarts from "echarts";
import "echarts-wordcloud";
import { Button } from "@/components/ui/button";
import { showMessage } from "@/lib/toast";
import { agentDataApi } from "@services/znt/api";
import StudentBeamChart from "./components/StudentBeamChart";

const WC_COLORS = ["#0D9488", "#7C3AED", "#3B82F6", "#06B6D4", "#EC4899", "#F59E0B", "#10B981", "#8B5CF6"];

type WordCloudItem = { word: string; count: number };
type TopicItem = { topic: string; questions?: string[]; count: number };
type TaskAnalysisResult = { word_cloud?: WordCloudItem[]; wordCloud?: WordCloudItem[]; covered?: TopicItem[]; uncovered?: TopicItem[] };
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

const normalizeWords = (detail: TaskAnalysisDetail | null): WordCloudItem[] => {
  const raw = detail?.result?.word_cloud || detail?.result?.wordCloud || detail?.word_cloud || [];
  return raw
    .map((item: any) => ({ word: String(item.word || item.name || "").trim(), count: Number(item.count ?? item.value ?? 0) }))
    .filter((item) => item.word && item.count > 0)
    .sort((a, b) => b.count - a.count);
};

const normalizeTopics = (value: unknown): TopicItem[] => Array.isArray(value)
  ? value.map((item: any) => ({ topic: String(item.topic || "未命名主题"), questions: Array.isArray(item.questions) ? item.questions : [], count: Number(item.count || 0) }))
  : [];

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
        sizeRange: [14, 64],
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
    return <div className="flex h-[360px] items-center justify-center rounded-lg bg-surface-2 text-sm text-text-tertiary">暂无词云数据，请重新分析或检查该任务分析记录</div>;
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
        style={{ cursor: dragging ? "grabbing" : "grab", height: 360 }}
      >
        <div ref={ref} className="h-[360px] w-full origin-center transition-transform duration-75" style={{ transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)` }} />
      </div>
    </div>
  );
};

const TaskAnalysisResultPage: React.FC = () => {
  const { analysisId } = useParams<{ analysisId?: string }>();
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") === "beam" ? "beam" : "wordcloud";
  const isBeamView = view === "beam";
  const [loading, setLoading] = useState(true);
  const [loadingBeam, setLoadingBeam] = useState(false);
  const [detail, setDetail] = useState<TaskAnalysisDetail | null>(null);
  const [beamSessions, setBeamSessions] = useState<any[]>([]);

  const wc = useMemo(() => normalizeWords(detail), [detail]);
  const covered = useMemo(() => normalizeTopics(detail?.result?.covered || detail?.covered), [detail]);
  const uncovered = useMemo(() => normalizeTopics(detail?.result?.uncovered || detail?.uncovered), [detail]);

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
      limit_sessions: 30,
    }).then((response) => {
      if (cancelled) return;
      if (response.success) setBeamSessions(response.data || []);
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

          {isBeamView ? (
            <div className="mb-5 rounded-xl border border-border bg-surface p-4 animate-in fade-in duration-500">
              <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-semibold">学生提问语义光束图</h3><p className="mt-1 text-xs text-text-tertiary">同类问题会汇聚到同一主题 lane，线条表示每个学生的提问链条。</p></div>{loadingBeam && <Loader2 className="h-4 w-4 animate-spin text-primary" />}</div>
              {loadingBeam ? <div className="flex h-[360px] items-center justify-center text-sm text-text-tertiary">正在加载链条数据...</div> : <StudentBeamChart sessions={beamSessions} />}
            </div>
          ) : (
            <>
              <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
                <div className="rounded-xl border border-border bg-surface p-4 animate-in fade-in duration-500 lg:col-span-3"><WordCloudChart data={wc} /></div>
                <div className="lg:col-span-2">
                  <div className="mb-2 flex items-center gap-2"><Lightbulb className="h-4 w-4" style={{ color: "var(--ws-color-warning)" }} /><h3 className="text-sm font-semibold">学生自发新问题</h3><span className="text-xs text-text-tertiary">{uncovered.length} 个方向</span></div>
                  <p className="mb-3 text-xs text-text-tertiary">建议补充到下节课任务单中</p>
                  {uncovered.length > 0 ? <div className="space-y-2">{uncovered.map((item, index) => <div key={`${item.topic}-${index}`} className="rounded-lg border border-border-secondary bg-surface p-3 transition-all hover:border-[var(--ws-color-warning)]/30 hover:shadow-sm"><div className="mb-1.5 flex items-center justify-between"><span className="truncate text-sm font-semibold">{item.topic}</span><span className="ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "var(--ws-color-warning-soft)", color: "var(--ws-color-warning)" }}>{item.count}次</span></div>{(item.questions || []).slice(0, 2).map((question, qIndex) => <div key={`${question}-${qIndex}`} className="mt-1 flex items-start gap-1 text-xs leading-relaxed text-text-secondary"><ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-text-tertiary/40" /><span>{question}</span></div>)}</div>)}</div> : <div className="flex h-[180px] items-center justify-center rounded-lg border border-dashed border-border-secondary text-sm text-text-tertiary">暂无未覆盖的新问题</div>}
                </div>
              </div>
              {covered.length > 0 && <details className="rounded-xl border border-border bg-surface-2 p-4 animate-in fade-in duration-500"><summary className="cursor-pointer select-none text-sm font-semibold text-text-secondary">任务单已覆盖（{covered.length} 个知识点）</summary><div className="mt-2.5 flex flex-wrap gap-1.5">{covered.map((item, index) => <span key={`${item.topic}-${index}`} className="inline-flex items-center rounded-md bg-surface px-2.5 py-1 text-xs font-medium">{item.topic}<span className="ml-1.5 text-text-tertiary">{item.count}次</span></span>)}</div></details>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskAnalysisResultPage;
