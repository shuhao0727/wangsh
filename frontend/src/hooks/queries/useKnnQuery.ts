import { useQuery } from "@tanstack/react-query";
import { knnApi } from "@/services/knn";
import { queryKeys } from "./queryKeys";

export const usePublicKnnBatches = () => useQuery({
  queryKey: queryKeys.knn.publicList(), queryFn: knnApi.publicList, refetchInterval: 15000,
});
export const usePublicKnnBatch = (id: string) => useQuery({
  queryKey: queryKeys.knn.publicBatch(id), queryFn: () => knnApi.publicBatch(id),
  enabled: !!id, refetchInterval: 5000, retry: false,
});
export const useKnnBatches = (userId: number | undefined) => useQuery({
  queryKey: queryKeys.knn.staff(userId), queryFn: knnApi.list,
  enabled: userId !== undefined, refetchInterval: 15000, gcTime: 0,
});
export const useKnnDetail = (userId: number | undefined, id: string) => useQuery({
  queryKey: queryKeys.knn.detail(userId, id), queryFn: () => knnApi.detail(id),
  enabled: !!id && userId !== undefined, refetchInterval: 5000, retry: false, gcTime: 0,
});
