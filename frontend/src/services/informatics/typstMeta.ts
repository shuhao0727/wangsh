import { api } from "../api";

export type TypstCategoryListItem = {
  id: number;
  path: string;
  sort_order: number;
  updated_at: string;
};

export type TypstStyleListItem = {
  key: string;
  title: string;
  sort_order: number;
  updated_at: string;
};

export type TypstStyleResponse = {
  key: string;
  title: string;
  sort_order: number;
  content: string;
  updated_at: string;
};

export const typstCategoriesApi = {
  list: async () => {
    const res = await api.get("/informatics/typst-categories");
    return res.data as unknown as TypstCategoryListItem[];
  },
  create: async (payload: { path: string; sort_order?: number }) => {
    const res = await api.post("/informatics/typst-categories", payload);
    return res.data as unknown as TypstCategoryListItem;
  },
  update: async (id: number, payload: Partial<{ path: string; sort_order: number }>) => {
    const res = await api.patch(`/informatics/typst-categories/${id}`, payload);
    return res.data as unknown as TypstCategoryListItem;
  },
  remove: async (id: number) => {
    const res = await api.delete(`/informatics/typst-categories/${id}`);
    return res.data as unknown as { ok: boolean };
  },
};

export const typstStylesApi = {
  list: async () => {
    const res = await api.get("/informatics/typst-styles");
    return res.data as unknown as TypstStyleListItem[];
  },
  get: async (key: string) => {
    const res = await api.get(`/informatics/typst-styles/${encodeURIComponent(key)}`);
    return res.data as unknown as TypstStyleResponse;
  },
  upsert: async (payload: { key: string; title?: string; sort_order?: number; content?: string }) => {
    const res = await api.post("/informatics/typst-styles", payload);
    return res.data as unknown as TypstStyleResponse;
  },
  update: async (key: string, payload: Partial<{ title: string; sort_order: number; content: string }>) => {
    const res = await api.patch(`/informatics/typst-styles/${encodeURIComponent(key)}`, payload);
    return res.data as unknown as TypstStyleResponse;
  },
  remove: async (key: string) => {
    const res = await api.delete(`/informatics/typst-styles/${encodeURIComponent(key)}`);
    return res.data as unknown as { ok: boolean };
  },
  seedFromResource: async (key: string) => {
    const res = await api.post(`/informatics/typst-styles/seed/${encodeURIComponent(key)}`);
    return res.data as unknown as TypstStyleResponse;
  },
};

