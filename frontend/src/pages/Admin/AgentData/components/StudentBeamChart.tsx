/**
 * 学生语义光束图
 * 教师问题链固定为中轴，真实学生问题链围绕中轴形成连续波形。
 */
import React, { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts";
import useDocumentDarkMode from "@/hooks/useDocumentDarkMode";
import { getAgentChartTheme } from "./chartTheme";
import type { BeamRangeSelection, BeamStudentChain, BeamTeacherAnchor, BeamRelationType } from "../types";

type BurstPoint = { bucket_start: string; question_count: number; top_questions?: Array<{ question: string; count: number }> };
type EnrichedBeamQuestion = {
  chainId: string;
  studentName: string;
  content: string;
  time: number;
  y: number;
  relationType: BeamRelationType;
  relationLabel: string;
  teacherQuestion?: string;
  teacherTime?: string;
  isUncovered?: boolean;
  evidenceIds?: number[];
  colorIndex: number;
};

interface Props {
  height?: number;
  teacherAnchors?: BeamTeacherAnchor[];
  studentChains?: BeamStudentChain[];
  burstPoints?: BurstPoint[];
  manualRange?: { startAt?: string; endAt?: string } | null;
  onRangeChange?: (selection: BeamRangeSelection) => void;
}

const escapeHtml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmtTime = (v: number) => { const d = new Date(v); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const smoothStep = (value: number) => value * value * (3 - 2 * value);
const relationOffset: Record<BeamRelationType, number> = {
  clarify: -0.28,
  follow_up: 0.28,
  apply: 0.72,
  debug: -0.86,
  challenge: -0.62,
  transfer: 1,
  extend: 1.16,
  off_track: -1.18,
};

const StudentBeamChart: React.FC<Props> = ({
  height = 520, teacherAnchors = [], studentChains = [], burstPoints = [], manualRange, onRangeChange,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const onRangeChangeRef = useRef(onRangeChange);
  const emitRangeRef = useRef<((start?: number, end?: number, source?: BeamRangeSelection["source"]) => void) | null>(null);
  const isDark = useDocumentDarkMode();

  const empty = useMemo(
    () => studentChains.every((chain) => chain.nodes.length === 0),
    [studentChains],
  );

  useEffect(() => {
    onRangeChangeRef.current = onRangeChange;
  }, [onRangeChange]);

  useEffect(() => {
    if (!ref.current || empty) return;
    const theme = getAgentChartTheme();
    if (chartRef.current) { chartRef.current.dispose(); chartRef.current = null; }
    chartRef.current = echarts.init(ref.current);

    const chains = studentChains.filter((chain) => chain.nodes.length > 0);

    const teacherQuestions = teacherAnchors
      .map((anchor, index) => ({
        id: anchor.id || `teacher-${index}`,
        content: anchor.question || "教师提问",
        time: new Date(anchor.time).getTime(),
        label: anchor.label || `T${index + 1}`,
      }))
      .filter((item) => Number.isFinite(item.time))
      .sort((a, b) => a.time - b.time);

    const allNodeTimes = chains.flatMap((chain) => chain.nodes.map((node) => new Date(node.time).getTime())).filter(Number.isFinite);
    if (allNodeTimes.length === 0) { chartRef.current.clear(); return; }
    const minTime = Math.min(...allNodeTimes, teacherQuestions[0]?.time ?? allNodeTimes[0]);
    const maxTime = Math.max(...allNodeTimes, teacherQuestions[teacherQuestions.length - 1]?.time ?? allNodeTimes[allNodeTimes.length - 1]);
    const maxLane = 1.45;

    const nearestTeacher = (time: number) => {
      if (teacherQuestions.length === 0) return undefined;
      return teacherQuestions.reduce((best, current) => (
        Math.abs(current.time - time) < Math.abs(best.time - time) ? current : best
      ), teacherQuestions[0]);
    };

    const enriched = chains.flatMap((chain, chainIndex) => chain.nodes
      .map((node, nodeIndex): EnrichedBeamQuestion | null => {
        const time = new Date(node.time).getTime();
        if (!Number.isFinite(time)) return null;
        const teacher = nearestTeacher(time);
        const baseOffset = relationOffset[node.relationType] ?? relationOffset.follow_up;
        const wave = Math.sin((nodeIndex + 1) * 1.15 + chainIndex * 0.8) * 0.12;
        const y = clamp(baseOffset + wave, -maxLane, maxLane);
        return {
          chainId: chain.id,
          studentName: chain.studentName,
          content: node.content,
          time,
          y,
          relationType: node.relationType,
          relationLabel: node.relationLabel,
          teacherQuestion: node.teacherQuestion || teacher?.content,
          teacherTime: node.teacherTime || (teacher ? new Date(teacher.time).toISOString() : undefined),
          isUncovered: Boolean(node.isUncovered),
          evidenceIds: node.evidenceIds || [],
          colorIndex: chainIndex,
        };
      })
      .filter((item): item is EnrichedBeamQuestion => item !== null))
      .sort((a, b) => a.time - b.time);

    if (enriched.length === 0) { chartRef.current.clear(); return; }

    const emitRange = (start?: number, end?: number, source: BeamRangeSelection["source"] = "zoom") => {
      const callback = onRangeChangeRef.current;
      if (!callback) return;
      const startAt = Number.isFinite(start) ? start : undefined;
      const endAt = Number.isFinite(end) ? end : undefined;
      const inRange = enriched
        .filter((item) => (startAt === undefined || item.time >= startAt) && (endAt === undefined || item.time <= endAt))
        .sort((a, b) => a.time - b.time);
      const rangeTeachers = teacherQuestions
        .filter((teacher) => (startAt === undefined || teacher.time >= startAt) && (endAt === undefined || teacher.time <= endAt))
        .map((teacher) => ({
          id: teacher.id,
          time: new Date(teacher.time).toISOString(),
          question: teacher.content,
          label: teacher.label,
        }));
      callback({
        startAt: startAt === undefined ? undefined : new Date(startAt).toISOString(),
        endAt: endAt === undefined ? undefined : new Date(endAt).toISOString(),
        questions: inRange.map((item) => ({
          chainId: item.chainId,
          time: new Date(item.time).toISOString(),
          studentName: item.studentName,
          content: item.content,
          relationType: item.relationType,
          relationLabel: item.relationLabel,
          teacherQuestion: item.teacherQuestion,
          teacherTime: item.teacherTime,
          isUncovered: item.isUncovered,
          evidenceIds: item.evidenceIds,
        })),
        teacherAnchors: rangeTeachers,
        source,
      });
    };
    emitRangeRef.current = emitRange;

    // 学生光束线
    const buildContinuousBeamData = (items: Array<typeof enriched[number]>, studentIndex: number) => {
      if (items.length <= 1) return items.map((item) => [item.time, item.y]);
      const range = Math.max(maxTime - minTime, 1);
      const data: number[][] = [];
      items.forEach((item, index) => {
        if (index === 0) {
          data.push([item.time, item.y]);
          return;
        }
        const prev = items[index - 1];
        const steps = clamp(Math.round(((item.time - prev.time) / range) * 120), 16, 44);
        const direction = studentIndex % 2 === 0 ? 1 : -1;
        const amplitude = clamp(Math.abs(item.y - prev.y) * 0.08 + 0.05, 0.05, 0.18);
        for (let step = 1; step <= steps; step += 1) {
          const progress = step / steps;
          const eased = smoothStep(progress);
          const x = prev.time + (item.time - prev.time) * progress;
          const baseY = prev.y + (item.y - prev.y) * eased;
          const wave = Math.sin(progress * Math.PI) * amplitude * direction;
          data.push([x, baseY + wave]);
        }
      });
      return data;
    };

    const trajectorySeries = chains.map((chain, idx) => {
      const items = enriched.filter((e) => e.chainId === chain.id).sort((a, b) => a.time - b.time);
      return {
        type: "line", name: `${chain.studentName} 趋势`, z: 1, symbol: "none", smooth: false, silent: true,
        data: buildContinuousBeamData(items, idx),
        lineStyle: { color: theme.beamColors[idx % theme.beamColors.length], width: 5, opacity: 0.1 },
      };
    });

    const beamSeries = chains.map((chain, idx) => {
      const items = enriched.filter((e) => e.chainId === chain.id).sort((a, b) => a.time - b.time);
      return {
        type: "line", name: chain.studentName, z: 2, symbol: "none", smooth: false,
        data: buildContinuousBeamData(items, idx),
        lineStyle: { color: theme.beamColors[idx % theme.beamColors.length], width: 2.2, opacity: 0.38 },
        endLabel: { show: true, formatter: chain.studentName, color: theme.beamColors[idx % theme.beamColors.length], fontWeight: 600 },
        emphasis: { lineStyle: { width: 4.5, opacity: 0.85 } },
      };
    });

    const teacherAxisSeries = [{
      type: "line",
      name: "教师提问主线",
      z: 3,
      symbol: "none",
      smooth: false,
      silent: true,
      data: [[minTime, 0], [maxTime, 0]],
      lineStyle: { color: theme.teacher, width: 5, opacity: 0.88, shadowBlur: 8, shadowColor: theme.teacherSoft },
      emphasis: { lineStyle: { width: 6.5, opacity: 1 } },
    }];

    const teacherPointSeries = teacherQuestions.length > 0 ? [{
      type: "scatter",
      name: "教师锚点",
      z: 6,
      symbol: "circle",
      symbolSize: 12,
      data: teacherQuestions.map((item) => ({
        value: [item.time, 0, "教师", item.content, "教师主线", 0],
        itemStyle: { color: theme.teacher, borderColor: theme.surface, borderWidth: 2 },
      })),
      label: { show: true, formatter: (p: any) => `T${p.dataIndex + 1}`, color: theme.teacher, fontSize: 10, position: "top" },
      tooltip: {
        formatter(param: any) {
          const v = param?.value;
          if (!v) return "";
          const [time, , , content] = v;
          return `<div style="max-width:300px"><b style="color:${theme.teacher}">教师提问主线</b><br/><span style="color:${theme.textSecondary}">${fmtTime(time as number)}</span><br/><div style="margin-top:4px;color:${theme.textMuted};line-height:1.4">"${escapeHtml(String(content).slice(0, 90))}"</div></div>`;
        },
      },
    }] : [];

    // 散点（区分覆盖/生发）
    const scatterData = enriched.map((item) => ({
      value: [item.time, item.y, item.studentName, item.content, item.relationLabel, item.isUncovered ? 1 : 0, item.teacherQuestion || ""],
      itemStyle: {
        color: item.isUncovered ? theme.uncovered : theme.beamColors[item.colorIndex % theme.beamColors.length],
        borderColor: item.isUncovered ? theme.uncoveredBorder : "transparent",
        borderWidth: item.isUncovered ? 2 : 0,
        opacity: 0.75,
        shadowBlur: item.isUncovered ? 8 : 4,
        shadowColor: item.isUncovered ? theme.uncoveredShadow : theme.laneLine,
      },
      symbol: item.isUncovered ? "diamond" : "circle",
      symbolSize: item.isUncovered ? 14 : 10,
    }));

    // 爆发点标记
    const burstScatter = burstPoints.map((bp) => ({
      value: [new Date(bp.bucket_start).getTime(), maxLane + 0.4],
      itemStyle: { color: theme.burst, shadowBlur: 12, shadowColor: theme.burstGlow },
      symbol: "pin", symbolSize: 20,
    }));

    chartRef.current.setOption({
      animationDuration: 800,
      animationEasing: "cubicOut",
      tooltip: {
        trigger: "item",
        confine: true,
        backgroundColor: theme.surfaceElevated,
        borderColor: theme.border,
        textStyle: { fontSize: 12, color: theme.textBase },
        formatter(param: any) {
          const v = param?.value;
          if (!v) return "";
          const [time, , name, content, relation, isUnc, teacherQuestion] = v;
          const tag = isUnc
            ? `<span style="color:${theme.uncoveredBorder};font-weight:600">🔥 生发问题</span>`
            : `<span style="color:${theme.primary}">学生问题链</span>`;
          const teacherLine = teacherQuestion ? `<br/><span style="color:${theme.teacher}">关联教师：${escapeHtml(String(teacherQuestion).slice(0, 40))}</span>` : "";
          return `<div style="max-width:300px"><b style="color:${theme.textBase}">${escapeHtml(String(relation))}</b> ${tag}<br/><span style="color:${theme.textSecondary}">${escapeHtml(String(name))} · ${fmtTime(time as number)}</span>${teacherLine}<br/><div style="margin-top:4px;color:${theme.textMuted};line-height:1.4">"${escapeHtml(String(content).slice(0, 90))}"</div></div>`;
        },
      },
      legend: { show: false },
      toolbox: {
        show: true,
        right: 12,
        top: 4,
        itemSize: 14,
        feature: {
          brush: {
            type: ["rect", "clear"],
            title: { rect: "框选时间段", clear: "清除框选" },
          },
        },
        iconStyle: { borderColor: theme.textSecondary },
        emphasis: { iconStyle: { borderColor: theme.primary } },
      },
      grid: { left: 16, right: 24, top: 36, bottom: 62 },
      xAxis: {
        type: "time",
        axisLabel: { fontSize: 10, formatter: fmtTime, color: theme.textSecondary },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: true, lineStyle: { color: theme.grid } },
      },
      yAxis: {
        type: "value",
        min: -1.65,
        max: 2.05,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      dataZoom: [
        { type: "slider", start: 0, end: 100, height: 20, bottom: 8, fillerColor: theme.primarySoft, borderColor: theme.border, handleStyle: { color: theme.primary }, textStyle: { fontSize: 10, color: theme.textSecondary } },
        { type: "inside", zoomOnMouseWheel: true, moveOnMouseMove: true },
      ],
      brush: {
        xAxisIndex: 0,
        brushMode: "single",
        transformable: true,
        brushStyle: {
          borderColor: theme.primary,
          color: `color-mix(in srgb, ${theme.primary} 8%, transparent)`,
          borderWidth: 1.5,
        },
      },
      series: [
        ...teacherAxisSeries,
        ...trajectorySeries,
        ...beamSeries,
        {
          type: "scatter", data: scatterData, z: 4,
          emphasis: { scale: 1.6, label: { show: true, formatter: (p: any) => p.value?.[3]?.slice(0, 20) || "", color: theme.textBase, fontSize: 10, position: "top" } },
        },
        ...teacherPointSeries,
        ...(burstScatter.length > 0 ? [{
          type: "scatter", data: burstScatter, z: 5, silent: false,
          tooltip: { formatter: () => `<span style="color:${theme.burst};font-weight:600">提问爆发点</span>` },
        }] : []),
      ],
    }, true);

    emitRange(minTime, maxTime, "initial");

    chartRef.current.off("datazoom");
    chartRef.current.on("datazoom", () => {
      const optionState = chartRef.current?.getOption() as any;
      const zoom = optionState?.dataZoom?.[0];
      const startValue = Number(zoom?.startValue);
      const endValue = Number(zoom?.endValue);
      if (Number.isFinite(startValue) && Number.isFinite(endValue)) {
        emitRange(startValue, endValue, "zoom");
        return;
      }
      const startPercent = Number(zoom?.start ?? 0);
      const endPercent = Number(zoom?.end ?? 100);
      emitRange(minTime + (maxTime - minTime) * (startPercent / 100), minTime + (maxTime - minTime) * (endPercent / 100), "zoom");
    });

    chartRef.current.off("brushEnd");
    chartRef.current.on("brushEnd", (event: any) => {
      const coordRange = event?.areas?.[0]?.coordRange;
      if (!coordRange) {
        emitRange(minTime, maxTime, "brush");
        return;
      }
      const xRange = Array.isArray(coordRange[0]) ? coordRange[0] : coordRange;
      if (Array.isArray(xRange) && xRange.length >= 2) {
        const start = Number(xRange[0]);
        const end = Number(xRange[1]);
        if (Number.isFinite(start) && Number.isFinite(end)) {
          emitRange(Math.min(start, end), Math.max(start, end), "brush");
        }
      }
    });

    const resize = () => chartRef.current?.resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      emitRangeRef.current = null;
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, [teacherAnchors, studentChains, burstPoints, isDark]);

  useEffect(() => {
    if (!manualRange?.startAt || !manualRange?.endAt || !emitRangeRef.current) return;
    const start = new Date(manualRange.startAt).getTime();
    const end = new Date(manualRange.endAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;
    const startValue = Math.min(start, end);
    const endValue = Math.max(start, end);
    emitRangeRef.current(startValue, endValue, "manual");
    chartRef.current?.dispatchAction({
      type: "dataZoom",
      startValue,
      endValue,
    });
  }, [manualRange]);

  if (empty) {
    return <div className="flex w-full items-center justify-center rounded-lg bg-surface-2 text-sm text-text-tertiary" style={{ height }}>暂无可绘制的学生提问链条</div>;
  }

  return (
    <div className="relative">
      <div ref={ref} className="w-full" style={{ height }} aria-label="学生提问语义光束图" />
      {/* 图例说明 */}
      <div className="absolute top-2 left-4 flex items-center gap-3 text-[11px] text-text-tertiary">
        <span className="flex items-center gap-1"><span className="inline-block w-4 border-t-[3px] border-[var(--ws-color-warning)]" />教师主线</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />任务覆盖</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rotate-45 border-2 border-[var(--ws-color-danger)] bg-[var(--ws-color-warning)]" />生发问题</span>
        {burstPoints.length > 0 && <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--ws-color-danger)]" />爆发点</span>}
      </div>
    </div>
  );
};

export default StudentBeamChart;
