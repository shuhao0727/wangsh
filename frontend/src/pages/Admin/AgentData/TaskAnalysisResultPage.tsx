/**
 * 任务分析结果页 — 路由分发 wrapper
 * 根据 view / type 参数渲染 HotAnalysisResultPage 或 ChainAnalysisResultPage
 */
import React, { Suspense } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

const HotAnalysis = React.lazy(() => import("./results/HotAnalysisResultPage"));
const ChainAnalysis = React.lazy(() => import("./results/ChainAnalysisResultPage"));

const Fallback: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const TaskAnalysisResultPage: React.FC = () => {
  const { analysisId } = useParams<{ analysisId?: string }>();
  const [searchParams] = useSearchParams();
  const view = (searchParams.get("view") || "timeline") as "timeline" | "beam" | "wordcloud";
  const typeParam = searchParams.get("type");
  const isBeamView = view === "beam" || typeParam === "chains";

  return (
    <Suspense fallback={<Fallback />}>
      {isBeamView ? <ChainAnalysis /> : <HotAnalysis />}
    </Suspense>
  );
};

export default TaskAnalysisResultPage;
