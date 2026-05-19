// ZNT API 统一导出
// 前端保留，后端已移除

import aiAgentsApi from "./ai-agents-api";
import { api, getStoredAccessToken } from "../../api";
import { logger } from "../../logger";
import type {
  BaseResponse,
  PaginatedResponse,
  AgentUsageData,
  StatisticsData,
  SearchFilterParams,
} from "../types";

type TaskAnalysisStreamPayload = {
  message?: string;
  progress?: number;
  step_id?: string;
  result?: unknown;
  id?: number;
};

type TaskAnalysisStreamCallbacks = {
  onEvent?: (event: string, payload: TaskAnalysisStreamPayload) => void;
};

interface ApiErrorShape {
  message?: string;
  response?: { data?: { detail?: unknown } };
}
const asApiError = (e: unknown): ApiErrorShape =>
  (e && typeof e === "object" ? e : {}) as ApiErrorShape;
const isRequestCanceled = (e: unknown): boolean => {
  const err = asApiError(e) as ApiErrorShape & { code?: string; name?: string };
  return err.code === "ERR_CANCELED" || err.name === "CanceledError" || err.message === "canceled";
};
const errMsg = (e: unknown, fallback: string): string => {
  const err = asApiError(e);
  const detail = err.response?.data?.detail;
  return (typeof detail === "string" ? detail : err.message) || fallback;
};

const AGENT_USAGE_BASE_PATH = "/ai-agents/usage";
const AGENT_CONVERSATIONS_BASE_PATH = "/ai-agents/conversations";

