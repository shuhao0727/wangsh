import { api } from "../api";

export type TypstNoteListItem = {
  id: number;
  title: string;
  summary?: string | null;
  category_path?: string;
  published?: boolean;
  updated_at: string;
  compiled_at?: string | null;
};

export type TypstAssetListItem = {
  id: number;
  path: string;
  mime: string;
  sha256?: string | null;
  size_bytes?: number | null;
  uploaded_by_id?: number | null;
  created_at: string;
};

export type TypstNote = {
  id: number;
  title: string;
  summary?: string | null;
  category_path?: string | null;
  published?: boolean;
  style_key?: string;
  entry_path?: string;
  files?: Record<string, string>;
  toc?: any[];
  content_typst: string;
  created_by_id?: number | null;
  compiled_hash?: string | null;
  compiled_at?: string | null;
  created_at: string;
  updated_at: string;
};

export const typstNotesApi = {
  list: async (params?: { skip?: number; limit?: number; search?: string }) => {
    const res = await api.get("/informatics/typst-notes", { params });
    return res.data as unknown as TypstNoteListItem[];
  },

  create: async (payload: {
    title: string;
    summary?: string;
    category_path?: string;
    published?: boolean;
    style_key?: string;
    entry_path?: string;
    files?: Record<string, string>;
    toc?: any[];
    content_typst?: string;
  }) => {
    const res = await api.post("/informatics/typst-notes", payload);
    return res.data as unknown as TypstNote;
  },

  get: async (id: number) => {
    const res = await api.get(`/informatics/typst-notes/${id}`);
    return res.data as unknown as TypstNote;
  },

  update: async (
    id: number,
    payload: Partial<{
      title: string;
      summary: string;
      category_path: string;
      published: boolean;
      style_key: string;
      entry_path: string;
      files: Record<string, string>;
      toc: any[];
      content_typst: string;
    }>,
  ) => {
    const res = await api.put(`/informatics/typst-notes/${id}`, payload);
    return res.data as unknown as TypstNote;
  },

  remove: async (id: number) => {
    const res = await api.delete(`/informatics/typst-notes/${id}`);
    return res.data as unknown as { success: boolean };
  },

  exportTyp: async (id: number) => {
    const res = await api.get(`/informatics/typst-notes/${id}/export.typ`, { responseType: "blob" });
    return res.data as unknown as Blob;
  },

  compilePdf: async (id: number) => {
    const res = await api.post(`/informatics/typst-notes/${id}/compile`, undefined, {
      responseType: "blob",
      timeout: 180000,
    });
    return res.data as unknown as Blob;
  },

  compilePdfAsync: async (id: number) => {
    const res = await api.post(`/informatics/typst-notes/${id}/compile-async`);
    return res.data as unknown as { job_id: string; note_id: number };
  },

  getCompileJob: async (jobId: string) => {
    const res = await api.get(`/informatics/typst-notes/compile-jobs/${jobId}`);
    return res.data as unknown as any;
  },

  cancelCompileJob: async (jobId: string) => {
    const res = await api.post(`/informatics/typst-notes/compile-jobs/${jobId}/cancel`);
    return res.data as unknown as { success: boolean; job_id: string };
  },

  exportPdf: async (id: number) => {
    const res = await api.get(`/informatics/typst-notes/${id}/export.pdf?t=${Date.now()}`, { responseType: "blob" });
    return res.data as unknown as Blob;
  },

  listAssets: async (id: number) => {
    const res = await api.get(`/informatics/typst-notes/${id}/assets`);
    return res.data as unknown as TypstAssetListItem[];
  },

  uploadAsset: async (id: number, payload: { path: string; file: File }) => {
    const form = new FormData();
    form.append("path", payload.path);
    form.append("file", payload.file);
    const res = await api.post(`/informatics/typst-notes/${id}/assets`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data as unknown as TypstAssetListItem;
  },

  deleteAsset: async (id: number, assetId: number) => {
    const res = await api.delete(`/informatics/typst-notes/${id}/assets/${assetId}`);
    return res.data as unknown as { success: boolean };
  },

  downloadAsset: async (id: number, assetId: number) => {
    const res = await api.get(`/informatics/typst-notes/${id}/assets/${assetId}`, { responseType: "blob" });
    return res.data as unknown as Blob;
  },
};
