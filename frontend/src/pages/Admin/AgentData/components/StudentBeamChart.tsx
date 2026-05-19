/**
 * 学生光束图 — 曲线·密度亮度·缩放·中央趋向
 * X=时间 | 同时间堆叠 | 曲线连接 | 越多越亮 | dataZoom | 中央=整体趋向
 */
import React, { useEffect, useRef } from "react";
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

const COLORS = ["#0D9488","#7C3AED","#3B82F6","#F59E0B","#EC4899","#06B6D4","#10B981","#EF4444","#8B5CF6","#F43F5E"];

interface Props { sessions: Session[] }

const StudentBeamChart: React.FC<Props> = ({ sessions }) => {
  const ref = useRef<HTMLDivElement>(null);
  const cRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current || sessions.length === 0) return;
    if (!cRef.current) cRef.current = echarts.init(ref.current);

    // Flatten all questions
    const allQ: Array<{ name: string; time: string; content: string }> = [];
    const names = new Set<string>();
    sessions.forEach((s) => {
      const name = s.user_name || s.session_id;
      names.add(name);
      s.messages.filter((m) => m.message_type === "question").forEach((m) => {
        allQ.push({ name, time: m.created_at, content: m.content.slice(0, 36) });
      });
    });
    if (allQ.length === 0) return;

    // Bucket by minute
    const buckets: Record<string, typeof allQ> = {};
    allQ.forEach((q) => {
      const b = q.time.slice(0, 16);
      if (!buckets[b]) buckets[b] = [];
      buckets[b].push(q);
    });

    const SPACING = 0.5;
    const times = Object.keys(buckets).sort();
    let maxY = 0;
    // Assign Y within each bucket with tighter spacing
    const yMap: Record<string, number> = {};
    times.forEach((t) => {
      buckets[t].forEach((item, idx) => {
        yMap[item.name + "|" + t] = idx * SPACING;
      });
      const bucketMaxY = (buckets[t].length - 1) * SPACING;
      if (bucketMaxY > maxY) maxY = bucketMaxY;
    });

    const nameArr = [...names];
    const scatterData: any[] = [];
    const lineSeries: any[] = [];

    nameArr.forEach((name, si) => {
      const pts = allQ.filter((q) => q.name === name);
      if (pts.length < 1) return;
      pts.sort((a, b) => a.time.localeCompare(b.time));
      const color = COLORS[si % COLORS.length];

      pts.forEach((p) => {
        const b = p.time.slice(0, 16);
        const y = yMap[p.name + "|" + b] ?? 0;
        const crowd = buckets[b]?.length || 1;
        const alpha = 0.6 + (crowd / Math.max(maxY / SPACING + 1, 1)) * 0.4;
        scatterData.push({ value: [p.time.slice(11, 16), y, p.name, p.content, crowd], itemStyle: { color, opacity: alpha }, name: p.name, symbolSize: 9 + Math.min(crowd, 8) * 2 });
      });

      // Curved line
      if (pts.length >= 2) {
        lineSeries.push({
          type: "line",
          data: pts.map((p) => { const b = p.time.slice(0, 16); return [p.time.slice(11, 16), yMap[p.name + "|" + b] ?? 0]; }),
          lineStyle: { color, width: 2.5, opacity: 0.3 }, smooth: 0.4, symbol: "none", silent: true, z: 1,
        });
      }
    });

    const timeLabels = times.map((t) => t.slice(11, 16));
    const step = Math.max(1, Math.floor(timeLabels.length / 14));

    cRef.current.setOption({
      tooltip: {
        formatter(p: any) {
          if (!p?.value) return "";
          const [, , name, content, crowd] = p.value;
          return `<b>${name}</b><br/>${content}${crowd > 1 ? `<br/><span style="color:#F59E0B">同时段 ${crowd} 人</span>` : ""}`;
        },
      },
      grid: { left: 6, right: 6, top: 30, bottom: 58 },
      xAxis: { type: "category", data: timeLabels, name: "时间", nameLocation: "start", nameTextStyle: { fontSize: 11 }, axisLabel: { fontSize: 10, interval: step }, axisLine: { show: false }, axisTick: { show: false } },
      yAxis: { show: false, min: -0.3, max: maxY + 0.3 },
      dataZoom: [
        { type: "slider", start: 0, end: 100, height: 20, bottom: 8, fillerColor: "rgba(13,148,136,0.1)", borderColor: "#e2e8f0", handleStyle: { color: "#0D9488" }, textStyle: { fontSize: 10 }, moveOnMouseWheel: false },
        { type: "inside", zoomOnMouseWheel: true, moveOnMouseMove: true },
      ],
      series: [
        ...lineSeries,
        {
          type: "scatter", data: scatterData, symbolSize: (v: any) => Math.max(10, ((v?.[4] || 1)) * 2 + 8),
          label: { show: true, formatter(p: any) { const c = p.value?.[4] || 0; return c >= 3 ? c + "人" : ""; }, fontSize: 10, position: "right", color: "#F59E0B", fontWeight: "bold" },
          emphasis: { scale: 1.6, label: { show: true, formatter(p: any) { return (p.value?.[2] || "") + ": " + (p.value?.[3] || ""); }, fontSize: 11 } },
          z: 2,
        },
      ],
    }, true);
  }, [sessions]);

  useEffect(() => {
    const onResize = () => cRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); cRef.current?.dispose(); cRef.current = null; };
  }, []);

  return <div ref={ref} className="h-[360px] w-full" />;
};

export default StudentBeamChart;
