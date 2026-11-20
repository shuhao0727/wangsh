import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { classroomApi } from "@services/classroom";
import type { ActivityCreateRequest, ActivityEndRequest } from "@services/classroom";
import { queryKeys } from "./queryKeys";

/** @deprecated Use queryKeys.classroom instead */
export const CLASSROOM_QUERY_KEY = "classroom-activities";
/** @deprecated Use queryKeys.activeAgents instead */
export const ACTIVE_AGENTS_KEY = "active-agents";

export function useClassroomList(params: {
  skip: number;
  limit: number;
  status?: string;
}) {
  return useQuery({
    queryKey: queryKeys.classroom.list(params),
    queryFn: () => classroomApi.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useActiveAgents() {
  return useQuery({
    queryKey: queryKeys.activeAgents.all,
    queryFn: () => classroomApi.getActiveAgents(),
    staleTime: 5 * 60 * 1000,
  });
}

export function activityDetailUnavailable(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 403 || status === 404;
}

export function useActivityDetail(id: number | null) {
  return useQuery({
    queryKey: queryKeys.classroom.detail(id),
    queryFn: () => classroomApi.getDetail(id!),
    enabled: (query) => id != null && !activityDetailUnavailable(query.state.error),
    retry: (failures, error) => failures < 1 && !activityDetailUnavailable(error),
    refetchInterval: (query) => {
      if (activityDetailUnavailable(query.state.error)) return false;
      if (query.state.error && (!query.state.data || query.state.data.status === "active")) return 6000;
      return query.state.data?.status === "active" ? 3000 : false;
    },
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ActivityCreateRequest) => classroomApi.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.classroom.all });
    },
  });
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ActivityCreateRequest> }) =>
      classroomApi.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.classroom.all });
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => classroomApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.classroom.all });
    },
  });
}

export function useBulkDeleteActivities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => classroomApi.bulkRemove(ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.classroom.all });
    },
  });
}

export function useStartActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => classroomApi.start(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.classroom.all });
    },
  });
}

export function useEndActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data?: ActivityEndRequest }) =>
      classroomApi.end(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.classroom.all });
    },
  });
}

export function useDuplicateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => classroomApi.duplicate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.classroom.all });
    },
  });
}

export function useRestartActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => classroomApi.restart(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.classroom.all });
    },
  });
}
