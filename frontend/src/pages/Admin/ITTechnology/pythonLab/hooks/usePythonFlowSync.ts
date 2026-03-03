import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FlowNode, FlowEdge, PortSide } from "../flow/model";
import type { IRBlock } from "../flow/ir";
import { generatePythonFromFlow } from "../flow/ir";
import { buildUnifiedFlowFromPython } from "../flow/python_sync";
import { computeBeautify, DEFAULT_BEAUTIFY_PARAMS, DEFAULT_BEAUTIFY_THRESHOLDS, type FlowBeautifyParams, type FlowBeautifyThresholds } from "../flow/beautify";
import { validatePythonStrict } from "../flow/python_runtime";
import { pythonlabDebugApi, pythonlabFlowApi, type PythonLabFlowDiagnostic } from "../services/pythonlabDebugApi";
import { cfgToFlow } from "../flow/cfg_to_flow";
import { nodeSizeForTitle } from "../flow/ports";
import { sortFlowGraphStable } from "../flow/determinism";
import { toErrorMessage } from "../errorMessage";
import { buildDebugMapFromNodes, type DebugForRangeEntry } from "../flow/debugMap";

export function usePythonFlowSync(params: {
  starterCode?: string;
  preferBackendCfg?: boolean;
  beautifyParams?: FlowBeautifyParams;
  beautifyThresholds?: FlowBeautifyThresholds;
  beautifyAlignMode?: boolean;
  autoLayout?: boolean;
  interacting?: boolean;
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
    beautifyParams,
    beautifyThresholds,
    beautifyAlignMode,
    autoLayout = true,
    interacting,
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
  const [debugForRanges, setDebugForRanges] = useState<DebugForRangeEntry[] | null>(null);

  const generated = useMemo(() => generatePythonFromFlow(nodes, edges), [nodes, edges]);
  const debugMap = useMemo(() => buildDebugMapFromNodes(nodes, debugForRanges), [debugForRanges, nodes]);

  const applyLayout = useCallback(
    async (rawNodes: FlowNode[], rawEdges: FlowEdge[]) => {
      const sorted = sortFlowGraphStable({ nodes: rawNodes, edges: rawEdges });

      const effectiveParams: FlowBeautifyParams = beautifyParams ?? { ...DEFAULT_BEAUTIFY_PARAMS, rankdir: "TB", splines: "spline" };
      const effectiveThresholds: FlowBeautifyThresholds = beautifyThresholds ?? DEFAULT_BEAUTIFY_THRESHOLDS;

      const res = await computeBeautify(sorted.nodes, sorted.edges, effectiveParams, effectiveThresholds, { snapToGrid: !beautifyAlignMode });
      const laidNodes = res.layout.nodes;
      const laidEdges = res.layout.edges;

      if (!canvasRef.current) {
        setNodes(laidNodes);
        setEdges(laidEdges);
        return;
      }

      const rect = canvasRef.current.getBoundingClientRect();
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;

      for (const n of laidNodes) {
        const s = nodeSizeForTitle(n.shape, n.title);
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + s.w);
        maxY = Math.max(maxY, n.y + s.h);
      }

      for (const e of laidEdges) {
        const pts = e.anchors || [];
        for (const p of pts) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
      }

      if (!Number.isFinite(minX)) {
        setNodes(laidNodes);
        setEdges(laidEdges);
        return;
      }

      const contentW = maxX - minX;
      const contentH = maxY - minY;
      const fitX = (rect.width - 80) / Math.max(1, contentW);
      const fitY = (rect.height - 80) / Math.max(1, contentH);
      const fit = Math.max(0.2, Math.min(1, fitX, fitY));
      const nextScale = fit >= 1 ? 1 : Math.max(0.2, fit);

      const contentCenterX = minX + contentW / 2;
      const contentCenterY = minY + contentH / 2;
      const nextOffsetX = Math.round(rect.width / 2 - contentCenterX * nextScale);
      const nextOffsetY = Math.round(rect.height / 2 - contentCenterY * nextScale);

      setScale(nextScale);
      setOffsetX(nextOffsetX);
      setOffsetY(nextOffsetY);
      setNodes(laidNodes);
      setEdges(laidEdges);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setConnectFromId(null);
      setConnectFromPort(null);
    },
    [
      beautifyParams,
      beautifyThresholds,
      beautifyAlignMode,
      canvasRef,
      setConnectFromId,
      setConnectFromPort,
      setEdges,
      setNodes,
      setOffsetX,
      setOffsetY,
      setScale,
      setSelectedEdgeId,
      setSelectedNodeId,
    ]
  );

  const semanticKey = useMemo(() => {
    const addStr = (h: number, s: string) => {
      let x = h | 0;
      for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619);
      return x | 0;
    };
    let h = 2166136261 | 0;
    const sorted = sortFlowGraphStable({ nodes, edges });
    for (const n of sorted.nodes) h = addStr(h, `${n.id}\t${n.shape}\t${n.title}`);
    for (const e of sorted.edges) h = addStr(h, `${e.id}\t${e.from}\t${e.to}\t${e.label ?? ""}`);
    return String(h >>> 0);
  }, [edges, nodes]);

  const lastAppliedSemanticKeyRef = useRef<string | null>(null);

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
      setDebugForRanges(null);
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
        const resetAndClear = () => {
          setCodeIr(null);
          setDebugForRanges(null);
          setNodes([]);
          setEdges([]);
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
          setConnectFromId(null);
          setConnectFromPort(null);
        };

        if (preferBackendCfg) {
          try {
            const parsed = await pythonlabFlowApi.parseFlow(code, {
              expand: { functions: flowExpandFunctions, maxDepth: 8 },
              limits: { maxParseMs: 1500, maxNodes: 2000, maxEdges: 4000 },
            });
            setFlowDiagnostics(parsed.diagnostics || []);
            const flow = cfgToFlow(parsed);
            setCodeIr(null);
            setDebugForRanges(null);
            await applyLayout(flow.nodes, flow.edges);
            return;
          } catch (e: unknown) {
            setFlowDiagnostics([{ level: "error", code: "E_FLOW_PARSE", message: toErrorMessage(e, "流程图解析失败") }]);
            resetAndClear();
            return;
          }
        }

        const v = validatePythonStrict(code);
        const built = v.ok ? buildUnifiedFlowFromPython(code) : null;
        if (v.ok && built) {
          setFlowDiagnostics([]);
          setCodeIr(built.ir);
          setDebugForRanges(built.debugMap.forRanges);
          await applyLayout(built.nodes, built.edges);
          return;
        }

        if (!preferBackendCfg) {
          setFlowDiagnostics([{ level: "error", code: "E_FLOW_BUILD", message: v.ok ? "流程图构建失败：暂不支持该代码结构" : "语法错误：无法生成流程图" }]);
          resetAndClear();
          return;
        }

        try {
          const cfg = await pythonlabDebugApi.parseCfg(code);
          const flow = cfgToFlow(cfg);
          setFlowDiagnostics(cfg.diagnostics?.map((d) => ({ level: d.level, message: d.message, code: "W_CFG" })) ?? []);
          setCodeIr(null);
          await applyLayout(flow.nodes, flow.edges);
        } catch (e: unknown) {
          setFlowDiagnostics([{ level: "error", code: "E_CFG_PARSE", message: toErrorMessage(e, "流程图解析失败") }]);
          resetAndClear();
        }
      })();
    }, 600); // Increased debounce for Graphviz
    return () => window.clearTimeout(t);
  }, [
    canvasRef,
    code,
    codeMode,
    applyLayout,
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

  useEffect(() => {
    if (codeMode !== "auto") return;
    if (interacting) return;
    if (!autoLayout) {
      lastAppliedSemanticKeyRef.current = semanticKey;
      return;
    }
    if (!nodes.length) return;
    if (lastAppliedSemanticKeyRef.current === semanticKey) return;
    const t = window.setTimeout(() => {
      void (async () => {
        await applyLayout(nodes, edges);
        lastAppliedSemanticKeyRef.current = semanticKey;
      })();
    }, 600);
    return () => window.clearTimeout(t);
  }, [applyLayout, autoLayout, codeMode, edges, interacting, nodes, semanticKey]);

  return { code, setCode, codeMode, setCodeMode, codeIr, setCodeIr, generated, debugMap, flowDiagnostics, flowExpandFunctions, setFlowExpandFunctions };
}
