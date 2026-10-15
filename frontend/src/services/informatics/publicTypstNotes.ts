import { api } from "../api";

export type PublicTypstNoteListItem = {
  id: number;
  title: string;
  summary?: string;
  category_path?: string;
  source_path?: string;
  updated_at: string;
};

export type PublicTypstNote = {
  id: number;
  title: string;
  summary?: string;
  toc?: any[];
  updated_at: string;
  pdf_available?: boolean;
};

export const publicTypstNotesApi = {
  list: async (params?: { skip?: number; limit?: number; search?: string }) => {
    const res = await api.get("/public/informatics/typst-notes", {
      params: { ...(params || {}), _ts: Date.now() },
      headers: { "Cache-Control": "no-cache" },
    });
    return res.data as unknown as PublicTypstNoteListItem[];
  },

  get: async (id: number) => {
    const res = await api.get(`/public/informatics/typst-notes/${id}`, {
      params: { _ts: Date.now() },
      headers: { "Cache-Control": "no-cache" },
    });
    return res.data as unknown as PublicTypstNote;
  },

  exportPdf: async (id: number, cacheKey?: string | number) => {
    try {
      const res = await api.get(`/public/informatics/typst-notes/${id}/export.pdf`, {
        params: { v: cacheKey ?? Date.now() },
        responseType: "blob",
        headers: { "Cache-Control": "no-cache" },
      });
      return res.data as unknown as Blob;
    } catch (e: any) {
      const blob = e?.response?.data;
      if (blob instanceof Blob) {
        try {
          const text = await blob.text();
          let detail = text;
          try {
            const obj = JSON.parse(text);
            detail = obj?.detail || text;
          } catch {
            // 非 JSON 错误正文直接按文本展示。
          }
          throw new Error(detail || "导出失败");
        } catch (readError) {
          if (readError instanceof Error && readError.message) throw readError;
          throw e;
        }
      }
      throw e;
    }
  },

  exportTyp: async (id: number) => {
    const res = await api.get(`/public/informatics/typst-notes/${id}/export.typ`, {
      params: { v: Date.now() },
      responseType: "blob",
      headers: { "Cache-Control": "no-cache" },
    });
    return res.data as unknown as Blob;
  },

  listStyles: async () => {
    const res = await api.get("/public/informatics/typst-style");
    return res.data as unknown as string[];
  },
};
