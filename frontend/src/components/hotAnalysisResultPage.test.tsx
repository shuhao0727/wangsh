import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskAnalysisDetail, TaskAnalysisResult } from "@/pages/Admin/AgentData/types";
import { buildHotPhases, buildHotTimeline } from "@/pages/Admin/AgentData/results/hotTimeline";

const { useAnalysisDetail, useNormalizedResult, chart, handlers, zrHandlers } = vi.hoisted(() => ({
  useAnalysisDetail: vi.fn(),
  useNormalizedResult: vi.fn(),
  chart: { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn(), containPixel: vi.fn(() => true), convertFromPixel: vi.fn() },
  handlers: new Map<string, (event: unknown) => void>(),
  zrHandlers: new Map<string, (event: unknown) => void>(),
}));
vi.mock("@/pages/Admin/AgentData/results/hooks/useAnalysisDetail", () => ({ useAnalysisDetail }));
vi.mock("@/pages/Admin/AgentData/results/hooks/useNormalizedResult", () => ({ useNormalizedResult }));
// 图表库已改为按需封装 @/lib/echarts，mock 需指向封装模块
vi.mock("@/lib/echarts", () => ({
  echarts: {
  init: vi.fn(() => ({
    ...chart,
    on: (name: string, callback: (event: unknown) => void) => handlers.set(name, callback),
    getZr: () => ({
      on: (name: string, callback: (event: unknown) => void) => zrHandlers.set(name, callback),
      off: (name: string) => zrHandlers.delete(name),
    }),
  })),
  },
}));

import HotAnalysisResultPage from "@/pages/Admin/AgentData/results/HotAnalysisResultPage";

const at = (time: string) => `2026-10-23T${time}:00+08:00`;
const detail: TaskAnalysisDetail = {
  id: 8, title: "循环结构课堂热点", class_name: "高一 1 班",
  created_at: at("09:15"), start_at: at("09:00"), end_at: at("09:12"), task_sheet: "用循环寻找最近的邻居。",
};
const resultData: TaskAnalysisResult = {
  analysis_version: "hot_v2", bucket_seconds: 180,
  summary: { valid_question_count: 4, unique_students: 3, raw_count: 5 },
  data_quality: { raw_count: 5, valid_question_count: 4, excluded_count: 1 },
  analysis_audit: { valid_question_count: 4, teacher_anchor_statistics_consistent: true, warnings: [] },
  timeline_buckets: [
    { bucket_start: at("09:00"), bucket_end: at("09:03"), question_count: 3, unique_students: 2, question_type_distribution: { clarify: 1, transfer: 1, extend: 1 }, top_questions: [{ question: "循环怎么停止？" }] },
    { bucket_start: at("09:06"), bucket_end: at("09:09"), question_count: 1, unique_students: 1, question_type_distribution: { debug: 1 } },
  ],
  student_question_events: [
    { message_id: 1, user_id: 1, user_name: "学生甲", created_at: at("09:00"), content: "循环怎么停止？", question_type: "clarify", included_in_analysis: true },
    { message_id: 2, user_id: 2, user_name: "学生乙", created_at: at("09:01"), content: "如果换成其他数据呢？", question_type: "transfer", question_type_label: "迁移", included_in_analysis: true },
    { message_id: 3, user_id: 1, user_name: "学生甲", created_at: at("09:02"), content: "还能进一步扩展吗？", question_type: "extend", question_type_label: "延伸", included_in_analysis: true },
    { message_id: 4, user_id: 3, user_name: "学生丙", created_at: at("09:07"), content: "这里的下标为什么报错？", question_type: "debug", included_in_analysis: true },
    { message_id: 5, user_id: 4, created_at: at("09:01"), content: "排除的闲聊", question_type: "off_track", included_in_analysis: false },
  ],
  teacher_questions: [
    { time: at("09:01"), question: "先观察终止条件。" },
    { time: at("09:02"), question: "换个数据会怎样？" },
  ],
};

// 分析智能体逐条归类后的结果：T1/T2 编号由后端按时间生成。
const classifiedData: TaskAnalysisResult = {
  ...resultData,
  question_classification: {
    version: "hot_classify_v1",
    subtype_labels: { clarify: "理解追问", apply: "尝试应用", debug: "调试求助", verify: "核对确认", principle: "原理深挖", transfer: "迁移拓展", new_confusion: "新的困惑" },
    items: {
      "1": { category: "response", subtype: "clarify", teacher_ref: "T1", reason: "在问终止条件" },
      "2": { category: "generative", subtype: "transfer", teacher_ref: null, reason: "换数据场景" },
      "3": { category: "response", subtype: "apply", teacher_ref: "T2", reason: "照着做" },
      "4": { category: "generative", subtype: "new_confusion", teacher_ref: null, reason: "下标越界的误解" },
    },
    totals: { response: 2, generative: 2, unrelated: 0, unclassified: 0 },
    teachers: [
      { ref: "T1", time: at("09:01"), question: "先观察终止条件。", response_count: 1, subtypes: { clarify: 1 } },
      { ref: "T2", time: at("09:02"), question: "换个数据会怎样？", response_count: 1, subtypes: { apply: 1 } },
    ],
  },
  classification_status: { enabled: true, status: "completed", reason: null },
};
const useResult = (result: TaskAnalysisResult) => useNormalizedResult.mockReturnValue({ resultData: result });
const getOption = () => chart.setOption.mock.lastCall![0];
const choose = (index: number) => fireEvent.change(screen.getByLabelText("查看时段"), { target: { value: String(index) } });

