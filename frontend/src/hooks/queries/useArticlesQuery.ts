import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { articleApi } from "@services";
import type { ArticleFilterParams } from "@services";
import { queryKeys } from "./queryKeys";
import { useBatchMutation } from "./useBatchMutation";

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
  return useBatchMutation({
    mutationFn: (id: number) => articleApi.deleteArticle(id),
    invalidateKeys: [queryKeys.articles.all],
  });
}

export function useBatchPublishArticles() {
  return useBatchMutation({
    mutationFn: ({ id, published }: { id: number; published: boolean }) =>
      articleApi.togglePublishStatus(id, published),
    invalidateKeys: [queryKeys.articles.all],
  });
}
