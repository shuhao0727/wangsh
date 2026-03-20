// 题目管理 API

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
    return detail.map((d: any) => String(d?.msg || d?.message || "")).filter(Boolean).join("；") || undefined;
  }
  return String(detail);
};

// ─── 类型定义 ───

export interface AssessmentQuestion {
  id: number;
  config_id: number;
  question_type: "choice" | "fill" | "short_answer";
  content: string;
  options: string | null;
  correct_answer: string;
  score: number;
  difficulty: "easy" | "medium" | "hard";
  knowledge_point: string | null;
  explanation: string | null;
  source: "ai_generated" | "manual" | "ai_realtime";
  mode: "fixed" | "adaptive";
  adaptive_config: string | null;
  created_at: string;
}

export interface QuestionListResponse {
  items: AssessmentQuestion[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface QuestionCreateRequest {
  config_id: number;
  question_type: "choice" | "fill" | "short_answer";
  content: string;
  options?: string;
  correct_answer: string;
  score: number;
  difficulty?: "easy" | "medium" | "hard";
  knowledge_point?: string;
  explanation?: string;
  source?: "manual";
  mode?: "fixed" | "adaptive";
  adaptive_config?: string;
}

export interface QuestionUpdateRequest {
  question_type?: "choice" | "fill" | "short_answer";
  content?: string;
  options?: string;
  correct_answer?: string;
  score?: number;
  difficulty?: "easy" | "medium" | "hard";
  knowledge_point?: string;
  explanation?: string;
  mode?: "fixed" | "adaptive";
  adaptive_config?: string;
}

export interface GenerateParams {
  count?: number;
  question_type?: "choice" | "fill" | "short_answer";
  difficulty?: "easy" | "medium" | "hard";
  knowledge_points?: string[];
}

export interface GenerateResult {
  message: string;
  count: number;
  items: AssessmentQuestion[];
}

// ─── API ───

export const assessmentQuestionApi = {
  list: async (configId: number, params?: {
    skip?: number;
    limit?: number;
    question_type?: string;
    difficulty?: string;
  }): Promise<QuestionListResponse> => {
    try {
      const resp = await api.get(`${BASE}/configs/${configId}/questions`, { params });
      return resp.data as any;
    } catch (error) {
      logger.error("获取题目列表失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "获取题目列表失败");
    }
  },

  create: async (data: QuestionCreateRequest): Promise<AssessmentQuestion> => {
    try {
      const resp = await api.post(`${BASE}/questions`, data);
      return resp.data as any;
    } catch (error) {
      logger.error("创建题目失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "创建题目失败");
    }
  },

  update: async (questionId: number, data: QuestionUpdateRequest): Promise<AssessmentQuestion> => {
    try {
      const resp = await api.put(`${BASE}/questions/${questionId}`, data);
      return resp.data as any;
    } catch (error) {
      logger.error("更新题目失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "更新题目失败");
    }
  },

  delete: async (questionId: number): Promise<void> => {
    try {
      await api.delete(`${BASE}/questions/${questionId}`);
    } catch (error) {
      logger.error("删除题目失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "删除题目失败");
    }
  },

  generate: async (configId: number, params?: GenerateParams): Promise<GenerateResult> => {
    try {
      const resp = await api.post(`${BASE}/configs/${configId}/generate-questions`, params || {}, { timeout: 120000 });
      return resp.data as any;
    } catch (error) {
      logger.error("AI 生成题目失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "AI 生成题目失败");
    }
  },
};
