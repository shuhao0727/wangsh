import { createContext, useContext } from "react";
import type React from "react";
import type { FlowEdge, FlowNode, PortSide } from "../flow/model";

export interface FlowApi {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  connectMode: boolean;
  connectFromId: string | null;
  connectFromPort: PortSide | null;
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<FlowEdge[]>>;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedEdgeId: React.Dispatch<React.SetStateAction<string | null>>;
  setConnectMode: React.Dispatch<React.SetStateAction<boolean>>;
  setConnectFromId: React.Dispatch<React.SetStateAction<string | null>>;
  setConnectFromPort: React.Dispatch<React.SetStateAction<PortSide | null>>;
}

export const FlowCtx = createContext<FlowApi | null>(null);

export function useFlow(): FlowApi {
  const ctx = useContext(FlowCtx);
  if (!ctx) throw new Error("useFlow must be used within FlowProvider");
  return ctx;
}
