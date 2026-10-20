import axios from "axios";
import api from "./api";

export const DIMENSIONS = [
  ["球类对抗", "篮球、足球、乒乓球、羽毛球"],
  ["力量", "俯卧撑、仰卧起坐、深蹲"],
  ["耐力", "慢跑、游泳、骑行"],
  ["技巧", "跳绳、体操、舞蹈"],
  ["团队配合", "接力、合作游戏、团队球赛"],
  ["日常活动", "步行、爬楼梯、课间活动"],
] as const;
export const LIKING = ["完全不喜欢", "不太喜欢", "一般", "比较喜欢", "非常喜欢"];
export const LABELS = ["球类对抗", "力量类", "耐力类", "技巧类"] as const;
export type KnnLabel = typeof LABELS[number];
export type Phase = "draft" | "scheduled" | "open" | "ended" | "closed";
export const PHASE_LABELS: Record<Phase, string> = {
  draft: "草稿", scheduled: "待开始", open: "收集中", ended: "已到期", closed: "已结束",
};
export type PublicBatch = { id: string; title: string; starts_at: string; ends_at: string; phase: Phase };
export type BatchSummary = PublicBatch & {
  state: "draft" | "scheduled" | "closed"; created_at: string;
  expected: number; submitted: number; missing: number; pending_refill: number; frozen_at: string | null;
};
export type Answer = { revision: number; features: number[]; label: KnnLabel; display_consent: boolean; submitted_at: string };
export type RosterRow = { student_no: string; current_revision: number; refill_allowed: boolean; answer: Answer | null };
export type BatchDetail = BatchSummary & { rows: RosterRow[] };
export type BatchConfig = { title: string; starts_at: string; ends_at: string; student_numbers: string[] };
export type StudentStatus = PublicBatch & { student_no: string; current_revision: number; refill_allowed: boolean; can_submit: boolean };
export type Submission = { student_no: string; request_id: string; expected_revision: number; features: number[]; label: KnnLabel; display_consent: boolean };
export type Receipt = { student_no: string; revision: number; submitted_at: string };
export type FrozenData = { version: number; aId: string; students: { id: string; label: KnnLabel; features: number[] }[] };
const base = "/it/knn/batches";
const staff = "/admin/it/knn/batches";

export const knnApi = {
  publicList: async () => (await api.client.get<PublicBatch[]>(base)).data,
  publicBatch: async (id: string) => (await api.client.get<PublicBatch>(`${base}/${id}`)).data,
  check: async (id: string, student_no: string) => (await api.client.post<StudentStatus>(`${base}/${id}/check`, { student_no })).data,
  submit: async (id: string, body: Submission) => (await api.client.post<Receipt>(`${base}/${id}/submissions`, body)).data,
  list: async () => (await api.client.get<BatchSummary[]>(staff)).data,
  detail: async (id: string) => (await api.client.get<BatchDetail>(`${staff}/${id}`)).data,
  create: async (body: BatchConfig) => (await api.client.post<BatchDetail>(staff, body)).data,
  update: async (id: string, body: BatchConfig) => (await api.client.put<BatchDetail>(`${staff}/${id}`, body)).data,
  state: async (id: string, action: "start" | "schedule" | "close") =>
    (await api.client.post<BatchDetail>(`${staff}/${id}/state`, { action })).data,
  refill: async (id: string, student_numbers: string[], allowed: boolean) =>
    (await api.client.post<BatchDetail>(`${staff}/${id}/refill`, { student_numbers, allowed })).data,
  history: async (id: string, number: string) =>
    (await api.client.get<{ student_no: string; answers: Answer[] }>(`${staff}/${id}/history/${encodeURIComponent(number)}`)).data,
  freeze: async (id: string, a_student_no?: string) =>
    (await api.client.post<FrozenData>(`${staff}/${id}/freeze`, { a_student_no: a_student_no || null })).data,
  frozen: async (id: string) => (await api.client.get<FrozenData>(`${staff}/${id}/frozen`)).data,
  csv: async (id: string) => (await api.client.get<Blob>(`${staff}/${id}/export.csv`, { responseType: "blob" })).data,
};

export function knnError(error: unknown): string {
  if (axios.isAxiosError<{ detail?: unknown }>(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return "填写内容不符合要求，请检查学号、时间和各项取值。";
  }
  return "请求失败，请稍后重试；已填写的内容会保留。";
}

export function downloadKnn(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const timeText = (value: string) => new Date(value).toLocaleString("zh-CN", { hour12: false });
