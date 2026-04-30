import React, { useState, useMemo } from "react";
import { FlowCtx, type FlowApi } from "./FlowContext";
import type { FlowEdge, FlowNode, PortSide } from "../flow/model";

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
