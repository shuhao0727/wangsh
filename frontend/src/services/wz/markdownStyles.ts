import { api } from "../api";

export type MarkdownStyleListItem = {
  key: string;
  title: string;
  sort_order: number;
  updated_at: string;
};

export type MarkdownStyleResponse = {
  key: string;
  title: string;
  sort_order: number;
  content: string;
  created_at: string;
  updated_at: string;
};

export const markdownStylesApi = {
  list: async () => {
    const res = await api.get("/articles/markdown-styles");
    return res.data as unknown as MarkdownStyleListItem[];
  },
  get: async (key: string) => {
    const res = await api.get(`/articles/markdown-styles/${encodeURIComponent(key)}`);
    return res.data as unknown as MarkdownStyleResponse;
  },
  upsert: async (payload: { key: string; title?: string; sort_order?: number; content?: string }) => {
    const res = await api.post("/articles/markdown-styles", payload);
    return res.data as unknown as MarkdownStyleResponse;
  },
  update: async (key: string, payload: Partial<{ title: string; sort_order: number; content: string }>) => {
    const res = await api.patch(`/articles/markdown-styles/${encodeURIComponent(key)}`, payload);
    return res.data as unknown as MarkdownStyleResponse;
  },
  remove: async (key: string) => {
    const res = await api.delete(`/articles/markdown-styles/${encodeURIComponent(key)}`);
    return res.data as unknown as { ok: boolean };
  },
};

