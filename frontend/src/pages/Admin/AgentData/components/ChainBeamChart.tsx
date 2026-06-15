/**
 * 问题链光束图 — 学生轨迹汇聚版
 *
 * 每条彩色线 = 一个学生的问题链
 * 相似问题（不同学生、时间差≤2分钟）合并为共享点
 * 多条线在共享点处汇聚 → 形成"光束"效果
 * 教师提问用红色竖虚线标记
 */
import React, { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts";
import dayjs from "dayjs";
import { getAgentChartTheme } from "./chartTheme";
import { escapeHtml, shortText } from "../normalize";

/* ─── 类型 ─── */
interface MergedGroup {
  group_id: number;
  topic_label: string;
  merged_time: string; // ISO timestamp
  question_ids: number[];
  student_ids: (number | null)[];
  representative_question: string;
  questions: Array<{ message_id: number; user_id: number | null; content: string; created_at: string }>;
  member_count: number;
}

interface StudentChain {
  user_id: number | null;
  user_name: string;
  questions: Array<{ message_id: number; content: string; created_at: string }>;
}

interface TeacherMark {
  time: string;
  question: string;
}

interface ChainBeamChartProps {
  mergedGroups: MergedGroup[];
  studentChains: StudentChain[];
  teacherMarks: TeacherMark[];
  startTime?: string; // ISO, 用于计算相对分钟
}

/* ─── 颜色 ─── */
const BEAM_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#e11d48", "#a855f7", "#0ea5e9", "#65a30d",
];

/* ─── 学生数量上限（60人班级取 Top 25 活跃学生，避免卡顿）─── */
const MAX_STUDENTS = 25;

