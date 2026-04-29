import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { classroomApi } from "@services/classroom";
import type { ActivityCreateRequest, ActivityEndRequest } from "@services/classroom";

export const CLASSROOM_QUERY_KEY = "classroom-activities";
export const ACTIVE_AGENTS_KEY = "active-agents";

export function useClassroomList(params: {
  skip: number;
  limit: number;
  status?: string;
}) {
  return useQuery({
    queryKey: [CLASSROOM_QUERY_KEY, params],
    queryFn: () => classroomApi.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useActiveAgents() {
  return useQuery({
    queryKey: [ACTIVE_AGENTS_KEY],
    queryFn: () => classroomApi.getActiveAgents(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useActivityDetail(id: number | null) {
  return useQuery({
    queryKey: [CLASSROOM_QUERY_KEY, "detail", id],
    queryFn: () => classroomApi.getDetail(id!),
    enabled: id != null,
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ActivityCreateRequest) => classroomApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLASSROOM_QUERY_KEY] });
    },
  });
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ActivityCreateRequest> }) =>
      classroomApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLASSROOM_QUERY_KEY] });
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => classroomApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLASSROOM_QUERY_KEY] });
    },
  });
}

export function useBulkDeleteActivities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => classroomApi.bulkRemove(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLASSROOM_QUERY_KEY] });
    },
  });
}

export function useStartActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => classroomApi.start(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLASSROOM_QUERY_KEY] });
    },
  });
}

export function useEndActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data?: ActivityEndRequest }) =>
      classroomApi.end(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLASSROOM_QUERY_KEY] });
    },
  });
}

export function useDuplicateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => classroomApi.duplicate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLASSROOM_QUERY_KEY] });
    },
  });
}

export function useRestartActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => classroomApi.restart(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CLASSROOM_QUERY_KEY] });
    },
  });
}
