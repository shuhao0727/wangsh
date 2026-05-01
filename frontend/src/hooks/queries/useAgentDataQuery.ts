import { useQuery } from "@tanstack/react-query";
import { agentDataApi, groupDiscussionApi } from "@services/agents";
import { aiAgentsApi } from "@services/agents";
import type { SearchFilterParams } from "@services/znt/types";
import { queryKeys } from "./queryKeys";

/** @deprecated Use queryKeys.agentData instead */
export const AGENT_DATA_QUERY_KEY = "agent-data";
/** @deprecated Use queryKeys.discussion instead */
export const GROUP_DISCUSSION_QUERY_KEY = "group-discussion";

// ---- AgentData - UsageRecordPanel ----

export function useAgentDataList(params: {
  searchParams: SearchFilterParams;
  page: number;
  pageSize: number;
}) {
  return useQuery({
    queryKey: queryKeys.agentData.list(params),
    queryFn: async () => {
      const res = await agentDataApi.getAgentData({
        ...params.searchParams,
        page: params.page,
        page_size: params.pageSize,
      });
      if (!res.success) {
        throw new Error(res.message || "加载数据失败");
      }
      return res.data;
    },
    staleTime: 30_000,
  });
}

// ---- AgentData - DetailModal ----

export function useConversationMessages(
  sessionId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.agentData.conversation(sessionId ?? ""),
    queryFn: async () => {
      const res = await agentDataApi.getConversationMessagesAdmin(sessionId!);
      if (!res.success) {
        throw new Error(res.message || "获取会话消息失败");
      }
      return res.data;
    },
    enabled: enabled && !!sessionId,
    staleTime: 60_000,
  });
}

// ---- GroupDiscussion - Sessions list ----

export function useGroupDiscussionSessions(params: {
  startDate?: string;
  endDate?: string;
  className?: string;
  groupNo?: string;
  groupName?: string;
  userName?: string;
  page: number;
  size: number;
}) {
  return useQuery({
    queryKey: queryKeys.discussion.sessions(params),
    queryFn: async () => {
      const res = await groupDiscussionApi.adminListSessions({
        startDate: params.startDate || undefined,
        endDate: params.endDate || undefined,
        className: params.className || undefined,
        groupNo: params.groupNo || undefined,
        groupName: params.groupName || undefined,
        userName: params.userName || undefined,
        page: params.page,
        size: params.size,
      });
      if (!res.success) {
        throw new Error(res.message || "加载失败");
      }
      return res.data;
    },
    staleTime: 30_000,
  });
}

// ---- GroupDiscussion - Messages (session modal) ----

export function useGroupDiscussionMessages(
  sessionId: number | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.discussion.messages(sessionId!),
    queryFn: async () => {
      const res = await groupDiscussionApi.adminListMessages({
        sessionId: sessionId!,
        page: 1,
        size: 500,
      });
      if (!res.success) {
        throw new Error(res.message || "加载消息失败");
      }
      return res.data.items || [];
    },
    enabled: enabled && !!sessionId,
    staleTime: 30_000,
  });
}

// ---- GroupDiscussion - Members (session modal) ----

export function useGroupDiscussionMembers(
  sessionId: number | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.discussion.members(sessionId!),
    queryFn: async () => {
      const res = await groupDiscussionApi.adminListMembers({
        sessionId: sessionId!,
      });
      if (!res.success) {
        throw new Error(res.message || "加载成员失败");
      }
      return res.data;
    },
    enabled: enabled && !!sessionId,
    staleTime: 30_000,
  });
}

// ---- GroupDiscussion - Analyses (session modal) ----

export function useGroupDiscussionAnalyses(
  sessionId: number | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.discussion.analyses(sessionId!),
    queryFn: async () => {
      const res = await groupDiscussionApi.adminListAnalyses({
        sessionId: sessionId!,
        limit: 20,
      });
      if (!res.success) {
        throw new Error(res.message || "加载分析历史失败");
      }
      return res.data.items || [];
    },
    enabled: enabled && !!sessionId,
    staleTime: 30_000,
  });
}

// ---- GroupDiscussion - Public config ----

export function useDiscussionPublicConfig() {
  return useQuery({
    queryKey: queryKeys.discussion.publicConfig(),
    queryFn: async () => {
      const res = await groupDiscussionApi.getPublicConfig();
      if (!res.success) {
        throw new Error(res.message || "获取配置失败");
      }
      return res.data;
    },
    staleTime: 60_000,
  });
}

// ---- GroupDiscussion - All agents (for dropdown) ----

export function useAllAgents() {
  return useQuery({
    queryKey: queryKeys.discussion.allAgents(),
    queryFn: async () => {
      const res = await aiAgentsApi.getAgents({ limit: 200 });
      if (!res.success) {
        throw new Error(res.message || "获取智能体列表失败");
      }
      return res.data;
    },
    staleTime: 60_000,
  });
}
