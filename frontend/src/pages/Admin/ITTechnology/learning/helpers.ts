import { api, type ApiResponse } from "@services";
import type { LearningContentItem, LearningModuleKey, LearningProgressState, LearningStageStatus } from "./types";
import { createEmptyLearningProgress } from "./types";

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

export const fetchLearningContent = async (moduleKey: LearningModuleKey): Promise<LearningContentItem[] | null> => {
  try {
    const response = await api.get<ApiResponse<LearningContentItem[]>>(`/learning/content/${moduleKey}`);
    return Array.isArray(response.data?.data) ? response.data.data : null;
  } catch {
    return null;
  }
};

export const fetchLearningContentPayload = async <T>(moduleKey: LearningModuleKey): Promise<Partial<T> | null> => {
  const items = await fetchLearningContent(moduleKey);
  if (!items?.length) return null;

  return items.reduce<Partial<T>>((acc, item) => {
    if (item.enabled === false) return acc;
    const value = item.content as unknown;
    if (item.section_key === "raw" && isRecord(value)) {
      return { ...acc, ...(value as Partial<T>) };
    }
    if (isRecord(value) && Object.prototype.hasOwnProperty.call(value, item.item_key)) {
      return { ...acc, [item.item_key]: value[item.item_key] } as Partial<T>;
    }
    return { ...acc, [item.item_key]: value } as Partial<T>;
  }, {});
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
