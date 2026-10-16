import type {
  LearningBook,
  LearningBookChapter,
  LearningContentItem,
  LearningModuleKey,
  LearningProgressState,
  LearningStageStatus,
} from "./types";
import { createEmptyLearningProgress } from "./types";
import { api } from "@services";

export interface PersistedLearningChapter {
  id?: number;
  slug: string;
  title?: string | null;
  summary?: string | null;
  estimated_minutes?: number | null;
  difficulty?: string | null;
  group_name?: string | null;
  markdown?: string | null;
  sort_order?: number | null;
}

export const normalizeLearningProgress = (value: unknown): LearningProgressState => {
  const empty = createEmptyLearningProgress();
  if (!value || typeof value !== "object") return empty;
  const raw = value as Partial<LearningProgressState> & Record<string, unknown>;
  return {
    stageStatus: isRecord(raw.stageStatus) ? normalizeStageStatus(raw.stageStatus) : empty.stageStatus,
    completedItems: isBooleanRecord(raw.completedItems) ? raw.completedItems : empty.completedItems,
    favoriteItems: isBooleanRecord(raw.favoriteItems) ? raw.favoriteItems : empty.favoriteItems,
    notesByItem: isStringRecord(raw.notesByItem) ? raw.notesByItem : empty.notesByItem,
    moduleNotes: typeof raw.moduleNotes === "string" ? raw.moduleNotes : typeof raw.notes === "string" ? raw.notes : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
  };
};

export const mergeContentItems = <T extends LearningContentItem>(fallback: T[], remote: LearningContentItem[] | null): T[] => {
  if (!remote || remote.length === 0) return fallback;
  const enabledRemote = remote.filter((item) => item.enabled !== false);
  if (enabledRemote.length === 0) return fallback;
  const fallbackMap = new Map(fallback.map((item) => [`${item.section_key}:${item.item_key}`, item]));
  enabledRemote.forEach((item) => {
    fallbackMap.set(`${item.section_key}:${item.item_key}`, item as T);
  });
  return Array.from(fallbackMap.values()).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
};

