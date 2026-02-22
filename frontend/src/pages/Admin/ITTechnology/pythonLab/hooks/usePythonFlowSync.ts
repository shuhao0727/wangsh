import { useEffect, useMemo, useState } from "react";
import type { FlowNode, FlowEdge, PortSide } from "../flow/model";
import type { IRBlock } from "../flow/ir";
import { generatePythonFromFlow } from "../flow/ir";
import { buildUnifiedFlowFromPython } from "../flow/python_sync";
import { arrangeFromIRElk } from "../flow/ir_layout_elk";
import { validatePythonStrict } from "../flow/python_runtime";
import { pythonlabDebugApi, pythonlabFlowApi, type PythonLabFlowDiagnostic } from "../services/pythonlabDebugApi";
import { cfgToFlow } from "../flow/cfg_to_flow";

export function usePythonFlowSync(params: {
  starterCode?: string;
  preferBackendCfg?: boolean;
  nodes: FlowNode[];
  edges: FlowEdge[];
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<FlowEdge[]>>;
  setScale: React.Dispatch<React.SetStateAction<number>>;
  setOffsetX: React.Dispatch<React.SetStateAction<number>>;
  setOffsetY: React.Dispatch<React.SetStateAction<number>>;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedEdgeId: React.Dispatch<React.SetStateAction<string | null>>;
  setConnectFromId: React.Dispatch<React.SetStateAction<string | null>>;
  setConnectFromPort: React.Dispatch<React.SetStateAction<PortSide | null>>;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}) {
  const {
    starterCode,
    preferBackendCfg,
    nodes,
    edges,
    setNodes,
    setEdges,
    setScale,
    setOffsetX,
    setOffsetY,
    setSelectedNodeId,
    setSelectedEdgeId,
    setConnectFromId,
    setConnectFromPort,
    canvasRef,
  } =
    params;

  const [code, setCode] = useState(starterCode || "print('Hello, Python')\n");
  const [codeMode, setCodeMode] = useState<"auto" | "manual">("auto");
  const [codeIr, setCodeIr] = useState<IRBlock | null>(null);
  const [flowDiagnostics, setFlowDiagnostics] = useState<PythonLabFlowDiagnostic[]>([]);
  const [flowExpandFunctions, setFlowExpandFunctions] = useState<"all" | "top" | "none">("all");

  const generated = useMemo(() => generatePythonFromFlow(nodes, edges), [nodes, edges]);

  useEffect(() => {
    if (!starterCode) return;
    setFlowDiagnostics([]);
    setCodeIr(null);
    setCodeMode("manual");
    setCode(starterCode);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setConnectFromId(null);
    setConnectFromPort(null);
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
  }, [
    setConnectFromId,
    setConnectFromPort,
    setOffsetX,
    setOffsetY,
    setScale,
    setSelectedEdgeId,
    setSelectedNodeId,
    starterCode,
  ]);

  useEffect(() => {
    if (codeMode === "auto") {
      setCode(generated.python);
      setCodeIr(generated.ir);
      const map = generated.nodeLineMap;
      if (map) {
        setNodes((prev) => {
          let changed = false;
          const next = prev.map((n) => {
            const line = map[n.id];
            if (!line) return n;
            if (n.sourceLine === line) return n;
            changed = true;
            return { ...n, sourceLine: line };
          });
          return changed ? next : prev;
        });
      }
    }
  }, [codeMode, generated.ir, generated.nodeLineMap, generated.python, setNodes]);

  useEffect(() => {
    if (codeMode !== "manual") return;
    const t = window.setTimeout(() => {
      void (async () => {
        if (preferBackendCfg) {
          try {
            const parsed = await pythonlabFlowApi.parseFlow(code, {
              expand: { functions: flowExpandFunctions, maxDepth: 8 },
              limits: { maxParseMs: 1500, maxNodes: 2000, maxEdges: 4000 },
            });
            setFlowDiagnostics(parsed.diagnostics || []);
            const flow = cfgToFlow(parsed as any);
            setCodeIr(null);
            if (!canvasRef.current) {
              setNodes(flow.nodes);
              setEdges(flow.edges);
              return;
            }
            const rect = canvasRef.current.getBoundingClientRect();
            const laid = await arrangeFromIRElk(flow.nodes, flow.edges, { width: rect.width, height: rect.height });
            let minX = Number.POSITIVE_INFINITY;
            let minY = Number.POSITIVE_INFINITY;
            for (const n of laid.nodes) {
              minX = Math.min(minX, n.x);
              minY = Math.min(minY, n.y);
            }
            setScale(1);
            setOffsetX(Math.round(80 - (Number.isFinite(minX) ? minX : 0)));
            setOffsetY(Math.round(40 - (Number.isFinite(minY) ? minY : 0)));
            setNodes(laid.nodes);
            setEdges(laid.edges);
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
            setConnectFromId(null);
            setConnectFromPort(null);
            return;
          } catch (e: any) {
            const msg = e?.response?.data?.detail ? String(e.response.data.detail) : e?.message ? String(e.message) : "流程图解析失败";
            setFlowDiagnostics([{ level: "error", code: "E_FLOW_PARSE", message: msg }]);
            setCodeIr(null);
            setNodes([]);
            setEdges([]);
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
            setConnectFromId(null);
            setConnectFromPort(null);
            return;
          }
        }

        const v = validatePythonStrict(code);
        const built = v.ok ? buildUnifiedFlowFromPython(code) : null;
        if (v.ok && built) {
          setFlowDiagnostics([]);
          setCodeIr(built.ir);
          const nextNodes = built.nodes;
          const nextEdges = built.edges;
          if (!canvasRef.current) {
            setNodes(nextNodes);
            setEdges(nextEdges);
            return;
          }
          const rect = canvasRef.current.getBoundingClientRect();
          const laid = await arrangeFromIRElk(nextNodes, nextEdges, { width: rect.width, height: rect.height });
          let minX = Number.POSITIVE_INFINITY;
          let minY = Number.POSITIVE_INFINITY;
          for (const n of laid.nodes) {
            minX = Math.min(minX, n.x);
            minY = Math.min(minY, n.y);
          }
          setScale(1);
          setOffsetX(Math.round(80 - (Number.isFinite(minX) ? minX : 0)));
          setOffsetY(Math.round(40 - (Number.isFinite(minY) ? minY : 0)));
          setNodes(laid.nodes);
          setEdges(laid.edges);
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
          setConnectFromId(null);
          setConnectFromPort(null);
          return;
        }

        if (!preferBackendCfg) {
          setFlowDiagnostics([{ level: "error", code: "E_FLOW_BUILD", message: v.ok ? "流程图构建失败：暂不支持该代码结构" : "语法错误：无法生成流程图" }]);
          setCodeIr(null);
          setNodes([]);
          setEdges([]);
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
          setConnectFromId(null);
          setConnectFromPort(null);
          return;
        }

        try {
          const cfg = await pythonlabDebugApi.parseCfg(code);
          const flow = cfgToFlow(cfg);
          setFlowDiagnostics(cfg.diagnostics?.map((d) => ({ level: d.level, message: d.message, code: "W_CFG" })) ?? []);
          setCodeIr(null);
          if (!canvasRef.current) {
            setNodes(flow.nodes);
            setEdges(flow.edges);
            return;
          }
          const rect = canvasRef.current.getBoundingClientRect();
          const laid = await arrangeFromIRElk(flow.nodes, flow.edges, { width: rect.width, height: rect.height });
          let minX = Number.POSITIVE_INFINITY;
          let minY = Number.POSITIVE_INFINITY;
          for (const n of laid.nodes) {
            minX = Math.min(minX, n.x);
            minY = Math.min(minY, n.y);
          }
          setScale(1);
          setOffsetX(Math.round(80 - (Number.isFinite(minX) ? minX : 0)));
          setOffsetY(Math.round(40 - (Number.isFinite(minY) ? minY : 0)));
          setNodes(laid.nodes);
          setEdges(laid.edges);
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
          setConnectFromId(null);
          setConnectFromPort(null);
        } catch (e: any) {
          const msg = e?.response?.data?.detail ? String(e.response.data.detail) : e?.message ? String(e.message) : "流程图解析失败";
          setFlowDiagnostics([{ level: "error", code: "E_CFG_PARSE", message: msg }]);
          setCodeIr(null);
          setNodes([]);
          setEdges([]);
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
          setConnectFromId(null);
          setConnectFromPort(null);
        }
      })();
    }, 300);
    return () => window.clearTimeout(t);
  }, [
    canvasRef,
    code,
    codeMode,
    flowExpandFunctions,
    preferBackendCfg,
    setConnectFromId,
    setConnectFromPort,
    setEdges,
    setNodes,
    setOffsetX,
    setOffsetY,
    setScale,
    setSelectedEdgeId,
    setSelectedNodeId,
  ]);

  return { code, setCode, codeMode, setCodeMode, codeIr, setCodeIr, generated, flowDiagnostics, flowExpandFunctions, setFlowExpandFunctions };
}
