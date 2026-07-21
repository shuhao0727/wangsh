import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import ChainAnalysisResultPage from "@/pages/Admin/AgentData/results/ChainAnalysisResultPage";

vi.mock("@/pages/Admin/AgentData/results/SharedResultLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/pages/Admin/AgentData/results/hooks/useAnalysisDetail", () => ({
  useAnalysisDetail: () => ({
    loading: false,
    isBeamView: true,
    detail: {
      id: 1,
      title: "问题链分析",
      class_name: "高一 1 班",
      created_at: "2026-07-19T00:00:00Z",
    },
  }),
}));

vi.mock("@/pages/Admin/AgentData/results/hooks/useNormalizedResult", () => ({
  useNormalizedResult: () => ({}),
}));

vi.mock("@/pages/Admin/AgentData/results/hooks/useBeamData", () => ({
  useBeamData: () => ({
    resultData: { merged_groups: [], deep_analysis: {} },
    chainCount: 0,
    teacherAnchorCount: 0,
    questionTotal: 0,
    studentTotal: 0,
    savedStudentChains: [],
  }),
}));

vi.mock("@/pages/Admin/AgentData/components/ChainBeamChart", () => ({
  default: () => <div>问题链光束图</div>,
}));

test("does not show time-bucket controls that do not change the analysis", () => {
  render(<ChainAnalysisResultPage />);

  expect(screen.queryByRole("button", { name: "1分钟" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "3分钟" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "5分钟" })).not.toBeInTheDocument();
});
