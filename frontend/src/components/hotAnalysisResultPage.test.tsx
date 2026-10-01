import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useAnalysisDetail, useNormalizedResult } = vi.hoisted(() => ({
  useAnalysisDetail: vi.fn(),
  useNormalizedResult: vi.fn(),
}));

vi.mock("@/pages/Admin/AgentData/results/hooks/useAnalysisDetail", () => ({ useAnalysisDetail }));
vi.mock("@/pages/Admin/AgentData/results/hooks/useNormalizedResult", () => ({ useNormalizedResult }));
vi.mock("@/pages/Admin/AgentData/results/SharedResultLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("echarts", () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
}));
vi.mock("echarts-wordcloud", () => ({}));

import HotAnalysisResultPage from "@/pages/Admin/AgentData/results/HotAnalysisResultPage";

const detail = {
  id: 8,
  title: "循环结构课堂热点",
  class_name: "高一 1 班",
  created_at: "2026-09-29T09:30:00Z",
  start_at: "2026-09-29T09:00:00Z",
  end_at: "2026-09-29T10:00:00Z",
};

const baseThemes = [
  {
    topic: "循环边界",
    count: 8,
    unique_students: 4,
    hotness_score: 82,
    commonness_score: 0.8,
    difficulty_signal_score: 0.75,
    persistence_score: 0.6,
    hotness_components: {
      commonness: { score: 0.8, contribution: 36 },
      difficulty: { score: 0.75, contribution: 22.5 },
      persistence: { score: 0.6, contribution: 15 },
    },
    heat_profile: "持续升温",
    hotness_explanation: ["覆盖多个有效学生", "在多个时间桶持续出现"],
    score_basis: "hot_v2",
  },
  {
    topic: "变量初始化",
    count: 3,
    unique_students: 2,
    hotness_score: 41,
    commonness_score: 0.4,
    difficulty_signal_score: 0.35,
    persistence_score: 0.2,
  },
];

const resultData = {
  analysis_version: "hot_v2",
  bucket_seconds: 180,
  data_quality: {
    raw_count: 12,
    valid_question_count: 9,
    excluded_count: 3,
    prompt_echo_count: 1,
    duplicate_count: 1,
    noise_count: 1,
    off_track_count: 1,
    too_short_count: 1,
  },
  analysis_audit: {
    audit_version: "hot_v2_audit_1",
    raw_event_count: 14,
    raw_student_event_count: 12,
    valid_question_count: 9,
    excluded_event_count: 3,
    teacher_anchor_denominator: 9,
    teacher_anchor_match_count: 1,
    teacher_anchor_coverage: 1 / 9,
    teacher_anchor_confidence_total: 1,
    teacher_anchor_statistics_consistent: true,
    warnings: [],
  },
  summary: {
    question_count: 11,
    valid_question_count: 9,
    raw_count: 12,
    unique_students: 5,
    burst_count: 1,
    teacher_anchor_match_count: 1,
    teacher_anchor_coverage: 1 / 9,
    teacher_anchor_confidence_distribution: { low: 1 },
  },
  themes: baseThemes,
  student_question_events: [
    {
      message_id: 101,
      created_at: "2026-09-29T09:18:00Z",
      content: "为什么循环会多执行一次？",
      included_in_analysis: true,
      theme: "循环边界",
      teacher_anchor_id: "teacher-1",
      teacher_anchor_question: "大家先观察循环停止条件。",
      teacher_anchor_score: 0.42,
      teacher_anchor_confidence: "low",
      teacher_anchor_match_type: "time_only",
      teacher_anchor_reason: ["时间接近"],
      trigger_delay_seconds: 35,
    },
  ],
  teacher_questions: [
    { id: "teacher-1", time: "09:17:25", question: "大家先观察循环停止条件。" },
  ],
  timeline_buckets: [
    {
      bucket_start: "09:15",
      bucket_end: "09:18",
      question_count: 4,
      unique_students: 3,
      is_burst: true,
      burst_score: 0.78,
      burst_reasons: ["提问量高于基线", "学生覆盖扩大"],
      volume_signal: 0.8,
      growth_signal: 0.7,
      student_diversity_signal: 0.75,
      teacher_anchor_id: "teacher-1",
      teacher_anchor_question: "大家先观察循环停止条件。",
      teacher_anchor_confidence: "low",
      teacher_anchor_match_type: "time_only",
      teacher_anchor_reason: ["时间接近"],
      trigger_delay_seconds: 35,
      top_questions: [{ question: "为什么循环会多执行一次？", count: 2 }],
      theme_distribution: { "循环边界": 4 },
      question_type_distribution: { clarify: 4 },
    },
  ],
  deep_analysis: {
    theme_analysis: [
      {
        theme: "循环边界",
        question_count: 8,
        unique_students: 4,
        diagnosis: "优先复核循环终止条件的理解。",
        representative_questions: ["为什么循环会多执行一次？"],
      },
    ],
    executive_summary: "本次热点主要集中在循环边界。",
  },
  teaching_suggestions: [],
};

