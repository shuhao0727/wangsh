import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { agentDataApi } from "@services/znt/api";
import { showMessage } from "@/lib/toast";
import type { TaskAnalysisDetail } from "../../types";

export function useAnalysisDetail() {
  const { analysisId } = useParams<{ analysisId?: string }>();
  const [searchParams] = useSearchParams();
  const view = (searchParams.get("view") || "timeline") as "timeline" | "beam" | "wordcloud";
  const typeParam = searchParams.get("type");
  const isBeamView = view === "beam" || typeParam === "chains";
  const isTimelineView = view === "timeline" && !isBeamView;

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<TaskAnalysisDetail | null>(null);

  useEffect(() => {
    const id = Number.parseInt(analysisId || "", 10);
    if (Number.isNaN(id)) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    const fetchApi = isBeamView ? agentDataApi.getChainAnalysis : agentDataApi.getHotAnalysis;
    void fetchApi(id)
      .then((response: any) => {
        if (cancelled) return;
        if (response.success) { setDetail(response.data as TaskAnalysisDetail); return; }
        return (isBeamView ? agentDataApi.getHotAnalysis(id) : agentDataApi.getChainAnalysis(id))
          .then((r2: any) => {
            if (cancelled) return;
            if (r2.success) { setDetail(r2.data as TaskAnalysisDetail); return; }
            return agentDataApi.getTaskAnalysis(id);
          })
          .then((r3: any) => {
            if (cancelled) return;
            if (r3?.success) { setDetail(r3.data as TaskAnalysisDetail); return; }
            showMessage.error("记录不存在");
          });
      })
      .catch(() => {
        if (!cancelled) showMessage.error("获取任务分析失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [analysisId, isBeamView]);

  return { loading, detail, isBeamView, isTimelineView, view };
}
