/**
 * 学生个体画像抽屉 — 点击学生名称后展示 Bloom 雷达、问题类型分布、提问时间线等
 */
import React, { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts";
import dayjs from "dayjs";
import { X, MessageSquare, Clock, Target, TrendingUp } from "lucide-react";
import { getAgentChartTheme } from "./chartTheme";
import type { BeamStudentChain, BeamQuestionNode } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  chain: BeamStudentChain | null;
  teacherAnchors?: Array<{ id: string; time: string; question: string; label?: string }>;
}

/** 问题类型柱状图 */
const QuestionTypeBar: React.FC<{ nodes: BeamQuestionNode[] }> = ({ nodes }) => {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current || nodes.length === 0) return;
    if (!chartRef.current) chartRef.current = echarts.init(ref.current);
    const theme = getAgentChartTheme();

    const counts: Record<string, number> = {};
    nodes.forEach((n) => { const t = n.relationLabel || "其他"; counts[t] = (counts[t] || 0) + 1; });
    const labels = Object.keys(counts);
    const values = labels.map((k) => counts[k]);

    chartRef.current.setOption({
      tooltip: { trigger: "axis" },
      grid: { left: 8, right: 8, top: 8, bottom: 8 },
      xAxis: { type: "value", show: false },
      yAxis: { type: "category", data: labels.reverse(), axisLabel: { color: theme.textSecondary, fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false } },
      series: [{
        type: "bar", data: values.reverse().map((v) => ({ value: v, itemStyle: { color: "#0D9488", borderRadius: [0, 4, 4, 0] } })),
        barWidth: 14, label: { show: true, position: "right", color: theme.textSecondary, fontSize: 11 },
      }],
    }, true);
  }, [nodes]);

  useEffect(() => {
    const r = () => chartRef.current?.resize();
    window.addEventListener("resize", r);
    return () => { window.removeEventListener("resize", r); chartRef.current?.dispose(); chartRef.current = null; };
  }, []);

  if (nodes.length === 0) return null;
  return <div ref={ref} className="h-[200px] w-full" />;
};

const StudentProfileDrawer: React.FC<Props> = ({ open, onClose, chain }) => {
  const nodes = chain?.nodes || [];
  const timeRange = useMemo(() => {
    if (nodes.length === 0) return "暂无";
    return `${dayjs(nodes[0].time).format("HH:mm")} - ${dayjs(nodes[nodes.length - 1].time).format("HH:mm")}`;
  }, [nodes]);

  const questionTypes = useMemo(() => {
    const counts: Record<string, number> = {};
    nodes.forEach((n) => { const t = n.relationLabel || "其他"; counts[t] = (counts[t] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [nodes]);

  if (!open || !chain) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative flex h-full w-[420px] max-w-[100vw] flex-col overflow-y-auto border-l border-border-secondary bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border-secondary px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-text-base">{chain.studentName}</h2>
            {chain.className && <p className="text-xs text-text-tertiary">{chain.className}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-text-tertiary hover:bg-surface-2 hover:text-text-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 px-5 py-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-primary-soft/40 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs text-text-tertiary"><MessageSquare className="h-3 w-3" />提问</div>
              <div className="mt-0.5 text-lg font-semibold text-primary">{nodes.length}</div>
            </div>
            <div className="rounded-lg bg-surface-2 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-xs text-text-tertiary"><Clock className="h-3 w-3" />活跃</div>
              <div className="mt-0.5 text-sm font-semibold text-text-base">{timeRange}</div>
            </div>
          </div>

          {/* Question type breakdown */}
          {questionTypes.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text-base"><TrendingUp className="h-3.5 w-3.5" />问题类型</h3>
              <div className="space-y-1.5">
                {questionTypes.slice(0, 5).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-1.5">
                    <span className="text-sm text-text-secondary">{type}</span>
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Question type bar chart */}
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text-base"><Target className="h-3.5 w-3.5" />类型分布</h3>
            <QuestionTypeBar nodes={nodes} />
          </div>

          {/* Time-based list */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-text-base">问题时间线</h3>
            <div className="space-y-2.5">
              {nodes.map((node, i) => (
                <div key={`${node.id || i}`} className="rounded-lg border border-border-secondary bg-surface-2 px-3 py-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary">{dayjs(node.time).format("HH:mm")}</span>
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] text-primary">{node.relationLabel}</span>
                  </div>
                  <div className="text-sm leading-relaxed text-text-base">{node.content}</div>
                  {node.teacherQuestion && (
                    <div className="mt-1 rounded border border-[var(--ws-color-warning)]/20 bg-[var(--ws-color-warning)]/8 px-2 py-0.5 text-xs text-text-tertiary">
                      关联教师：{node.teacherQuestion}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentProfileDrawer;
