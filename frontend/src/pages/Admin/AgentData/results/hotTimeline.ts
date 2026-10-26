import dayjs from "dayjs";
import { mergeAnalysisDateAndClockTime } from "../normalize";
import type { HotQuestionLabel, HotStudentQuestionEvent, TaskAnalysisDetail, TaskAnalysisResult } from "../types";

export type HotEvent = HotStudentQuestionEvent & { time: number; label?: HotQuestionLabel };
export type HotTimePoint = {
  start: number;
  end: number;
  total: number | null;
  generative: number | null;
  students: number | null;
  examples: string[];
  events: HotEvent[];
  /** 仅在有 LLM 归类时存在：回应型、无关、未归类条数。 */
  response?: number | null;
  unrelated?: number | null;
  unclassified?: number | null;
};

const count = (value: unknown): number | null => (
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null
);
const firstCount = (...values: unknown[]) => values.map(count).find((value) => value !== null) ?? null;
// 有 LLM 归类时以标签为准（与本课相关但不回应任何教师提问）；旧记录退回关键词分类。
export const isGenerative = (event: HotStudentQuestionEvent & { label?: HotQuestionLabel }) => (
  event.label ? decisive(event.label)?.category === "generative" : event.question_type === "transfer" || event.question_type === "extend"
);
export const timeLabel = (time: number) => dayjs(time).format("HH:mm");

/** 归类标签的中文说明：回应型写明回应哪个教师提问。 */
export function labelText(label: HotQuestionLabel | undefined, subtypeLabels: Record<string, string>) {
  if (!label) return "未归类";
  if (label.ambiguous) return "待确认";
  const sub = label.subtype ? subtypeLabels[label.subtype] || label.subtype : "";
  if (label.category === "response") return `回应 ${label.teacher_ref}${sub ? ` · ${sub}` : ""}`;
  if (label.category === "generative") return `生成性${sub ? ` · ${sub}` : ""}`;
  return "无关";
}
export const intervalLabel = (point: Pick<HotTimePoint, "start" | "end">) => `${timeLabel(point.start)} – ${timeLabel(point.end)}`;

// Only resolve saved timestamps. Shared legacy normalizers also invent fallback times,
// which would turn missing data into an apparently precise classroom timeline here.
function savedTime(value: string | undefined, detail: TaskAnalysisDetail | null): number | null {
  if (!value?.trim()) return null;
  let text = value.trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) {
    const base = detail?.start_at || detail?.end_at || detail?.created_at;
    if (!base || !dayjs(base).isValid()) return null;
    const merged = mergeAnalysisDateAndClockTime(base, text);
    if (!merged) return null;
    text = merged;
    if (detail?.start_at && detail.end_at && dayjs(text).isBefore(detail.start_at)) {
      const nextDay = dayjs(text).add(1, "day");
      if (!nextDay.isAfter(detail.end_at)) text = nextDay.toISOString();
    }
  }
  const parsed = dayjs(text);
  return parsed.isValid() ? parsed.valueOf() : null;
}

function generativeCount(distribution: Record<string, number> | undefined, total: number | null) {
  if (total === 0) return 0;
  if (!distribution || total === null) return null;
  const values = Object.values(distribution);
  if (!values.length || values.some((value) => count(value) === null) || values.reduce((a, b) => a + b, 0) !== total) return null;
  return (distribution.transfer || 0) + (distribution.extend || 0);
}

// 待确认条目不计入任何一类，与后端统计口径保持一致
const decisive = (label?: HotQuestionLabel) => (label && !label.ambiguous ? label : undefined);
/** 后端只归类「有 message_id 且通过质量筛选」的问题（见 hot_agent._classifiable_events），
 *  前端计数必须用同一批事件，否则没有 message_id 的事件会被算成“未归类”而总数里本就没有它。 */
const classifiable = (event: HotEvent) => event.message_id !== undefined;
const categoryCount = (events: HotEvent[], category: HotQuestionLabel["category"]) => (
  events.filter((event) => classifiable(event) && decisive(event.label)?.category === category).length
);

// 回应、生成性、无关按标签计数；总数里扣掉这些确定类别后剩下的都记为“未归类”，
// 它同时包含待确认（多轮无共识）和模型没有返回结果的条目。
function classifiedCounts(events: HotEvent[], total: number | null) {
  const response = categoryCount(events, "response");
  const unrelated = categoryCount(events, "unrelated");
  const labelled = response + unrelated + categoryCount(events, "generative");
  return { response, unrelated, unclassified: total === null ? null : Math.max(0, total - labelled) };
}

