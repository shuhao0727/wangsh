import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { planApi } from "@services/classroomPlan";
import { queryKeys } from "./queryKeys";

/** @deprecated Use queryKeys.classroomPlans instead */
export const PLAN_QUERY_KEY = "classroom-plans";

export function usePlansList(params: { skip: number; limit: number }) {
  return useQuery({
    queryKey: queryKeys.classroomPlans.list(params),
    queryFn: () => planApi.list(params.skip, params.limit),
    placeholderData: (prev) => prev,
  });
}

export function usePlanDetail(id: number | null) {
  return useQuery({
    queryKey: queryKeys.classroomPlans.detail(id!),
    queryFn: () => planApi.get(id!),
    enabled: id != null,
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ title, activity_ids }: { title: string; activity_ids: number[] }) =>
      planApi.create(title, activity_ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.classroomPlans.all });
    },
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title, activity_ids }: { id: number; title?: string; activity_ids?: number[] }) =>
      planApi.update(id, title, activity_ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.classroomPlans.all });
    },
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => planApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.classroomPlans.all });
    },
  });
}

export function useStartPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => planApi.start(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.classroomPlans.all });
    },
  });
}

export function useResetPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => planApi.reset(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.classroomPlans.all });
    },
  });
}

export function useNextPlanItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => planApi.next(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.classroomPlans.all });
    },
  });
}

export function useEndPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => planApi.end(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.classroomPlans.all });
    },
  });
}

export function useStartPlanItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, itemId }: { planId: number; itemId: number }) =>
      planApi.startItem(planId, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.classroomPlans.all });
    },
  });
}

export function useEndPlanItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, itemId }: { planId: number; itemId: number }) =>
      planApi.endItem(planId, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.classroomPlans.all });
    },
  });
}
