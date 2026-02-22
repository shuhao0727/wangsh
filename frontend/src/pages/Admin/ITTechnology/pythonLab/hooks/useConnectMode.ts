import { useCallback, useRef } from "react";
import type { FlowEdge, FlowNode, PortSide } from "../flow/model";
import { allowedPortsForShape } from "../flow/ports";

export function useConnectMode(params: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedEdgeId: string | null;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedEdgeId: React.Dispatch<React.SetStateAction<string | null>>;
  connectMode: boolean;
  setConnectMode: React.Dispatch<React.SetStateAction<boolean>>;
  connectFromId: string | null;
  setConnectFromId: React.Dispatch<React.SetStateAction<string | null>>;
  connectFromPort: PortSide | null;
  setConnectFromPort: React.Dispatch<React.SetStateAction<PortSide | null>>;
  setEdges: React.Dispatch<React.SetStateAction<FlowEdge[]>>;
  nextId: (prefix: string) => string;
  onInteract?: () => void;
}) {
  const {
    nodes,
    edges,
    selectedEdgeId,
    setSelectedNodeId,
    setSelectedEdgeId,
    connectMode,
    setConnectMode,
    connectFromId,
    setConnectFromId,
    connectFromPort,
    setConnectFromPort,
    setEdges,
    nextId,
    onInteract,
  } = params;

  const deletePendingEdgeRef = useRef<{ from: string; to: string } | null>(null);

  const defaultPortForNode = useCallback((node: FlowNode, role: "from" | "to"): PortSide => {
    const allowed = allowedPortsForShape(node.shape, node.title);
    if (node.shape === "start_end") return allowed[0];
    if (role === "from" && allowed.includes("bottom")) return "bottom";
    if (role === "to" && allowed.includes("top")) return "top";
    return allowed[0];
  }, []);

  const applyPortChange = useCallback(
    (edgeId: string, which: "from" | "to", nodeId: string, port: PortSide) => {
      onInteract?.();
      setEdges((prev) =>
        prev.map((e) => {
          if (e.id !== edgeId) return e;
          if (which === "from") return { ...e, from: nodeId, fromPort: port, fromDir: undefined, fromFree: null, routeMode: "manual" };
          if (e.toEdge) return e;
          return { ...e, to: nodeId, toPort: port, toDir: undefined, toFree: null, routeMode: "manual" };
        })
      );
    },
    [onInteract, setEdges]
  );

  const onPortClick = useCallback(
    (nodeId: string, port: PortSide) => {
      onInteract?.();
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const allowed = allowedPortsForShape(node.shape, node.title);
      const resolvedPort = allowed.includes(port) ? port : allowed[0];

      if (connectMode) {
        if (!connectFromId) {
          setConnectFromId(nodeId);
          setConnectFromPort(resolvedPort);
          return;
        }
        if (connectFromId === nodeId) {
          setConnectFromPort(resolvedPort);
          return;
        }

        deletePendingEdgeRef.current = { from: connectFromId, to: nodeId };
        setEdges((prev) => {
          const key = deletePendingEdgeRef.current;
          if (!key) return prev;
          const exists = prev.find((x) => x.from === key.from && x.to === key.to && !x.toEdge);
          if (exists) {
            setSelectedEdgeId(exists.id);
            setConnectFromId(null);
            setConnectFromPort(null);
            return prev;
          }

          const fromNode = nodes.find((n) => n.id === key.from);
          const toNode = nodes.find((n) => n.id === key.to);
          if (!fromNode || !toNode) return prev;

          const outgoingCount = prev.filter((x) => x.from === key.from && !x.toEdge).length;
          const fromPortGuess =
            connectFromPort ??
            (fromNode.shape === "decision" && outgoingCount === 0
              ? "bottom"
              : fromNode.shape === "decision" && outgoingCount === 1
                ? "right"
                : defaultPortForNode(fromNode, "from"));
          const toPortGuess = resolvedPort;
          const label =
            fromNode.shape === "decision" && fromPortGuess === "bottom"
              ? "是"
              : fromNode.shape === "decision" && fromPortGuess === "right"
                ? "否"
                : undefined;

          const edge: FlowEdge = {
            id: nextId("edge"),
            from: key.from,
            to: key.to,
            style: "straight",
            routeMode: "auto",
            anchor: null,
            fromPort: fromPortGuess,
            toPort: toPortGuess,
            fromDir: undefined,
            toDir: undefined,
            label,
          };
          setSelectedEdgeId(edge.id);
          setSelectedNodeId(null);
          setConnectFromId(null);
          setConnectFromPort(null);
          return [...prev, edge];
        });
        return;
      }

      if (selectedEdgeId) {
        const ed = edges.find((x) => x.id === selectedEdgeId);
        if (!ed) return;
        if (nodeId === ed.from) applyPortChange(ed.id, "from", nodeId, resolvedPort);
        if (nodeId === ed.to) applyPortChange(ed.id, "to", nodeId, resolvedPort);
      }
    },
    [
      applyPortChange,
      connectFromId,
      connectFromPort,
      connectMode,
      defaultPortForNode,
      edges,
      nextId,
      nodes,
      onInteract,
      selectedEdgeId,
      setConnectFromId,
      setConnectFromPort,
      setEdges,
      setSelectedEdgeId,
      setSelectedNodeId,
    ]
  );

  const onNodeClick = useCallback(
    (nodeId: string) => {
      onInteract?.();
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      if (!connectMode) return;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      if (!connectFromId) {
        setConnectFromId(nodeId);
        setConnectFromPort(defaultPortForNode(node, "from"));
        return;
      }
      if (connectFromId === nodeId) return;
      onPortClick(nodeId, defaultPortForNode(node, "to"));
    },
    [connectFromId, connectMode, defaultPortForNode, nodes, onInteract, onPortClick, setConnectFromId, setConnectFromPort, setSelectedEdgeId, setSelectedNodeId]
  );

  const toggleConnect = useCallback(() => {
    setConnectMode((v) => !v);
    setConnectFromId(null);
    setConnectFromPort(null);
    setSelectedEdgeId(null);
  }, [setConnectFromId, setConnectFromPort, setConnectMode, setSelectedEdgeId]);

  const resetConnectSelection = useCallback(() => {
    setConnectFromId(null);
    setConnectFromPort(null);
  }, [setConnectFromId, setConnectFromPort]);

  return { onPortClick, onNodeClick, toggleConnect, resetConnectSelection };
}

