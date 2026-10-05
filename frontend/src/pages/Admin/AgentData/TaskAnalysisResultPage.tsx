/**
 * 任务分析结果页 — 路由分发 wrapper
 * 根据 view / type 参数渲染 HotAnalysisResultPage 或 ChainAnalysisResultPage
 */
import React, { Suspense } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { LoadingState } from "@/components/ui/loading-state";

const HotAnalysis = React.lazy(() => import("./results/HotAnalysisResultPage"));
const ChainAnalysis = React.lazy(() => import("./results/ChainAnalysisResultPage"));

// 懒加载子页面的兜底：整屏加载态。原为裸 <Loader2>（无 aria，屏幕阅读器静默）。
// 尺寸 xl = h-8，与原 h-8 逐像素一致。
const Fallback: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center">
    <LoadingState label="正在加载分析结果…" size="xl" />
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
