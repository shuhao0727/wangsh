// 测评会话 API（学生端 + 管理端统计）

import { api } from "../api";
import { logger } from "../logger";

const BASE = "/assessment";
const ADMIN_BASE = "/assessment/admin";

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

export interface AvailableAssessment {
  id: number;
  title: string;
  total_score: number;
  time_limit_minutes: number;
  session_status: string | null;
  session_id: number | null;
  earned_score: number | null;
}

export interface SessionStartResponse {
  session_id: number;
  config_title: string;
  total_questions: number;
  total_score: number;
  time_limit_minutes: number;
  started_at: string;
}

export interface QuestionForStudent {
  answer_id: number;
  question_type: string;
  content: string;
  options: string | null;
  score: number;
  student_answer: string | null;
  is_answered: boolean;
  is_adaptive?: boolean;
  knowledge_point?: string | null;
  attempt_seq?: number;
}

export interface AnswerResult {
  answer_id: number;
  question_type: string;
  is_correct: boolean | null;
  correct_answer: string | null;
  explanation: string | null;
  earned_score: number | null;
  max_score: number;
  ai_feedback: string | null;
  next_question?: {
    answer_id: number;
    question_type: string;
    content: string;
    options: string | null;
    score: number;
    is_adaptive: boolean;
    knowledge_point: string;
    attempt_seq: number;
  } | null;
  mastery_status?: string;
}

export interface SessionSubmitResponse {
  session_id: number;
  status: string;
  earned_score: number;
  total_score: number;
  basic_profile_id: number | null;
  summary: string | null;
}

export interface ProfileStatusResponse {
  basic_ready: boolean;
  advanced_ready: boolean;
}

export interface AnswerDetailResponse {
  id: number;
  question_type: string;
  content: string;
  options: string | null;
  student_answer: string | null;
  correct_answer: string;
  is_correct: boolean | null;
  earned_score: number | null;
  max_score: number;
  ai_feedback: string | null;
  explanation: string | null;
}

export interface SessionResultResponse {
  session_id: number;
  config_id: number;
  config_title: string;
  status: string;
  earned_score: number | null;
  total_score: number;
  started_at: string | null;
  submitted_at: string | null;
  answers: AnswerDetailResponse[];
  basic_profile_id: number | null;
}

export interface BasicProfileResponse {
  id: number;
  session_id: number;
  user_id: number;
  config_id: number;
  earned_score: number;
  total_score: number;
  knowledge_scores: string | null;
  wrong_points: string | null;
  ai_summary: string | null;
  created_at: string;
  class_knowledge_rates?: Record<string, number> | null;
}

export interface StatisticsResponse {
  config_id: number;
  config_title: string;
  total_students: number;
  submitted_count: number;
  avg_score: number | null;
  max_score: number | null;
  min_score: number | null;
  pass_rate: number | null;
  knowledge_rates: Record<string, number> | null;
}

export interface SessionListItem {
  id: number;
  user_id: number;
  user_name: string | null;
  class_name: string | null;
  status: string;
  earned_score: number | null;
  total_score: number;
  started_at: string | null;
  submitted_at: string | null;
  created_at: string;
}

