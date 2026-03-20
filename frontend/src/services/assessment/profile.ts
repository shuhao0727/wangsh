// 三维融合画像 API

import { api } from "../api";
import { logger } from "../logger";

const ADMIN_BASE = "/assessment/admin";
const BASE = "/assessment";

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
  return String(detail);
};

// ─── 类型定义 ───

export interface StudentProfile {
  id: number;
  profile_type: string;
  target_id: string;
  config_id: number | null;
  config_title: string | null;
  discussion_session_id: number | null;
  agent_ids: string | null;
  data_sources: string | null;
  result_text: string | null;
  scores: string | null;
  created_by_user_id: number | null;
  creator_name: string | null;
  created_at: string;
}

export interface ProfileListResponse {
  items: StudentProfile[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ProfileGenerateRequest {
  profile_type: "individual" | "group" | "class";
  target_id: string;
  config_id?: number;
  discussion_session_id?: number;
  agent_ids?: number[];
  agent_id: number;
}

export interface ProfileBatchGenerateRequest {
  user_ids: number[];
  config_id?: number;
  discussion_session_id?: number;
  agent_ids?: number[];
  agent_id: number;
}

// ─── API ───

export const profileApi = {
  // Admin: 生成画像
  generate: async (data: ProfileGenerateRequest): Promise<StudentProfile> => {
    try {
      const resp = await api.post(`${ADMIN_BASE}/profiles/generate`, data, { timeout: 120000 });
      return resp.data as any;
    } catch (error) {
      logger.error("生成画像失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "生成画像失败");
    }
  },

  // Admin: 批量生成
  batchGenerate: async (data: ProfileBatchGenerateRequest): Promise<{ items: StudentProfile[]; count: number }> => {
    try {
      const resp = await api.post(`${ADMIN_BASE}/profiles/batch-generate`, data, { timeout: 120000 });
      return resp.data as any;
    } catch (error) {
      logger.error("批量生成画像失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "批量生成画像失败");
    }
  },

  // Admin: 画像列表
  list: async (params?: {
    skip?: number; limit?: number; profile_type?: string; target_id?: string;
  }): Promise<ProfileListResponse> => {
    try {
      const resp = await api.get(`${ADMIN_BASE}/profiles`, { params });
      return resp.data as any;
    } catch (error) {
      logger.error("获取画像列表失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "获取画像列表失败");
    }
  },

  // Admin: 画像详情
  get: async (id: number): Promise<StudentProfile> => {
    try {
      const resp = await api.get(`${ADMIN_BASE}/profiles/${id}`);
      return resp.data as any;
    } catch (error) {
      logger.error("获取画像详情失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "获取画像详情失败");
    }
  },

  // Admin: 删除画像
  delete: async (id: number): Promise<void> => {
    try {
      await api.delete(`${ADMIN_BASE}/profiles/${id}`);
    } catch (error) {
      logger.error("删除画像失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "删除画像失败");
    }
  },

  // Student: 我的画像列表
  getMyProfiles: async (params?: { skip?: number; limit?: number }): Promise<ProfileListResponse> => {
    try {
      const resp = await api.get(`${BASE}/my-profiles`, { params });
      return resp.data as any;
    } catch (error) {
      logger.error("获取我的画像失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "获取我的画像失败");
    }
  },

  // Student: 我的画像详情
  getMyProfile: async (id: number): Promise<StudentProfile> => {
    try {
      const resp = await api.get(`${BASE}/my-profiles/${id}`);
      return resp.data as any;
    } catch (error) {
      logger.error("获取画像详情失败:", error);
      throw new Error(toDetailMessage(asApiError(error).response?.data?.detail) || "获取画像详情失败");
    }
  },
};
