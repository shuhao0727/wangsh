import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

/**
 * 通用批量操作 Hook
 *
 * 用于处理需要对多个项目执行相同操作的场景（如批量删除、批量发布等）
 *
 * @example
 * ```tsx
 * const batchDelete = useBatchMutation({
 *   mutationFn: (id: number) => articlesApi.delete(id),
 *   invalidateKeys: [queryKeys.articles.all],
 *   onSuccess: (results) => {
 *     const success = results.filter(r => r.status === "fulfilled").length;
 *     showMessage(`成功删除 ${success} 篇文章`, "success");
 *   },
 * });
 *
 * // 使用
 * await batchDelete.mutateAsync([1, 2, 3]);
 * ```
 */
export function useBatchMutation<T, R = void>({
  mutationFn,
  invalidateKeys,
  onSuccess,
}: {
  /** 对单个项目执行的操作函数 */
  mutationFn: (item: T) => Promise<R>;
  /** 操作成功后需要失效的 Query Keys */
  invalidateKeys: QueryKey[];
  /** 所有操作完成后的回调，接收所有结果（包括成功和失败） */
  onSuccess?: (results: PromiseSettledResult<R>[]) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: T[]) => {
      // 使用 Promise.allSettled 确保所有操作都执行完成，即使部分失败
      const results = await Promise.allSettled(
        items.map((item) => Promise.resolve().then(() => mutationFn(item)))
      );

      // 统计成功和失败数量
      const successCount = results.filter((r) => r.status === "fulfilled").length;
      const errorCount = results.length - successCount;

      return { results, successCount, errorCount };
    },
    onSuccess: (data) => {
      // 失效相关查询缓存
      invalidateKeys.forEach((key) => {
        void queryClient.invalidateQueries({ queryKey: key });
      });

      // 调用自定义回调
      onSuccess?.(data.results);
    },
  });
}
