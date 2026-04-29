import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { aiAgentsApi } from "@services/agents";
import type { AgentFormValues } from "@services/znt/types";

export const AI_AGENTS_QUERY_KEY = "ai-agents";

export function useAgentsList(params: {
  page: number;
  pageSize: number;
  search?: string;
  agentType?: string;
}) {
  return useQuery({
    queryKey: [AI_AGENTS_QUERY_KEY, params],
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
    queryKey: [AI_AGENTS_QUERY_KEY, "statistics"],
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
      queryClient.invalidateQueries({ queryKey: [AI_AGENTS_QUERY_KEY] });
    },
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AgentFormValues> }) =>
      aiAgentsApi.updateAgent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AI_AGENTS_QUERY_KEY] });
    },
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => aiAgentsApi.deleteAgent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [AI_AGENTS_QUERY_KEY] });
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
      queryClient.invalidateQueries({ queryKey: [AI_AGENTS_QUERY_KEY] });
    },
  });
}