// 代理数据API
const agentDataApi = {
  // 获取代理使用数据
  getAgentData: async (
    params?: SearchFilterParams,
    signal?: AbortSignal,
  ): Promise<BaseResponse<PaginatedResponse<AgentUsageData>>> => {
    try {
      const queryParams: Record<string, unknown> = {};
      if (params?.keyword) queryParams.keyword = params.keyword;
      if (params?.agent_name) queryParams.agent_name = params.agent_name;
      if (params?.student_name) queryParams.student_name = params.student_name;
      if (params?.student_id) queryParams.student_id = params.student_id;
      if (params?.class_name) queryParams.class_name = params.class_name;
      if (params?.grade) queryParams.grade = params.grade;
      if (params?.start_date) queryParams.start_date = params.start_date;
      if (params?.end_date) queryParams.end_date = params.end_date;
      if (params?.page) queryParams.page = params.page;
      if (params?.page_size) queryParams.page_size = params.page_size;

      const response = await api.get(AGENT_USAGE_BASE_PATH, {
        params: queryParams,
        signal,
      });

      return {
        data: response.data as unknown as PaginatedResponse<AgentUsageData>,
        success: true,
        message: "获取智能体使用数据成功",
      };
    } catch (error: unknown) {
      if (isRequestCanceled(error)) {
        throw error;
      }
      logger.error("获取智能体使用数据失败:", error);
      return {
        data: {
          items: [],
          total: 0,
          page: params?.page || 1,
          page_size: params?.page_size || 20,
          total_pages: 0,
        },
        success: false,
        message:
          errMsg(error, "获取智能体使用数据失败"),
      };
    }
  },

  listConversations: async (params: {
    agent_id: number;
    limit?: number;
  }): Promise<
    BaseResponse<
      Array<{
        session_id: string;
        agent_id: number;
        display_agent_name?: string;
        display_user_name?: string;
        last_at: string;
        turns: number;
        preview?: string;
      }>
    >
  > => {
    try {
      const response = await api.get(AGENT_CONVERSATIONS_BASE_PATH, {
        params: { agent_id: params.agent_id, limit: params.limit ?? 5 },
      });
      return {
        data: response.data as unknown as never[],
        success: true,
        message: "获取会话列表成功",
      };
    } catch (error: unknown) {
      logger.error("获取会话列表失败:", error);
      return {
        data: [],
        success: false,
        message:
          errMsg(error, "获取会话列表失败"),
      };
    }
  },

  getConversationMessages: async (sessionId: string): Promise<
    BaseResponse<
      Array<{
        id: number;
        session_id: string;
        user_id?: number;
        agent_id?: number;
        display_user_name?: string;
        display_agent_name?: string;
        message_type: string;
        content: string;
        response_time_ms?: number;
        created_at: string;
      }>
    >
  > => {
    try {
      const response = await api.get(
        `${AGENT_CONVERSATIONS_BASE_PATH}/${encodeURIComponent(sessionId)}`,
      );
      return {
        data: response.data as unknown as never[],
        success: true,
        message: "获取会话消息成功",
      };
    } catch (error: unknown) {
      logger.error("获取会话消息失败:", error);
      return {
        data: [],
        success: false,
        message:
          errMsg(error, "获取会话消息失败"),
      };
    }
  },

  getConversationMessagesAdmin: async (sessionId: string): Promise<
    BaseResponse<
      Array<{
        id: number;
        session_id: string;
        user_id?: number;
        agent_id?: number;
        display_user_name?: string;
        display_agent_name?: string;
        message_type: string;
        content: string;
        response_time_ms?: number;
        created_at: string;
      }>
    >
  > => {
    try {
      const response = await api.get(
        `/ai-agents/admin/conversations/${encodeURIComponent(sessionId)}`,
      );
      return {
        data: response.data as unknown as never[],
        success: true,
        message: "获取会话消息成功",
      };
    } catch (error: unknown) {
      logger.error("获取会话消息失败:", error);
      return {
        data: [],
        success: false,
        message:
          errMsg(error, "获取会话消息失败"),
      };
    }
  },

  // 获取统计数据
  getStatistics: async (
    params?: SearchFilterParams,
    signal?: AbortSignal,
  ): Promise<BaseResponse<StatisticsData>> => {
    try {
      const queryParams: Record<string, unknown> = {};
      if (params?.keyword) queryParams.keyword = params.keyword;
      if (params?.agent_name) queryParams.agent_name = params.agent_name;
      if (params?.student_name) queryParams.student_name = params.student_name;
      if (params?.student_id) queryParams.student_id = params.student_id;
      if (params?.class_name) queryParams.class_name = params.class_name;
      if (params?.grade) queryParams.grade = params.grade;
      if (params?.start_date) queryParams.start_date = params.start_date;
      if (params?.end_date) queryParams.end_date = params.end_date;

      const response = await api.get(`${AGENT_USAGE_BASE_PATH}/statistics`, {
        params: queryParams,
        signal,
      });

      return {
        data: response.data as unknown as StatisticsData,
        success: true,
        message: "获取统计数据成功",
      };
    } catch (error: unknown) {
      logger.error("获取统计数据失败:", error);
      return {
        data: {
          total_usage: 0,
          active_students: 0,
          active_agents: 0,
          avg_response_time: 0,
          today_usage: 0,
          week_usage: 0,
          month_usage: 0,
        },
        success: false,
        message:
          errMsg(error, "获取统计数据失败"),
      };
    }
  },

  createUsage: async (payload: {
    agent_id: number;
    user_id?: number;
    question?: string;
    answer?: string;
    session_id?: string;
    response_time_ms?: number;
    used_at?: string;
  }): Promise<BaseResponse<AgentUsageData>> => {
    try {
      const response = await api.post(AGENT_USAGE_BASE_PATH, payload);
      return {
        data: response.data as unknown as AgentUsageData,
        success: true,
        message: "写入使用数据成功",
      };
    } catch (error: unknown) {
      logger.error("写入使用数据失败:", error);
      return {
        data: {
          id: Date.now(),
          user_id: payload.user_id || 0,
          moxing_id: payload.agent_id,
          question: payload.question,
          answer: payload.answer,
          session_id: payload.session_id,
          response_time_ms: payload.response_time_ms,
          used_at: payload.used_at,
        },
        success: false,
        message:
          errMsg(error, "写入使用数据失败"),
      };
    }
  },

  analyzeHotQuestions: async (params: {
    agent_id: number;
    start_at?: string;
    end_at?: string;
    bucket_seconds?: number;
    top_n?: number;
    class_name?: string;
    student_id?: string;
  }): Promise<
    BaseResponse<
      Array<{
        bucket_start: string;
        question_count: number;
        unique_students: number;
        top_questions: Array<{ question: string; count: number }>;
      }>
    >
  > => {
    try {
      const response = await api.get("/ai-agents/analysis/hot-questions", {
        params,
      });
      return {
        data: response.data as unknown as never[],
        success: true,
        message: "获取热点问题成功",
      };
    } catch (error: unknown) {
      logger.error("获取热点问题失败:", error);
      return {
        data: [],
        success: false,
        message:
          errMsg(error, "获取热点问题失败"),
      };
    }
  },

  analyzeStudentChains: async (params: {
    agent_id: number;
    user_id?: number;
    student_id?: string;
    student_name?: string;
    class_name?: string;
    start_at?: string;
    end_at?: string;
    limit_sessions?: number;
  }): Promise<
    BaseResponse<
      Array<{
        session_id: string;
        last_at: string;
        turns: number;
        student_id?: string;
        user_name?: string;
        class_name?: string;
        messages: Array<{
          id: number;
          message_type: string;
          content: string;
          created_at: string;
        }>;
      }>
    >
  > => {
    try {
      const response = await api.get("/ai-agents/analysis/student-chains", {
        params,
      });
      return {
        data: response.data as unknown as never[],
        success: true,
        message: "获取学生提问链条成功",
      };
    } catch (error: unknown) {
      logger.error("获取学生提问链条失败:", error);
      return {
        data: [],
        success: false,
        message:
          errMsg(error, "获取学生提问链条失败"),
      };
    }
  },

  getFilterOptions: async (): Promise<
    BaseResponse<{ class_names: string[]; grades: string[]; agent_names: string[] }>
  > => {
    try {
      const response = await api.get(`${AGENT_USAGE_BASE_PATH}/filter-options`);
      return {
        data: response.data as unknown as { class_names: string[]; grades: string[]; agent_names: string[] },
        success: true,
        message: "获取筛选选项成功",
      };
    } catch (error: unknown) {
      logger.error("获取筛选选项失败:", error);
      return {
        data: { class_names: [], grades: [], agent_names: [] },
        success: false,
        message: errMsg(error, "获取筛选选项失败"),
      };
    }
  },

  analyzeTaskSheet: async (params: {
    task_sheet: string;
    agent_id: number;
    start_at?: string;
    end_at?: string;
    class_name?: string;
  }): Promise<
    BaseResponse<{
      word_cloud: Array<{ word: string; count: number }>;
      covered: Array<{ topic: string; questions: string[]; count: number }>;
      uncovered: Array<{ topic: string; questions: string[]; count: number }>;
    }>
  > => {
    try {
      const response = await api.client.post("/ai-agents/analysis/task-analysis", params);
      return {
        data: response.data as never,
        success: true,
        message: "分析完成",
      };
    } catch (error: unknown) {
      logger.error("任务分析失败:", error);
      return {
        data: { word_cloud: [], covered: [], uncovered: [] },
        success: false,
        message: errMsg(error, "分析失败"),
      };
    }
  },

  listTaskAnalyses: async (): Promise<BaseResponse<unknown[]>> => {
    try {
      const response = await api.get("/ai-agents/analysis/task-analyses");
      return { data: response.data as unknown as unknown[], success: true, message: "ok" };
    } catch (e: unknown) { return { data: [], success: false, message: errMsg(e, "获取列表失败") }; }
  },

  getTaskAnalysis: async (id: number): Promise<BaseResponse<unknown>> => {
    try {
      const response = await api.get(`/ai-agents/analysis/task-analyses/${id}`);
      return { data: response.data as unknown, success: true, message: "ok" };
    } catch (e: unknown) { return { data: null, success: false, message: errMsg(e, "获取失败") }; }
  },

  saveTaskAnalysis: async (params: {
    title: string; task_sheet: string; agent_id: number;
    start_at?: string; end_at?: string; class_name?: string;
  }): Promise<BaseResponse<unknown>> => {
    try {
      const response = await api.client.post("/ai-agents/analysis/task-analyses", params);
      return { data: response.data as unknown, success: true, message: "保存成功" };
    } catch (e: unknown) { return { data: null, success: false, message: errMsg(e, "保存失败") }; }
  },

  saveTaskAnalysisStream: async (
    params: {
      title: string; task_sheet: string; agent_id: number;
      start_at?: string; end_at?: string; class_name?: string;
    },
    callbacks: TaskAnalysisStreamCallbacks = {},
  ): Promise<BaseResponse<unknown>> => {
    try {
      const token = getStoredAccessToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch("/api/v1/ai-agents/analysis/task-analyses/stream", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(params),
      });
      if (!response.ok || !response.body) {
        throw new Error(`请求失败：${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let savedPayload: TaskAnalysisStreamPayload | null = null;

      const consumeBlock = (block: string) => {
        let event = "message";
        const dataLines: string[] = [];
        for (const line of block.split("\n")) {
          if (line.startsWith("event: ")) event = line.slice(7).trim();
          if (line.startsWith("data: ")) dataLines.push(line.slice(6));
        }
        if (dataLines.length === 0) return;
        const payload = JSON.parse(dataLines.join("\n")) as TaskAnalysisStreamPayload;
        callbacks.onEvent?.(event, payload);
        if (event === "saved") savedPayload = payload;
        if (event === "error") throw new Error(payload.message || "分析失败");
      };

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          consumeBlock(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");
        }
        if (done) break;
      }
      if (buffer.trim()) consumeBlock(buffer);
      return { data: savedPayload as unknown, success: true, message: "保存成功" };
    } catch (e: unknown) { return { data: null, success: false, message: errMsg(e, "保存失败") }; }
  },

  deleteTaskAnalysis: async (id: number): Promise<BaseResponse<unknown>> => {
    try {
      await api.client.delete(`/ai-agents/analysis/task-analyses/${id}`);
      return { data: null, success: true, message: "已删除" };
    } catch (e: unknown) { return { data: null, success: false, message: errMsg(e, "删除失败") }; }
  },

  exportSelectedConversations: async (sessionIds: string[]): Promise<BaseResponse<Blob>> => {
    try {
      const response = await api.client.post(
        "/ai-agents/admin/export/conversations",
        { session_ids: sessionIds },
        { responseType: "blob" },
      );
      return {
        data: response.data as Blob,
        success: true,
        message: "导出成功",
      };
    } catch (error: unknown) {
      logger.error("导出会话失败:", error);
      return {
        data: new Blob([""], { type: "application/octet-stream" }),
        success: false,
        message:
          errMsg(error, "导出失败"),
      };
    }
  },

  exportHotQuestions: async (params: {
    agent_id: number;
    start_at?: string;
    end_at?: string;
    bucket_seconds?: number;
    top_n?: number;
    class_name?: string;
    student_id?: string;
  }): Promise<BaseResponse<Blob>> => {
    try {
      const response = await api.client.get("/ai-agents/admin/export/hot-questions", {
        params,
        responseType: "blob",
      });
      return {
        data: response.data as Blob,
        success: true,
        message: "导出成功",
      };
    } catch (error: unknown) {
      logger.error("导出热点问题失败:", error);
      return {
        data: new Blob([""], { type: "application/octet-stream" }),
        success: false,
        message:
          errMsg(error, "导出失败"),
      };
    }
  },

  exportStudentChains: async (params: {
    agent_id: number;
    user_id?: number;
    student_id?: string;
    student_name?: string;
    class_name?: string;
    start_at?: string;
    end_at?: string;
    limit_sessions?: number;
  }): Promise<BaseResponse<Blob>> => {
    try {
      const response = await api.client.get("/ai-agents/admin/export/student-chains", {
        params,
        responseType: "blob",
      });
      return {
        data: response.data as Blob,
        success: true,
        message: "导出成功",
      };
    } catch (error: unknown) {
      logger.error("导出学生提问链条失败:", error);
      return {
        data: new Blob([""], { type: "application/octet-stream" }),
        success: false,
        message:
          errMsg(error, "导出失败"),
      };
    }
  },
};

// 导出所有API
export { aiAgentsApi, agentDataApi };

// 导出类型
export type { ZntMoxingStats } from "./ai-agents-api";
