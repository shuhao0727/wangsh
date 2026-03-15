import type { AxiosRequestConfig } from "axios";
import { api } from "../../api";
import { logger } from "../../logger";
import type { BaseResponse } from "../types";

interface ApiErrorShape {
  message?: string;
  response?: { data?: { detail?: unknown }; status?: number };
}
const asApiError = (e: unknown): ApiErrorShape =>
  (e && typeof e === "object" ? e : {}) as ApiErrorShape;
const errMsg = (e: unknown, fallback: string): string => {
  const err = asApiError(e);
  const detail = err.response?.data?.detail;
  return (typeof detail === "string" ? detail : err.message) || fallback;
};

const BASE_PATH = "/ai-agents/group-discussion";

export type GroupDiscussionJoinResponse = {
  session_id: number;
  session_date: string;
  class_name: string;
  group_no: string;
  group_name?: string | null;
  display_name: string;
  group_lock_seconds: number;
};

export type GroupDiscussionGroup = {
  session_id: number;
  session_date: string;
  class_name: string;
  group_no: string;
  group_name?: string | null;
  message_count: number;
  member_count: number;
  last_message_at?: string | null;
};

export type GroupDiscussionGroupListResponse = {
  items: GroupDiscussionGroup[];
};

export type GroupDiscussionPublicConfig = {
  enabled: boolean;
  join_lock_seconds: number;
  rate_limit_seconds: number;
};

export type GroupDiscussionMessage = {
  id: number;
  session_id: number;
  user_id: number;
  user_display_name: string;
  content: string;
  created_at: string;
};

export type GroupDiscussionMessageListResponse = {
  items: GroupDiscussionMessage[];
  next_after_id: number;
};

export type GroupDiscussionAdminSession = {
  id: number;
  session_date: string;
  class_name: string;
  group_no: string;
  group_name?: string | null;
  message_count: number;
  created_at: string;
  last_message_at?: string | null;
};

