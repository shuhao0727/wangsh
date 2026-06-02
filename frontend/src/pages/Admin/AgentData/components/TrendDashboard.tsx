/**
 * 跨课时趋势面板 — 折线图展示多项指标随时间变化
 */
import React, { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import { Loader2, TrendingUp, AlertCircle } from "lucide-react";
import { getAgentChartTheme } from "./chartTheme";
import { agentDataApi } from "@services/znt/api";
import dayjs from "dayjs";

interface TrendItem {
  id: number;
  title: string;
  created_at: string;
  theme_count?: number;
  question_count?: number;
  burst_count?: number;
  unique_students?: number;
  top_themes?: string[];
  chain_count?: number;
  teacher_anchor_count?: number;
  teaching_suggestions_count?: number;
}

interface Props {
  agentId: number;
  analysisType: "hot_questions" | "student_chains";
  height?: number;
}

const METRICS_HOT: Array<{ key: keyof TrendItem; label: string; color: string }> = [
  { key: "theme_count", label: "热点主题数", color: "#0D9488" },
  { key: "question_count", label: "参考问题数", color: "#7C3AED" },
  { key: "burst_count", label: "爆发点", color: "#F59E0B" },
  { key: "unique_students", label: "参与学生", color: "#3B82F6" },
];

const METRICS_CHAIN: Array<{ key: keyof TrendItem; label: string; color: string }> = [
  { key: "chain_count", label: "问题链数", color: "#0D9488" },
  { key: "question_count", label: "提问总数", color: "#7C3AED" },
  { key: "unique_students", label: "参与学生", color: "#3B82F6" },
  { key: "teacher_anchor_count", label: "教师锚点", color: "#F59E0B" },
];

const TrendDashboard: React.FC<Props> = ({ agentId, analysisType, height = 360 }) => {
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  const metrics = analysisType === "student_chains" ? METRICS_CHAIN : METRICS_HOT;

  useEffect(() => {
    if (!agentId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    agentDataApi.getAnalysisTrends(agentId, analysisType, 10)
      .then((res: any) => {
        if (cancelled) return;
        if (res?.success && Array.isArray(res.data)) setTrends(res.data);
        else setError(res?.message || "获取趋势数据失败");
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || "网络错误");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [agentId, analysisType]);

  useEffect(() => {
    if (!ref.current || trends.length < 2) return;
    if (!chartRef.current) chartRef.current = echarts.init(ref.current);
    const theme = getAgentChartTheme();

    const dates = trends.map((t) => dayjs(t.created_at).format("MM/DD"));
    const selectedMetrics = metrics.filter((m) => {
      const values = trends.map((t) => Number(t[m.key]) || 0);
      return values.some((v) => v > 0);
    });

    chartRef.current.setOption({
      tooltip: {
        trigger: "axis",
        backgroundColor: theme.surfaceElevated,
        borderColor: theme.border,
        textStyle: { color: theme.textBase, fontSize: 12 },
      },
      legend: {
        bottom: 0,
        textStyle: { color: theme.textSecondary, fontSize: 11 },
        data: selectedMetrics.map((m) => m.label),
      },
      grid: { left: 10, right: 20, top: 15, bottom: 35 },
      xAxis: {
        type: "category",
        data: dates,
        axisLabel: { color: theme.textSecondary, fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisLabel: { color: theme.textSecondary, fontSize: 10 },
        splitLine: { lineStyle: { color: theme.grid } },
      },
      series: selectedMetrics.map((m) => ({
        name: m.label,
        type: "line",
        data: trends.map((t) => Number(t[m.key]) || 0),
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { color: m.color, width: 2 },
        itemStyle: { color: m.color },
      })),
    }, true);
  }, [trends, metrics]);

  useEffect(() => {
    const r = () => chartRef.current?.resize();
    window.addEventListener("resize", r);
    return () => { window.removeEventListener("resize", r); chartRef.current?.dispose(); chartRef.current = null; };
  }, []);

  const loadingChart = loading;

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold text-text-base">
          {analysisType === "student_chains" ? "学生问题链" : "热点问题"} 趋势
        </h2>
        <span className="text-xs text-text-tertiary">近 {trends.length} 次</span>
      </div>

      {loadingChart ? (
        <div className="flex items-center justify-center" style={{ height }}>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center gap-2 text-sm text-text-tertiary" style={{ height }}>
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : trends.length < 2 ? (
        <div className="flex items-center justify-center text-sm text-text-tertiary" style={{ height }}>
          需要至少 2 次分析记录才能展示趋势（当前 {trends.length} 次）
        </div>
      ) : (
        <>
          <div ref={ref} style={{ height }} />
          {trends.some((t) => t.top_themes?.length) && (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-medium text-text-tertiary">最近热点主题</p>
              {trends.slice(0, 3).map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-xs">
                  <span className="text-text-tertiary">{dayjs(t.created_at).format("MM/DD")}</span>
                  <span className="flex flex-wrap gap-1">
                    {(t.top_themes || []).map((theme, i) => (
                      <span key={i} className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] text-primary">{theme}</span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default TrendDashboard;
