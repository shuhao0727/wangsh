// 课堂互动 API

import { api } from "./api";

const BASE = "/classroom";
const ADMIN_BASE = "/classroom/admin";

// ─── 类型 ───

export interface OptionItem {
  key: string;
  text: string;
}

export interface Activity {
  id: number;
  activity_type: "vote" | "fill_blank";
  title: string;
  options: OptionItem[] | null;
  correct_answer: string | null;
  allow_multiple: boolean;
  time_limit: number;
  status: "draft" | "active" | "ended";
  started_at: string | null;
  ended_at: string | null;
  created_by: number;
  created_at: string;
  response_count?: number;
  remaining_seconds?: number | null;
  my_answer?: string | null;
  stats?: ActivityStats | null;
  analysis_agent_id?: number | null;
  analysis_prompt?: string | null;
  analysis_status?: string | null;
  analysis_result?: string | null;
  analysis_context?: Record<string, any> | null;
  analysis_error?: string | null;
  analysis_updated_at?: string | null;
}

export interface ActivityStats {
  activity_id: number;
  total_responses: number;
  option_counts: Record<string, number> | null;
  correct_count: number;
  correct_rate: number | null;
  blank_slot_stats?: Array<{
    slot_index: number;
    correct_answer: string;
    total_count: number;
    correct_count: number;
    correct_rate: number | null;
    top_wrong_answers: Array<{ answer: string; count: number }>;
  }> | null;
  top_wrong_answers?: Array<{ answer: string; count: number }> | null;
}

export interface ActivityListResponse {
  items: Activity[];
  total: number;
  page: number;
  page_size: number;
}

export interface ActivityResult {
  id: number;
  activity_type: string;
  title: string;
  options: OptionItem[] | null;
  correct_answer: string | null;
  allow_multiple: boolean;
  my_answer: string | null;
  is_correct: boolean | null;
  stats: ActivityStats | null;
}

export interface ActivityCreateRequest {
  activity_type: "vote" | "fill_blank";
  title: string;
  options?: OptionItem[];
  correct_answer?: string;
  allow_multiple?: boolean;
  time_limit?: number;
  analysis_agent_id?: number;
  analysis_prompt?: string;
}

export interface ActivityEndRequest {
  analysis_agent_id?: number;
  analysis_prompt?: string;
}

export interface ActiveAgentOption {
  id: number;
  name: string;
}

// ─── API ───

export const classroomApi = {
  // 管理端
  create: async (data: ActivityCreateRequest): Promise<Activity> => {
    const resp = await api.post(ADMIN_BASE + "/", data);
    return resp.data as any;
  },
  update: async (id: number, data: Partial<ActivityCreateRequest>): Promise<Activity> => {
    const resp = await api.put(`${ADMIN_BASE}/${id}`, data);
    return resp.data as any;
  },
  remove: async (id: number): Promise<void> => {
    await api.delete(`${ADMIN_BASE}/${id}`);
  },

  bulkRemove: async (ids: number[]): Promise<{ deleted: number[]; skipped: number[] }> => {
    const resp = await api.post(`${ADMIN_BASE}/bulk-delete`, { ids });
    return resp.data as any;
  },

  duplicate: async (id: number): Promise<Activity> => {
    const resp = await api.post(`${ADMIN_BASE}/${id}/duplicate`);
    return resp.data as any;
  },
  restart: async (id: number): Promise<Activity> => {
    const resp = await api.post(`${ADMIN_BASE}/${id}/restart`);
    return resp.data as any;
  },
  list: async (params?: { skip?: number; limit?: number; status?: string }): Promise<ActivityListResponse> => {
    const resp = await api.get(ADMIN_BASE + "/", { params });
    return resp.data as any;
  },
  getDetail: async (id: number): Promise<Activity> => {
    const resp = await api.get(`${ADMIN_BASE}/${id}`);
    return resp.data as any;
  },
  start: async (id: number): Promise<Activity> => {
    const resp = await api.post(`${ADMIN_BASE}/${id}/start`);
    return resp.data as any;
  },
  end: async (id: number, data?: ActivityEndRequest): Promise<Activity> => {
    const resp = await api.post(`${ADMIN_BASE}/${id}/end`, data || {});
    return resp.data as any;
  },
  getStatistics: async (id: number): Promise<ActivityStats> => {
    const resp = await api.get(`${ADMIN_BASE}/${id}/statistics`);
    return resp.data as any;
  },
  getActiveAgents: async (): Promise<ActiveAgentOption[]> => {
    const resp = await api.get("/ai-agents/active");
    const rows = Array.isArray(resp.data) ? resp.data : [];
    return rows.map((row: any) => ({
      id: Number(row?.id || 0),
      name: String(row?.name || row?.agent_name || `智能体${row?.id ?? ""}`),
    })).filter((row: ActiveAgentOption) => Number.isFinite(row.id) && row.id > 0);
  },

  // 学生端
  getActive: async (): Promise<Activity[]> => {
    const resp = await api.get(BASE + "/active");
    return resp.data as any;
  },
  getActivity: async (id: number): Promise<Activity> => {
    const resp = await api.get(`${BASE}/${id}`);
    return resp.data as any;
  },
  respond: async (id: number, answer: string): Promise<{ id: number; answer: string; is_correct: boolean | null; submitted_at: string }> => {
    const resp = await api.post(`${BASE}/${id}/respond`, { answer });
    return resp.data as any;
  },
  getResult: async (id: number): Promise<ActivityResult> => {
    const resp = await api.get(`${BASE}/${id}/result`);
    return resp.data as any;
  },
};
