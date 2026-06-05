import { useEffect, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { agentDataApi } from "@services/znt/api";
import { showMessage } from "@/lib/toast";
import type { TaskAnalysisDetail } from "../../types";

export function useAnalysisDetail() {
  const { analysisId } = useParams<{ analysisId?: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const view = (searchParams.get("view") || "timeline") as "timeline" | "beam" | "wordcloud";
  const typeParam = searchParams.get("type");
  const isBeamView = location.pathname.includes("/task-analysis/chains/") || view === "beam" || typeParam === "chains";
  const isTimelineView = view === "timeline" && !isBeamView;

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<TaskAnalysisDetail | null>(null);

  useEffect(() => {
    const id = Number.parseInt(analysisId || "", 10);
    if (Number.isNaN(id)) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    const fetchers = typeParam === "chains"
      ? [agentDataApi.getChainAnalysis, agentDataApi.getTaskAnalysis]
      : typeParam === "hot"
        ? [agentDataApi.getHotAnalysis, agentDataApi.getTaskAnalysis]
        : isBeamView
          ? [agentDataApi.getTaskAnalysis, agentDataApi.getChainAnalysis]
          : [agentDataApi.getTaskAnalysis, agentDataApi.getHotAnalysis];

    void (async () => {
      try {
        for (const fetcher of fetchers) {
          const response = await fetcher(id);
          if (cancelled) return;
          if (response.success) {
            setDetail(response.data as TaskAnalysisDetail);
            return;
          }
        }
        if (!cancelled) showMessage.error("记录不存在");
      } catch {
        if (!cancelled) showMessage.error("获取任务分析失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [analysisId, isBeamView, typeParam]);

  return { loading, detail, isBeamView, isTimelineView, view };
}
