import { api } from "../api";

export type PublicTypstNoteListItem = {
  id: number;
  title: string;
  summary?: string;
  category_path?: string;
  updated_at: string;
};

export type PublicTypstNote = {
  id: number;
  title: string;
  summary?: string;
  toc?: any[];
  updated_at: string;
};

export const publicTypstNotesApi = {
  list: async (params?: { skip?: number; limit?: number; search?: string }) => {
    const res = await api.get("/public/informatics/typst-notes", { params });
    return res.data as unknown as PublicTypstNoteListItem[];
  },

  get: async (id: number) => {
    const res = await api.get(`/public/informatics/typst-notes/${id}`);
    return res.data as unknown as PublicTypstNote;
  },

  exportPdf: async (id: number) => {
    try {
      const res = await api.get(`/public/informatics/typst-notes/${id}/export.pdf`, { responseType: "blob" });
      return res.data as unknown as Blob;
    } catch (e: any) {
      const blob = e?.response?.data;
      if (blob instanceof Blob) {
        try {
          const text = await blob.text();
          const obj = JSON.parse(text);
          throw new Error(obj?.detail || text);
        } catch {
          try {
            const text = await blob.text();
            throw new Error(text || "导出失败");
          } catch {
            throw e;
          }
        }
      }
      throw e;
    }
  },

  exportTyp: async (id: number) => {
    const res = await api.get(`/public/informatics/typst-notes/${id}/export.typ`, { responseType: "blob" });
    return res.data as unknown as Blob;
  },

  listStyles: async () => {
    const res = await api.get("/public/informatics/typst-style");
    return res.data as unknown as string[];
  },
};
