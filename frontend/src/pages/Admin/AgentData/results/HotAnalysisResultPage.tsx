import React, { useMemo } from "react";
import { Info, Loader2 } from "lucide-react";
import dayjs from "dayjs";
import SharedResultLayout from "./SharedResultLayout";
import { useAnalysisDetail } from "./hooks/useAnalysisDetail";
import { useNormalizedResult } from "./hooks/useNormalizedResult";
import { escapeHtml, safeFilePart } from "../normalize";
import HotQuestionTimeline from "./HotQuestionTimeline";
import HotPhaseList from "./HotPhaseList";
import { buildHotPhases, buildHotTimeline, intervalLabel, labelText } from "./hotTimeline";

const displayCount = (value: number | null, unit: string) => value === null ? "未记录" : `${value} ${unit}`;
const downloadBlob = (content: string, filename: string, mime: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
// 分阶段导出：每个教师提问后学生的回应与生成性问题原文。
const phaseMarkdown = (phases: ReturnType<typeof buildHotPhases>, subtypeLabels: Record<string, string>) => phases.flatMap((phase) => [
  `## ${phase.ref ?? "课前提问"}${phase.question ? `：${phase.question}` : ""}`,
  "",
  `回应 ${phase.responseTotal} 条（${Object.entries(phase.responses).map(([key, value]) => `${subtypeLabels[key] || key} ${value}`).join("，") || "无"}）；仍回应更早提问 ${phase.earlierResponses} 条；生成性 ${phase.generative.length} 条；无关 ${phase.unrelated} 条。`,
  "",
  ...phase.generative.map((event) => `- [${labelText(event.label, subtypeLabels)}] ${event.content || event.question || ""}${event.label?.reason ? `（${event.label.reason}）` : ""}`),
  "",
]);

const auditLabels: Record<string, string> = {
  anchor_denominator_mismatch: "教师关联统计分母与有效问题数不一致",
  confidence_distribution_mismatch: "教师关联置信度统计与匹配数不一致",
  anchor_match_count_mismatch: "教师关联匹配条数不一致",
  anchor_coverage_mismatch: "教师关联覆盖率与匹配数不一致",
};

const HotAnalysisResultPage: React.FC = () => {
  const { loading, detail } = useAnalysisDetail();
  const { resultData } = useNormalizedResult(detail);
  const model = useMemo(() => buildHotTimeline(resultData, detail), [resultData, detail]);
  const phases = useMemo(() => buildHotPhases(model), [model]);
  const totals = resultData.question_classification?.totals;
  const classifyState = resultData.classification_status;
  const audit = resultData.analysis_audit;
  const quality = resultData.data_quality;
  const auditNeedsReview = audit?.teacher_anchor_statistics_consistent === false || Boolean(audit?.warnings?.length);
  const granularity = model.step ? `${model.step / 60000} 分钟` : "未记录";
  const timeRange = model.start !== null && model.end !== null
    ? `${dayjs(model.start).format("YYYY-MM-DD HH:mm")} – ${dayjs(model.end).format(dayjs(model.start).isSame(model.end, "day") ? "HH:mm" : "YYYY-MM-DD HH:mm")}` : "未记录";
  const metadata = [
    ["课程/智能体", detail?.title || (detail?.agent_id ? `智能体 ${detail.agent_id}` : "未记录")],
    ["班级", detail?.class_name || "全部班级"],
    ["分析时段", timeRange],
    ["参与学生", displayCount(model.students, "人")],
    ["有效提问", displayCount(model.total, "条")],
    ...(totals ? [
      ["回应教师", `${totals.response} 条`],
      ["生成性问题", `${totals.generative} 条`],
      ["无关", `${totals.unrelated} 条`],
    ] : [["其中生成性问题", displayCount(model.generative, "条")]]),
  ];
  const exportOptions = useMemo(() => {
    if (!detail) return undefined;
    const title = detail.title || "热点问题分析";
    const filename = `热点分析_${safeFilePart(title)}_${dayjs(detail.created_at).format("YYYYMMDD")}`;
    const value = (number: number | null) => number === null ? "未记录" : String(number);
    const rows = model.points.map((point) => [intervalLabel(point), value(point.total), value(point.generative), value(point.students)]);
    const notes = ["生成性问题为有效学生提问中的迁移、延伸子集，按保存的分类自动识别，不等同于学习效果。", ...model.notices];
    const summary = `班级：${detail.class_name || "全部班级"}；分析时段：${timeRange}；统计粒度：${granularity}；参与学生：${displayCount(model.students, "人")}；有效提问：${displayCount(model.total, "条")}；其中生成性问题：${displayCount(model.generative, "条")}`;
    return [
      { label: "HTML 报告", ext: "html", action: () => downloadBlob([
        "<!doctype html><html lang=\"zh-CN\"><meta charset=\"UTF-8\">",
        `<title>${escapeHtml(title)}</title><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(summary)}</p>`,
        "<table><thead><tr><th>时间段</th><th>有效提问</th><th>其中生成性</th><th>参与学生</th></tr></thead><tbody>",
        ...rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`),
        "</tbody></table>", ...notes.map((note) => `<p>${escapeHtml(note)}</p>`), "</body></html>",
      ].join("\n"), `${filename}.html`, "text/html;charset=utf-8") },
      { label: "Markdown", ext: "md", action: () => downloadBlob([
        `# ${title}`, "", summary, "", "| 时间段 | 有效提问 | 其中生成性 | 参与学生 |", "| --- | ---: | ---: | ---: |",
        ...rows.map((row) => `| ${row.join(" | ")} |`), "", ...phaseMarkdown(phases, model.subtypeLabels), ...notes,
      ].join("\n"), `${filename}.md`, "text/markdown;charset=utf-8") },
    ];
  }, [detail, model, phases, timeRange, granularity]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!detail) return <div className="flex min-h-screen items-center justify-center text-sm text-text-tertiary">记录不存在</div>;

  return (
    <SharedResultLayout detail={detail} exportOptions={exportOptions} showTaskSheet={false}>
      <div className="space-y-5">
        <section aria-label="分析基础信息" className="space-y-3 border-b border-border-secondary pb-5">
          <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-2 text-sm">
            {metadata.slice(0, 3).map(([label, value]) => <div key={label} className="flex min-w-0 flex-wrap items-baseline gap-x-2"><dt className="text-text-tertiary">{label}</dt><dd className="break-words font-medium text-text-base">{value}</dd></div>)}
          </dl>
          <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-2 text-sm">
            {metadata.slice(3).map(([label, value]) => <div key={label} className="flex items-baseline gap-2"><dt className="text-text-tertiary">{label}</dt><dd className="font-semibold tabular-nums text-text-base">{value}</dd></div>)}
          </dl>
        </section>

        {auditNeedsReview && <p role="status" className="flex items-start gap-2 text-xs leading-relaxed text-warning"><Info className="mt-0.5 h-4 w-4 shrink-0" />本次统计存在待复核项，可在下方“统计说明与任务单”查看。</p>}
        {classifyState?.status && classifyState.status !== "completed" && <p role="status" className="flex items-start gap-2 text-xs leading-relaxed text-text-tertiary"><Info className="mt-0.5 h-4 w-4 shrink-0" />{
          classifyState.status === "skipped" ? `未配置分析智能体，未做回应 / 生成性归类${classifyState.reason ? `（${classifyState.reason}）` : ""}；生成性暂按关键词估计。`
            : classifyState.status === "empty" ? "分析智能体未返回有效归类结果，生成性暂按关键词估计。"
              : `部分问题未能归类：${classifyState.reason || ""}`
        }</p>}
        <HotQuestionTimeline model={model} />
        <HotPhaseList phases={phases} model={model} />

        <details className="border-t border-border-secondary pt-3 text-xs text-text-secondary">
          <summary className="w-fit cursor-pointer py-1 text-text-tertiary hover:text-text-base">统计说明与任务单</summary>
          <div className="mt-3 space-y-2 leading-relaxed">
            <p>{totals
              ? "仅统计通过质量筛选的学生提问。回应 / 生成性 / 无关由分析智能体结合教学设计和教师提问逐条判断，计数由程序统计；生成性指与本课有关但不在回应任何教师提问的问题。归类不等同于学习效果评价。"
              : "仅统计通过质量筛选的学生提问，生成性问题按已保存的“迁移＋延伸”分类自动识别；该分类不等同于学习效果评价。"}</p>
            <p>教师提问仅用于时间定位，标记与学生提问的先后关系不代表因果关系。统计粒度：{granularity}。</p>
            <p>原始学生消息 {quality?.raw_count ?? resultData.summary?.raw_count ?? "未记录"} 条，排除 {quality?.excluded_count ?? audit?.excluded_event_count ?? "未记录"} 条。{!audit && "本记录未保存统计审计信息，不视为审计通过。"}</p>
            {audit?.warnings?.map((warning) => <p key={warning} className="text-warning">{auditLabels[warning] || `待复核：${warning}`}</p>)}
            {auditNeedsReview && !audit?.warnings?.length && <p className="text-warning">本记录的教师关联统计存在不一致，需回到原始记录复核。</p>}
            {detail.task_sheet && <div className="pt-2"><div className="mb-1 font-medium text-text-base">任务单</div><div className="whitespace-pre-wrap break-words">{detail.task_sheet}</div></div>}
          </div>
        </details>
      </div>
    </SharedResultLayout>
  );
};

export default HotAnalysisResultPage;