export function buildHotTimeline(result: TaskAnalysisResult, detail: TaskAnalysisDetail | null) {
  const notices: string[] = [];
  const rawBuckets = result.timeline_buckets;
  const declaredStart = savedTime(detail?.start_at, detail);
  const declaredEnd = savedTime(detail?.end_at, detail);
  const savedStep = typeof result.bucket_seconds === "number" && Number.isFinite(result.bucket_seconds) && result.bucket_seconds > 0 ? result.bucket_seconds * 1000 : null;
  const durations = (rawBuckets || []).flatMap((bucket) => {
    const start = savedTime(bucket.bucket_start || bucket.start_at, detail);
    const end = savedTime(bucket.bucket_end || bucket.end_at, detail);
    return start !== null && end !== null && end > start ? [end - start] : [];
  });
  const step = savedStep ?? (durations.length && durations.every((value) => value === durations[0]) ? durations[0] : null);
  const labels = result.question_classification?.items || {};
  const classified = Boolean(result.question_classification?.totals);
  const validEvents: HotEvent[] = (result.student_question_events || []).filter((event) => (
    event.included_in_analysis === true || (event.included_in_analysis !== false && event.quality_label === "valid_question")
  )).flatMap((event) => {
    const time = savedTime(event.created_at, detail);
    const label = event.message_id !== undefined ? labels[String(event.message_id)] : undefined;
    return time === null ? [] : [{ ...event, time, ...(label ? { label } : {}) }];
  }).sort((a, b) => a.time - b.time);

  const parsedBuckets = (rawBuckets || []).flatMap((bucket) => {
    const start = savedTime(bucket.bucket_start || bucket.start_at, detail);
    const end = savedTime(bucket.bucket_end || bucket.end_at, detail) ?? (start !== null && step ? start + step : null);
    if (start === null || end === null || end <= start) return [];
    const total = count(bucket.question_count);
    const events = validEvents.filter((event) => event.time >= start && event.time < end);
    return [{
      start, end, total,
      generative: classified ? categoryCount(events, "generative") : generativeCount(bucket.question_type_distribution, total),
      ...(classified ? classifiedCounts(events, total) : {}),
      students: count(bucket.unique_students),
      examples: [...new Set([
        ...(bucket.top_questions || []).map((item) => item.question || ""),
        ...(bucket.representative_questions || []),
      ].filter(Boolean))],
      events,
    }];
  }).sort((a, b) => a.start - b.start);

  const invalidRange = declaredStart !== null && declaredEnd !== null && declaredStart >= declaredEnd;
  const start = invalidRange ? null : declaredStart ?? parsedBuckets[0]?.start ?? null;
  const end = invalidRange ? null : declaredEnd ?? parsedBuckets[parsedBuckets.length - 1]?.end ?? null;
  const overlapping = new Set<HotTimePoint>();
  for (let i = 0; i < parsedBuckets.length; i += 1) {
    for (let j = i + 1; j < parsedBuckets.length && parsedBuckets[j].start < parsedBuckets[i].end; j += 1) {
      overlapping.add(parsedBuckets[i]);
      overlapping.add(parsedBuckets[j]);
    }
  }
  const withinRange = invalidRange ? [] : parsedBuckets.filter((point) => !overlapping.has(point) && (start === null || point.start >= start) && (end === null || point.end <= end));
  const savedTotal = withinRange.every((point) => point.total !== null) ? withinRange.reduce((sum, point) => sum + (point.total || 0), 0) : null;
  const reportedTotal = firstCount(result.analysis_audit?.valid_question_count, result.data_quality?.valid_question_count, result.summary?.valid_question_count);
  const malformed = parsedBuckets.length !== (rawBuckets?.length || 0) || withinRange.length !== parsedBuckets.length;
  const totalMismatch = reportedTotal !== null && savedTotal !== null && reportedTotal !== savedTotal;
  const aligned = step !== null && start !== null && end !== null && withinRange.every((point, i) => (
    (point.start - start) % step === 0 && point.end === Math.min(point.start + step, end) && (i === 0 || point.start >= withinRange[i - 1].end)
  ));
  const canFillZero = result.analysis_version === "hot_v2" && Array.isArray(rawBuckets) && declaredStart !== null && declaredEnd !== null && savedTotal !== null && !invalidRange && !malformed && !totalMismatch && aligned;
  let points: HotTimePoint[] = withinRange;
  // Do not subdivide saved buckets or silently coarsen large analysis ranges.
  const slotCount = step && start !== null && end !== null ? Math.ceil((end - start) / step) : 0;
  if (aligned && slotCount > 0 && slotCount <= 5000 && step && start !== null && end !== null) {
    const byStart = new Map(withinRange.map((point) => [point.start, point]));
    points = Array.from({ length: slotCount }, (_, index) => {
      const time = start + index * step;
      return byStart.get(time) || {
        start: time, end: Math.min(time + step, end),
        total: canFillZero ? 0 : null,
        generative: canFillZero ? 0 : null,
        students: canFillZero ? 0 : null,
        ...(classified ? { response: canFillZero ? 0 : null, unrelated: canFillZero ? 0 : null, unclassified: canFillZero ? 0 : null } : {}),
        examples: [], events: [],
      };
    });
  }
  if (invalidRange) notices.push("分析起止时间无效，无法还原提问变化。");
  if (overlapping.size) notices.push("保存的时段存在重复或重叠，冲突时段未绘入图中，请复核记录。");
  if (malformed && !invalidRange && !overlapping.size) notices.push("部分时段的时间信息不完整，无法定位的数据未绘入图中。");
  if (totalMismatch) notices.push("有效提问总数与保存的时段统计不一致，请复核本次记录。");
  if (!Array.isArray(rawBuckets) || (rawBuckets.length === 0 && !canFillZero)) notices.push("本记录未保存可用的时间统计，无法还原提问变化。");
  if (declaredStart === null || declaredEnd === null) notices.push("分析起止时间未完整保存，仅展示已记录的时段。");
  if (slotCount > 5000) notices.push("分析时段较长，按原统计粒度展示已保存的时段；可缩放查看。");

  if (!aligned || slotCount > 5000) {
    const withGaps: HotTimePoint[] = [];
    let previousEnd = start;
    for (const point of points) {
      if (previousEnd !== null && previousEnd < point.start) withGaps.push({ start: previousEnd, end: point.start, total: null, generative: null, students: null, examples: [], events: [] });
      withGaps.push(point);
      previousEnd = point.end;
    }
    if (previousEnd !== null && end !== null && previousEnd < end) withGaps.push({ start: previousEnd, end, total: null, generative: null, students: null, examples: [], events: [] });
    points = withGaps;
  }
  if (points.some((point) => point.total === null)) notices.push("部分时段未记录提问数量，图中保留空档，不按零计。");
  if (points.some((point) => point.total !== null && point.generative === null)) notices.push("部分时段未保存完整的问题分类，生成性问题显示为未记录。");
  const total = reportedTotal ?? (points.length && !malformed && points.every((point) => point.total !== null) ? savedTotal : null);
  const generative = classified
    ? result.question_classification!.totals!.generative
    : !malformed && !totalMismatch && points.length && points.every((point) => point.generative !== null) ? points.reduce((sum, point) => sum + (point.generative || 0), 0) : null;
  const identities = validEvents.map((event) => event.user_id ?? event.student_id);
  const students = firstCount(result.summary?.unique_students) ?? (
    total !== null && validEvents.length === total && identities.every((id) => id !== undefined) ? new Set(identities).size : null
  );
  const teacherSource = [result.teacher_questions, result.teacher_mainline, result.teacher_marks].find((items) => items?.length) || [];
  // 归类结果里的 teacher_refs 已按时间去重编号，必须用它，否则页面编号会与“回应 Tn”对不上。
  const classifiedTeachers = result.question_classification?.teacher_refs;
  const teachers = classifiedTeachers?.length
    ? classifiedTeachers.flatMap((mark) => {
      const time = savedTime(mark.time, detail);
      return time !== null ? [{ time, question: mark.question, label: mark.ref }] : [];
    })
    : teacherSource.flatMap((mark, index) => {
      const time = savedTime(mark.time, detail);
      return time !== null && mark.question && (start === null || time >= start) && (end === null || time < end)
        ? [{ time, question: mark.question, label: `T${index + 1}` }] : [];
    });
  const subtypeLabels = result.question_classification?.subtype_labels || {};
  return { points, teachers, start, end, step, total, generative, students, notices, classified, events: validEvents, subtypeLabels };
}

