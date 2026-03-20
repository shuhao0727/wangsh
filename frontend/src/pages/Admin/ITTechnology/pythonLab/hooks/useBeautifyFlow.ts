import { useState, useEffect } from "react";
import { computeBeautify, DEFAULT_BEAUTIFY_PARAMS, type FlowBeautifyResult, type FlowBeautifyParams, type FlowBeautifyThresholds } from "../flow/beautify";
import { sortFlowGraphStable } from "../flow/determinism";
import { toErrorMessage } from "../errorMessage";
import type { FlowNode, FlowEdge } from "../flow/model";

export function useBeautifyFlow(params: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  beautifyParams?: FlowBeautifyParams;
  beautifyThresholds?: FlowBeautifyThresholds;
  beautifyAlignMode?: boolean;
}) {
  const { nodes, edges, beautifyParams, beautifyThresholds, beautifyAlignMode } = params;
  const [beautifyResult, setBeautifyResult] = useState<FlowBeautifyResult | null>(null);
  const [beautifyLoading, setBeautifyLoading] = useState(false);
  const [beautifyError, setBeautifyError] = useState<string | null>(null);
  const [beautifyRefreshToken, setBeautifyRefreshToken] = useState(0);

  useEffect(() => {
    if (!nodes.length) {
      setBeautifyResult(null);
      setBeautifyLoading(false);
      setBeautifyError(null);
      return;
    }
    const tid = window.setTimeout(async () => {
      setBeautifyLoading(true);
      try {
        const sorted = sortFlowGraphStable({ nodes, edges });
        const resp = await computeBeautify(sorted.nodes, sorted.edges, beautifyParams ?? DEFAULT_BEAUTIFY_PARAMS, beautifyThresholds, {
          snapToGrid: !beautifyAlignMode,
        });
        setBeautifyResult(resp);
        setBeautifyError(null);
      } catch (e: unknown) {
        const msg = toErrorMessage(e, "Graphviz 渲染失败");
        setBeautifyResult(null);
        setBeautifyError(msg);
      } finally {
        setBeautifyLoading(false);
      }
    }, 500);
    return () => window.clearTimeout(tid);
  }, [beautifyRefreshToken, edges, nodes, beautifyAlignMode, beautifyParams, beautifyThresholds]);

  const refreshBeautify = () => setBeautifyRefreshToken((t) => t + 1);

  return { beautifyResult, beautifyLoading, beautifyError, refreshBeautify };
}
