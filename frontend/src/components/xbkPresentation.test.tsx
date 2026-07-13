import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { XbkAnalysisModal } from "@/pages/Xbk/components/XbkAnalysisModal";
import { xbkDataApi } from "@/services";

vi.mock("@/services", () => ({
  xbkDataApi: {
    getSummary: vi.fn(),
    getCourseStats: vi.fn(),
    getClassStats: vi.fn(),
    getStudentsWithoutSelection: vi.fn(),
  },
}));

vi.mock("@/lib/toast", () => ({
  showMessage: {
    error: vi.fn(),
  },
}));

describe("XBK presentation contracts", () => {
  beforeEach(() => {
    vi.mocked(xbkDataApi.getSummary).mockResolvedValue({
      students: 1,
      courses: 1,
      selections: 1,
      unselected_count: 0,
      suspended_count: 0,
    } as never);
    vi.mocked(xbkDataApi.getCourseStats).mockResolvedValue({
      items: [{
        course_code: "C01",
        course_name: "超额课程",
        count: 12,
        allowed_total: 10,
      }],
    } as never);
    vi.mocked(xbkDataApi.getClassStats).mockResolvedValue({ items: [] } as never);
    vi.mocked(xbkDataApi.getStudentsWithoutSelection).mockResolvedValue({
      items: [],
    } as never);
  });

  it("marks courses over their limit as danger", async () => {
    render(
      <XbkAnalysisModal
        open
        onCancel={vi.fn()}
        filters={{ year: 2026, term: "上学期" }}
      />,
    );

    const badge = await screen.findByText("12/10");
    expect(badge).toHaveClass("bg-error-soft");
  });

  it("keeps the current-page export action in the XBK toolbar", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/pages/Xbk/index.tsx"),
      "utf8",
    );

    expect(source).toContain("handleExportCurrentTable");
    expect(source).toContain("当前页");
  });
});