export interface SessionListResponse {
  items: SessionListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ─── API ───

export const assessmentSessionApi = {
  // 学生端
  available: async (): Promise<AvailableAssessment[]> => {
    try {
      const resp = await api.get(`${BASE}/available`);
      return resp.data as any;
    } catch (error) {
      logger.error("获取可用测评失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "获取可用测评失败");
    }
  },

  start: async (configId: number): Promise<SessionStartResponse> => {
    try {
      const resp = await api.post(`${BASE}/sessions/start`, { config_id: configId }, { timeout: 120000 });
      return resp.data as any;
    } catch (error) {
      logger.error("开始检测失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "开始检测失败");
    }
  },

  getQuestions: async (sessionId: number): Promise<QuestionForStudent[]> => {
    try {
      const resp = await api.get(`${BASE}/sessions/${sessionId}/questions`);
      return resp.data as any;
    } catch (error) {
      logger.error("获取题目失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "获取题目失败");
    }
  },

  submitAnswer: async (sessionId: number, data: { answer_id: number; student_answer: string }): Promise<AnswerResult> => {
    try {
      const resp = await api.post(`${BASE}/sessions/${sessionId}/answer`, data, { timeout: 120000 });
      return resp.data as any;
    } catch (error) {
      logger.error("提交答案失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "提交答案失败");
    }
  },

  submit: async (sessionId: number): Promise<SessionSubmitResponse> => {
    try {
      const resp = await api.post(`${BASE}/sessions/${sessionId}/submit`, {}, { timeout: 120000 });
      return resp.data as any;
    } catch (error) {
      logger.error("提交检测失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "提交检测失败");
    }
  },

  getResult: async (sessionId: number): Promise<SessionResultResponse> => {
    try {
      const resp = await api.get(`${BASE}/sessions/${sessionId}/result`);
      return resp.data as any;
    } catch (error) {
      logger.error("获取检测结果失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "获取检测结果失败");
    }
  },

  getBasicProfile: async (sessionId: number): Promise<BasicProfileResponse> => {
    try {
      const resp = await api.get(`${BASE}/sessions/${sessionId}/basic-profile`);
      return resp.data as any;
    } catch (error) {
      logger.error("获取初级画像失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "获取初级画像失败");
    }
  },

  // 管理端
  getClassNames: async (configId: number): Promise<string[]> => {
    try {
      const resp = await api.get(`${ADMIN_BASE}/configs/${configId}/class-names`);
      return (resp.data as any).class_names || [];
    } catch (error) {
      logger.error("获取班级列表失败:", error);
      return [];
    }
  },

  getConfigSessions: async (configId: number, params?: {
    skip?: number; limit?: number; class_name?: string; status?: string; search?: string;
  }): Promise<SessionListResponse> => {
    try {
      const resp = await api.get(`${ADMIN_BASE}/configs/${configId}/sessions`, { params });
      return resp.data as any;
    } catch (error) {
      logger.error("获取答题列表失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "获取答题列表失败");
    }
  },

  getSessionDetail: async (sessionId: number): Promise<SessionResultResponse> => {
    try {
      const resp = await api.get(`${ADMIN_BASE}/sessions/${sessionId}`);
      return resp.data as any;
    } catch (error) {
      logger.error("获取答题详情失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "获取答题详情失败");
    }
  },

  getAdminBasicProfile: async (sessionId: number): Promise<BasicProfileResponse> => {
    try {
      const resp = await api.get(`${ADMIN_BASE}/sessions/${sessionId}/basic-profile`);
      return resp.data as any;
    } catch (error) {
      logger.error("获取学生画像失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "获取学生画像失败");
    }
  },

  getStatistics: async (configId: number, params?: { class_name?: string }): Promise<StatisticsResponse> => {
    try {
      const resp = await api.get(`${ADMIN_BASE}/configs/${configId}/statistics`, { params });
      return resp.data as any;
    } catch (error) {
      logger.error("获取统计数据失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "获取统计数据失败");
    }
  },

  allowRetest: async (sessionId: number): Promise<{ session_id: number; status: string; message: string }> => {
    try {
      const resp = await api.post(`${ADMIN_BASE}/sessions/${sessionId}/allow-retest`);
      return resp.data as any;
    } catch (error) {
      logger.error("允许重测失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "允许重测失败");
    }
  },

  batchRetest: async (configId: number, params: { session_ids?: number[]; class_name?: string }): Promise<{ deleted_count: number; message: string }> => {
    try {
      const resp = await api.post(`${ADMIN_BASE}/configs/${configId}/batch-retest`, params);
      return resp.data as any;
    } catch (error) {
      logger.error("批量重测失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "批量重测失败");
    }
  },

  exportXlsx: async (configId: number, params?: { class_name?: string; status?: string; search?: string }): Promise<void> => {
    try {
      const resp = await api.get(`${ADMIN_BASE}/configs/${configId}/export`, {
        params,
        responseType: "blob",
        timeout: 120000,
      });
      const disposition = resp.headers["content-disposition"] || "";
      let filename = "assessment_export.xlsx";
      const match = disposition.match(/filename\*=UTF-8''(.+)/);
      if (match) {
        filename = decodeURIComponent(match[1]);
      }
      const url = window.URL.createObjectURL(new Blob([resp.data as unknown as BlobPart]));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error("导出失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "导出失败");
    }
  },

  getProfileStatus: async (sessionId: number): Promise<ProfileStatusResponse> => {
    try {
      const resp = await api.get(`${BASE}/sessions/${sessionId}/profile-status`);
      return resp.data as any;
    } catch (error) {
      logger.error("获取画像状态失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "获取画像状态失败");
    }
  },
};
