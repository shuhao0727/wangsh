import { useEffect, useMemo, useState } from "react";
import { useMatch, useParams, useSearchParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { api } from "@services/api";
import type { TaskAnalysisDetail } from "../../types";

const detailPaths = {
  legacy: "/ai-agents/analysis/task-analyses",
  hot: "/ai-agents/analysis/hot-questions",
  chains: "/ai-agents/analysis/student-chains",
};

export function useAnalysisDetail() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const [searchParams] = useSearchParams();
  const hotRoute = useMatch("/task-analysis/hot/:analysisId");
  const chainRoute = useMatch("/task-analysis/chains/:analysisId");
  const typeParam = searchParams.get("type");
  const queryType = typeParam === "hot" || typeParam === "chains" ? typeParam : null;
  const explicitType = hotRoute ? "hot" : chainRoute ? "chains" : queryType;
  const reportType = explicitType ?? (searchParams.get("view") === "beam" ? "chains" : "hot");
  const id = /^\d+$/.test(analysisId ?? "") ? Number(analysisId) : 0;
  const validId = Number.isSafeInteger(id) && id > 0;

  const request = useMemo(() => ({ id, explicitType, reportType } as const), [id, explicitType, reportType]);
  const [result, setResult] = useState<{
    request: typeof request;
    detail: TaskAnalysisDetail | null;
    error: string | null;
  }>();

  useEffect(() => {
    if (!validId) return;
    const controller = new AbortController();
    const { signal } = controller;
    const paths = request.explicitType
      ? [detailPaths[request.explicitType]]
      : [detailPaths.legacy, detailPaths[request.reportType]];

    void (async () => {
      for (const path of paths) {
        try {
          const { data } = await api.client.get<TaskAnalysisDetail>(`${path}/${request.id}`, { signal });
          if (!signal.aborted) setResult({ request, detail: data, error: null });
          return;
        } catch (cause) {
          if (signal.aborted) return;
          const status = isAxiosError(cause) ? cause.response?.status : undefined;
          if (path === detailPaths.legacy && status === 404) continue;
          const error = status === 404 ? "记录不存在"
            : status === 503 ? "服务暂不可用，请稍后重试" : "获取任务分析失败";
          setResult({ request, detail: null, error });
          return;
        }
      }
    })();
    return () => controller.abort();
  }, [request, validId]);

  // 路由切换的首次渲染就隐藏旧详情，避免等待 effect 清理时仍可导出。
  const current = result?.request === request ? result : undefined;
  return {
    loading: validId && !current,
    detail: current?.detail ?? null,
    error: validId ? current?.error : "记录不存在",
    isBeamView: reportType === "chains",
  };
}