export const fetchLearningContent = async (moduleKey: LearningModuleKey, signal?: AbortSignal): Promise<LearningContentItem[] | null> => {
  try {
    const { data } = await api.get(`/learning/content/${moduleKey}`, { signal });
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
};

export const fetchLearningChapters = async (
  moduleKey: LearningModuleKey,
  signal?: AbortSignal,
): Promise<PersistedLearningChapter[] | null> => {
  try {
    const { data } = await api.get(`/learning/chapters/${moduleKey}`, { signal });
    if (!Array.isArray(data)) return null;
    return data.filter(
      (item): item is PersistedLearningChapter =>
        isRecord(item) && typeof item.slug === "string" && item.slug.trim().length > 0,
    );
  } catch {
    return null;
  }
};

export const loadBundledLearningBook = async (moduleKey: LearningModuleKey): Promise<LearningBook> => {
  switch (moduleKey) {
    case "ml":
      return (await import("../ml/book")).ML_BOOK;
    case "ai":
      return (await import("../ai/book")).AI_BOOK;
    case "agents":
      return (await import("../agents/book")).AGENTS_BOOK;
    default:
      return (await import("../ml/book")).ML_BOOK;
  }
};

const normalizeDifficulty = (
  value: string | null | undefined,
  fallback: LearningBookChapter["difficulty"],
): LearningBookChapter["difficulty"] => {
  return value === "beginner" || value === "intermediate" || value === "advanced" || value === "expert"
    ? value
    : fallback;
};

export const mergeLearningBookChapters = (
  book: LearningBook,
  persisted: PersistedLearningChapter[] | null,
): LearningBook => {
  if (!persisted?.length) return book;

  const persistedBySlug = new Map(persisted.map((chapter) => [chapter.slug, chapter]));
  const merged = book.chapters.map((chapter, index) => {
    const saved = persistedBySlug.get(chapter.slug);
    const currentOrder = "sort_order" in chapter && typeof chapter.sort_order === "number"
      ? chapter.sort_order : index;
    if (!saved) return { chapter, order: currentOrder, index };
    return {
      chapter: {
        ...chapter,
        title: saved.title ?? chapter.title,
        summary: saved.summary === null ? "" : saved.summary ?? chapter.summary,
        estimatedMinutes: saved.estimated_minutes ?? chapter.estimatedMinutes,
        difficulty: normalizeDifficulty(saved.difficulty, chapter.difficulty),
        group: saved.group_name === null ? undefined : saved.group_name ?? chapter.group,
        markdown: saved.markdown === null ? "" : saved.markdown ?? chapter.markdown,
        sort_order: saved.sort_order ?? currentOrder,
      },
      order: saved.sort_order ?? index,
      index,
    };
  });

  persisted.forEach((saved, index) => {
    if (book.chapters.some((chapter) => chapter.slug === saved.slug)) return;
    merged.push({
      chapter: {
        slug: saved.slug,
        title: saved.title ?? saved.slug,
        summary: saved.summary ?? "",
        estimatedMinutes: saved.estimated_minutes ?? 30,
        difficulty: normalizeDifficulty(saved.difficulty, "beginner"),
        goals: [],
        markdown: saved.markdown ?? "",
        checklist: [],
        experiments: [],
        glossary: [],
        references: [],
        group: saved.group_name ?? undefined,
        sort_order: saved.sort_order ?? book.chapters.length + index,
      },
      order: saved.sort_order ?? book.chapters.length + index,
      index: book.chapters.length + index,
    });
  });

  return {
    ...book,
    chapters: merged
      .sort((a, b) => a.order - b.order || a.index - b.index)
      .map(({ chapter }) => chapter),
  };
};

const resolveLearningBook = (
  bundled: LearningBook,
  raw: unknown,
  chapters: PersistedLearningChapter[] | null,
): LearningBook => {
  const book = isRecord(raw) && Array.isArray(raw.chapters)
    ? { ...bundled, ...raw, chapters: raw.chapters } as LearningBook
    : bundled;
  return mergeLearningBookChapters(book, chapters);
};

export const loadLearningBook = async (moduleKey: LearningModuleKey, signal?: AbortSignal) => {
  const [bundled, items, chapters] = await Promise.all([
    loadBundledLearningBook(moduleKey),
    fetchLearningContent(moduleKey, signal),
    fetchLearningChapters(moduleKey, signal),
  ]);
  const raw = items?.find((item) =>
    item.enabled !== false && item.section_key === "raw" && item.item_key === "book",
  )?.content;
  return {
    book: resolveLearningBook(bundled, isRecord(raw) ? raw.book : null, chapters),
    canSave: items !== null && chapters !== null,
  };
};

export const fetchLearningContentPayload = async <T>(moduleKey: LearningModuleKey, signal?: AbortSignal): Promise<Partial<T> | null> => {
  const [items, persistedChapters] = await Promise.all([
    fetchLearningContent(moduleKey, signal),
    fetchLearningChapters(moduleKey, signal),
  ]);
  if (!items?.length && !persistedChapters?.length) return null;

  const payload = (items ?? []).reduce<Partial<T>>((acc, item) => {
    if (item.enabled === false) return acc;
    const value = item.content as unknown;

    // "raw" section: spread content directly (e.g. full book object)
    if (item.section_key === "raw" && isRecord(value)) {
      return { ...acc, ...(value as Partial<T>) };
    }

    // Extract entry value — if content is a record keyed by item_key, unwrap
    const entryValue = (isRecord(value) && Object.prototype.hasOwnProperty.call(value, item.item_key))
      ? value[item.item_key]
      : value;

    // Group by section_key instead of storing at root level
    const sectionData = (acc as Record<string, unknown>)[item.section_key] || {};
    return {
      ...acc,
      [item.section_key]: { ...(sectionData as Record<string, unknown>), [item.item_key]: entryValue },
    } as Partial<T>;
  }, {});

  if (!persistedChapters?.length) return payload;
  const currentBook = (payload as Record<string, unknown>).book;
  return {
    ...payload,
    book: resolveLearningBook(await loadBundledLearningBook(moduleKey), currentBook, persistedChapters),
  } as Partial<T>;
};

export const filterByKeyword = <T extends { title?: string; name?: string; summary?: string; description?: string; desc?: string; tags?: string[] }>(items: T[], keyword: string): T[] => {
  const q = keyword.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => [item.title, item.name, item.summary, item.description, item.desc, ...(item.tags ?? [])]
    .filter(Boolean)
    .some((part) => String(part).toLowerCase().includes(q)));
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));

const isBooleanRecord = (value: unknown): value is Record<string, boolean> => {
  if (!isRecord(value)) return false;
  return Object.values(value).every((item) => typeof item === "boolean");
};

const isStringRecord = (value: unknown): value is Record<string, string> => {
  if (!isRecord(value)) return false;
  return Object.values(value).every((item) => typeof item === "string");
};

const normalizeStageStatus = (value: Record<string, unknown>): Record<string, LearningStageStatus> => {
  const result: Record<string, LearningStageStatus> = {};
  Object.entries(value).forEach(([key, status]) => {
    if (status === "pending" || status === "in-progress" || status === "completed") result[key] = status;
  });
  return result;
};