export type GroupDiscussionAdminSessionListResponse = {
  items: GroupDiscussionAdminSession[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export type GroupDiscussionAdminMessageListResponse = {
  items: GroupDiscussionMessage[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export type GroupDiscussionAdminAnalyzeResponse = {
  analysis_id: number;
  result_text: string;
  created_at: string;
};

export type GroupDiscussionAdminAnalysis = {
  id: number;
  session_id: number;
  agent_id: number;
  analysis_type: string;
  prompt: string;
  result_text: string;
  created_at: string;
};

export type GroupDiscussionAdminAnalysisListResponse = {
  items: GroupDiscussionAdminAnalysis[];
};

export type GroupDiscussionMember = {
  user_id: number;
  username?: string | null;
  full_name?: string | null;
  student_id?: string | null;
  joined_at: string;
  muted_until?: string | null;
};

export type GroupDiscussionAdminMemberListResponse = {
  items: GroupDiscussionMember[];
};

export const groupDiscussionApi = {
  getPublicConfig: async (): Promise<BaseResponse<GroupDiscussionPublicConfig>> => {
    try {
      const response = await api.get(`${BASE_PATH}/public-config`);
      const raw = response.data as unknown as Record<string, unknown>;
      const data = (raw && typeof raw === "object" && "data" in raw ? raw.data : raw) as unknown;
      return { success: true, message: "获取成功", data: data as GroupDiscussionPublicConfig };
    } catch (error: unknown) {
      logger.error("获取小组讨论配置失败:", error);
      return {
        success: false,
        message: errMsg(error, "获取失败"),
        data: { enabled: false, join_lock_seconds: 180, rate_limit_seconds: 5 },
      };
    }
  },

  setPublicConfig: async (params: {
    enabled: boolean;
  }): Promise<BaseResponse<GroupDiscussionPublicConfig>> => {
    try {
      const response = await api.put(`${BASE_PATH}/public-config`, { enabled: params.enabled });
      const raw = response.data as unknown as Record<string, unknown>;
      const data = (raw && typeof raw === "object" && "data" in raw ? raw.data : raw) as unknown;
      return { success: true, message: "设置成功", data: data as GroupDiscussionPublicConfig };
    } catch (error: unknown) {
      logger.error("设置小组讨论配置失败:", error);
      return {
        success: false,
        message: errMsg(error, "设置失败"),
        data: { enabled: params.enabled, join_lock_seconds: 180, rate_limit_seconds: 5 },
      };
    }
  },

  join: async (params: {
    groupNo: string;
    className?: string;
    groupName?: string;
  }): Promise<BaseResponse<GroupDiscussionJoinResponse>> => {
    try {
      const response = await api.post(`${BASE_PATH}/join`, {
        group_no: params.groupNo,
        class_name: params.className,
        group_name: params.groupName,
      });
      const raw = response.data as unknown as Record<string, unknown>;
      const data = (raw && typeof raw === "object" && "data" in raw ? raw.data : raw) as unknown;
      return { success: true, message: "加入成功", data: data as GroupDiscussionJoinResponse };
    } catch (error: unknown) {
      logger.error("加入小组讨论失败:", error);
      return {
        success: false,
        message: errMsg(error, "加入失败"),
        data: {
          session_id: 0,
          session_date: "",
          class_name: params.className || "",
          group_no: params.groupNo,
          group_name: params.groupName || null,
          display_name: "",
          group_lock_seconds: 0,
        },
      };
    }
  },

  listGroups: async (params?: {
    date?: string;
    className?: string;
    keyword?: string;
    limit?: number;
  }): Promise<BaseResponse<GroupDiscussionGroupListResponse>> => {
    try {
      const response = await api.get(`${BASE_PATH}/groups`, {
        params: {
          date: params?.date,
          class_name: params?.className,
          keyword: params?.keyword,
          limit: params?.limit ?? 50,
        },
      });
      const raw = response.data as unknown as Record<string, unknown>;
      const data = (raw && typeof raw === "object" && "data" in raw ? raw.data : raw) as unknown;
      return { success: true, message: "获取成功", data: data as GroupDiscussionGroupListResponse };
    } catch (error: unknown) {
      logger.error("获取讨论组列表失败:", error);
      return {
        success: false,
        message: errMsg(error, "获取失败"),
        data: { items: [] },
      };
    }
  },

  setGroupName: async (params: {
    sessionId: number;
    groupName: string;
  }): Promise<BaseResponse<GroupDiscussionJoinResponse>> => {
    try {
      const response = await api.put(`${BASE_PATH}/session/${params.sessionId}/name`, {
        group_name: params.groupName,
      });
      const raw = response.data as unknown as Record<string, unknown>;
      const data = (raw && typeof raw === "object" && "data" in raw ? raw.data : raw) as unknown;
      return { success: true, message: "设置成功", data: data as GroupDiscussionJoinResponse };
    } catch (error: unknown) {
      logger.error("设置组名失败:", error);
      return {
        success: false,
        message: errMsg(error, "设置失败"),
        data: {
          session_id: params.sessionId,
          session_date: "",
          class_name: "",
          group_no: "",
          group_name: params.groupName,
          display_name: "",
          group_lock_seconds: 0,
        },
      };
    }
  },

  listMessages: async (params: {
    sessionId: number;
    afterId?: number;
    limit?: number;
  }): Promise<BaseResponse<GroupDiscussionMessageListResponse>> => {
    try {
      const response = await api.get(`${BASE_PATH}/messages`, {
        params: {
          session_id: params.sessionId,
          after_id: params.afterId ?? 0,
          limit: params.limit ?? 50,
        },
      });
      const raw = response.data as unknown as Record<string, unknown>;
      const data = (raw && typeof raw === "object" && "data" in raw ? raw.data : raw) as unknown;
      return { success: true, message: "获取成功", data: data as GroupDiscussionMessageListResponse };
    } catch (error: unknown) {
      logger.error("获取小组讨论消息失败:", error);
      return {
        success: false,
        message: errMsg(error, "获取失败"),
        data: { items: [], next_after_id: params.afterId ?? 0 },
      };
    }
  },

  sendMessage: async (params: {
    sessionId: number;
    content: string;
  }): Promise<BaseResponse<GroupDiscussionMessage>> => {
    try {
      const response = await api.post(`${BASE_PATH}/messages`, {
        session_id: params.sessionId,
        content: params.content,
      });
      const raw = response.data as unknown as Record<string, unknown>;
      const data = (raw && typeof raw === "object" && "data" in raw ? raw.data : raw) as unknown;
      return { success: true, message: "发送成功", data: data as GroupDiscussionMessage };
    } catch (error: unknown) {
      logger.error("发送小组讨论消息失败:", error);
      return {
        success: false,
        message: errMsg(error, "发送失败"),
        data: {
          id: 0,
          session_id: params.sessionId,
          user_id: 0,
          user_display_name: "",
          content: params.content,
          created_at: new Date().toISOString(),
        },
      };
    }
  },

  adminMuteUser: async (params: {
    sessionId: number;
    userId: number;
    minutes: number;
  }): Promise<BaseResponse<boolean>> => {
    try {
      await api.post(`${BASE_PATH}/mute`, {
        session_id: params.sessionId,
        user_id: params.userId,
        minutes: params.minutes,
      });
      return { success: true, message: "禁言成功", data: true };
    } catch (error: unknown) {
      logger.error("禁言失败:", error);
      return {
        success: false,
        message: errMsg(error, "禁言失败"),
        data: false,
      };
    }
  },

  adminUnmuteUser: async (params: {
    sessionId: number;
    userId: number;
  }): Promise<BaseResponse<boolean>> => {
    try {
      await api.post(`${BASE_PATH}/unmute`, {
        session_id: params.sessionId,
        user_id: params.userId,
      });
      return { success: true, message: "解除禁言成功", data: true };
    } catch (error: unknown) {
      logger.error("解除禁言失败:", error);
      return {
        success: false,
        message: errMsg(error, "解除禁言失败"),
        data: false,
      };
    }
  },

  adminAddMember: async (params: {
    sessionId: number;
    userId: number;
  }): Promise<BaseResponse<boolean>> => {
    try {
      await api.post(`${BASE_PATH}/add-member`, {
        session_id: params.sessionId,
        user_id: params.userId,
      });
      return { success: true, message: "添加成员成功", data: true };
    } catch (error: unknown) {
      logger.error("添加成员失败:", error);
      return {
        success: false,
        message: errMsg(error, "添加成员失败"),
        data: false,
      };
    }
  },

  adminRemoveMember: async (params: {
    sessionId: number;
    userId: number;
  }): Promise<BaseResponse<boolean>> => {
    try {
      await api.post(`${BASE_PATH}/remove-member`, {
        session_id: params.sessionId,
        user_id: params.userId,
      });
      return { success: true, message: "移除成员成功", data: true };
    } catch (error: unknown) {
      logger.error("移除成员失败:", error);
      return {
        success: false,
        message: errMsg(error, "移除成员失败"),
        data: false,
      };
    }
  },

  adminListSessions: async (params: {
    startDate?: string;
    endDate?: string;
    className?: string;
    groupNo?: string;
    groupName?: string;
    userName?: string;
    page?: number;
    size?: number;
  }): Promise<BaseResponse<GroupDiscussionAdminSessionListResponse>> => {
    try {
      const response = await api.get(`${BASE_PATH}/admin/sessions`, {
        params: {
          start_date: params.startDate,
          end_date: params.endDate,
          class_name: params.className,
          group_no: params.groupNo,
          group_name: params.groupName,
          user_name: params.userName,
          page: params.page ?? 1,
          size: params.size ?? 20,
        },
      });
      const raw = response.data as unknown as Record<string, unknown>;
      const data = (raw && typeof raw === "object" && "data" in raw ? raw.data : raw) as unknown;
      return { success: true, message: "获取成功", data: data as GroupDiscussionAdminSessionListResponse };
    } catch (error: unknown) {
      logger.error("获取小组讨论会话失败:", error);
      return {
        success: false,
        message: errMsg(error, "获取失败"),
        data: { items: [], total: 0, page: 1, page_size: params.size ?? 20, total_pages: 0 },
      };
    }
  },

  adminDeleteSession: async (params: { sessionId: number }): Promise<BaseResponse<boolean>> => {
    try {
      await api.delete(`${BASE_PATH}/admin/sessions/${params.sessionId}`);
      return { success: true, message: "删除成功", data: true };
    } catch (error: unknown) {
      logger.error("删除小组讨论会话失败:", error);
      return {
        success: false,
        message: errMsg(error, "删除失败"),
        data: false,
      };
    }
  },

  adminBatchDeleteSessions: async (params: { sessionIds: number[] }): Promise<BaseResponse<number>> => {
    try {
      const response = await api.post(`${BASE_PATH}/admin/sessions/batch-delete`, {
        session_ids: params.sessionIds,
      });
      const raw = response.data as unknown as Record<string, unknown>;
      const deleted = Number(raw?.deleted || 0);
      return { success: true, message: "删除成功", data: deleted };
    } catch (error: unknown) {
      logger.error("批量删除小组讨论会话失败:", error);
      return {
        success: false,
        message: errMsg(error, "删除失败"),
        data: 0,
      };
    }
  },

  adminListMessages: async (params: {
    sessionId: number;
    page?: number;
    size?: number;
  }): Promise<BaseResponse<GroupDiscussionAdminMessageListResponse>> => {
    try {
      const response = await api.get(`${BASE_PATH}/admin/messages`, {
        params: { session_id: params.sessionId, page: params.page ?? 1, size: params.size ?? 100 },
      });
      const raw = response.data as unknown as Record<string, unknown>;
      const data = (raw && typeof raw === "object" && "data" in raw ? raw.data : raw) as unknown;
      return { success: true, message: "获取成功", data: data as GroupDiscussionAdminMessageListResponse };
    } catch (error: unknown) {
      logger.error("获取小组讨论消息（管理端）失败:", error);
      return {
        success: false,
        message: errMsg(error, "获取失败"),
        data: { items: [], total: 0, page: 1, page_size: params.size ?? 100, total_pages: 0 },
      };
    }
  },

  adminAnalyze: async (params: {
    sessionId: number;
    agentId: number;
    analysisType?: string;
    prompt?: string;
  }): Promise<BaseResponse<GroupDiscussionAdminAnalyzeResponse>> => {
    try {
      const response = await api.post(`${BASE_PATH}/admin/analyze`, {
        session_id: params.sessionId,
        agent_id: params.agentId,
        analysis_type: params.analysisType ?? "summary",
        prompt: params.prompt,
      });
      const raw = response.data as unknown as Record<string, unknown>;
      const data = (raw && typeof raw === "object" && "data" in raw ? raw.data : raw) as unknown;
      return { success: true, message: "分析成功", data: data as GroupDiscussionAdminAnalyzeResponse };
    } catch (error: unknown) {
      logger.error("分析小组讨论失败:", error);
      return {
        success: false,
        message: errMsg(error, "分析失败"),
        data: { analysis_id: 0, result_text: "", created_at: new Date().toISOString() },
      };
    }
  },

  adminListAnalyses: async (params: {
    sessionId: number;
    limit?: number;
  }): Promise<BaseResponse<GroupDiscussionAdminAnalysisListResponse>> => {
    try {
      const response = await api.get(`${BASE_PATH}/admin/analyses`, {
        params: {
          session_id: params.sessionId,
          limit: params.limit ?? 20,
        },
      });
      const raw = response.data as unknown as Record<string, unknown>;
      const data = (raw && typeof raw === "object" && "data" in raw ? raw.data : raw) as unknown;
      return { success: true, message: "获取成功", data: data as GroupDiscussionAdminAnalysisListResponse };
    } catch (error: unknown) {
      logger.error("获取小组讨论分析历史失败:", error);
      return {
        success: false,
        message: errMsg(error, "获取失败"),
        data: { items: [] },
      };
    }
  },

  adminListMembers: async (params: {
    sessionId: number;
  }): Promise<BaseResponse<GroupDiscussionAdminMemberListResponse>> => {
    try {
      const response = await api.get(`${BASE_PATH}/admin/members`, {
        params: { session_id: params.sessionId },
      });
      const raw = response.data as unknown as Record<string, unknown>;
      const data = (raw && typeof raw === "object" && "data" in raw ? raw.data : raw) as unknown;
      return { success: true, message: "获取成功", data: data as GroupDiscussionAdminMemberListResponse };
    } catch (error: unknown) {
      logger.error("获取小组成员失败:", error);
      return {
        success: false,
        message: errMsg(error, "获取失败"),
        data: { items: [] },
      };
    }
  },

  adminListClasses: async (params?: { date?: string }): Promise<BaseResponse<string[]>> => {
    try {
      const response = await api.get(
        `${BASE_PATH}/admin/classes`,
        ({ params: { date: params?.date }, silent: true } as AxiosRequestConfig & { silent?: boolean }),
      );
      const raw = response.data as unknown as Record<string, unknown>;
      const data = (raw && typeof raw === "object" && "data" in raw ? raw.data : raw) as unknown;
      return { success: true, message: "获取成功", data: data as string[] };
    } catch (error: unknown) {
      if (asApiError(error).response?.status !== 401) {
        logger.error("获取班级列表失败:", error);
      }
      return {
        success: false,
        message: errMsg(error, "获取失败"),
        data: [],
      };
    }
  },

  adminCompareAnalyze: async (params: {
    sessionIds: number[];
    agentId: number;
    bucketSeconds: number;
    analysisType: string;
    prompt?: string;
    useCache?: boolean;
  }): Promise<BaseResponse<GroupDiscussionAdminAnalyzeResponse>> => {
    try {
      const response = await api.post(`${BASE_PATH}/admin/compare-analyze`, {
        session_ids: params.sessionIds,
        agent_id: params.agentId,
        bucket_seconds: params.bucketSeconds,
        analysis_type: params.analysisType,
        prompt: params.prompt,
        use_cache: params.useCache ?? true,
      });
      const raw = response.data as unknown as Record<string, unknown>;
      const data = (raw && typeof raw === "object" && "data" in raw ? raw.data : raw) as unknown;
      return { success: true, message: "分析成功", data: data as GroupDiscussionAdminAnalyzeResponse };
    } catch (error: unknown) {
      logger.error("对比分析失败:", error);
      return {
        success: false,
        message: errMsg(error, "分析失败"),
        data: { analysis_id: 0, result_text: "", created_at: "" },
      };
    }
  },
};
