/**
 * TanStack Query hooks for Assessment Statistics & Sessions
 *
 * Replaces manual useState + useEffect + API patterns in StatisticsPage.tsx
 * with declarative query/mutation hooks.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  assessmentSessionApi,
  profileApi,
} from "@services/assessment";
import type {
  BasicProfileResponse,
  SessionListItem,
  SessionListResponse,
  StudentProfile,
} from "@services/assessment";
import { queryKeys } from "./queryKeys";

/** @deprecated Use queryKeys.assessmentStats instead */
export const ASSESSMENT_STATS_QUERY_KEY = "assessment-statistics";

// ─── Types ───

export interface GradedStudent {
  id: number;
  user_name: string;
  class_name: string | null;
}

export interface StudentProfileData {
  basic: BasicProfileResponse;
  advanced: StudentProfile | null;
}

const PAGE_SIZE = 100;

type ProfileListParams = NonNullable<Parameters<typeof profileApi.list>[0]> & {
  config_id?: number;
};

async function fetchAllConfigSessions(
  configId: number,
  params: {
    class_name?: string;
    status?: string;
    search?: string;
    time_field?: string;
    start_date?: string;
    end_date?: string;
  },
): Promise<SessionListItem[]> {
  const items: SessionListItem[] = [];
  let skip = 0;
  let total = Number.POSITIVE_INFINITY;

  while (skip < total) {
    const resp: SessionListResponse =
      await assessmentSessionApi.getConfigSessions(configId, {
        ...params,
        skip,
        limit: PAGE_SIZE,
      });

    items.push(...resp.items);
    total = resp.total;

    if (resp.items.length === 0) break;
    skip += resp.items.length;
  }

  return items;
}

// ─── Statistics ───

export function useAssessmentStatistics(
  configId: number,
  params?: {
    class_name?: string;
    time_field?: string;
    start_date?: string;
    end_date?: string;
  },
) {
  return useQuery({
    queryKey: queryKeys.assessmentStats.statistics(configId, params),
    queryFn: () => assessmentSessionApi.getStatistics(configId, params),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
    enabled: !isNaN(configId),
  });
}

// ─── Sessions list (paginated) ───

export function useAssessmentSessions(
  configId: number,
  params: {
    skip: number;
    limit: number;
    class_name?: string;
    status?: string;
    search?: string;
    time_field?: string;
    start_date?: string;
    end_date?: string;
  },
) {
  return useQuery({
    queryKey: queryKeys.assessmentStats.sessions(configId, params),
    queryFn: () => assessmentSessionApi.getConfigSessions(configId, params),
    placeholderData: (prev) => prev,
    staleTime: 10_000,
    enabled: !isNaN(configId),
  });
}

// ─── Class names ───

export function useAssessmentClassNames(configId: number) {
  return useQuery({
    queryKey: queryKeys.assessmentStats.classNames(configId),
    queryFn: () => assessmentSessionApi.getClassNames(configId),
    staleTime: 5 * 60_000,
    enabled: !isNaN(configId),
  });
}

// ─── Graded students (radar chart picker) ───

export function useGradedStudents(configId: number) {
  return useQuery({
    queryKey: queryKeys.assessmentStats.gradedStudents(configId),
    queryFn: async (): Promise<GradedStudent[]> => {
      const sessions = await fetchAllConfigSessions(configId, {
        status: "graded",
      });
      return sessions
        .filter((s) => s.user_name)
        .map((s) => ({
          id: s.id,
          user_name: s.user_name!,
          class_name: s.class_name,
        }));
    },
    staleTime: 60_000,
    enabled: !isNaN(configId),
  });
}

// ─── Session detail (dialog) ───

export function useSessionDetail(sessionId: number | null) {
  return useQuery({
    queryKey: queryKeys.assessmentStats.sessionDetail(sessionId),
    queryFn: () => assessmentSessionApi.getSessionDetail(sessionId!),
    enabled: sessionId != null,
    staleTime: 30_000,
  });
}

// ─── Student profile (basic + advanced) ───

export function useStudentProfile(
  sessionId: number | null,
  userId: number | null,
  configId?: number | null,
) {
  return useQuery({
    queryKey: queryKeys.assessmentStats.studentProfile(
      sessionId,
      userId,
      configId,
    ),
    queryFn: async (): Promise<StudentProfileData> => {
      const basic = await assessmentSessionApi.getAdminBasicProfile(sessionId!);
      const profileConfigId = configId ?? basic.config_id;
      const profileParams: ProfileListParams = {
        config_id: profileConfigId,
        profile_type: "individual",
        target_id: String(userId),
        limit: 1,
      };
      const advancedResp = await profileApi
        .list(profileParams)
        .catch(() => ({ items: [] as StudentProfile[] }));
      return {
        basic,
        advanced:
          advancedResp.items.length > 0 ? advancedResp.items[0] : null,
      };
    },
    enabled: sessionId != null && userId != null,
    staleTime: 30_000,
  });
}

// ─── Mutations ───

export function useAllowRetest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: number) =>
      assessmentSessionApi.allowRetest(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.assessmentStats.all,
      });
    },
  });
}

export function useBatchRetest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      configId,
      params,
    }: {
      configId: number;
      params: { session_ids?: number[]; class_name?: string };
    }) => assessmentSessionApi.batchRetest(configId, params),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.assessmentStats.all,
      });
    },
  });
}

export function useExportXlsx() {
  return useMutation({
    mutationFn: ({
      configId,
      params,
    }: {
      configId: number;
      params?: {
        class_name?: string;
        status?: string;
        search?: string;
        time_field?: string;
        start_date?: string;
        end_date?: string;
      };
    }) => assessmentSessionApi.exportXlsx(configId, params),
  });
}

export function useGenerateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      sessionId: number;
      profileUserId: number;
      configAgentId: number;
      configId: number;
    }) =>
      profileApi.generate({
        profile_type: "individual",
        target_id: String(params.profileUserId),
        config_id: params.configId,
        agent_id: params.configAgentId,
      }),
    onSuccess: (result, variables) => {
      // Update the student profile cache so the UI reflects the fresh profile
      queryClient.setQueryData(
        queryKeys.assessmentStats.studentProfile(
          variables.sessionId,
          variables.profileUserId,
          variables.configId,
        ),
        (old: StudentProfileData | undefined) =>
          old ? { ...old, advanced: result } : old,
      );
    },
  });
}

export function useBatchGenerateProfiles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      configId,
      configAgentId,
      filterClass,
    }: {
      configId: number;
      configAgentId: number;
      filterClass?: string;
    }) => {
      // First fetch unique graded user IDs
      const gradedSessions = await fetchAllConfigSessions(configId, {
        status: "graded",
        class_name: filterClass,
      });
      const userIds = gradedSessions
        .map((s) => s.user_id)
        .filter((v, i, arr) => arr.indexOf(v) === i);

      if (userIds.length === 0) {
        throw new Error("NO_GRADED_STUDENTS");
      }

      return profileApi.batchGenerate({
        user_ids: userIds,
        config_id: configId,
        agent_id: configAgentId,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.assessmentStats.all,
      });
    },
  });
}
