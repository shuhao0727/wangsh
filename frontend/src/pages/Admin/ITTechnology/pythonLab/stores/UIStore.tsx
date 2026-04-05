import React, { createContext, useContext, useState, useMemo } from "react";

export type VariableRow = {
  key: string;
  name: string;
  value: string;
  type: string;
};

export interface UIApi {
  leftCollapsed: boolean;
  nodeInspectorOpen: boolean;
  optimizationVisible: boolean;
  originalContent: string | null;
  optimizedContent: string | null;
  optimizationLoading: boolean;
  optimizationFeedback: string;
  optimizationLogId: number | null;
  revealLine: number | null;
  nodeInspectorAnchorRect: DOMRect | null;
  variables: VariableRow[];
  setLeftCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setNodeInspectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setOptimizationVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setOriginalContent: React.Dispatch<React.SetStateAction<string | null>>;
  setOptimizedContent: React.Dispatch<React.SetStateAction<string | null>>;
  setOptimizationLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setOptimizationFeedback: React.Dispatch<React.SetStateAction<string>>;
  setOptimizationLogId: React.Dispatch<React.SetStateAction<number | null>>;
  setRevealLine: React.Dispatch<React.SetStateAction<number | null>>;
  setNodeInspectorAnchorRect: React.Dispatch<React.SetStateAction<DOMRect | null>>;
  setVariables: React.Dispatch<React.SetStateAction<VariableRow[]>>;
}

const UICtx = createContext<UIApi | null>(null);

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

export const VARIABLE_COLUMNS = [
  { title: "变量", dataIndex: "name", key: "name", width: 120 },
  { title: "值", dataIndex: "value", key: "value" },
  { title: "类型", dataIndex: "type", key: "type", width: 120 },
] as const;

export function useUI(): UIApi {
  const ctx = useContext(UICtx);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
}
