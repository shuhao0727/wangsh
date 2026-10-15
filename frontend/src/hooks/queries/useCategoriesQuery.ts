import { categoryApi } from "@services";
import { useBatchMutation } from "./useBatchMutation";
import { queryKeys } from "./queryKeys";

/**
 * 批量删除分类
 */
export function useBatchDeleteCategories() {
  return useBatchMutation({
    mutationFn: (id: number) => categoryApi.deleteCategory(id),
    invalidateKeys: [queryKeys.categories.all],
  });
}
