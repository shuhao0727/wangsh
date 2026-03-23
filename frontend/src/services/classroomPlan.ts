// 课堂计划 API
import { api } from "./api";
import { Activity } from "./classroom";

const BASE = "/classroom/plans";

export interface PlanItem {
  id: number;
  activity_id: number;
  order_index: number;
  status: "pending" | "active" | "ended";
  activity: {
    id: number;
    title: string;
    activity_type: string;
    time_limit: number;
    status: string;
    options?: Array<{ key: string; text: string }> | null;
    correct_answer?: string | null;
    allow_multiple?: boolean;
  } | null;
}

export interface Plan {
  id: number;
  title: string;
  status: "draft" | "active" | "ended";
  current_item_id: number | null;
  created_by: number;
  created_at: string;
  items: PlanItem[];
}

export interface PlanListResponse {
  items: Plan[];
  total: number;
}

export const planApi = {
  // 管理端
  list: async (skip = 0, limit = 20): Promise<PlanListResponse> => {
    const resp = await api.get(`${BASE}/admin`, { params: { skip, limit } });
    return resp.data as any;
  },
  get: async (id: number): Promise<Plan> => {
    const resp = await api.get(`${BASE}/admin/${id}`);
    return resp.data as any;
  },
  create: async (title: string, activity_ids: number[]): Promise<Plan> => {
    const resp = await api.post(`${BASE}/admin`, { title, activity_ids });
    return resp.data as any;
  },
  update: async (id: number, title?: string, activity_ids?: number[]): Promise<Plan> => {
    const resp = await api.put(`${BASE}/admin/${id}`, { title, activity_ids });
    return resp.data as any;
  },
  remove: async (id: number): Promise<void> => {
    await api.delete(`${BASE}/admin/${id}`);
  },
  start: async (id: number): Promise<Plan> => {
    const resp = await api.post(`${BASE}/admin/${id}/start`);
    return resp.data as any;
  },
  reset: async (id: number): Promise<Plan> => {
    const resp = await api.post(`${BASE}/admin/${id}/reset`);
    return resp.data as any;
  },
  next: async (id: number): Promise<Plan> => {
    const resp = await api.post(`${BASE}/admin/${id}/next`);
    return resp.data as any;
  },
  end: async (id: number): Promise<Plan> => {
    const resp = await api.post(`${BASE}/admin/${id}/end`);
    return resp.data as any;
  },
  startItem: async (planId: number, itemId: number): Promise<Plan> => {
    const resp = await api.post(`${BASE}/admin/${planId}/items/${itemId}/start`);
    return resp.data as any;
  },
  endItem: async (planId: number, itemId: number): Promise<Plan> => {
    const resp = await api.post(`${BASE}/admin/${planId}/items/${itemId}/end`);
    return resp.data as any;
  },

  // 学生端
  getActivePlan: async (): Promise<Plan | null> => {
    const resp = await api.get(`${BASE}/active-plan`);
    return resp.data as any;
  },
};
