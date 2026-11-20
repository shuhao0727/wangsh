import { Profiler } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@services/api";
import TaskAnalysisResultPage from "../TaskAnalysisResultPage";
import ChainAnalysisResultPage from "./ChainAnalysisResultPage";
import HotAnalysisResultPage from "./HotAnalysisResultPage";

const legacy = "/ai-agents/analysis/task-analyses";
const hot = "/ai-agents/analysis/hot-questions";
const chains = "/ai-agents/analysis/student-chains";

function response(data: unknown, status = 200): AxiosResponse {
  return { data, status, statusText: "", headers: {}, config: { headers: new AxiosHeaders() } };
}

function record(id: number, title: string) {
  return response({
    id, title, agent_id: null, class_name: null, start_at: null, end_at: null,
    result: {}, created_at: "2026-11-18T10:00:00Z", task_sheet: "",
  });
}

function httpError(status: number, detail: string) {
  return new AxiosError(`HTTP ${status}`, undefined, undefined, undefined, response({ detail }, status));
}

function openReport(url: string, onCommit?: () => void) {
  const router = createMemoryRouter([
    { path: "/task-analysis/:analysisId", element: <TaskAnalysisResultPage /> },
    { path: "/task-analysis/hot/:analysisId", element: <HotAnalysisResultPage /> },
    { path: "/task-analysis/chains/:analysisId", element: <ChainAnalysisResultPage /> },
  ], { initialEntries: [url] });
  render(<Profiler id="report" onRender={() => onCommit?.()}><RouterProvider router={router} /></Profiler>);
  return router;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("analysis result routes", () => {
  it.each([
    ["/task-analysis/13?view=timeline&type=hot", 404, hot, "记录不存在"],
    ["/task-analysis/13?view=beam&type=chains", 503, chains, "服务暂不可用"],
    ["/task-analysis/hot/13?type=chains", 503, hot, "服务暂不可用"],
    ["/task-analysis/chains/13?type=hot", 404, chains, "记录不存在"],
  ] as const)("only requests the selected report for %s after HTTP %i", async (target, status, endpoint, message) => {
    const get = vi.spyOn(api.client, "get").mockImplementation((path) => {
      if (path === `${endpoint}/13`) return Promise.reject(httpError(status, message));
      return Promise.resolve(record(13, "其他表的同号报告"));
    });
    openReport(target);
    expect(await screen.findByText(new RegExp(message))).toBeVisible();
    expect(screen.queryByRole("heading", { name: "其他表的同号报告" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "导出" })).not.toBeInTheDocument();
    expect(get.mock.calls.map(([path]) => path)).toEqual([`${endpoint}/13`]);
  });

  it("removes the previous report and its open export menu on the first commit after navigation", async () => {
    let rejectTarget!: (error: AxiosError) => void;
    vi.spyOn(api.client, "get")
      .mockResolvedValueOnce(record(12, "上一条报告"))
      .mockReturnValueOnce(new Promise<AxiosResponse>((_, reject) => { rejectTarget = reject; }))
      .mockRejectedValue(httpError(404, "记录不存在"));
    const commitsAfterSwitch: Array<string | null> = [];
    let switched = false;
    const router = openReport("/task-analysis/12?type=hot", () => {
      if (switched) commitsAfterSwitch.push(document.querySelector("h1")?.textContent ?? null);
    });
    await screen.findByRole("heading", { name: "上一条报告" });
    fireEvent.click(screen.getByRole("button", { name: "导出" }));
    expect(screen.getByRole("button", { name: /Markdown/ })).toBeVisible();

    switched = true;
    await act(async () => { await router.navigate("/task-analysis/13?type=hot"); });
    expect(screen.queryByRole("button", { name: /导出|Markdown/ })).not.toBeInTheDocument();
    await act(async () => { rejectTarget(httpError(404, "记录不存在")); });
    expect(commitsAfterSwitch).not.toContain("上一条报告");
    expect(screen.getByText("记录不存在")).toBeVisible();
    expect(screen.queryByRole("button", { name: /导出|Markdown/ })).not.toBeInTheDocument();
  });

  it.each([
    ["/task-analysis/13", hot],
    ["/task-analysis/13?view=beam", chains],
  ])("keeps the old link order for %s after a missing legacy record", async (url, endpoint) => {
    const get = vi.spyOn(api.client, "get")
      .mockRejectedValueOnce(httpError(404, "记录不存在"))
      .mockResolvedValueOnce(record(13, "兼容报告"));
    openReport(url);
    expect(await screen.findByRole("heading", { name: "兼容报告" })).toBeVisible();
    expect(get.mock.calls.map(([path]) => path)).toEqual([`${legacy}/13`, `${endpoint}/13`]);
  });

  it.each([
    [503, "服务暂不可用"],
    [403, "获取任务分析失败"],
  ] as const)("does not fall back for a legacy HTTP %i", async (status, message) => {
    const get = vi.spyOn(api.client, "get")
      .mockRejectedValueOnce(httpError(status, "加载失败"))
      .mockResolvedValueOnce(record(13, "其他表的同号报告"));
    openReport("/task-analysis/13");
    expect(await screen.findByText(new RegExp(message))).toBeVisible();
    expect(screen.queryByRole("button", { name: "导出" })).not.toBeInTheDocument();
    expect(get.mock.calls.map(([path]) => path)).toEqual([`${legacy}/13`]);
  });

  it.each([
    ["hot", "chains", hot, chains, "热点甲", "问题链乙", /Markdown/, /^问题链分析_问题链乙_\d{8}\.md$/],
    ["chains", "hot", chains, hot, "问题链甲", "热点乙", /HTML 报告/, /^热点分析_热点乙_\d{8}\.html$/],
  ] as const)("exports the current report when switching from %s to %s at the same ID", async (
    previousType, targetType, previousEndpoint, targetEndpoint, previousTitle, targetTitle, format, filename,
  ) => {
    const get = vi.spyOn(api.client, "get")
      .mockResolvedValueOnce(record(13, previousTitle))
      .mockResolvedValueOnce(record(13, targetTitle));
    const createObjectURL = vi.fn<(_blob: Blob) => string>(() => "blob:analysis-report");
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = vi.fn();
    });
    const filenames: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      filenames.push(this.download);
    });
    const router = openReport(`/task-analysis/13?view=beam&type=${previousType}`);
    expect(await screen.findByRole("heading", { name: previousTitle })).toBeVisible();
    await act(async () => { await router.navigate(`/task-analysis/13?view=beam&type=${targetType}`); });
    expect(await screen.findByRole("heading", { name: targetTitle })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "导出" }));
    fireEvent.click(screen.getByRole("button", { name: format }));
    expect(filenames).toEqual([expect.stringMatching(filename)]);
    const content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(createObjectURL.mock.calls[0][0]);
    });
    expect(content).toContain(targetTitle);
    expect(content).not.toContain(previousTitle);
    expect(get.mock.calls.map(([path]) => path)).toEqual([`${previousEndpoint}/13`, `${targetEndpoint}/13`]);
  });
});