const normalized = {
  wc: [{ word: "循环", count: 8 }],
  resultData,
  covered: [],
  uncovered: baseThemes,
  hotThemes: baseThemes,
  teachingSuggestions: [],
  savedMainQuestionChain: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  useAnalysisDetail.mockReturnValue({ loading: false, detail });
  useNormalizedResult.mockReturnValue(normalized);
});

describe("HotAnalysisResultPage", () => {
  it("renders quality metrics, keeps the hotness score, and preserves unmatched base themes", () => {
    render(<HotAnalysisResultPage />);

    expect(screen.getByText("数据质量与统计口径")).toBeInTheDocument();
    expect(screen.getByText("规则 hot_v2")).toBeInTheDocument();
    expect(screen.getByText("原始学生问题")).toBeInTheDocument();
    expect(screen.getAllByText("12").length).toBeGreaterThan(0);
    expect(screen.getByText("排除/待核查")).toBeInTheDocument();
    expect(screen.getByText("疑似复制/回声")).toBeInTheDocument();
    expect(screen.getByText("噪声拆分：")).toBeInTheDocument();
    expect(screen.getByText("统计口径审计")).toBeInTheDocument();
    expect(screen.getByText("分析原始事件")).toBeInTheDocument();
    expect(screen.getByText("锚点统计分母")).toBeInTheDocument();
    expect(screen.getByText("自洽")).toBeInTheDocument();
    expect(screen.getByText(/教师锚点匹配 1 条/)).toBeInTheDocument();

    expect(screen.getByText("热点形成解释")).toBeInTheDocument();
    const hotnessPanel = screen.getByText("热点形成解释").closest("section");
    expect(hotnessPanel).not.toBeNull();
    expect(within(hotnessPanel as HTMLElement).getByText("循环边界")).toBeInTheDocument();
    expect(within(hotnessPanel as HTMLElement).getByText("82")).toBeInTheDocument();
    expect(within(hotnessPanel as HTMLElement).getAllByText("热点分 / 100")).toHaveLength(2);

    // 深度分析只补充诊断，未匹配到的 hot_v2 主题仍应保留。
    expect(within(hotnessPanel as HTMLElement).getByText("变量初始化")).toBeInTheDocument();
  });

  it("marks low-confidence teacher anchors as review evidence and avoids causal wording", () => {
    render(<HotAnalysisResultPage />);

    expect(screen.getByText("教师提问关联证据")).toBeInTheDocument();
    expect(screen.getByText("低置信度 1")).toBeInTheDocument();
    expect(screen.getByText(/低置信度关联必须回到学生原话和证据索引复核/)).toBeInTheDocument();
    expect(screen.getByText("置信度 低")).toBeInTheDocument();
    expect(screen.getByText("为什么循环会多执行一次？")).toBeInTheDocument();
    expect(screen.getByText(/不是教师提问导致学生困难的因果证明/)).toBeInTheDocument();
    expect(screen.queryByText("教师提问引发了困难", { exact: true })).not.toBeInTheDocument();
  });


  it("labels legacy teacher links with missing confidence as unknown and asks for manual review", () => {
    useNormalizedResult.mockReturnValue({
      ...normalized,
      resultData: {
        ...resultData,
        summary: {
          ...resultData.summary,
          teacher_anchor_coverage: 0,
          teacher_anchor_confidence_distribution: undefined,
        },
        student_question_events: [
          {
            ...resultData.student_question_events[0],
            teacher_anchor_confidence: undefined,
          },
        ],
        timeline_buckets: resultData.timeline_buckets.map((bucket) => ({
          ...bucket,
          teacher_anchor_confidence: undefined,
        })),
      },
    });

    render(<HotAnalysisResultPage />);

    expect(screen.getAllByText("置信度 未知").length).toBeGreaterThan(0);
    expect(screen.getByText("覆盖 未记录")).toBeInTheDocument();
    expect(screen.getByText(/该记录没有保存教师关联置信度分布/)).toBeInTheDocument();
    expect(screen.getByText(/“未知”不代表高或低/)).toBeInTheDocument();
    expect(screen.getByText(/匹配条数与覆盖率字段不一致/)).toBeInTheDocument();
    expect(screen.getAllByText("置信度 未知").length).toBeGreaterThan(1);
  });

  it("shows audit warnings without repairing an inconsistent backend result", () => {
    useNormalizedResult.mockReturnValue({
      ...normalized,
      resultData: {
        ...resultData,
        analysis_audit: {
          ...resultData.analysis_audit,
          teacher_anchor_statistics_consistent: false,
          warnings: ["anchor_denominator_mismatch", "confidence_distribution_mismatch"],
        },
      },
    });

    render(<HotAnalysisResultPage />);

    const qualityPanel = screen.getByText("数据质量与统计口径").closest("section");
    expect(qualityPanel).not.toBeNull();
    expect(within(qualityPanel as HTMLElement).getByText("需复核")).toBeInTheDocument();
    expect(within(qualityPanel as HTMLElement).getByText(/教师锚点分母与有效问题数不一致/)).toBeInTheDocument();
    expect(within(qualityPanel as HTMLElement).getByText(/教师锚点置信度分布与匹配数不一致/)).toBeInTheDocument();
  });

  it("does not invent a score for legacy records and still shows a consistent raw-count fallback", () => {
    const legacyThemes = baseThemes.map(({
      hotness_score: _hotnessScore,
      commonness_score: _commonnessScore,
      difficulty_signal_score: _difficultySignalScore,
      persistence_score: _persistenceScore,
      hotness_components: _hotnessComponents,
      ...theme
    }) => theme);
    useNormalizedResult.mockReturnValue({
      ...normalized,
      resultData: {
        ...resultData,
        data_quality: undefined,
        analysis_audit: undefined,
        summary: { ...resultData.summary, question_count: 2, valid_question_count: undefined },
        student_question_events: [
          { ...resultData.student_question_events[0], message_id: 201 },
          { ...resultData.student_question_events[0], message_id: 202 },
        ],
        themes: legacyThemes,
        deep_analysis: { theme_analysis: [] },
      },
      hotThemes: legacyThemes,
      uncovered: legacyThemes,
    });

    render(<HotAnalysisResultPage />);

    const qualityPanel = screen.getByText("数据质量与统计口径").closest("section");
    expect(qualityPanel).not.toBeNull();
    expect(within(qualityPanel as HTMLElement).getByText("原始学生问题")).toBeInTheDocument();
    expect(within(qualityPanel as HTMLElement).getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/当前记录识别到了主题，但没有保存可解释热点分数/)).toBeInTheDocument();
    expect(screen.getByText(/不参与热点困难度排序/)).toBeInTheDocument();
    expect(screen.queryByText("热点分 / 100")).not.toBeInTheDocument();
  });

  it("keeps timeline display controls and switches the presentation bucket without changing the analysis copy", () => {
    render(<HotAnalysisResultPage />);

    expect(screen.getByText("课堂提问时序分析")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1分钟" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3分钟" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "5分钟" })).toBeInTheDocument();
    expect(screen.getByText(/教师提问作为时间\/语义锚点用于复盘定位/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "5分钟" }));
    expect(screen.getByText(/教师提问作为时间\/语义锚点用于复盘定位/)).toBeInTheDocument();
  });
});
