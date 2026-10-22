import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import KnnPage from "./index";
import { knnApi } from "@/services/knn";

const BATCH_ID = "b1";
const openBatch = {
  id: BATCH_ID,
  title: "KNN 运动习惯采集",
  starts_at: "2026-10-20T12:52:00+08:00",
  ends_at: "2026-10-20T23:36:00+08:00",
  phase: "open" as const,
};

vi.mock("@/services/knn", async () => {
  const actual = await vi.importActual<typeof import("@/services/knn")>("@/services/knn");
  return {
    ...actual,
    knnApi: {
      publicBatch: vi.fn(),
      publicList: vi.fn(),
      check: vi.fn(),
      submit: vi.fn(),
    },
  };
});

const renderPage = () => {
  // 关闭轮询与重试，避免测试中残留定时器。
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/games/knn/${BATCH_ID}`]}>
        <Routes>
          <Route path="/games/knn/:batchId" element={<KnnPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

/** 六类运动各选「2 天」，再选报名类别「球类对抗」。 */
const fillAllFields = () => {
  for (const name of ["球类对抗", "力量", "耐力", "技巧", "团队配合", "日常活动"]) {
    const days = screen.getByLabelText(`${name}参与天数`).querySelectorAll("input");
    fireEvent.click(days[2]);
  }
  fireEvent.click(screen.getByLabelText("球类对抗"));
};

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(knnApi.publicBatch).mockResolvedValue(openBatch);
  vi.mocked(knnApi.check).mockResolvedValue({
    ...openBatch,
    student_no: "11",
    current_revision: 0,
    refill_allowed: false,
    can_submit: true,
  });
  vi.mocked(knnApi.submit).mockResolvedValue({
    student_no: "11",
    revision: 1,
    submitted_at: "2026-10-20T20:23:21+08:00",
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("KNN 学生填写页", () => {
  it("修改学号不会清空已填写的答案", async () => {
    renderPage();
    await screen.findByRole("button", { name: "开始填写" });

    fireEvent.change(screen.getByLabelText("学号"), { target: { value: "11" } });
    fireEvent.click(screen.getByRole("button", { name: "开始填写" }));
    await screen.findByText("核对内容");

    fillAllFields();
    fireEvent.click(screen.getByRole("button", { name: "核对内容" }));
    await screen.findByRole("button", { name: "确认提交" });

    // 回到第一步改学号，重新进入后答案仍在，可直接再次进入确认页。
    fireEvent.click(screen.getByRole("button", { name: "返回修改" }));
    fireEvent.click(screen.getByRole("button", { name: "返回" }));
    fireEvent.change(screen.getByLabelText("学号"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "开始填写" }));
    await screen.findByText("核对内容");

    fireEvent.click(screen.getByRole("button", { name: "核对内容" }));
    await screen.findByRole("button", { name: "确认提交" });
    expect(
      screen.queryByText("请完成六项运动习惯和运动意向。"),
    ).not.toBeInTheDocument();
  });

  it("批次已结束时禁止开始填写", async () => {
    vi.mocked(knnApi.publicBatch).mockResolvedValue({ ...openBatch, phase: "ended" });
    renderPage();
    await screen.findByRole("button", { name: "开始填写" });

    expect(screen.getByRole("button", { name: "开始填写" })).toBeDisabled();
    expect(screen.getByText(/当前已到期/)).toBeInTheDocument();
  });

  it("共用设备时不预填上一位同学的学号，并提示草稿归属", async () => {
    sessionStorage.setItem(
      `knn-draft:${BATCH_ID}`,
      JSON.stringify({
        number: "11",
        features: [2, 2, 2, 2, 2, 2],
        label: "球类对抗",
        consent: false,
      }),
    );
    renderPage();
    await screen.findByRole("button", { name: "开始填写" });

    expect(screen.getByLabelText("学号")).toHaveValue("");
    expect(
      screen.getByText(/本设备保存过一次未提交的填写记录（学号 11）/),
    ).toBeInTheDocument();
  });
});
