import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { showMessage } from "@/lib/toast";
import { agentDataApi } from "@services/znt/api";
import TaskAnalysisComparePage from "@/pages/Admin/AgentData/TaskAnalysisComparePage";
import TaskAnalysisListPanel from "@/pages/Admin/AgentData/components/TaskAnalysisListPanel";

vi.mock("@/lib/toast", () => ({
  showMessage: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@services/znt/api", () => ({
  agentDataApi: {
    getTaskAnalysis: vi.fn(),
    getHotAnalysis: vi.fn(),
    getChainAnalysis: vi.fn(),
    listHotAnalyses: vi.fn(),
    listChainAnalyses: vi.fn(),
    deleteHotAnalysis: vi.fn(),
    deleteChainAnalysis: vi.fn(),
  },
}));

vi.mock("echarts", () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock("@components/Admin", () => ({
  AdminTablePanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/data-table", () => ({
  DataTable: ({ table }: { table: any }) => {
    const rows = table.getRowModel().rows;
    const selectColumn = table.getAllColumns().find((column: any) => column.id === "select");
    const actionColumn = table.getAllColumns().find((column: any) => column.id === "actions");
    const selectCell = selectColumn?.columnDef.cell;
    const actionCell = actionColumn?.columnDef.cell;
    return (
      <div data-testid="data-table">
        {rows.map((row: any) => (
          <div key={row.original.id}>
            <span>{row.original.title}</span>
            {typeof selectCell === "function" ? selectCell({ row }) : null}
            {typeof actionCell === "function" ? actionCell({ row }) : null}
          </div>
        ))}
      </div>
    );
  },
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const RouteSwitcher = () => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/task-analysis?type=chains")}>
      switch analysis type
    </button>
  );
};

const TaskAnalysisRoute = () => {
  const [params] = useSearchParams();
  return <TaskAnalysisListPanel analysisType={params.get("type") === "chains" ? "chains" : "hot"} />;
};

describe("async agent analysis pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails the whole comparison when any requested record reports failure", async () => {
    vi.mocked(agentDataApi.getHotAnalysis)
      .mockResolvedValueOnce({
        success: true,
        message: "ok",
        data: { id: 1, title: "A", created_at: "2026-07-11", result: {} },
      })
      .mockResolvedValueOnce({
        success: false,
        message: "无权访问",
        data: null,
      });

    render(
      <MemoryRouter initialEntries={["/task-analysis/compare?type=hot&ids=1,2"]}>
        <TaskAnalysisComparePage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(showMessage.error).toHaveBeenCalled());
    expect(screen.getByText(/对比分析加载失败/)).toBeInTheDocument();
    expect(screen.queryByText("A")).not.toBeInTheDocument();
  });

  it("surfaces a list API business failure instead of presenting an empty list", async () => {
    vi.mocked(agentDataApi.listHotAnalyses).mockResolvedValue({
      success: false,
      message: "服务不可用",
      data: [],
    });

    render(
      <MemoryRouter>
        <TaskAnalysisListPanel analysisType="hot" />
      </MemoryRouter>,
    );

    await waitFor(() => expect(showMessage.error).toHaveBeenCalled());
    expect(screen.getByText(/分析记录加载失败/)).toBeInTheDocument();
  });

  it("does not reload the old analysis type after deletion completes following a type switch", async () => {
    const deletion = deferred<{ success: boolean; message: string; data: null }>();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(agentDataApi.listHotAnalyses).mockResolvedValue({
      success: true,
      message: "ok",
      data: [{ id: 1, title: "Hot", created_at: "2026-07-11", uncovered_count: 0 }],
    });
    vi.mocked(agentDataApi.listChainAnalyses).mockResolvedValue({
      success: true,
      message: "ok",
      data: [],
    });
    vi.mocked(agentDataApi.deleteHotAnalysis).mockReturnValue(deletion.promise);

    render(
      <MemoryRouter initialEntries={["/task-analysis?type=hot"]}>
        <RouteSwitcher />
        <Routes>
          <Route
            path="/task-analysis"
            element={<TaskAnalysisRoute />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("Hot");
    const actionButtons = screen.getByTestId("data-table").querySelectorAll("button");
    fireEvent.click(actionButtons[actionButtons.length - 1]);
    fireEvent.click(screen.getByRole("button", { name: "switch analysis type" }));
    deletion.resolve({ success: true, message: "ok", data: null });

    await waitFor(() => expect(showMessage.success).toHaveBeenCalledWith("已删除"));
    expect(agentDataApi.listHotAnalyses).toHaveBeenCalledTimes(1);
  });

  it("clears selected records when switching analysis type", async () => {
    vi.mocked(agentDataApi.listHotAnalyses).mockResolvedValue({
      success: true,
      message: "ok",
      data: [
        { id: 1, title: "Hot A", created_at: "2026-07-11", uncovered_count: 0 },
        { id: 2, title: "Hot B", created_at: "2026-07-11", uncovered_count: 0 },
      ],
    });
    vi.mocked(agentDataApi.listChainAnalyses).mockResolvedValue({
      success: true,
      message: "ok",
      data: [{ id: 3, title: "Chain A", created_at: "2026-07-11", uncovered_count: 0 }],
    });

    render(
      <MemoryRouter initialEntries={["/task-analysis?type=hot"]}>
        <RouteSwitcher />
        <Routes>
          <Route path="/task-analysis" element={<TaskAnalysisRoute />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("Hot A");
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(screen.getByRole("button", { name: /对比分析 \(2\)/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "switch analysis type" }));

    await screen.findByText("Chain A");
    expect(screen.queryByRole("button", { name: /对比分析/ })).not.toBeInTheDocument();
  });
});