beforeEach(() => {
  vi.clearAllMocks();
  handlers.clear();
  zrHandlers.clear();
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  useAnalysisDetail.mockReturnValue({ loading: false, detail });
  useResult(resultData);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("热点问题时间统计", () => {
  it("保留完整分析区间和空桶，生成性作为总数的子集，人数按全程去重", () => {
    const model = buildHotTimeline(resultData, detail);
    expect(model.points.map((point) => [point.total, point.generative])).toEqual([[3, 2], [0, 0], [1, 0], [0, 0]]);
    expect(model.start).toBe(Date.parse(detail.start_at!));
    expect(model.end).toBe(Date.parse(detail.end_at!));
    expect(model.total).toBe(4);
    expect(model.generative).toBe(2);
    expect(model.students).toBe(3);
    const withoutSummary = buildHotTimeline({ ...resultData, summary: undefined }, detail);
    expect(withoutSummary.students).toBe(3);
    expect(buildHotTimeline({ ...resultData, summary: undefined, student_question_events: [] }, detail).students).toBeNull();
  });

  it("旧记录的未知时段和缺失分类保持未知，不伪造零或全量人数", () => {
    const model = buildHotTimeline({
      ...resultData, analysis_version: undefined, summary: undefined, student_question_events: [],
      timeline_buckets: resultData.timeline_buckets!.map((bucket) => ({ ...bucket, question_type_distribution: undefined })),
    }, detail);
    expect(model.points.map((point) => point.total)).toEqual([3, null, 1, null]);
    expect(model.points.map((point) => point.generative)).toEqual([null, null, null, null]);
    expect(model.generative).toBeNull();
    expect(model.students).toBeNull();
    expect(model.notices.join(" ")).toContain("不按零计");
  });

  it("不允许重复桶重复计数，也不将异常总数掩盖为空桶零值", () => {
    const duplicate = buildHotTimeline({ ...resultData, timeline_buckets: [...resultData.timeline_buckets!, resultData.timeline_buckets![0]] }, detail);
    expect(duplicate.points[0].total).toBeNull();
    expect(duplicate.generative).toBeNull();
    expect(duplicate.notices.join(" ")).toContain("重复或重叠");
    const mismatch = buildHotTimeline({ ...resultData, analysis_audit: { valid_question_count: 10 } }, detail);
    expect(mismatch.total).toBe(10);
    expect(mismatch.points[1].total).toBeNull();
    expect(mismatch.notices.join(" ")).toContain("不一致");
  });

  it("缺失或无效时间不能从索引生成，时间范围颠倒时不绘图", () => {
    expect(buildHotTimeline({ timeline_buckets: [{ question_count: 2 }] }, detail).points.every((point) => point.total === null)).toBe(true);
    const invalid = buildHotTimeline(resultData, { ...detail, start_at: detail.end_at, end_at: detail.start_at });
    expect(invalid.points).toEqual([]);
    expect(invalid.notices.join(" ")).toContain("起止时间无效");
    const empty = buildHotTimeline({}, detail);
    expect(empty.total).toBeNull();
    expect(empty.generative).toBeNull();
  });

  it("非规则时段仍为真实时间，未知长空档断开折线并提示", () => {
    const irregular = buildHotTimeline({
      analysis_version: "legacy",
      timeline_buckets: [
        { bucket_start: at("09:00"), bucket_end: at("09:02"), question_count: 1, question_type_distribution: { transfer: 1 } },
        { bucket_start: at("09:07"), bucket_end: at("09:10"), question_count: 1, question_type_distribution: { extend: 1 } },
      ],
    }, detail);
    expect(irregular.step).toBeNull();
    expect(irregular.points.map((point) => point.total)).toEqual([1, null, 1, null]);
    expect(irregular.notices.join(" ")).toContain("保留空档");
  });

  it("同桶教师提问保留各自真实时间，跨午夜旧时钟值使用分析日期", () => {
    expect(buildHotTimeline(resultData, detail).teachers.map((mark) => mark.time)).toEqual([Date.parse(at("09:01")), Date.parse(at("09:02"))]);
    // Legacy clock-only values follow the page's local timezone, as the shared normalizer does.
    const overnight = buildHotTimeline({ teacher_questions: [{ time: "00:01", question: "跨午夜提问" }] }, {
      ...detail,
      start_at: new Date(2026, 9, 23, 23, 50).toISOString(),
      end_at: new Date(2026, 9, 24, 0, 10).toISOString(),
    });
    expect(overnight.teachers[0].time).toBe(new Date(2026, 9, 24, 0, 1).getTime());
  });
});

describe("HotAnalysisResultPage", () => {
  it("基础信息后直接显示时间图，柱线同轴、不堆叠、不平滑插值", () => {
    const view = render(<HotAnalysisResultPage />);
    const metadata = screen.getByRole("region", { name: "分析基础信息" });
    expect(within(metadata).getByText("3 人")).toBeInTheDocument();
    expect(within(metadata).getByText("4 条")).toBeInTheDocument();
    expect(within(metadata).getByText("2 条")).toBeInTheDocument();
    expect(screen.queryByText("热点形成解释")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "1分钟" })).not.toBeInTheDocument();
    const option = getOption();
    expect(option.xAxis[1].type).toBe("time");
    expect(option.xAxis[1].min).toBe(Date.parse(detail.start_at!));
    expect(option.xAxis[1].max).toBe(Date.parse(detail.end_at!));
    const [bar, line, teacher] = option.series;
    expect(bar.type).toBe("bar");
    expect(bar.data.map((item: number[]) => item[1])).toEqual([3, 0, 1, 0]);
    expect(line.data.map((item: number[]) => item[1])).toEqual([2, 0, 0, 0]);
    expect(line.stack).toBeUndefined();
    expect(line.smooth).toBe(false);
    expect(line.connectNulls).toBe(false);
    expect(teacher.data).toHaveLength(2);
    expect(option.tooltip.formatter([{ seriesId: "questions", dataIndex: 0 }])).toContain("参与学生：2 人");
    view.unmount();
    expect(chart.dispose).toHaveBeenCalled();
    expect(zrHandlers.size).toBe(0);
  });

  it("点击柱形看有效原问，点击折线仅看生成性，排除记录不混入", () => {
    render(<HotAnalysisResultPage />);
    act(() => handlers.get("click")!({ seriesId: "questions", dataIndex: 0 }));
    expect(screen.getByText("循环怎么停止？")).toBeInTheDocument();
    expect(screen.getByText("如果换成其他数据呢？")).toBeInTheDocument();
    expect(screen.queryByText("排除的闲聊")).not.toBeInTheDocument();
    expect(screen.getByText("已保存本时段全部 3 条有效原问。")).toBeInTheDocument();
    act(() => handlers.get("click")!({ seriesId: "generative", dataIndex: 0 }));
    expect(screen.queryByText("循环怎么停止？")).not.toBeInTheDocument();
    expect(screen.getByText("还能进一步扩展吗？")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "仅生成性" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "全部" }));
    expect(screen.getByText("循环怎么停止？")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "收起" }));
    expect(screen.queryByRole("region", { name: "时段原问" })).not.toBeInTheDocument();
  });

  it("空白和零时段可点击，也能通过选择框访问", () => {
    render(<HotAnalysisResultPage />);
    chart.convertFromPixel.mockReturnValue([Date.parse(at("09:04")), 0]);
    act(() => zrHandlers.get("click")!({ offsetX: 200, offsetY: 100 }));
    expect(screen.getByText("本时段没有有效学生提问。")).toBeInTheDocument();
    choose(2);
    expect(screen.getByText("这里的下标为什么报错？")).toBeInTheDocument();
  });

  it("只有摘要的旧记录明确标注，不能从摘要伪造逐条分类", () => {
    useResult({ ...resultData, student_question_events: undefined });
    render(<HotAnalysisResultPage />);
    choose(0);
    expect(screen.getByText(/典型原问摘要：本记录仅保存了摘要/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "仅生成性" }));
    expect(screen.getByText(/未保存可筛选的生成性原问/)).toBeInTheDocument();
    expect(screen.queryByText("循环怎么停止？")).not.toBeInTheDocument();
  });

  it("审计异常简短提示，详情折叠且不替后端修正统计", () => {
    useResult({ ...resultData, analysis_audit: { valid_question_count: 4, teacher_anchor_statistics_consistent: false, warnings: ["anchor_denominator_mismatch"] } });
    render(<HotAnalysisResultPage />);
    expect(screen.getByRole("status")).toHaveTextContent("本次统计存在待复核项");
    const disclosure = screen.getByText("统计说明与任务单").closest("details")!;
    expect(disclosure.open).toBe(false);
    fireEvent.click(screen.getByText("统计说明与任务单"));
    expect(disclosure.open).toBe(true);
    expect(screen.getByText("教师关联统计分母与有效问题数不一致")).toBeVisible();
    expect(screen.getByText(/先后关系不代表因果关系/)).toBeVisible();
  });

  it("没有统计的记录显示明确空态，仍保留导出入口", () => {
    useResult({});
    render(<HotAnalysisResultPage />);
    expect(screen.getByRole("status")).toHaveTextContent("没有可绘制的时间统计");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /导出/ }));
    expect(screen.getByRole("button", { name: /HTML 报告/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Markdown/ })).toBeInTheDocument();
  });
});

