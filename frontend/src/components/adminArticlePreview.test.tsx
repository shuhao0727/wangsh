import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { AxiosHeaders } from "axios";
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { articleApi } from "@services";
import AdminArticlePreviewPage from "@/pages/Admin/Articles/PreviewPage";

vi.mock("@services", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@services")>()),
  articleApi: {
    getArticleBySlug: vi.fn(),
  },
}));

type PreviewResponse = Awaited<ReturnType<typeof articleApi.getArticleBySlug>>;

function deferredPreview() {
  let resolve!: (response: PreviewResponse) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<PreviewResponse>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function previewResponse(id: number, title: string): PreviewResponse {
  return {
    data: {
      id, title, slug: `draft-${id}`, content: `${title}正文`, summary: "",
      custom_css: null, style_key: null, style: null, published: false,
      author_id: 1, category_id: null, created_at: "2026-10-11T00:00:00Z",
      updated_at: "2026-10-11T00:00:00Z",
      author: { id: 1, username: "preview-author", full_name: null }, category: null,
    },
    status: 200, statusText: "OK", headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };
}

function renderPreview() {
  const router = createMemoryRouter([
    { path: "/admin/articles/preview/:slug", element: <AdminArticlePreviewPage /> },
  ], { initialEntries: ["/admin/articles/preview/draft-1"] });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe("AdminArticlePreviewPage", () => {
  beforeEach(() => vi.resetAllMocks());

  it("loads a draft through the protected slug API", async () => {
    vi.mocked(articleApi.getArticleBySlug).mockResolvedValue({
      data: {
        id: 9,
        title: "草稿预览",
        slug: "draft-preview",
        content: "正文内容",
        summary: "摘要",
        custom_css: null,
        style_key: null,
        style: null,
        published: false,
        author_id: 1,
        category_id: null,
        created_at: "2026-10-11T00:00:00Z",
        updated_at: "2026-10-11T00:00:00Z",
        author: null,
        category: null,
      },
    } as never);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/admin/articles/preview/draft-preview"]}>
          <Routes>
            <Route path="/admin/articles/preview/:slug" element={<AdminArticlePreviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(articleApi.getArticleBySlug).toHaveBeenCalledWith("draft-preview"));
    expect(await screen.findByText("草稿预览")).toBeInTheDocument();
    expect(screen.getByText("正文内容")).toBeInTheDocument();
  });

  it("recovers from a failed slug when the next slug succeeds", async () => {
    const next = deferredPreview();
    vi.mocked(articleApi.getArticleBySlug)
      .mockRejectedValueOnce(new Error("first draft unavailable"))
      .mockReturnValueOnce(next.promise);
    const router = renderPreview();
    expect(await screen.findByText("文章预览失败")).toBeInTheDocument();

    await act(async () => { await router.navigate("/admin/articles/preview/draft-2"); });
    await act(async () => { next.resolve(previewResponse(2, "恢复的草稿")); });

    expect(await screen.findByRole("heading", { name: "恢复的草稿" })).toBeInTheDocument();
    expect(screen.getByText("恢复的草稿正文")).toBeInTheDocument();
    expect(screen.queryByText("文章预览失败")).not.toBeInTheDocument();
    expect(articleApi.getArticleBySlug).toHaveBeenLastCalledWith("draft-2");
  });

  it("clears the previous article while the next slug is loading", async () => {
    const next = deferredPreview();
    vi.mocked(articleApi.getArticleBySlug)
      .mockResolvedValueOnce(previewResponse(1, "旧草稿"))
      .mockReturnValueOnce(next.promise);
    const router = renderPreview();
    expect(await screen.findByRole("heading", { name: "旧草稿" })).toBeInTheDocument();

    await act(async () => { await router.navigate("/admin/articles/preview/draft-2"); });

    expect(screen.getByRole("status", { name: "正在加载文章预览…" })).toBeInTheDocument();
    expect(screen.queryByText("旧草稿")).not.toBeInTheDocument();
    expect(screen.queryByText("旧草稿正文")).not.toBeInTheDocument();

    await act(async () => { next.resolve(previewResponse(2, "新草稿")); });
    expect(await screen.findByRole("heading", { name: "新草稿" })).toBeInTheDocument();
  });

  it("ignores both an old success and an old failure after the newest slug succeeds", async () => {
    const oldSuccess = deferredPreview();
    const oldFailure = deferredPreview();
    const newest = deferredPreview();
    vi.mocked(articleApi.getArticleBySlug)
      .mockReturnValueOnce(oldSuccess.promise)
      .mockReturnValueOnce(oldFailure.promise)
      .mockReturnValueOnce(newest.promise);
    const router = renderPreview();
    await act(async () => { await router.navigate("/admin/articles/preview/draft-2"); });
    await act(async () => { await router.navigate("/admin/articles/preview/draft-3"); });
    await act(async () => { newest.resolve(previewResponse(3, "最新草稿")); });
    expect(await screen.findByRole("heading", { name: "最新草稿" })).toBeInTheDocument();

    await act(async () => { oldSuccess.resolve(previewResponse(1, "过时草稿")); });
    expect(screen.getByRole("heading", { name: "最新草稿" })).toBeInTheDocument();
    expect(screen.queryByText("过时草稿正文")).not.toBeInTheDocument();

    await act(async () => { oldFailure.reject(new Error("obsolete request failed")); });
    expect(screen.getByRole("heading", { name: "最新草稿" })).toBeInTheDocument();
    expect(screen.getByText("最新草稿正文")).toBeInTheDocument();
    expect(screen.queryByText("文章预览失败")).not.toBeInTheDocument();
    expect(articleApi.getArticleBySlug).toHaveBeenCalledTimes(3);
  });
});
