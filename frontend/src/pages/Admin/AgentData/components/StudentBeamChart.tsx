/**
 * 学生语义光束图 — 增强版
 * 特性：主问题链对齐 | 教师标记 | 爆发点 | 覆盖/生发区分 | 交互增强
 */
import React, { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts";

type Message = { message_type: string; content: string; created_at: string };
type Session = {
  session_id: string;
  user_name?: string;
  class_name?: string;
  last_at: string;
  turns: number;
  messages: Message[];
};
type MainChainItem = { stage: string; question: string; reason?: string; evidence?: string[] };
type TeacherMark = { time: string; question: string };
type BurstPoint = { bucket_start: string; question_count: number; top_questions?: Array<{ question: string; count: number }> };
type TopicItem = { topic: string; questions?: string[]; count: number };

interface Props {
  sessions: Session[];
  height?: number;
  mainQuestionChain?: MainChainItem[];
  teacherMarks?: TeacherMark[];
  burstPoints?: BurstPoint[];
  covered?: TopicItem[];
  uncovered?: TopicItem[];
}

const BEAM_COLORS = ["#0D9488", "#7C3AED", "#3B82F6", "#F59E0B", "#EC4899", "#06B6D4", "#10B981", "#EF4444", "#8B5CF6", "#F43F5E"];
const STOP_WORDS = new Set(["怎么", "如何", "为什么", "什么", "可以", "这个", "那个", "一下", "请问", "老师", "就是", "还是", "如果", "没有", "问题", "请", "呢", "吗", "啊", "的", "了", "和", "与", "在", "是", "我", "要", "能"]);

const extractTerms = (text: string): string[] => {
  const cleaned = text.replace(/[\s\p{P}\p{S}]+/gu, " ").trim();
  const latin = cleaned.match(/[a-zA-Z][a-zA-Z0-9_+#-]{1,}/g) || [];
  const chinese = cleaned.replace(/[a-zA-Z0-9_+#-]+/g, "").replace(/\s+/g, "");
  const cTerms: string[] = [];
  for (let size = 4; size >= 2; size -= 1) {
    for (let i = 0; i <= chinese.length - size; i += size) {
      const t = chinese.slice(i, i + size);
      if (!STOP_WORDS.has(t)) cTerms.push(t);
    }
  }
  return [...latin, ...cTerms].map((t) => t.toLowerCase()).filter((t) => t.length >= 2 && !STOP_WORDS.has(t)).slice(0, 8);
};

const similarity = (a: Set<string>, b: Set<string>) => {
  if (a.size === 0 || b.size === 0) return 0;
  let same = 0;
  a.forEach((t) => { if (b.has(t)) same += 1; });
  return same / Math.min(a.size, b.size);
};

const escapeHtml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmtTime = (v: number) => { const d = new Date(v); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

// 判断问题是否属于 uncovered（生发性）— 使用术语相似度而非子串匹配
const isUncoveredQuestion = (content: string, uncoveredTopics: TopicItem[]): boolean => {
  if (uncoveredTopics.length === 0) return false;
  const contentTerms = new Set(extractTerms(content));
  if (contentTerms.size === 0) return false;
  return uncoveredTopics.some((t) => {
    const topicTerms = new Set(extractTerms(t.topic));
    if (similarity(contentTerms, topicTerms) >= 0.4) return true;
    return (t.questions || []).some((q) => similarity(contentTerms, new Set(extractTerms(q))) >= 0.45);
  });
};

const StudentBeamChart: React.FC<Props> = ({
  sessions, height = 520, mainQuestionChain = [], teacherMarks = [], burstPoints = [], covered = [], uncovered = [],
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  const empty = useMemo(() => sessions.every((s) => !s.messages.some((m) => m.message_type === "question")), [sessions]);

  useEffect(() => {
    if (!ref.current || sessions.length === 0 || empty) return;
    if (chartRef.current) { chartRef.current.dispose(); chartRef.current = null; }
    chartRef.current = echarts.init(ref.current);

    // 提取所有问题
    const questions = sessions.flatMap((s) => {
      const name = s.user_name || s.session_id.slice(0, 8);
      return s.messages
        .filter((m) => m.message_type === "question" && m.content.trim())
        .map((m) => ({ name, content: m.content.trim(), time: new Date(m.created_at).getTime() }));
    }).filter((q) => Number.isFinite(q.time)).sort((a, b) => a.time - b.time);

    if (questions.length === 0) { chartRef.current.clear(); return; }

    // 聚类：优先对齐主问题链阶段，否则自动聚类
    type Cluster = { label: string; terms: Set<string>; items: typeof questions; isChainStage: boolean };
    const clusters: Cluster[] = [];

    // 用主问题链阶段作为预设 lane
    if (mainQuestionChain.length > 0) {
      mainQuestionChain.forEach((stage) => {
        const terms = new Set(extractTerms(stage.question + " " + stage.stage));
        (stage.evidence || []).forEach((e) => extractTerms(e).forEach((t) => terms.add(t)));
        clusters.push({ label: stage.stage, terms, items: [], isChainStage: true });
      });
    }

    // 分配问题到聚类
    questions.forEach((q) => {
      const terms = new Set(extractTerms(q.content));
      const match = clusters.find((c) => similarity(c.terms, terms) >= 0.4);
      if (match) {
        terms.forEach((t) => match.terms.add(t));
        match.items.push(q);
      } else {
        const label = [...terms].slice(0, 3).join("/") || q.content.slice(0, 12);
        clusters.push({ label, terms, items: [q], isChainStage: false });
      }
    });

    // 排序：主问题链阶段在中间，其他按数量排列在两侧
    const chainClusters = clusters.filter((c) => c.isChainStage && c.items.length > 0);
    const otherClusters = clusters.filter((c) => !c.isChainStage && c.items.length > 0).sort((a, b) => b.items.length - a.items.length);

    const orderedClusters = [...chainClusters, ...otherClusters];
    const laneMap = new Map<string, number>();
    orderedClusters.forEach((c, i) => {
      const lane = i < chainClusters.length
        ? i - Math.floor(chainClusters.length / 2)  // 主链居中
        : chainClusters.length + Math.ceil((i - chainClusters.length) / 2) * ((i - chainClusters.length) % 2 === 0 ? 1 : -1);
      laneMap.set(c.label, lane);
    });

    const maxLane = Math.max(1, ...[...laneMap.values()].map(Math.abs));
    const students = [...new Set(questions.map((q) => q.name))];
    const enriched = orderedClusters.flatMap((c) => c.items.map((item) => ({
      ...item, topic: c.label, y: laneMap.get(c.label) || 0, isChainStage: c.isChainStage,
      isUncovered: isUncoveredQuestion(item.content, uncovered),
    })));

    // === 绘制 ===

    // Lane 引导线（主问题链阶段用实线+标签，其他用虚线）
    const laneSeries = orderedClusters.map((c) => {
      const y = laneMap.get(c.label) || 0;
      return {
        type: "line", name: c.label, silent: true, z: 0, symbol: "none",
        data: [[questions[0].time, y], [questions[questions.length - 1].time, y]],
        lineStyle: {
          color: c.isChainStage ? "rgba(13,148,136,0.25)" : "rgba(148,163,184,0.12)",
          width: c.isChainStage ? 2 : 1,
          type: c.isChainStage ? "solid" : "dashed",
        },
        label: c.isChainStage ? { show: true, formatter: c.label, position: "insideStartTop", fontSize: 10, color: "#0D9488", fontWeight: 600 } : undefined,
      };
    });

    // 学生光束线
    const beamSeries = students.map((student, idx) => {
      const items = enriched.filter((e) => e.name === student).sort((a, b) => a.time - b.time);
      return {
        type: "line", name: student, z: 2, symbol: "none", smooth: 0.5,
        data: items.map((item) => [item.time, item.y]),
        lineStyle: { color: BEAM_COLORS[idx % BEAM_COLORS.length], width: 2.2, opacity: 0.28 },
        emphasis: { lineStyle: { width: 4.5, opacity: 0.8 } },
      };
    });

    // 散点（区分覆盖/生发）
    const scatterData = enriched.map((item) => ({
      value: [item.time, item.y, item.name, item.content, item.topic, item.isUncovered ? 1 : 0],
      itemStyle: {
        color: item.isUncovered ? "#F59E0B" : BEAM_COLORS[students.indexOf(item.name) % BEAM_COLORS.length],
        borderColor: item.isUncovered ? "#DC2626" : "transparent",
        borderWidth: item.isUncovered ? 2 : 0,
        opacity: 0.75,
        shadowBlur: item.isUncovered ? 8 : 4,
        shadowColor: item.isUncovered ? "rgba(220,38,38,0.3)" : "rgba(13,148,136,0.2)",
      },
      symbol: item.isUncovered ? "diamond" : "circle",
      symbolSize: item.isUncovered ? 14 : 10,
    }));

    // 教师标记线
    const teacherMarkLines = teacherMarks.map((tm) => ({
      xAxis: new Date(tm.time).getTime(),
      label: { formatter: `📌 ${tm.question || "教师提问"}`, fontSize: 9, color: "#D97706", position: "insideEndTop" as const },
      lineStyle: { type: "dashed" as const, color: "#F59E0B", width: 1.5 },
    }));

    // 爆发点标记
    const burstScatter = burstPoints.map((bp) => ({
      value: [new Date(bp.bucket_start).getTime(), maxLane + 0.4],
      itemStyle: { color: "#EF4444", shadowBlur: 12, shadowColor: "rgba(239,68,68,0.5)" },
      symbol: "pin", symbolSize: 20,
    }));

    chartRef.current.setOption({
      animationDuration: 800,
      animationEasing: "cubicOut",
      tooltip: {
        trigger: "item",
        confine: true,
        backgroundColor: "rgba(255,255,255,0.96)",
        borderColor: "#e2e8f0",
        textStyle: { fontSize: 12 },
        formatter(param: any) {
          const v = param?.value;
          if (!v) return "";
          const [time, , name, content, topic, isUnc] = v;
          const tag = isUnc ? '<span style="color:#DC2626;font-weight:600">🔥 生发问题</span>' : '<span style="color:#0D9488">✅ 任务覆盖</span>';
          return `<div style="max-width:280px"><b style="color:#0f172a">${escapeHtml(String(topic))}</b> ${tag}<br/><span style="color:#64748b">${escapeHtml(String(name))} · ${fmtTime(time as number)}</span><br/><div style="margin-top:4px;color:#334155;line-height:1.4">"${escapeHtml(String(content).slice(0, 80))}"</div></div>`;
        },
      },
      legend: { show: false },
      grid: { left: 16, right: 24, top: 32, bottom: 58 },
      xAxis: {
        type: "time",
        axisLabel: { fontSize: 10, formatter: fmtTime },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: true, lineStyle: { color: "rgba(148,163,184,0.1)" } },
      },
      yAxis: {
        type: "value",
        min: -maxLane - 1,
        max: maxLane + 1,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      dataZoom: [
        { type: "slider", start: 0, end: 100, height: 20, bottom: 8, fillerColor: "rgba(13,148,136,0.1)", borderColor: "#e2e8f0", handleStyle: { color: "#0D9488" }, textStyle: { fontSize: 10 } },
        { type: "inside", zoomOnMouseWheel: true, moveOnMouseMove: true },
      ],
      series: [
        ...laneSeries,
        ...beamSeries,
        {
          type: "scatter", data: scatterData, z: 4,
          emphasis: { scale: 1.6, label: { show: true, formatter: (p: any) => p.value?.[3]?.slice(0, 20) || "", color: "#0f172a", fontSize: 10, position: "top" } },
        },
        // 教师标记线（独立 series 避免渲染冲突）
        ...(teacherMarkLines.length > 0 ? [{
          type: "line", data: [] as any[], z: 3, silent: true, symbol: "none",
          markLine: { silent: true, symbol: ["none", "none"], data: teacherMarkLines },
        }] : []),
        ...(burstScatter.length > 0 ? [{
          type: "scatter", data: burstScatter, z: 5, silent: false,
          tooltip: { formatter: () => "🔥 提问爆发点" },
        }] : []),
      ],
    }, true);

    const resize = () => chartRef.current?.resize();
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); chartRef.current?.dispose(); chartRef.current = null; };
  }, [sessions, mainQuestionChain, teacherMarks, burstPoints, uncovered]);

  if (sessions.length === 0 || empty) {
    return <div className="flex w-full items-center justify-center rounded-lg bg-surface-2 text-sm text-text-tertiary" style={{ height }}>暂无可绘制的学生提问链条</div>;
  }

  return (
    <div className="relative">
      <div ref={ref} className="w-full" style={{ height }} aria-label="学生提问语义光束图" />
      {/* 图例说明 */}
      <div className="absolute top-2 right-4 flex items-center gap-3 text-[11px] text-text-tertiary">
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-primary" />任务覆盖</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rotate-45 bg-amber-500 border border-red-500" />生发问题</span>
        {teacherMarks.length > 0 && <span className="flex items-center gap-1"><span className="inline-block w-4 border-t-2 border-dashed border-amber-400" />教师提问</span>}
        {burstPoints.length > 0 && <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />爆发点</span>}
      </div>
    </div>
  );
};

export default StudentBeamChart;
