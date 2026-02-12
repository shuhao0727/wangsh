import { api } from "../api";

export type TypstMetricsResponse = {
  typst_compile: {
    counts: { total: number; hit: number; miss: number; fail: number };
    cache_hit_rate_recent: number;
    dur_ms: { n: number; p50: number; p90: number; p95: number; max: number };
    waited_ms: { n: number; p50: number; p90: number; p95: number; max: number };
    queue_length: { typst: number; celery: number };
    sample_size: number;
  };
  http: { "429_total": number };
};

export const systemMetricsApi = {
  typstMetrics: async () => {
    const res = await api.get("/system/typst-metrics");
    return res.data as unknown as TypstMetricsResponse;
  },
  typstPdfCleanup: async (payload: { dry_run: boolean; retention_days?: number }) => {
    const qs = new URLSearchParams();
    qs.set("dry_run", String(payload.dry_run));
    if (payload.retention_days !== undefined) qs.set("retention_days", String(payload.retention_days));
    const res = await api.post(`/system/typst-pdf-cleanup?${qs.toString()}`, null);
    return res.data as unknown as any;
  },
};
