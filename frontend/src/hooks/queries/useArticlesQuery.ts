import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { articleApi } from "@services";
import type { ArticleFilterParams } from "@services";
import { queryKeys } from "./queryKeys";

export function useArticlesList(params: ArticleFilterParams) {
  return useQuery({
    queryKey: queryKeys.articles.list(params as Record<string, unknown>),
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });
}

export function useTogglePublish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, published }: { id: number; published: boolean }) =>
      articleApi.togglePublishStatus(id, published),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
    },
  });
}
