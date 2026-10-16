import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { articleApi, categoryApi } from "@services";
import { queryKeys } from "./queryKeys";
import { useBatchDeleteCategories } from "./useCategoriesQuery";
import { useBatchPublishArticles } from "./useArticlesQuery";

vi.mock("@services", () => ({
  categoryApi: { deleteCategory: vi.fn() },
  articleApi: { togglePublishStatus: vi.fn() },
}));

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe("article batch mutation consumers", () => {
  beforeEach(() => vi.resetAllMocks());

  it("settles every category after a failure and invalidates only category queries", async () => {
    vi.mocked(categoryApi.deleteCategory).mockImplementation(async (id) => {
      if (id === 2) throw new Error("category still in use");
      return { data: undefined } as never;
    });
    const { client, wrapper } = setup();
    const key = [...queryKeys.categories.all, { page: 1 }];
    client.setQueryData(key, [1, 2, 3]);
    client.setQueryData(queryKeys.articles.all, [8]);
    const { result, unmount } = renderHook(() => useBatchDeleteCategories(), { wrapper });
    await act(async () => {
      const data = await result.current.mutateAsync([1, 2, 3]);
      expect(data.successCount).toBe(2);
      expect(data.errorCount).toBe(1);
      expect(data.results.map((item) => item.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
    });
    expect(categoryApi.deleteCategory).toHaveBeenCalledTimes(3);
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.articles.all)?.isInvalidated).toBe(false);
    unmount(); client.clear();
  });

  it("publishes each requested state and invalidates article lists after partial failure", async () => {
    vi.mocked(articleApi.togglePublishStatus).mockImplementation(async (id) => {
      if (id === 2) throw new Error("write refused");
      return { data: undefined } as never;
    });
    const { client, wrapper } = setup();
    const key = queryKeys.articles.list({ page: 1, search: "目标" });
    client.setQueryData(key, []);
    const { result, unmount } = renderHook(() => useBatchPublishArticles(), { wrapper });
    await act(async () => {
      const data = await result.current.mutateAsync([{ id: 1, published: true }, { id: 2, published: false }]);
      expect(data.successCount).toBe(1);
      expect(data.errorCount).toBe(1);
    });
    expect(articleApi.togglePublishStatus).toHaveBeenNthCalledWith(1, 1, true);
    expect(articleApi.togglePublishStatus).toHaveBeenNthCalledWith(2, 2, false);
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    unmount(); client.clear();
  });
});
