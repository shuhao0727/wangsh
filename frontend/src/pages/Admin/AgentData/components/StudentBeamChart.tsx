/**
 * 学生语义光束图
 * 教师问题链固定为中轴，真实学生问题链围绕中轴形成参考式认知路径光束。
 */
import React, { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts";
import { getAgentChartTheme } from "./chartTheme";
import { escapeHtml } from "../normalize";
import { buildRelatedQuestionGroups, type RelatedQuestionGroup } from "./questionRelatedness";
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
  bloomLevel: string;
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
  onStudentClick?: (studentName: string) => void;
}

const fmtTime = (v: number) => { const d = new Date(v); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const smoothStep = (value: number) => value * value * (3 - 2 * value);
const roundedLineStyle = { cap: "round" as const, join: "round" as const, miterLimit: 2 };
const relationLearningFallback: Record<BeamRelationType, string> = {
  clarify: "理解",
  follow_up: "理解",
  apply: "应用",
  debug: "分析",
  challenge: "评价",
  transfer: "创造",
  extend: "创造",
  off_track: "分析",
};
const learningLevelOffset: Record<string, number> = {
  "了解/知道": -1,
  理解: -0.5,
  应用: 0.5,
  分析: 1,
  评价: 1.28,
  创造: 1.5,
};
const laneLabelForValue = (value: number) => {
  const key = Math.round(value * 2) / 2;
  const labels: Record<string, string> = {
    "-1": "了解/知道",
    "-0.5": "理解",
    "0": "教师轴",
    "0.5": "应用",
    "1": "分析",
    "1.5": "评价/创造",
  };
  return labels[String(key)] || "";
};
const normalizeLearningLevel = (value?: string, relationType?: BeamRelationType) => {
  const text = String(value || "").toLowerCase();
  if (/创造|创作|create|设计|生成|创新/.test(text)) return "创造";
  if (/评价|评估|evaluate|判断|论证|反思/.test(text)) return "评价";
  if (/分析|analy[sz]e|拆解|区别|对比|比较|为什么|归因|原因|关系|原理|本质/.test(text)) return "分析";
  if (/应用|apply|使用|实现|怎么写|如何写|代码|程序|迁移|换成|类似|解决/.test(text)) return "应用";
  if (/理解|understand|解释|说明|举例|例子|示例|意思/.test(text)) return "理解";
  if (/了解|知道|记忆|remember|识别|列举|定义|概念|是什么/.test(text)) return "了解/知道";
  return relationType ? relationLearningFallback[relationType] : "理解";
};

const StudentBeamChart: React.FC<Props> = ({
  height = 520, teacherAnchors = [], studentChains = [], burstPoints = [], manualRange, onRangeChange, onStudentClick,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const onRangeChangeRef = useRef(onRangeChange);
  const emitRangeRef = useRef<((start?: number, end?: number, source?: BeamRangeSelection["source"]) => void) | null>(null);
  const emittedInitialRef = useRef(false);

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
    const normalizeTeacherText = (value?: string) => String(value || "")
      .replace(/\s+/g, "")
      .replace(/[，。！？、,.?!:：；;]/g, "")
      .toLowerCase();
    const teacherForQuestion = (question: string | undefined, time: number) => {
      const key = normalizeTeacherText(question);
      if (key) {
        const matched = teacherQuestions.find((teacher) => {
          const teacherKey = normalizeTeacherText(teacher.content);
          return teacherKey === key || teacherKey.includes(key) || key.includes(teacherKey);
        });
        if (matched) return matched;
      }
      return nearestTeacher(time);
    };

    const enriched = chains.flatMap((chain, chainIndex) => chain.nodes
      .map((node, nodeIndex): EnrichedBeamQuestion | null => {
        const time = new Date(node.time).getTime();
        if (!Number.isFinite(time)) return null;
        const teacher = teacherForQuestion(node.teacherQuestion, time);
        const bloomLevel = normalizeLearningLevel(node.bloomLevel, node.relationType);
        const baseOffset = learningLevelOffset[bloomLevel] ?? learningLevelOffset.理解;
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
          bloomLevel,
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
      if (startAt === undefined || endAt === undefined) return;

      const inRange = enriched
        .filter((item) => item.time >= startAt && item.time <= endAt)
        .sort((a, b) => a.time - b.time);
      const rangeTeachers = teacherQuestions
        .filter((teacher) => teacher.time >= startAt && teacher.time <= endAt)
        .map((teacher) => ({
          id: teacher.id,
          time: new Date(teacher.time).toISOString(),
          question: teacher.content,
          label: teacher.label,
        }));
      callback({
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        questions: inRange.map((item) => ({
          chainId: item.chainId,
          time: new Date(item.time).toISOString(),
          studentName: item.studentName,
          content: item.content,
          relationType: item.relationType,
          relationLabel: item.relationLabel,
          bloomLevel: item.bloomLevel,
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
    const buildContinuousBeamData = (items: Array<typeof enriched[number]>) => {
      if (items.length <= 1) return items.map((item) => [item.time, item.y]);
      const range = Math.max(maxTime - minTime, 1);
      const data: number[][] = [];
      items.forEach((item, index) => {
        if (index === 0) {
          data.push([item.time, item.y]);
          return;
        }
        const prev = items[index - 1];
        // 只补充过渡插值点，不删减真实采样点；每段终点仍是原始问题节点。
        const steps = clamp(Math.round(((item.time - prev.time) / range) * 160), 24, 72);
        for (let step = 1; step <= steps; step += 1) {
          const progress = step / steps;
          const eased = smoothStep(progress);
          const x = prev.time + (item.time - prev.time) * progress;
          const y = prev.y + (item.y - prev.y) * eased;
          data.push([x, y]);
        }
      });
      return data;
    };

    // 预计算每条链的光束插值数据，避免 trajectorySeries 和 beamSeries 对相同数据重复计算
    const chainBeamDataMap = new Map<string, number[][]>();
    chains.forEach((chain) => {
      const items = enriched.filter((e) => e.chainId === chain.id).sort((a, b) => a.time - b.time);
      chainBeamDataMap.set(chain.id, buildContinuousBeamData(items));
    });

    const laneBandSeries = [{
      type: "line",
      name: "认知分区",
      z: 0,
      silent: true,
      symbol: "none",
      data: [[minTime, 0], [maxTime, 0]],
      lineStyle: { opacity: 0 },
      markArea: {
        silent: true,
        data: [
          [
            {
              yAxis: 0.5,
              itemStyle: { color: theme.primaryBand },
              label: { show: true, formatter: "高阶思维区", color: theme.primary, fontSize: 10, position: "insideLeft" },
            },
            { yAxis: 1.55 },
          ],
          [
            {
              yAxis: -1.55,
              itemStyle: { color: theme.uncoveredSoft },
              label: { show: true, formatter: "基础理解区", color: theme.textSecondary, fontSize: 10, position: "insideLeft" },
            },
            { yAxis: -0.55 },
          ],
        ],
      },
    }];

    const anchorBeamSeries = [{
      type: "lines",
      name: "教师触发光束",
      coordinateSystem: "cartesian2d",
      z: 1,
      silent: true,
      animationDelay: (index: number) => index * 12,
      data: enriched.map((item) => {
        const explicitTeacherTime = new Date(item.teacherTime || "").getTime();
        const anchor = Number.isFinite(explicitTeacherTime)
          ? { time: explicitTeacherTime }
          : teacherForQuestion(item.teacherQuestion, item.time);
        const color = item.isUncovered ? theme.uncoveredBorder : theme.beamColors[item.colorIndex % theme.beamColors.length];
        const baseOpacity = clamp(8 / Math.max(enriched.length, 1), 0.035, 0.08);
        return {
          coords: [[anchor?.time ?? item.time, 0], [item.time, item.y]],
          lineStyle: { ...roundedLineStyle, color, opacity: item.isUncovered ? Math.max(baseOpacity, 0.12) : baseOpacity, width: item.isUncovered ? 1.6 : 1, curveness: 0.18 },
        };
      }),
    }];

    const trajectorySeries = chains.map((chain, idx) => {
      return {
        type: "line", name: `${chain.studentName} 趋势`, z: 1, symbol: "none", smooth: false, silent: true,
        data: chainBeamDataMap.get(chain.id) || [],
        lineStyle: { ...roundedLineStyle, color: theme.beamColors[idx % theme.beamColors.length], width: 5.4, opacity: 0.09, shadowBlur: 0 },
      };
    });

    const beamSeries = chains.map((chain, idx) => {
      return {
        type: "line", name: chain.studentName, z: 3, symbol: "none", smooth: false,
        data: chainBeamDataMap.get(chain.id) || [],
        lineStyle: { ...roundedLineStyle, color: theme.beamColors[idx % theme.beamColors.length], width: 2.4, opacity: 0.78, shadowBlur: 0 },
        endLabel: {
          show: true,
          formatter: chain.studentName,
          color: theme.beamColors[idx % theme.beamColors.length],
          fontWeight: 700,
          fontSize: 11,
          distance: 8,
          backgroundColor: theme.surfaceElevated,
          borderRadius: 8,
          padding: [2, 5],
        },
        emphasis: { lineStyle: { ...roundedLineStyle, width: 3.8, opacity: 0.96, shadowBlur: 0 } },
      };
    });

    const teacherAxisSeries = [{
      type: "line",
      name: "教师提问主线",
      z: 4,
      symbol: "none",
      smooth: false,
      silent: true,
      data: [[minTime, 0], [maxTime, 0]],
      lineStyle: { ...roundedLineStyle, color: theme.teacher, width: 5.2, opacity: 0.94, shadowBlur: 4, shadowColor: theme.teacherSoft },
      emphasis: { lineStyle: { ...roundedLineStyle, width: 5.8, opacity: 1 } },
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

    const relatedQuestionGroups: RelatedQuestionGroup[] = buildRelatedQuestionGroups(enriched);

    // 散点（区分覆盖/生发）
    const scatterData = enriched.map((item, index) => ({
      value: [item.time, item.y, item.studentName, item.content, item.relationLabel, item.isUncovered ? 1 : 0, item.teacherQuestion || "", item.bloomLevel],
      relatedQuestions: relatedQuestionGroups[index],
      itemStyle: {
        color: item.isUncovered ? theme.uncovered : theme.beamColors[item.colorIndex % theme.beamColors.length],
        borderColor: item.isUncovered ? theme.uncoveredBorder : "transparent",
        borderWidth: item.isUncovered ? 2 : 0,
        opacity: item.isUncovered ? 0.94 : 0.86,
        shadowBlur: item.isUncovered ? 12 : 6,
        shadowColor: item.isUncovered ? theme.uncoveredShadow : theme.primarySoft,
      },
      symbol: item.isUncovered ? "diamond" : "circle",
      symbolSize: item.isUncovered ? 15.5 : 10.5,
    }));

    // 爆发点标记
    const burstScatter = burstPoints.map((bp) => ({
      value: [new Date(bp.bucket_start).getTime(), maxLane + 0.4],
      questionCount: bp.question_count,
      topQuestions: bp.top_questions || [],
      itemStyle: { color: theme.burst, shadowBlur: 12, shadowColor: theme.burstGlow },
      symbol: "pin", symbolSize: 24,
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
          const related = param?.data?.relatedQuestions as RelatedQuestionGroup | undefined;
          const [time, , name, content, relation, isUnc, teacherQuestion, bloomLevel] = v;
          const tag = isUnc
            ? `<span style="color:${theme.uncoveredBorder};font-weight:600">🔥 生发问题</span>`
            : `<span style="color:${theme.primary}">学生问题链</span>`;
          const teacherLine = teacherQuestion ? `<br/><span style="color:${theme.teacher}">关联教师：${escapeHtml(String(teacherQuestion).slice(0, 40))}</span>` : "";
          const levelLine = bloomLevel ? `<br/><span style="color:${theme.primary}">学习层次：${escapeHtml(String(bloomLevel))}</span>` : "";
          const relatedLine = related?.top.length
            ? `<div style="margin-top:8px;border-top:1px solid ${theme.border};padding-top:6px"><b style="color:${theme.textBase}">同段相关问题 Top（${related.total}）</b>${related.top.map((item, index) => `<div style="margin-top:4px;color:${theme.textMuted};line-height:1.35">${index + 1}. ${escapeHtml(item.content.slice(0, 46))}${item.content.length > 46 ? "..." : ""}<br/><span style="color:${theme.textSecondary}">${escapeHtml(item.studentName)} · ${fmtTime(item.time)} · ${escapeHtml(item.bloomLevel)}${(item.count || 1) > 1 ? ` · ${item.count}次` : ""}</span></div>`).join("")}</div>`
            : `<div style="margin-top:8px;border-top:1px solid ${theme.border};padding-top:6px;color:${theme.textSecondary}">同时间段暂无明显相近问题</div>`;
          return `<div style="max-width:360px"><b style="color:${theme.textBase}">${escapeHtml(String(relation))}</b> ${tag}<br/><span style="color:${theme.textSecondary}">${escapeHtml(String(name))} · ${fmtTime(time as number)}</span>${levelLine}${teacherLine}<br/><div style="margin-top:4px;color:${theme.textMuted};line-height:1.4">"${escapeHtml(String(content).slice(0, 90))}"</div>${relatedLine}</div>`;
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
      grid: { left: 80, right: 74, top: 56, bottom: 70 },
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
        interval: 0.5,
        axisLabel: {
          show: true,
          color: theme.textSecondary,
          fontSize: 10,
          margin: 12,
          formatter: (value: number) => laneLabelForValue(value),
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: true, lineStyle: { color: theme.grid } },
      },
      dataZoom: [
        { type: "slider", start: 0, end: 100, height: 22, bottom: 10, fillerColor: theme.primarySoft, borderColor: theme.border, handleStyle: { color: theme.primary }, textStyle: { fontSize: 10, color: theme.textSecondary } },
        { type: "inside", zoomOnMouseWheel: true, moveOnMouseMove: true },
      ],
      brush: {
        xAxisIndex: 0,
        brushMode: "single",
        transformable: true,
        brushStyle: {
          borderColor: theme.primary,
          color: theme.primaryBrush,
          borderWidth: 1.5,
        },
      },
      series: [
        ...laneBandSeries,
        ...anchorBeamSeries,
        ...teacherAxisSeries,
        ...trajectorySeries,
        ...beamSeries,
        {
          type: "scatter", name: "学生问题节点", data: scatterData, z: 5,
          emphasis: { scale: 1.6, label: { show: true, formatter: (p: any) => p.value?.[3]?.slice(0, 20) || "", color: theme.textBase, fontSize: 10, position: "top" } },
        },
        ...teacherPointSeries,
        ...(burstScatter.length > 0 ? [{
          type: "scatter", data: burstScatter, z: 5, silent: false,
          tooltip: {
            formatter: (param: any) => {
              const time = Number(param?.value?.[0]);
              const topQuestions = (param?.data?.topQuestions || []) as Array<{ question?: string; count?: number }>;
              const list = topQuestions.length
                ? topQuestions.slice(0, 4).map((item, index) => `<div style="margin-top:4px;color:${theme.textMuted};line-height:1.35">${index + 1}. ${escapeHtml(String(item.question || "").slice(0, 52))}${String(item.question || "").length > 52 ? "..." : ""}<span style="color:${theme.textSecondary}"> · ${Number(item.count || 0)}次</span></div>`).join("")
                : `<div style="margin-top:4px;color:${theme.textSecondary}">暂无该时间桶的 Top 问题</div>`;
              return `<div style="max-width:340px"><span style="color:${theme.burst};font-weight:700">提问爆发点</span><br/><span style="color:${theme.textSecondary}">${Number.isFinite(time) ? fmtTime(time) : ""} · ${Number(param?.data?.questionCount || 0)} 个问题</span>${list}</div>`;
            },
          },
        }] : []),
      ],
    }, true);

    if (!emittedInitialRef.current) {
      emitRange(minTime, maxTime, "initial");
      emittedInitialRef.current = true;
    }

    chartRef.current.off("datazoom");
    chartRef.current.on("datazoom", () => {
      if (chartRef.current?.isDisposed?.()) return;
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

    if (onStudentClick) {
      chartRef.current.off("click");
      chartRef.current.on("click", (params: any) => {
        const clickedStudent = studentChains.some((c) => c.studentName === params.seriesName)
          ? params.seriesName
          : params.value?.[2];
        if (clickedStudent && studentChains.some((c) => c.studentName === clickedStudent)) {
          onStudentClick(clickedStudent);
        }
      });
    }

    const resize = () => chartRef.current?.resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      emitRangeRef.current = null;
      emittedInitialRef.current = false;
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, [teacherAnchors, studentChains, burstPoints]);

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
    <div className="relative bg-[linear-gradient(180deg,var(--ws-color-surface),var(--ws-color-surface-2))]">
      <div ref={ref} className="w-full" style={{ height }} aria-label="学生认知路径光束图" />
      {/* 图例说明 */}
      <div className="absolute left-4 top-3 flex flex-wrap items-center gap-3 rounded-full border border-border/70 bg-surface/90 px-3 py-1.5 text-[11px] text-text-tertiary shadow-sm backdrop-blur">
        <span className="flex items-center gap-1"><span className="inline-block w-4 border-t-[3px] border-[var(--ws-color-warning)]" />教师主轴</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />学生问题层次</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rotate-45 border-2 border-[var(--ws-color-danger)] bg-[var(--ws-color-warning)]" />生发问题</span>
        {burstPoints.length > 0 && <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--ws-color-danger)]" />爆发点</span>}
      </div>
      <div className="absolute bottom-11 left-4 max-w-[420px] rounded-full border border-border/60 bg-surface/85 px-3 py-1 text-[10px] text-text-tertiary shadow-sm backdrop-blur">
        悬停学生点可看同段相近问题 Top；爆发点显示该时段关注最高的问题。
      </div>
    </div>
  );
};

export default StudentBeamChart;
