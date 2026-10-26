import { useEffect, useId, useRef, useState } from "react";
import { echarts, type EChartsCoreOption } from "@/lib/echarts";
import { Button } from "@/components/ui/button";
import { escapeHtml } from "../normalize";
import { getAgentChartTheme } from "../components/chartTheme";
import { intervalLabel, isGenerative, labelText, timeLabel, type HotTimelineModel } from "./hotTimeline";

type Filter = "all" | "response" | "generative" | "unrelated" | "unclassified";
const FILTER_LABELS: Record<Filter, string> = { all: "全部", response: "回应", generative: "生成性", unrelated: "无关", unclassified: "未归类/待确认" };
// 有归类时点击堆叠柱的哪一段，就筛选哪一类；旧记录的折线仍代表生成性。
const SERIES_FILTER: Record<string, Filter> = {
  questions: "all", generative: "generative", response: "response", unrelated: "unrelated", unclassified: "unclassified",
};

const displayCount = (value: number | null) => value === null ? "未记录" : `${value} 条`;
const questionText = (event: HotTimelineModel["points"][number]["events"][number]) => event.content || event.question || "（本条未保存原问文本）";

export default function HotQuestionTimeline({ model }: { model: HotTimelineModel }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const selectId = useId();
  const [selection, setSelection] = useState<{ index: number; filter: Filter } | null>(null);
  const hasStatistics = model.start !== null && model.end !== null && model.points.some((point) => point.total !== null);
  const point = selection ? model.points[selection.index] : undefined;
  const matches = (event: HotTimelineModel["events"][number], filter: Filter) => {
    if (filter === "all") return true;
    if (!model.classified) return isGenerative(event);
    // 待确认条目归入“未归类”，不混进任何确定类别
    // “未归类”与图表口径一致：没有标签、待确认，或后端根本没收到这条（无 message_id）
    if (filter === "unclassified") return event.message_id === undefined || !event.label || Boolean(event.label.ambiguous);
    return !event.label?.ambiguous && event.label?.category === filter;
  };
  const selectedEvents = point?.events.filter((event) => matches(event, selection!.filter)) || [];
  // 未归类里包含待确认条目，必须能筛选出来，否则用户看不到低置信度的原问
  const filters: Filter[] = model.classified ? ["all", "response", "generative", "unrelated", "unclassified"] : ["all", "generative"];
  const completeEvents = point?.total !== null && point?.events.length === point?.total;

  useEffect(() => {
    if (!chartRef.current || !hasStatistics) return;
    const element = chartRef.current;
    const chart = echarts.init(element);
    const theme = getAgentChartTheme();
    const hasTeachers = model.teachers.length > 0;
    const mainGrid = hasTeachers ? 1 : 0;
    const midpoint = (item: { start: number; end: number }) => (item.start + item.end) / 2;
    const timeAxis = { type: "time" as const, min: model.start!, max: model.end! };
    const tooltip = (params: unknown) => {
      const items = (Array.isArray(params) ? params : [params]) as Array<{ seriesId?: string; dataIndex?: number }>;
      const teacher = items.find((item) => item.seriesId === "teachers");
      if (teacher?.dataIndex !== undefined) {
        const mark = model.teachers[teacher.dataIndex];
        return model.teachers.filter((item) => item.time === mark.time)
          .map((item) => `<div><strong>${escapeHtml(item.label)} · ${escapeHtml(timeLabel(item.time))}</strong><br>${escapeHtml(item.question)}</div>`).join("<br>");
      }
      const index = items.find((item) => item.seriesId && item.seriesId in SERIES_FILTER)?.dataIndex;
      if (index === undefined || !model.points[index]) return "";
      const current = model.points[index];
      const examples = current.events.length ? current.events.map(questionText) : current.examples;
      return [
        `<strong>${escapeHtml(intervalLabel(current))}</strong>`,
        `学生提问：${displayCount(current.total)}`,
        ...(model.classified ? [
          `回应教师：${displayCount(current.response ?? null)}`,
          `生成性：${displayCount(current.generative)}`,
          `无关：${displayCount(current.unrelated ?? null)}`,
          ...(current.unclassified ? [`未归类：${displayCount(current.unclassified)}`] : []),
        ] : [`其中生成性：${displayCount(current.generative)}`]),
        `参与学生：${current.students === null ? "未记录" : `${current.students} 人`}`,
        ...examples.slice(0, 2).map((text) => `<div style="margin-top:6px;white-space:normal">${escapeHtml(text.length > 90 ? `${text.slice(0, 90)}…` : text)}</div>`),
        "<div style=\"margin-top:6px\">点击查看该时段原问</div>",
      ].join("<br>");
    };
    const render = () => {
      chart.resize();
      const range = model.end! - model.start!;
      const width = model.step ? Math.max(1, Math.min(42, (element.clientWidth - 90) * model.step / range * 0.65)) : 12;
      chart.setOption<EChartsCoreOption>({
        animation: false,
        textStyle: { color: theme.textBase, fontFamily: "inherit" },
        grid: [
          ...(hasTeachers ? [{ left: 54, right: 20, top: 8, height: 28 }] : []),
          { left: 54, right: 20, top: hasTeachers ? 80 : 34, bottom: 48 },
        ],
        tooltip: {
          trigger: "axis", confine: true, formatter: tooltip,
          backgroundColor: theme.surfaceElevated, borderColor: theme.border,
          textStyle: { color: theme.textBase, fontSize: 12, width: 280 },
          extraCssText: "max-width:min(300px,80vw);white-space:normal;line-height:1.6;",
        },
        xAxis: [
          ...(hasTeachers ? [{ ...timeAxis, gridIndex: 0, show: false }] : []),
          {
            ...timeAxis, gridIndex: mainGrid, splitNumber: 6,
            axisLine: { lineStyle: { color: theme.border } }, axisTick: { show: false },
            axisLabel: { formatter: (value: number) => timeLabel(value), color: theme.textSecondary, hideOverlap: true },
            axisPointer: { label: { show: false } }, splitLine: { show: false },
          },
        ],
        yAxis: [
          ...(hasTeachers ? [{ type: "value" as const, gridIndex: 0, min: 0, max: 2, show: false }] : []),
          {
            type: "value", gridIndex: mainGrid, min: 0, minInterval: 1, name: "问题数（条）",
            nameTextStyle: { color: theme.textSecondary, align: "left", padding: [0, 0, 0, -36] },
            axisLabel: { color: theme.textSecondary }, axisLine: { show: false }, axisTick: { show: false },
            splitLine: { lineStyle: { color: theme.grid, type: "dashed" } },
          },
        ],
        dataZoom: model.points.length > 80 ? [{ type: "inside", xAxisIndex: hasTeachers ? [0, 1] : [0], filterMode: "none" }] : [],
        series: [
          ...(model.classified ? ([
            ["response", "回应教师", theme.primary, (item: HotTimelineModel["points"][number]) => item.response ?? null],
            ["generative", "生成性", theme.accent, (item: HotTimelineModel["points"][number]) => item.generative],
            ["unrelated", "无关", theme.textMuted, (item: HotTimelineModel["points"][number]) => item.unrelated ?? null],
            ["unclassified", "未归类", theme.border, (item: HotTimelineModel["points"][number]) => item.unclassified ?? null],
          ] as const).map(([id, name, color, value]) => ({
            id, name, type: "bar" as const, stack: "questions", xAxisIndex: mainGrid, yAxisIndex: mainGrid,
            data: model.points.map((item) => [midpoint(item), value(item)]), barWidth: width,
            itemStyle: { color, opacity: id === "unrelated" ? 0.45 : 0.85 },
            emphasis: { itemStyle: { opacity: 1 } },
          })) : [
            {
              id: "questions", name: "学生提问", type: "bar" as const, xAxisIndex: mainGrid, yAxisIndex: mainGrid,
              data: model.points.map((item) => [midpoint(item), item.total]), barWidth: width,
              itemStyle: { color: theme.primary, opacity: 0.75, borderRadius: [2, 2, 0, 0] },
              emphasis: { itemStyle: { opacity: 1 } },
            },
            {
              id: "generative", name: "其中生成性", type: "line" as const, xAxisIndex: mainGrid, yAxisIndex: mainGrid,
              data: model.points.map((item) => [midpoint(item), item.generative]),
              connectNulls: false, smooth: false, showSymbol: true, symbol: "circle", symbolSize: 7,
              lineStyle: { color: theme.info, width: 2 }, itemStyle: { color: theme.info }, z: 3,
            },
          ]),
          ...(hasTeachers ? [{
            id: "teachers", name: "教师提问", type: "scatter" as const, xAxisIndex: 0, yAxisIndex: 0,
            data: model.teachers.map((item) => [item.time, 1]), symbol: "diamond", symbolSize: 9,
            itemStyle: { color: theme.teacher },
            label: { show: true, position: "top" as const, formatter: (params: { dataIndex: number }) => model.teachers[params.dataIndex].label, color: theme.textSecondary, fontSize: 10 },
            labelLayout: { hideOverlap: true }, tooltip: { trigger: "item" as const, formatter: tooltip },
          }] : []),
        ],
      });
    };
    chart.on("click", (event: { seriesId?: string; dataIndex?: number }) => {
      if (event.seriesId && event.seriesId in SERIES_FILTER && event.dataIndex !== undefined) {
        setSelection({ index: event.dataIndex, filter: SERIES_FILTER[event.seriesId] });
      }
    });
    const onBlankClick = (event: { target?: unknown; offsetX: number; offsetY: number }) => {
      if (event.target || !chart.containPixel({ gridIndex: mainGrid }, [event.offsetX, event.offsetY])) return;
      const [time] = chart.convertFromPixel({ gridIndex: mainGrid }, [event.offsetX, event.offsetY]) as number[];
      const index = model.points.findIndex((item) => time >= item.start && time < item.end);
      if (index >= 0) setSelection({ index, filter: "all" });
    };
    chart.getZr().on("click", onBlankClick);
    render();
    const observer = new ResizeObserver(render);
    observer.observe(element);
    return () => {
      observer.disconnect();
      chart.getZr().off("click", onBlankClick);
      chart.dispose();
    };
  }, [model, hasStatistics]);

  return (
    <section aria-label="课堂提问时间图" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h2 className="text-sm font-semibold text-text-base">课堂提问变化</h2>
        <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
          {model.classified ? <>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-primary opacity-85" />回应教师</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[var(--ws-color-accent)] opacity-85" />生成性</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-text-tertiary opacity-45" />无关</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-border opacity-85 ring-1 ring-inset ring-text-tertiary" />未归类</span>
          </> : <>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-primary opacity-75" />学生提问</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-3 bg-info" />其中生成性</span>
          </>}
          {model.teachers.length > 0 && <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rotate-45 bg-warning" />教师提问</span>}
        </div>
      </div>
      <p className="text-xs text-text-tertiary">{model.step ? `按 ${model.step / 60000} 分钟统计` : "按保存的时段统计"} · {model.classified ? "柱形按归类堆叠：回应教师、生成性、无关" : "生成性问题包含在学生提问总数中"}{hasStatistics && " · 点击时段查看原问"}</p>
      {hasStatistics ? (
        <div ref={chartRef} role="img" aria-label={model.classified ? "横轴为时间，纵轴为问题数；柱形按回应教师、生成性、无关堆叠。可通过下方查看时段选择原问。" : "横轴为时间，纵轴为问题数；柱形为全部有效学生提问，折线为其中的生成性问题。可通过下方查看时段选择原问。"} className="h-[330px] w-full sm:h-[380px]" />
      ) : <div role="status" className="flex h-48 items-center justify-center text-sm text-text-tertiary">本记录没有可绘制的时间统计</div>}
      {model.notices.length > 0 && <div className="space-y-1 text-xs leading-relaxed text-text-tertiary">{model.notices.map((notice) => <p key={notice}>{notice}</p>)}</div>}
      {model.points.length > 0 && <div className="flex flex-wrap items-center gap-2 text-xs">
        <label htmlFor={selectId} className="text-text-secondary">查看时段</label>
        <select id={selectId} className="h-8 max-w-full rounded-md bg-surface-2 px-2 text-text-base outline-none focus-visible:ring-2 focus-visible:ring-primary" value={selection?.index ?? ""} onChange={(event) => setSelection(event.target.value === "" ? null : { index: Number(event.target.value), filter: "all" })}>
          <option value="">选择时段查看原问</option>
          {model.points.map((item, index) => <option key={item.start} value={index}>{intervalLabel(item)} · {displayCount(item.total)}</option>)}
        </select>
      </div>}
      {point && <section aria-label="时段原问" className="space-y-3 border-t border-border-secondary pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-text-base">{intervalLabel(point)} <span className="ml-1 text-xs font-normal text-text-tertiary">学生提问 {displayCount(point.total)}{model.classified ? `，回应 ${displayCount(point.response ?? null)}，生成性 ${displayCount(point.generative)}，无关 ${displayCount(point.unrelated ?? null)}` : `，其中生成性 ${displayCount(point.generative)}`}</span></h3>
          <div className="flex items-center gap-1">
            {filters.map((filter) => {
              const active = selection!.filter === filter;
              const text = filter === "all" ? FILTER_LABELS.all : model.classified ? FILTER_LABELS[filter] : "仅生成性";
              return <Button key={filter} variant="ghost" size="sm" aria-pressed={active} onClick={() => setSelection({ index: selection!.index, filter })} className={active ? "bg-primary-soft text-primary" : "text-text-secondary"}>{text}</Button>;
            })}
            <Button variant="ghost" size="sm" onClick={() => setSelection(null)}>收起</Button>
          </div>
        </div>
        {point.total === 0 && !point.events.length ? <p className="text-xs text-text-tertiary">本时段没有有效学生提问。</p> : <>
          {point.events.length > 0 && <p className="text-xs text-text-tertiary">{completeEvents ? `已保存本时段全部 ${point.events.length} 条有效原问。` : `仅展示已保存的 ${point.events.length} 条有效原问，不能还原本时段全部记录。`}{selection?.filter !== "all" && (model.classified ? ` 当前仅显示“${FILTER_LABELS[selection!.filter]}”的原问。` : " 当前仅显示已标记为迁移、延伸的原问。")}</p>}
          {selectedEvents.length > 0 ? <ol className="divide-y divide-border-secondary">
            {selectedEvents.map((event, index) => <li key={`${event.message_id ?? event.time}-${index}`} className="py-3 first:pt-0">
              <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-tertiary"><time>{timeLabel(event.time)}</time><span>{event.user_name || (event.student_id ? `学生 ${event.student_id}` : "学生信息未记录")}</span>{model.classified
                ? <span className={event.label?.category === "generative" ? "font-medium text-[var(--ws-color-accent)]" : event.label?.category === "response" ? "text-primary" : ""}>{labelText(event.label, model.subtypeLabels)}</span>
                : <span className={isGenerative(event) ? "text-info" : ""}>{event.question_type_label || (isGenerative(event) ? "生成性问题" : event.question_type ? "其他有效提问" : "分类未记录")}</span>}</div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text-base">{questionText(event)}</p>
              {event.label?.reason && <p className="mt-1 text-xs text-text-tertiary">判断依据：{event.label.reason}</p>}
              {event.label?.ambiguous && <p className="mt-1 text-xs text-warning">多次判定未取得多数（{event.label.votes ?? "?"} 次中同意 {Math.round((event.label.agreement ?? 0) * 100)}%），请以原话为准</p>}
            </li>)}
          </ol> : selection?.filter !== "all" ? <p className="text-xs text-text-tertiary">{model.classified ? `本时段没有“${FILTER_LABELS[selection!.filter]}”的问题。` : point.generative === 0 ? "本时段没有生成性问题。" : "未保存可筛选的生成性原问；切换“全部”可查看已保存内容。"}</p> : point.examples.length > 0 ? <div className="space-y-2">
            <p className="text-xs text-text-tertiary">典型原问摘要：本记录仅保存了摘要，不能还原全部原问或逐条分类。</p>
            <ol className="space-y-2 text-sm leading-relaxed text-text-base">{point.examples.map((text, index) => <li key={index} className="whitespace-pre-wrap break-words">{text}</li>)}</ol>
          </div> : <p className="text-xs text-text-tertiary">本记录未保存该时段的原问明细。</p>}
        </>}
      </section>}
    </section>
  );
}
