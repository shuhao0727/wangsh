import React, { createContext, useContext, useState, useMemo } from "react";
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

const FlowCtx = createContext<FlowApi | null>(null);

export function FlowProvider({ children }: { children: React.ReactNode }) {
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [connectFromPort, setConnectFromPort] = useState<PortSide | null>(null);

  const api = useMemo<FlowApi>(
    () => ({
      nodes, edges, selectedNodeId, selectedEdgeId, connectMode, connectFromId, connectFromPort,
      setNodes, setEdges, setSelectedNodeId, setSelectedEdgeId, setConnectMode, setConnectFromId, setConnectFromPort,
    }),
    [nodes, edges, selectedNodeId, selectedEdgeId, connectMode, connectFromId, connectFromPort]
  );

  return <FlowCtx.Provider value={api}>{children}</FlowCtx.Provider>;
}

export function useFlow(): FlowApi {
  const ctx = useContext(FlowCtx);
  if (!ctx) throw new Error("useFlow must be used within FlowProvider");
  return ctx;
}