const ChainBeamChart: React.FC<ChainBeamChartProps> = ({ mergedGroups, studentChains, teacherMarks, startTime }) => {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  // 学生列表（去重、按提问数排序、取 Top N 避免 60 人班级卡顿）
  const students = useMemo(() => {
    const seen = new Map<number | null, string>();
    const countMap = new Map<number | null, number>();
    studentChains.forEach((sc) => {
      if (!seen.has(sc.user_id)) seen.set(sc.user_id, sc.user_name);
      countMap.set(sc.user_id, (countMap.get(sc.user_id) || 0) + sc.questions.length);
    });
    return [...seen.entries()]
      .sort((a, b) => (countMap.get(b[0]) || 0) - (countMap.get(a[0]) || 0))
      .slice(0, MAX_STUDENTS)
      .map(([id, name], idx) => ({ id, name, idx }));
  }, [studentChains]);

  // 基准时间（用于计算相对分钟）
  const baseTime = useMemo(() => {
    if (startTime) return dayjs(startTime).valueOf();
    // 取所有数据中最早的时间
    let earliest = Infinity;
    mergedGroups.forEach((g) => {
      const t = dayjs(g.merged_time).valueOf();
      if (t < earliest) earliest = t;
    });
    studentChains.forEach((sc) => {
      sc.questions.forEach((q) => { const t = dayjs(q.created_at).valueOf(); if (t < earliest) earliest = t; });
    });
    return Number.isFinite(earliest) ? earliest : Date.now();
  }, [mergedGroups, studentChains, startTime]);

  const toMinute = (iso: string) => Math.round((dayjs(iso).valueOf() - baseTime) / 60000);

  // 构建合并点索引：message_id → group
  const messageToGroup = useMemo(() => {
    const map = new Map<number, MergedGroup>();
    mergedGroups.forEach((g) => { g.question_ids.forEach((id) => map.set(id, g)); });
    return map;
  }, [mergedGroups]);

  // 为每个合并组计算 Y 坐标
  // 独立点(1人): Y = 该学生的 idx
  // 共享点(多人): Y = 参与学生 idx 的平均值
  const getStudentIdx = (userId: number | null) => students.findIndex((s) => s.id === userId);

  const groupYMap = useMemo(() => {
    const map = new Map<number, number>();
    mergedGroups.forEach((g) => {
      if (g.member_count <= 1) {
        const idx = getStudentIdx(g.student_ids[0]);
        map.set(g.group_id, idx >= 0 ? idx : 0);
      } else {
        const yValues = g.student_ids.map((sid) => getStudentIdx(sid)).filter((i) => i >= 0);
        const avgY = yValues.length > 0 ? yValues.reduce((s, v) => s + v, 0) / yValues.length : students.length / 2;
        map.set(g.group_id, avgY);
      }
    });
    return map;
  }, [mergedGroups, students]);

  // 统计
  const totalQuestions = studentChains.reduce((s, sc) => s + sc.questions.length, 0);
  const sharedCount = mergedGroups.filter((g) => g.member_count > 1).length;

  useEffect(() => {
    if (!ref.current || students.length === 0) return;
    if (!chartRef.current) chartRef.current = echarts.init(ref.current);
    const theme = getAgentChartTheme();

    // 计算时间范围
    let maxMinute = 40;
    studentChains.forEach((sc) => { sc.questions.forEach((q) => { maxMinute = Math.max(maxMinute, toMinute(q.created_at) + 2); }); });

    // 教师提问竖线
    const teacherLines = teacherMarks.map((m, i) => ({
      xAxis: toMinute(m.time),
      label: { formatter: `T${i + 1}`, position: "start" as const, fontSize: 10, color: theme.teacher || "#ef4444", fontWeight: 700 },
      lineStyle: { color: theme.teacher || "#ef4444", width: 1.5, type: "dashed" as const, opacity: 0.5 },
    }));

    // 为每个学生生成 series
    const series: any[] = [];

    students.forEach((student, sIdx) => {
      const color = BEAM_COLORS[sIdx % BEAM_COLORS.length];
      const chain = studentChains.find((sc) => sc.user_id === student.id);
      if (!chain || chain.questions.length === 0) return;

      // 构建该学生的点序列（按时间排序）
      const points = chain.questions
        .map((q) => {
          const group = messageToGroup.get(q.message_id);
          const minute = toMinute(q.created_at);
          const y = group ? (groupYMap.get(group.group_id) ?? sIdx) : sIdx;
          return { minute, y, question: q.content, group, messageId: q.message_id };
        })
        .sort((a, b) => a.minute - b.minute);

      series.push({
        name: student.name,
        type: "line",
        smooth: 0.4,
        symbol: "circle",
        symbolSize: (value: any, params: any) => {
          const p = points[params.dataIndex];
          return p?.group && p.group.member_count > 1 ? 8 + p.group.member_count : 6;
        },
        lineStyle: { color, width: 2, opacity: 0.6 },
        itemStyle: { color, borderColor: "#fff", borderWidth: 1.5 },
        emphasis: {
          lineStyle: { width: 3.5, opacity: 1 },
          itemStyle: { borderWidth: 2, shadowBlur: 8, shadowColor: color },
        },
        data: points.map((p) => ({
          value: [p.minute, p.y],
          question: p.question,
          studentName: student.name,
          group: p.group,
        })),
        z: 5 + sIdx,
      });
    });

    // 共享点高亮层
    const sharedData = mergedGroups.filter((g) => g.member_count > 1).map((g) => ({
      value: [toMinute(g.merged_time), groupYMap.get(g.group_id) ?? 0],
      symbolSize: 10 + g.member_count * 2,
      group: g,
    }));

    series.push({
      name: "共享汇聚点",
      type: "scatter",
      symbol: "circle",
      symbolSize: (val: any, params: any) => params.data.symbolSize,
      itemStyle: { color: "rgba(100,116,139,0.12)", borderColor: "rgba(100,116,139,0.4)", borderWidth: 1.5 },
      emphasis: { itemStyle: { borderColor: "#475569", borderWidth: 2, shadowBlur: 12 } },
      data: sharedData,
      z: 3,
    });

    // 附加教师提问 markLine 到第一个 series
    if (series.length > 0 && teacherLines.length > 0) {
      series[0].markLine = { silent: true, symbol: ["none", "none"], data: teacherLines };
    }

    chartRef.current.setOption({
      animationDuration: 1200,
      animationEasing: "cubicOut",
      tooltip: {
        trigger: "item", confine: true,
        backgroundColor: theme.surfaceElevated || "#fff", borderColor: theme.border || "#e2e8f0",
        textStyle: { color: theme.textBase || "#1e293b", fontSize: 12 },
        formatter: (params: any) => {
          const d = params.data;
          if (!d) return "";
          const g = d.group as MergedGroup | undefined;
          if (g && g.member_count > 1) {
            const names = g.student_ids.map((sid) => students.find((s) => s.id === sid)?.name || "未知").join("、");
            return `<b>${escapeHtml(g.topic_label)}</b> · 第${toMinute(g.merged_time)}分钟` +
              `<br/><span style="color:#8b5cf6;font-weight:600">🔗 ${g.member_count}人汇聚</span>` +
              `<br/><span style="color:#64748b">学生：${escapeHtml(names)}</span>` +
              `<br/>「${escapeHtml(shortText(g.representative_question, 40))}」`;
          }
          const name = d.studentName || params.seriesName || "";
          const q = d.question || "";
          const min = Array.isArray(d.value) ? d.value[0] : 0;
          return `<b style="color:${params.color}">${escapeHtml(name)}</b>` +
            `<br/><span style="color:#64748b">第 ${min} 分钟</span>` +
            (q ? `<br/>「${escapeHtml(shortText(q, 40))}」` : "");
        },
      },
      legend: {
        type: "scroll", top: 4, left: 80, right: 40,
        itemWidth: 14, itemHeight: 8,
        textStyle: { color: theme.textSecondary || "#64748b", fontSize: 11 },
      },
      grid: { left: 50, right: 30, top: 50, bottom: 40 },
      xAxis: {
        type: "value", name: "时间（分钟）", nameLocation: "middle", nameGap: 28,
        nameTextStyle: { color: theme.textSecondary || "#64748b", fontSize: 11 },
        min: 0, max: maxMinute, interval: 5,
        axisLabel: { color: theme.textSecondary || "#94a3b8", fontSize: 11, formatter: "{value}'" },
        axisLine: { lineStyle: { color: theme.border || "#e2e8f0" } },
        axisTick: { show: false },
        splitLine: { lineStyle: { type: "dashed", color: theme.grid || "#f1f5f9" } },
      },
      yAxis: {
        type: "value", show: false,
        min: -0.5, max: students.length - 0.5,
      },
      series,
    }, true);
  }, [students, studentChains, mergedGroups, teacherMarks, baseTime, groupYMap, messageToGroup]);

  // resize
  useEffect(() => {
    const resize = () => chartRef.current?.resize();
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); chartRef.current?.dispose(); chartRef.current = null; };
  }, []);

  if (students.length === 0) {
    return <section className="rounded-2xl border border-dashed border-border-secondary bg-surface/80 p-6 text-center text-sm text-text-tertiary">暂无问题链数据</section>;
  }

  return (
    <section className="rounded-2xl border border-primary/15 bg-surface/90 p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-base">学生问题链光束图</h2>
          <p className="mt-1 text-xs text-text-tertiary">
            每条线=一个学生的思考路径，汇聚点=多个学生问了相似问题
          </p>
        </div>
        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
          {students.length} 学生 · {sharedCount} 汇聚点
        </span>
      </div>
      <div ref={ref} className="h-[520px] w-full" aria-label="学生问题链光束图" />
      <div className="mt-3 grid gap-2 rounded-xl border border-primary/10 bg-primary-soft/20 p-2 text-sm sm:grid-cols-4">
        {[
          { label: "参与学生", value: `${students.length} 人` },
          { label: "总提问数", value: `${totalQuestions} 次` },
          { label: "共享汇聚点", value: `${sharedCount} 个` },
          { label: "教师提问", value: `${teacherMarks.length} 个` },
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

export default ChainBeamChart;
