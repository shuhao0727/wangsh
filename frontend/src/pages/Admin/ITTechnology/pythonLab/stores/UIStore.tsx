import React, { useState, useMemo } from "react";
import { UICtx, type UIApi, type VariableRow } from "./UIContext";

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [leftCollapsed, setLeftCollapsed] = useState(true);
  const [nodeInspectorOpen, setNodeInspectorOpen] = useState(false);
  const [optimizationVisible, setOptimizationVisible] = useState(false);
  const [originalContent, setOriginalContent] = useState<string | null>(null);
  const [optimizedContent, setOptimizedContent] = useState<string | null>(null);
  const [optimizationLoading, setOptimizationLoading] = useState(false);
  const [optimizationFeedback, setOptimizationFeedback] = useState("");
  const [optimizationLogId, setOptimizationLogId] = useState<number | null>(null);
  const [revealLine, setRevealLine] = useState<number | null>(null);
  const [nodeInspectorAnchorRect, setNodeInspectorAnchorRect] = useState<DOMRect | null>(null);
  const [variables, setVariables] = useState<VariableRow[]>([]);

  const api = useMemo<UIApi>(
    () => ({
      leftCollapsed, nodeInspectorOpen, optimizationVisible, originalContent, optimizedContent,
      optimizationLoading, optimizationFeedback, optimizationLogId, revealLine, nodeInspectorAnchorRect, variables,
      setLeftCollapsed, setNodeInspectorOpen, setOptimizationVisible, setOriginalContent,
      setOptimizedContent, setOptimizationLoading, setOptimizationFeedback, setOptimizationLogId,
      setRevealLine, setNodeInspectorAnchorRect, setVariables,
    }),
    [leftCollapsed, nodeInspectorOpen, optimizationVisible, originalContent, optimizedContent, optimizationLoading, optimizationFeedback, optimizationLogId, revealLine, nodeInspectorAnchorRect, variables]
  );

  return <UICtx.Provider value={api}>{children}</UICtx.Provider>;
}
