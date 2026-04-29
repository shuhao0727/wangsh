import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assessmentConfigApi } from "@services/assessment";
import type {
  AssessmentConfigCreateRequest,
  AssessmentConfigUpdateRequest,
} from "@services/assessment";

export const ASSESSMENT_QUERY_KEY = "assessment-configs";

export function useAssessmentConfigs(params: {
  skip: number;
  limit: number;
  grade?: string;
  enabled?: boolean;
  search?: string;
}) {
  return useQuery({
    queryKey: [ASSESSMENT_QUERY_KEY, params],
    queryFn: () => assessmentConfigApi.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useAssessmentConfig(id: number | null) {
  return useQuery({
    queryKey: [ASSESSMENT_QUERY_KEY, "detail", id],
    queryFn: () => assessmentConfigApi.get(id!),
    enabled: id != null,
  });
}

export function useCreateAssessmentConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AssessmentConfigCreateRequest) =>
      assessmentConfigApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSESSMENT_QUERY_KEY] });
    },
  });
}

export function useUpdateAssessmentConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: AssessmentConfigUpdateRequest;
    }) => assessmentConfigApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSESSMENT_QUERY_KEY] });
    },
  });
}

export function useDeleteAssessmentConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => assessmentConfigApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSESSMENT_QUERY_KEY] });
    },
  });
}

export function useToggleAssessmentConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => assessmentConfigApi.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASSESSMENT_QUERY_KEY] });
    },
  });
}