describe("回应 / 生成性归类", () => {
  it("有归类时生成性以智能体标签为准，不再看关键词", () => {
    const model = buildHotTimeline(classifiedData, detail);
    expect(model.classified).toBe(true);
    expect(model.generative).toBe(2);
    // 第 4 条“下标为什么报错”没有迁移类关键词，按标签仍计为生成性
    expect(model.points.map((point) => [point.response, point.generative, point.unrelated])).toEqual([[2, 1, 0], [0, 0, 0], [0, 1, 0], [0, 0, 0]]);
    expect(model.teachers.map((item) => item.label)).toEqual(["T1", "T2"]);
  });

  it("按教师提问切分阶段，区分回应本题、回应更早提问与生成性", () => {
    const phases = buildHotPhases(buildHotTimeline(classifiedData, detail));
    expect(phases.map((phase) => phase.ref)).toEqual([null, "T1", "T2"]);
    const [lead, t1, t2] = phases;
    expect(lead.earlierResponses).toBe(1);
    expect(t1.generative.map((event) => event.content)).toEqual(["如果换成其他数据呢？"]);
    expect(t2.responses).toEqual({ apply: 1 });
    expect(t2.generative.map((event) => event.label?.subtype)).toEqual(["new_confusion"]);
    expect(buildHotPhases(buildHotTimeline(resultData, detail))).toEqual([]);
  });

  it("堆叠柱按类别筛选原问，并展示判断依据与分阶段列表", () => {
    useResult(classifiedData);
    render(<HotAnalysisResultPage />);
    const series = getOption().series;
    expect(series.slice(0, 4).map((item: { id: string; stack?: string }) => [item.id, item.stack])).toEqual([
      ["response", "questions"], ["generative", "questions"], ["unrelated", "questions"], ["unclassified", "questions"],
    ]);
    act(() => handlers.get("click")!({ seriesId: "generative", dataIndex: 0 }));
    const region = screen.getByRole("region", { name: "时段原问" });
    expect(within(region).getByText("如果换成其他数据呢？")).toBeInTheDocument();
    expect(within(region).queryByText("循环怎么停止？")).not.toBeInTheDocument();
    expect(within(region).getByText("判断依据：换数据场景")).toBeInTheDocument();
    fireEvent.click(within(region).getByRole("button", { name: "回应" }));
    expect(within(region).getByText("回应 T1 · 理解追问")).toBeInTheDocument();
    const phases = screen.getByRole("region", { name: "按教师提问分阶段" });
    expect(within(phases).getByText("先观察终止条件。")).toBeInTheDocument();
    expect(within(phases).getByText("判断依据：下标越界的误解")).toBeInTheDocument();
  });

  it("未配置分析智能体时明确说明生成性仍是关键词估计", () => {
    useResult({ ...resultData, classification_status: { enabled: false, status: "skipped", reason: "未选择分析智能体" } });
    render(<HotAnalysisResultPage />);
    expect(screen.getByText(/未做回应 \/ 生成性归类（未选择分析智能体）/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "按教师提问分阶段" })).not.toBeInTheDocument();
  });

  it("多轮判定未取得多数的条目显示待确认，不计入任何类别", () => {
    useResult({
      ...classifiedData,
      question_classification: {
        ...classifiedData.question_classification!,
        items: {
          ...classifiedData.question_classification!.items,
          "2": { category: "generative", subtype: "transfer", teacher_ref: null, reason: "换场景", ambiguous: true, agreement: 0.33, votes: 3 },
        },
        totals: { response: 2, generative: 1, unrelated: 0, unclassified: 1 },
        ambiguous_count: 1,
        vote_rounds: 3,
      },
    });
    render(<HotAnalysisResultPage />);
    const model = buildHotTimeline(resultData, detail);
    act(() => handlers.get("click")!({ seriesId: "questions", dataIndex: 0 }));
    const region = screen.getByRole("region", { name: "时段原问" });
    expect(within(region).getByText("待确认")).toBeInTheDocument();
    expect(within(region).getByText(/多次判定未取得多数/)).toBeInTheDocument();
    fireEvent.click(within(region).getByRole("button", { name: "生成性" }));
    expect(within(region).queryByText("如果换成其他数据呢？")).not.toBeInTheDocument();
    expect(model).toBeTruthy();
  });
});