export type HotTimelineModel = ReturnType<typeof buildHotTimeline>;

export type HotPhase = {
  ref: string | null;
  question: string | null;
  start: number;
  end: number;
  /** 本阶段回应“本阶段教师提问”的条数，按细分统计。 */
  responses: Record<string, number>;
  responseTotal: number;
  /** 本阶段仍在回应更早教师提问的条数（例如 T2 时段还在问 T1）。 */
  earlierResponses: number;
  generative: HotEvent[];
  unrelated: number;
};

/** 以教师提问为界切分阶段：Tn 到下一个提问之间，看学生如何回应、又生成了哪些新问题。 */
export function buildHotPhases(model: HotTimelineModel): HotPhase[] {
  if (!model.classified || model.start === null || model.end === null) return [];
  const teachers = [...model.teachers].sort((a, b) => a.time - b.time);
  const bounds: Array<{ ref: string | null; question: string | null; start: number }> = [];
  if (!teachers.length || teachers[0].time > model.start) bounds.push({ ref: null, question: null, start: model.start });
  teachers.forEach((item) => bounds.push({ ref: item.label, question: item.question, start: item.time }));
  return bounds.map((bound, index) => {
    const end = bounds[index + 1]?.start ?? model.end!;
    const events = model.events.filter((event) => event.time >= bound.start && event.time < end);
    const responses: Record<string, number> = {};
    let earlierResponses = 0;
    for (const event of events) {
      const label = decisive(event.label);
      if (label?.category !== "response") continue;
      if (label.teacher_ref === bound.ref && label.subtype) {
        responses[label.subtype] = (responses[label.subtype] || 0) + 1;
      } else {
        earlierResponses += 1;
      }
    }
    return {
      ref: bound.ref,
      question: bound.question,
      start: bound.start,
      end,
      responses,
      responseTotal: Object.values(responses).reduce((sum, value) => sum + value, 0),
      earlierResponses,
      generative: events.filter((event) => decisive(event.label)?.category === "generative"),
      unrelated: events.filter((event) => decisive(event.label)?.category === "unrelated").length,
    };
  }).filter((phase) => phase.end > phase.start);
}
