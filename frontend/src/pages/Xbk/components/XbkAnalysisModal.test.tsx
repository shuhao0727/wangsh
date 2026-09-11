import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { XbkAnalysisModal } from "./XbkAnalysisModal";
import { xbkDataApi } from "@services";
import { showMessage } from "@/lib/toast";

vi.mock("@services", () => ({ xbkDataApi: {
  getSummary: vi.fn(), getCourseStats: vi.fn(), getClassStats: vi.fn(),
  getStudentsWithEmptySelection: vi.fn(), getStudentsWithoutSelection: vi.fn(),
} }));
vi.mock("@/lib/toast", () => ({ showMessage: { error: vi.fn() } }));
const filters = { year: "2026-2027", term: "上学期" as const, grade: "高一" as const, class_name: "1班" };
const summary = { students: 2, courses: 1, selections: 1, unselected_count: 1, suspended_count: 0, no_selection_students: 0 };
const props = { open: true, onCancel: vi.fn(), filters };

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(xbkDataApi.getSummary).mockResolvedValue(summary);
  vi.mocked(xbkDataApi.getCourseStats).mockResolvedValue({ items: [] });
  vi.mocked(xbkDataApi.getClassStats).mockResolvedValue({ items: [] });
  vi.mocked(xbkDataApi.getStudentsWithEmptySelection).mockResolvedValue({ items: [
    { id: 2, year: "2026-2027", term: "上学期", grade: "高一", class_name: "1班", student_no: "00002", name: "未选学生" },
  ] });
});

describe("XbkAnalysisModal", () => {
  it("未选明细使用空课程接口并保留筛选，不混入休学数据", async () => {
    render(<XbkAnalysisModal {...props} />);
    const tab = await screen.findByRole("tab", { name: "未选课学生 (1)" });
    expect(xbkDataApi.getStudentsWithEmptySelection).toHaveBeenCalledWith(filters);
    expect(xbkDataApi.getStudentsWithoutSelection).not.toHaveBeenCalled();
    fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
    fireEvent.click(tab);
    fireEvent.keyDown(tab, { key: "Enter" });
    expect(await screen.findByText("00002")).toBeInTheDocument();
  });

  it("筛选对象重建但值不变时不重复请求", async () => {
    const view = render(<XbkAnalysisModal {...props} />);
    await screen.findByRole("tab", { name: "未选课学生 (1)" });
    view.rerender(<XbkAnalysisModal {...props} filters={{ ...filters }} />);
    expect(xbkDataApi.getSummary).toHaveBeenCalledTimes(1);
  });

  it("失败不把旧数据或零值当作统计结果", async () => {
    vi.mocked(xbkDataApi.getSummary).mockRejectedValueOnce(new Error("offline"));
    render(<XbkAnalysisModal {...props} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("加载分析数据失败");
    expect(screen.queryByRole("tab", { name: "概览" })).not.toBeInTheDocument();
  });

  it("关闭后到达的失败不会污染下一会话", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(xbkDataApi.getSummary).mockImplementationOnce(() => new Promise((_resolve, rej) => { reject = rej; }));
    const view = render(<XbkAnalysisModal {...props} />);
    await waitFor(() => expect(xbkDataApi.getSummary).toHaveBeenCalledTimes(1));
    view.rerender(<XbkAnalysisModal {...props} open={false} />);
    await act(async () => { reject(new Error("old failure")); });
    expect(showMessage.error).not.toHaveBeenCalled();
    view.rerender(<XbkAnalysisModal {...props} />);
    expect(await screen.findByRole("tab", { name: "未选课学生 (1)" })).toBeInTheDocument();
  });
});
