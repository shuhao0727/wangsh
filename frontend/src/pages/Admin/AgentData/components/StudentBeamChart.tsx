/**
 * 学生光束图 — 时间推进 | 主题汇聚 | 学生链条
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

interface Props {
  sessions: Session[];
}

const COLORS = ["#0D9488", "#7C3AED", "#3B82F6", "#F59E0B", "#EC4899", "#06B6D4", "#10B981", "#EF4444", "#8B5CF6", "#F43F5E"];
const STOP_WORDS = new Set(["怎么", "如何", "为什么", "什么", "可以", "这个", "那个", "一下", "请问", "老师", "就是", "还是", "如果", "没有", "问题", "请", "呢", "吗", "啊", "的", "了", "和", "与", "在", "是", "我", "要", "能"]);

const normalizeText = (text: string) => text
  .toLowerCase()
  .replace(/[\s\p{P}\p{S}]+/gu, "")
  .slice(0, 80);

const extractTerms = (text: string) => {
  const cleaned = text
    .replace(/[\s\p{P}\p{S}]+/gu, " ")
    .trim();
  const latinTerms = cleaned.match(/[a-zA-Z][a-zA-Z0-9_+#-]{1,}/g) || [];
  const chinese = cleaned.replace(/[a-zA-Z0-9_+#-]+/g, "").replace(/\s+/g, "");
  const chineseTerms: string[] = [];
  for (let size = 4; size >= 2; size -= 1) {
    for (let i = 0; i <= chinese.length - size; i += size) {
      const term = chinese.slice(i, i + size);
      if (!STOP_WORDS.has(term)) chineseTerms.push(term);
    }
  }
  return [...latinTerms, ...chineseTerms]
    .map((term) => term.toLowerCase())
    .filter((term) => term.length >= 2 && !STOP_WORDS.has(term))
    .slice(0, 8);
};

const similarity = (a: Set<string>, b: Set<string>) => {
  if (a.size === 0 || b.size === 0) return 0;
  let same = 0;
  a.forEach((term) => { if (b.has(term)) same += 1; });
  return same / Math.min(a.size, b.size);
};

const makeTopicLabel = (content: string, terms: string[]) => {
  if (terms.length > 0) return terms.slice(0, 3).join(" / ");
  const normalized = normalizeText(content);
  return normalized.slice(0, 14) || "未命名主题";
};

const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const formatTime = (value: number) => {
  const d = new Date(value);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const StudentBeamChart: React.FC<Props> = ({ sessions }) => {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  const empty = useMemo(() => sessions.every((session) => !session.messages.some((message) => message.message_type === "question")), [sessions]);

  useEffect(() => {
    if (!ref.current) return;
    if (!chartRef.current) chartRef.current = echarts.init(ref.current);

    const questions = sessions.flatMap((session) => {
      const name = session.user_name || session.session_id;
      return session.messages
        .filter((message) => message.message_type === "question" && message.content.trim())
        .map((message) => ({
          name,
          sessionId: session.session_id,
          className: session.class_name,
          content: message.content.trim(),
          time: new Date(message.created_at).getTime(),
          createdAt: message.created_at,
        }));
    }).filter((question) => Number.isFinite(question.time));

    if (questions.length === 0) {
      chartRef.current.clear();
      return;
    }

    questions.sort((a, b) => a.time - b.time);

    const clusters: Array<{ label: string; terms: Set<string>; items: typeof questions }> = [];
    questions.forEach((question) => {
      const terms = new Set(extractTerms(question.content));
      const normalized = normalizeText(question.content);
      const match = clusters.find((cluster) => {
        if (similarity(cluster.terms, terms) >= 0.45) return true;
        const clusterLabel = normalizeText(cluster.label);
        return normalized.includes(clusterLabel) || clusterLabel.includes(normalized.slice(0, 8));
      });
      if (match) {
        terms.forEach((term) => match.terms.add(term));
        match.items.push(question);
      } else {
        clusters.push({ label: makeTopicLabel(question.content, [...terms]), terms, items: [question] });
      }
    });

    const orderedClusters = clusters.sort((a, b) => b.items.length - a.items.length);
    const laneMap = new Map<string, { y: number; count: number }>();
    orderedClusters.forEach((cluster, index) => {
      const lane = index === 0 ? 0 : Math.ceil(index / 2) * (index % 2 === 1 ? -1 : 1);
      laneMap.set(cluster.label, { y: lane, count: cluster.items.length });
    });

    const enriched = orderedClusters.flatMap((cluster) => cluster.items.map((item) => ({ ...item, topic: cluster.label, ...laneMap.get(cluster.label)! })));
    const students = [...new Set(enriched.map((item) => item.name))];
    const maxCount = Math.max(...orderedClusters.map((cluster) => cluster.items.length), 1);
    const maxLane = Math.max(1, ...[...laneMap.values()].map((lane) => Math.abs(lane.y)));

    const topicGuideSeries = orderedClusters.map((cluster) => {
      const lane = laneMap.get(cluster.label)!;
      return {
        type: "line",
        name: cluster.label,
        data: [[questions[0].time, lane.y], [questions[questions.length - 1].time, lane.y]],
        lineStyle: { color: lane.y === 0 ? "rgba(13,148,136,0.22)" : "rgba(148,163,184,0.16)", width: lane.count >= 3 ? 2 : 1, type: "dashed" },
        symbol: "none",
        silent: true,
        z: 0,
      };
    });

    const beamSeries = students.map((student, index) => {
      const items = enriched.filter((item) => item.name === student).sort((a, b) => a.time - b.time);
      return {
        type: "line",
        name: student,
        data: items.map((item) => [item.time, item.y, item.topic, item.content, item.count]),
        smooth: 0.55,
        symbol: "none",
        lineStyle: { color: COLORS[index % COLORS.length], width: 2.4, opacity: 0.32 },
        emphasis: { lineStyle: { width: 4, opacity: 0.75 } },
        z: 2,
      };
    });

    const scatterData = enriched.map((item) => ({
      value: [item.time, item.y, item.name, item.content, item.topic, item.count],
      name: item.topic,
      itemStyle: {
        color: COLORS[students.indexOf(item.name) % COLORS.length],
        opacity: 0.62 + (item.count / maxCount) * 0.32,
        shadowBlur: 4 + Math.min(item.count, 8) * 2,
        shadowColor: "rgba(13,148,136,0.28)",
      },
    }));

    chartRef.current.setOption({
      animationDuration: 650,
      animationEasing: "cubicOut",
      tooltip: {
        trigger: "item",
        confine: true,
        formatter(param: any) {
          const value = param?.value;
          if (!value) return "";
          const [time, , name, content, topic, count] = value;
          return `<b>${escapeHtml(String(topic))}</b><br/>${escapeHtml(String(name))} · ${formatTime(time)}<br/><span style="color:#64748b">${escapeHtml(String(content))}</span><br/><span style="color:#F59E0B">同主题 ${Number(count) || 0} 条提问</span>`;
        },
      },
      grid: { left: 16, right: 24, top: 24, bottom: 58 },
      xAxis: {
        type: "time",
        axisLabel: { fontSize: 10, formatter: formatTime },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: true, lineStyle: { color: "rgba(148,163,184,0.14)" } },
        name: "时间",
        nameLocation: "start",
        nameTextStyle: { fontSize: 11, color: "#94a3b8" },
      },
      yAxis: {
        type: "value",
        min: -maxLane - 0.7,
        max: maxLane + 0.7,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      dataZoom: [
        { type: "slider", start: 0, end: 100, height: 20, bottom: 8, fillerColor: "rgba(13,148,136,0.12)", borderColor: "#e2e8f0", handleStyle: { color: "#0D9488" }, textStyle: { fontSize: 10 }, moveOnMouseWheel: false },
        { type: "inside", zoomOnMouseWheel: true, moveOnMouseMove: true },
      ],
      series: [
        ...topicGuideSeries,
        ...beamSeries,
        {
          type: "scatter",
          data: scatterData,
          symbolSize: (value: any) => 10 + Math.min(value?.[5] || 1, 8) * 2.4,
          label: {
            show: true,
            formatter(param: any) {
              const count = param.value?.[5] || 0;
              return count >= 2 ? param.value?.[4] : "";
            },
            color: "#0f766e",
            fontSize: 10,
            fontWeight: 600,
            position: "right",
          },
          emphasis: {
            scale: 1.55,
            label: { show: true, formatter: (param: any) => `${param.value?.[2] || ""}：${param.value?.[3] || ""}`, color: "#0f172a", fontSize: 11 },
          },
          z: 4,
        },
      ],
    }, true);
  }, [sessions]);

  useEffect(() => {
    const resize = () => chartRef.current?.resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  if (sessions.length === 0 || empty) {
    return <div className="flex h-[360px] w-full items-center justify-center rounded-lg bg-surface-2 text-sm text-text-tertiary">暂无可绘制的学生提问链条</div>;
  }

  return <div ref={ref} className="h-[360px] w-full" aria-label="学生提问语义光束图" />;
};

export default StudentBeamChart;
