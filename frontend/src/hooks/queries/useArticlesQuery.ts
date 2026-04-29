import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { articleApi } from "@services";
import type { ArticleFilterParams } from "@services";

const QUERY_KEY = "articles";

export function useArticlesList(params: ArticleFilterParams) {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: async () => {
      const response = await articleApi.listArticles(params);
      return response.data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useDeleteArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => articleApi.deleteArticle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useTogglePublish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, published }: { id: number; published: boolean }) =>
      articleApi.togglePublishStatus(id, published),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useBatchDeleteArticles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => articleApi.deleteArticle(id)),
      );
      let successCount = 0;
      let errorCount = 0;
      results.forEach((r) => {
        if (r.status === "fulfilled") {
          successCount++;
        } else {
          errorCount++;
        }
      });
      return { successCount, errorCount };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useBatchPublishArticles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ids,
      published,
    }: {
      ids: number[];
      published: boolean;
    }) => {
      const results = await Promise.allSettled(
        ids.map((id) => articleApi.togglePublishStatus(id, published)),
      );
      let successCount = 0;
      let errorCount = 0;
      results.forEach((r) => {
        if (r.status === "fulfilled") {
          successCount++;
        } else {
          errorCount++;
        }
      });
      return { successCount, errorCount };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
