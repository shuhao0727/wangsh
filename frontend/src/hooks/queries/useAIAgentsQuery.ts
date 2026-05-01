import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { aiAgentsApi } from "@services/agents";
import type { AgentFormValues } from "@services/znt/types";
import { queryKeys } from "./queryKeys";

/** @deprecated Use queryKeys.aiAgents instead */
export const AI_AGENTS_QUERY_KEY = "ai-agents";

export function useAgentsList(params: {
  page: number;
  pageSize: number;
  search?: string;
  agentType?: string;
}) {
  return useQuery({
    queryKey: queryKeys.aiAgents.list(params),
    queryFn: async () => {
      const response = await aiAgentsApi.getAgents({
        skip: (params.page - 1) * params.pageSize,
        limit: params.pageSize,
        search: params.search,
        agent_type: params.agentType,
      });
      return response.data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useAgentStatistics() {
  return useQuery({
    queryKey: queryKeys.aiAgents.statistics(),
    queryFn: async () => {
      const response = await aiAgentsApi.getAgentStatistics();
      return response.data;
    },
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AgentFormValues) => aiAgentsApi.createAgent(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiAgents.all });
    },
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AgentFormValues> }) =>
      aiAgentsApi.updateAgent(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiAgents.all });
    },
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => aiAgentsApi.deleteAgent(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiAgents.all });
    },
  });
}

export function useBatchDeleteAgents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => aiAgentsApi.deleteAgent(id))
      );
      return results;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiAgents.all });
    },
  });
}
