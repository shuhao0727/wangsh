/**
 * ML 学习书 API 服务。
 */
import { api } from "../api";

// ── Types ────────────────────────────────────────

export interface MLBookMetadata {
  id?: number;
  module_key: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  audience?: string | null;
  outcomes: string[];
  enabled: boolean;
}

export interface MLBookChapter {
  id?: number;
  book_id?: number;
  slug: string;
  chapter_number: number;
  title: string;
  summary?: string | null;
  difficulty?: string | null;
  estimated_minutes?: number | null;
  markdown?: string | null;
  goals: string[];
  checklist: string[];
  experiments: ExperimentData[];
  glossary: GlossaryItem[];
  references: ReferenceItem[];
  prerequisites: string[];
  keywords: string[];
  quiz: QuizItem[];
  sort_order: number;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ExperimentData {
  title: string;
  goal: string;
  steps: string[];
  output: string;
  difficulty: string;
}

export interface GlossaryItem {
  term: string;
  definition: string;
}

export interface ReferenceItem {
  title: string;
  source?: string;
  note: string;
  url?: string;
}

export interface QuizItem {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface MLBookResponse {
  book: (MLBookMetadata & { chapters: MLBookChapter[] }) | null;
}

export interface MLChapterResponse {
  chapter: MLBookChapter;
}

export interface ReorderItem {
  slug: string;
  chapter_number: number;
}

// ── Admin API ────────────────────────────────────

export const mlBookAdminApi = {
  /** 获取书籍完整数据（含全部章节，含禁用项）。 */
  getBook: (moduleKey: string) =>
    api.client.get<MLBookResponse>(`/admin/ml/book/${moduleKey}`),

  /** 创建或更新书籍元数据。 */
  upsertBook: (moduleKey: string, data: Partial<MLBookMetadata>) =>
    api.client.put<MLBookResponse>(`/admin/ml/book/${moduleKey}`, data),

  /** 获取单个章节。 */
  getChapter: (moduleKey: string, slug: string) =>
    api.client.get<MLChapterResponse>(`/admin/ml/book/${moduleKey}/chapters/${slug}`),

  /** 创建或更新章节。 */
  upsertChapter: (moduleKey: string, slug: string, data: Omit<MLBookChapter, "id" | "book_id" | "created_at" | "updated_at">) =>
    api.client.put<MLChapterResponse>(`/admin/ml/book/${moduleKey}/chapters/${slug}`, data),

  /** 删除章节。 */
  deleteChapter: (moduleKey: string, slug: string) =>
    api.client.delete(`/admin/ml/book/${moduleKey}/chapters/${slug}`),

  /** 批量重新排序章节。 */
  reorderChapters: (moduleKey: string, items: ReorderItem[]) =>
    api.client.patch(`/admin/ml/book/${moduleKey}/chapters/reorder`, { items }),

  /** 启用或禁用章节。 */
  toggleChapter: (moduleKey: string, slug: string, enabled: boolean) =>
    api.client.patch(`/admin/ml/book/${moduleKey}/chapters/${slug}/toggle`, { enabled }),
};

// ── Public API ───────────────────────────────────

export const mlBookPublicApi = {
  /** 获取已启用的书籍（含已启用章节），供学生端使用。 */
  getBook: (moduleKey: string) =>
    api.client.get<MLBookResponse>(`/ml/book/${moduleKey}`),
};
