// 测评配置 API

import { api } from "../api";
import { logger } from "../logger";

const BASE = "/assessment/admin";

interface ApiErrorShape {
  message?: string;
  response?: { data?: { detail?: unknown } };
}
const asApiError = (e: unknown): ApiErrorShape =>
  (e && typeof e === "object" ? e : {}) as ApiErrorShape;

const toDetailMessage = (detail: unknown): string | undefined => {
  if (!detail) return undefined;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d: any) => {
      if (typeof d === "string") return d;
      const loc = Array.isArray(d?.loc) ? d.loc.join(".") : "";
      const msg = String(d?.msg || d?.message || "");
      return [loc, msg].filter(Boolean).join(": ");
    }).filter(Boolean).join("；") || undefined;
  }
  if (typeof detail === "object") {
    const obj = detail as Record<string, unknown>;
    return String(obj.msg || obj.message || JSON.stringify(detail));
  }
  return String(detail);
};

// ─── 类型定义 ───

export interface AssessmentConfigAgent {
  id: number;
  name: string;
  agent_type: string;
}

export interface AssessmentConfig {
  id: number;
  title: string;
  grade: string | null;
  teaching_objectives: string | null;
  knowledge_points: string | null;
  total_score: number;
  question_config: string | null;
  ai_prompt: string | null;
  agent_id: number | null;
  agent_name: string | null;
  time_limit_minutes: number;
  available_start: string | null;
  available_end: string | null;
  enabled: boolean;
  created_by_user_id: number | null;
  creator_name: string | null;
  question_count: number;
  session_count: number;
  config_agents: AssessmentConfigAgent[];
  created_at: string;
  updated_at: string;
}

export interface AssessmentConfigListResponse {
  items: AssessmentConfig[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AssessmentConfigCreateRequest {
  title: string;
  grade?: string;
  teaching_objectives?: string;
  knowledge_points?: string;
  total_score?: number;
  question_config?: string;
  ai_prompt?: string;
  agent_id?: number;
  time_limit_minutes?: number;
  agent_ids?: number[];
  available_start?: string;
  available_end?: string;
}

export interface AssessmentConfigUpdateRequest {
  title?: string;
  subject?: string;
  grade?: string;
  teaching_objectives?: string;
  knowledge_points?: string;
  total_score?: number;
  question_config?: string;
  ai_prompt?: string;
  agent_id?: number;
  time_limit_minutes?: number;
  agent_ids?: number[];
  available_start?: string;
  available_end?: string;
}

// ─── API ───

export const assessmentConfigApi = {
  list: async (params?: {
    skip?: number;
    limit?: number;
    grade?: string;
    enabled?: boolean;
    search?: string;
  }): Promise<AssessmentConfigListResponse> => {
    try {
      const resp = await api.get(`${BASE}/configs`, { params });
      return resp.data as any;
    } catch (error) {
      logger.error("获取测评配置列表失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "获取测评配置列表失败");
    }
  },

  get: async (id: number): Promise<AssessmentConfig> => {
    try {
      const resp = await api.get(`${BASE}/configs/${id}`);
      return resp.data as any;
    } catch (error) {
      logger.error("获取测评配置详情失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "获取测评配置详情失败");
    }
  },

  create: async (data: AssessmentConfigCreateRequest): Promise<AssessmentConfig> => {
    try {
      const resp = await api.post(`${BASE}/configs`, data);
      return resp.data as any;
    } catch (error) {
      logger.error("创建测评配置失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "创建测评配置失败");
    }
  },

  update: async (id: number, data: AssessmentConfigUpdateRequest): Promise<AssessmentConfig> => {
    try {
      const resp = await api.put(`${BASE}/configs/${id}`, data);
      return resp.data as any;
    } catch (error) {
      logger.error("更新测评配置失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "更新测评配置失败");
    }
  },

  delete: async (id: number): Promise<void> => {
    try {
      await api.delete(`${BASE}/configs/${id}`);
    } catch (error) {
      logger.error("删除测评配置失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "删除测评配置失败");
    }
  },

  toggle: async (id: number): Promise<AssessmentConfig> => {
    try {
      const resp = await api.put(`${BASE}/configs/${id}/toggle`);
      return resp.data as any;
    } catch (error) {
      logger.error("切换测评状态失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "切换测评状态失败");
    }
  },
};
