/**
 * 多课时对比分析页面
 * 从 URL params 读取 ids，并行加载记录，展示对比视图
 */
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import * as echarts from "echarts";
import dayjs from "dayjs";
import { Button } from "@/components/ui/button";
import { agentDataApi } from "@services/znt/api";

type AnalysisRecord = {
  id: number;
  title: string;
  class_name?: string;
  created_at: string;
  result: any;
};

const COLORS = ["#0D9488", "#7C3AED", "#3B82F6", "#F59E0B", "#EC4899"];
const BLOOM_KEYS = ["记忆", "理解", "应用", "分析", "评价", "创造"];

const TaskAnalysisComparePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const ids = useMemo(() => (searchParams.get("ids") || "").split(",").map(Number).filter(Boolean), [searchParams]);
  const [records, setRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const bloomRef = React.useRef<HTMLDivElement>(null);
  const timelineRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ids.length < 2) { setLoading(false); return; }
    Promise.all(ids.map((id) => agentDataApi.getTaskAnalysis(id)))
      .then((results) => {
        setRecords(results.filter((r: any) => r.success).map((r: any) => r.data as AnalysisRecord));
      })
      .finally(() => setLoading(false));
  }, [ids]);

  // Bloom 对比图
  useEffect(() => {
    if (!bloomRef.current || records.length < 2) return;
    const chart = echarts.init(bloomRef.current);
    const series = BLOOM_KEYS.map((key) => ({
      name: key, type: "bar", stack: "bloom",
      data: records.map((r) => (r.result?.bloom || {})[key] || 0),
    }));
    chart.setOption({
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { data: BLOOM_KEYS, top: 4, textStyle: { fontSize: 11 } },
      grid: { left: 60, right: 20, top: 40, bottom: 30 },
      xAxis: { type: "category", data: records.map((r) => r.title.slice(0, 12) || `#${r.id}`) },
      yAxis: { type: "value", name: "提问数" },
      series,
    });
    const resize = () => chart.resize();
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); chart.dispose(); };
  }, [records]);

  // 时序对比图
  useEffect(() => {
    if (!timelineRef.current || records.length < 2) return;
    const chart = echarts.init(timelineRef.current);
    const series = records.map((r, idx) => {
      const buckets = r.result?.timeline_buckets || [];
      return {
        name: r.title.slice(0, 12) || `#${r.id}`,
        type: "line", smooth: true,
        data: buckets.map((b: any, i: number) => [i * 3, b.question_count || 0]),
        lineStyle: { color: COLORS[idx % COLORS.length], width: 2.5 },
        itemStyle: { color: COLORS[idx % COLORS.length] },
      };
    });
    chart.setOption({
      tooltip: { trigger: "axis" },
      legend: { top: 4, textStyle: { fontSize: 11 } },
      grid: { left: 50, right: 20, top: 40, bottom: 30 },
      xAxis: { type: "value", name: "分钟", axisLabel: { formatter: "{value}min" } },
      yAxis: { type: "value", name: "提问数" },
      series,
    });
    const resize = () => chart.resize();
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); chart.dispose(); };
  }, [records]);

  // 生发问题交集分析
  const generativeComparison = useMemo(() => {
    if (records.length < 2) return { shared: [], unique: [] };
    const allTopics = records.map((r) => (r.result?.uncovered || []).map((t: any) => t.topic));
    const topicCount = new Map<string, number>();
    allTopics.flat().forEach((t: string) => topicCount.set(t, (topicCount.get(t) || 0) + 1));
    const shared = [...topicCount.entries()].filter(([, c]) => c >= 2).map(([t]) => t);
    const unique = [...topicCount.entries()].filter(([, c]) => c === 1).map(([t]) => t);
    return { shared, unique };
  }, [records]);

  if (ids.length < 2) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--ws-color-bg)]">
        <div className="text-center space-y-3">
          <p className="text-sm text-text-tertiary">请至少选择 2 条分析记录进行对比</p>
          <Button variant="outline" onClick={() => window.close()}>返回</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--ws-color-bg)]">
      <header className="shrink-0 border-b border-border-secondary bg-surface px-6 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => window.close()}><ArrowLeft className="h-4 w-4 mr-1" />关闭</Button>
        <span className="text-sm font-semibold">多课时对比分析</span>
        <span className="text-xs text-text-tertiary">({ids.length} 条记录)</span>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 max-w-6xl mx-auto w-full">
          {/* ① 对比概览表格 */}
          <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="text-base font-semibold mb-3">对比概览</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-text-tertiary border-b border-border-secondary">
                    <th className="py-2 px-3 font-medium">指标</th>
                    {records.map((r) => (
                      <th key={r.id} className="py-2 px-3 font-medium">{r.title.slice(0, 15)}<br/><span className="text-[10px] font-normal">{dayjs(r.created_at).format("MM-DD")}</span></th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-secondary">
                  <tr>
                    <td className="py-2 px-3 text-text-secondary">提问总数</td>
                    {records.map((r) => <td key={r.id} className="py-2 px-3 font-semibold">{(r.result?.timeline_buckets || []).reduce((s: number, b: any) => s + (b.question_count || 0), 0)}</td>)}
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-text-secondary">生发问题</td>
                    {records.map((r) => <td key={r.id} className="py-2 px-3 font-semibold text-amber-600">{(r.result?.uncovered || []).length}</td>)}
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-text-secondary">爆发点</td>
                    {records.map((r) => <td key={r.id} className="py-2 px-3 font-semibold text-red-600">{(r.result?.burst_points || []).length}</td>)}
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-text-secondary">主问题链</td>
                    {records.map((r) => <td key={r.id} className="py-2 px-3">{(r.result?.main_question_chain || []).length} 阶段</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ② Bloom 认知层级对比 */}
          <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="text-base font-semibold mb-1">Bloom 认知层级对比</h2>
            <p className="text-xs text-text-tertiary mb-3">观察不同课时学生提问的认知层级分布差异</p>
            <div ref={bloomRef} style={{ width: "100%", height: 280 }} />
          </section>

          {/* ③ 时序热点叠加 */}
          <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="text-base font-semibold mb-1">时序提问量对比</h2>
            <p className="text-xs text-text-tertiary mb-3">X轴为课堂相对时间，观察哪节课的爆发点更早/更密集</p>
            <div ref={timelineRef} style={{ width: "100%", height: 280 }} />
          </section>

          {/* ④ 生发问题对比 */}
          <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="text-base font-semibold mb-1">生发问题对比</h2>
            <p className="text-xs text-text-tertiary mb-3">跨课时重复出现的生发问题 = 任务单系统性盲区</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {generativeComparison.shared.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50/30 p-3">
                  <div className="text-xs font-semibold text-red-700 mb-2">🔴 系统性盲区（多课时重复）</div>
                  <div className="space-y-1">
                    {generativeComparison.shared.map((t, i) => (
                      <div key={i} className="text-sm text-text-base">{t}</div>
                    ))}
                  </div>
                </div>
              )}
              {generativeComparison.unique.length > 0 && (
                <div className="rounded-lg border border-border-secondary bg-surface-2 p-3">
                  <div className="text-xs font-semibold text-text-secondary mb-2">⚪ 偶发性问题（仅出现一次）</div>
                  <div className="space-y-1">
                    {generativeComparison.unique.slice(0, 8).map((t, i) => (
                      <div key={i} className="text-sm text-text-tertiary">{t}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {generativeComparison.shared.length > 0 && (
              <div className="mt-3 rounded-lg bg-primary-soft/50 px-3 py-2 text-xs text-primary">
                💡 系统性盲区建议优先纳入下次任务单设计，偶发性问题可作为课堂即时回应。
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default TaskAnalysisComparePage;
