import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  assessmentConfigApi,
  assessmentQuestionApi,
} from "@services/assessment";
import type {
  AssessmentConfigCreateRequest,
  AssessmentConfigUpdateRequest,
  QuestionCreateRequest,
  QuestionUpdateRequest,
  GenerateParams,
  AssessmentQuestion,
} from "@services/assessment";
import { queryKeys } from "./queryKeys";

/** @deprecated Use queryKeys.assessment instead */
export const ASSESSMENT_QUERY_KEY = "assessment-configs";

/** @deprecated Use queryKeys.assessmentQuestions instead */
export const ASSESSMENT_QUESTIONS_KEY = "assessment-questions";

export function useAssessmentConfigs(params: {
  skip: number;
  limit: number;
  grade?: string;
  enabled?: boolean;
  search?: string;
}) {
  return useQuery({
    queryKey: queryKeys.assessment.list(params),
    queryFn: () => assessmentConfigApi.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useAssessmentConfig(id: number | null) {
  return useQuery({
    queryKey: queryKeys.assessment.detail(id!),
    queryFn: () => assessmentConfigApi.get(id!),
    enabled: id != null,
  });
}

export function useAssessmentConfigForEditor(configId: number | null) {
  return useQuery({
    queryKey: queryKeys.assessment.editor(configId!),
    queryFn: () => assessmentConfigApi.get(configId!),
    enabled: configId != null && Number.isFinite(configId),
    staleTime: 30_000,
  });
}

export function useAssessmentQuestions(
  configId: number | null,
  params: {
    page: number;
    pageSize: number;
    question_type?: string;
    difficulty?: string;
  },
) {
  return useQuery({
    queryKey: queryKeys.assessmentQuestions.list(
      configId!,
      params as Record<string, unknown>,
    ),
    queryFn: () =>
      assessmentQuestionApi.list(configId!, {
        skip: (params.page - 1) * params.pageSize,
        limit: params.pageSize,
        question_type: params.question_type,
        difficulty: params.difficulty,
      }),
    enabled: configId != null && Number.isFinite(configId),
    placeholderData: (prev) => prev,
  });
}

export interface AdaptiveKP {
  key: string;
  knowledge_point: string;
  question_type: "choice" | "fill";
  score: number;
  prompt_hint: string;
  mastery_streak: number;
  max_attempts: number;
}

const parseAdaptiveConfig = (raw: string | null) => {
  const defaults = { mastery_streak: 2, max_attempts: 5, prompt_hint: "" };
  if (!raw) return defaults;
  try {
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
};

const ASSESSMENT_QUESTION_PAGE_SIZE = 200;

export function useAdaptiveKPs(configId: number | null) {
  return useQuery({
    queryKey: queryKeys.assessmentQuestions.adaptive(configId!),
    queryFn: async () => {
      const questions: AssessmentQuestion[] = [];
      let skip = 0;
      let total = Number.POSITIVE_INFINITY;

      while (skip < total) {
        const resp = await assessmentQuestionApi.list(configId!, {
          skip,
          limit: ASSESSMENT_QUESTION_PAGE_SIZE,
        });
        questions.push(...resp.items);
        total = resp.total;

        if (resp.items.length === 0) break;
        skip += resp.items.length;
      }

      return questions
        .filter((q: AssessmentQuestion) => q.mode === "adaptive")
        .map((q: AssessmentQuestion): AdaptiveKP => {
          const cfg = parseAdaptiveConfig(q.adaptive_config);
          return {
            key: String(q.id),
            knowledge_point: q.knowledge_point || "",
            question_type: q.question_type as "choice" | "fill",
            score: q.score,
            prompt_hint: cfg.prompt_hint,
            mastery_streak: cfg.mastery_streak,
            max_attempts: cfg.max_attempts,
          };
        });
    },
    enabled: configId != null && Number.isFinite(configId),
    staleTime: 30_000,
  });
}

export function useSaveAssessmentConfig() {
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.assessment.all });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.assessmentStats.all,
      });
    },
  });
}

export function useCreateAssessmentQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: QuestionCreateRequest) =>
      assessmentQuestionApi.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.assessmentQuestions.all,
      });
    },
  });
}

export function useUpdateAssessmentQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: QuestionUpdateRequest;
    }) => assessmentQuestionApi.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.assessmentQuestions.all,
      });
    },
  });
}

export function useDeleteAssessmentQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => assessmentQuestionApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.assessmentQuestions.all,
      });
    },
  });
}

export function useGenerateAssessmentQuestions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      configId,
      params,
    }: {
      configId: number;
      params?: GenerateParams;
    }) => assessmentQuestionApi.generate(configId, params),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.assessmentQuestions.all,
      });
    },
  });
}

export function useCreateAssessmentConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AssessmentConfigCreateRequest) =>
      assessmentConfigApi.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assessment.all });
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.assessment.all });
    },
  });
}

export function useDeleteAssessmentConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => assessmentConfigApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assessment.all });
    },
  });
}

export function useToggleAssessmentConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => assessmentConfigApi.toggle(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.assessment.all });
    },
  });
}
