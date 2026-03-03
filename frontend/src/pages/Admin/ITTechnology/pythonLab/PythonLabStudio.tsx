import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Input, Layout, Space, Tag, Typography } from "antd";
import type { PythonLabExperiment } from "./types";
import { normalizeFlowImport, type FlowEdge, type FlowNode, type PortSide } from "./flow/model";
import { pointAtT } from "./flow/geometry";
import { nodeSizeForTitle } from "./flow/ports";
import { clampBetween } from "./flow/math";
import { RightPanel } from "./components/RightPanel";
import { FloatingPopup } from "./components/FloatingPopup";
import { useEdgeGeometries } from "./hooks/useEdgeGeometries";
import { FlowEdgesSvg } from "./components/FlowEdgesSvg";
import { FlowNodesLayer } from "./components/FlowNodesLayer";
import { EdgeToolbar } from "./components/EdgeToolbar";
import { TemplatePalette } from "./components/TemplatePalette";
import { advancedTemplates, basicTemplates } from "./templates";
import { useFlowCanvasInteractions } from "./hooks/useFlowCanvasInteractions";
import { CanvasToolbar } from "./components/CanvasToolbar";
import { usePythonFlowSync } from "./hooks/usePythonFlowSync";
import { usePythonLabActions } from "./hooks/usePythonLabActions";
import { useArrangeLayout } from "./hooks/useArrangeLayout";
import { useConnectMode } from "./hooks/useConnectMode";
import { useDapRunner } from "./hooks/useDapRunner";
import { TerminalPopup } from "./components/TerminalPopup";
import { pythonlabPseudocodeApi, type PythonLabPseudocodeParseResponse } from "./services/pythonlabDebugApi";
import { computeTidy, type FlowTidyResult } from "./flow/tidy";
import { computeBeautify, type FlowBeautifyResult } from "./flow/beautify";
import { sortFlowGraphStable } from "./flow/determinism";
import { loadEffectiveRuleSetV1, type PythonLabRuleSetV1 } from "./pipeline/rules";
import { ensurePythonLabStorageCompatible } from "./storageCompat";
import { toErrorMessage } from "./errorMessage";

const { Sider, Content } = Layout;
const { Text } = Typography;

type VariableRow = {
  key: string;
  name: string;
  value: string;
  type: string;
};

function nextId(prefix: string) {
  return `${prefix}_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
}

const PythonLabStudio: React.FC<{
  experiment?: PythonLabExperiment;
}> = ({ experiment }) => {
  useEffect(() => {
    ensurePythonLabStorageCompatible();
  }, []);

  const [pipelineMode, setPipelineMode] = useState(() => {
    try {
      return localStorage.getItem("python_lab_pipeline_mode") === "1";
    } catch {
      return false;
    }
  });
  const [pseudocode, setPseudocode] = useState<PythonLabPseudocodeParseResponse | null>(null);
  const [pseudocodeLoading, setPseudocodeLoading] = useState(false);
  const [pseudocodeError, setPseudocodeError] = useState<string | null>(null);
  const [ruleSet, setRuleSet] = useState<PythonLabRuleSetV1>(() => loadEffectiveRuleSetV1(experiment?.id ?? ""));
  const [beautifyResult, setBeautifyResult] = useState<FlowBeautifyResult | null>(null);
  const [beautifyLoading, setBeautifyLoading] = useState(false);
  const [beautifyError, setBeautifyError] = useState<string | null>(null);
  const [beautifyRefreshToken, setBeautifyRefreshToken] = useState(0);
  const [canvasRoutingStyle, setCanvasRoutingStyle] = useState<"orthogonal" | "direct">(() => {
    try {
      return localStorage.getItem("python_lab_canvas_routing_style") === "direct" ? "direct" : "orthogonal";
    } catch {
      return "orthogonal";
    }
  });
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [panMode, setPanMode] = useState(false);
  const [followMode, setFollowMode] = useState(true);
  const [followTick, setFollowTick] = useState(0);
  const [interactionFlag, setInteractionFlag] = useState(false);
  const [canvasBusy, setCanvasBusy] = useState(false);
  const [autoLayout, setAutoLayout] = useState(true);

  const [demoAutoArrangeToken, setDemoAutoArrangeToken] = useState(0);
  const demoAutoArrangeHandledRef = useRef(0);
  const arrangeLayoutRef = useRef<null | (() => Promise<void>)>(null);

  const fitViewTo = (nextNodes: FlowNode[], nextEdges: FlowEdge[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const marginScreen = Math.max(16, Math.min(40, Math.round(Math.min(rect.width, rect.height) * 0.04)));
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    const centersX: number[] = [];

    for (const n of nextNodes) {
      const s = nodeSizeForTitle(n.shape, n.title);
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + s.w);
      maxY = Math.max(maxY, n.y + s.h);
      centersX.push(n.x + s.w / 2);
    }
    for (const e of nextEdges) {
      const pts =
        e.style === "polyline" || e.style === "bezier"
          ? e.anchors && e.anchors.length
            ? e.anchors
            : e.anchor
              ? [e.anchor]
              : []
          : [];
      for (const p of pts) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      if (e.fromFree) {
        minX = Math.min(minX, e.fromFree.x);
        minY = Math.min(minY, e.fromFree.y);
        maxX = Math.max(maxX, e.fromFree.x);
        maxY = Math.max(maxY, e.fromFree.y);
      }
      if (e.toFree) {
        minX = Math.min(minX, e.toFree.x);
        minY = Math.min(minY, e.toFree.y);
        maxX = Math.max(maxX, e.toFree.x);
        maxY = Math.max(maxY, e.toFree.y);
      }
    }
    if (!Number.isFinite(minX)) return;

    centersX.sort((a, b) => a - b);
    const trunkX =
      centersX.length === 0
        ? (minX + maxX) / 2
        : centersX.length % 2
          ? centersX[(centersX.length - 1) / 2]
          : (centersX[centersX.length / 2 - 1] + centersX[centersX.length / 2]) / 2;

    const boundsW = maxX - minX;
    const boundsH = maxY - minY;
    const fitX = (rect.width - marginScreen * 2) / Math.max(1, boundsW);
    const fitY = (rect.height - marginScreen * 2) / Math.max(1, boundsH);
    const fit = Math.max(0.2, Math.min(1, fitX, fitY));
    const viewScale = fit >= 1 ? 1 : Math.max(0.2, fit);
    setScale(viewScale);

    const fitScreenW = rect.width - marginScreen * 2;
    const fitScreenH = rect.height - marginScreen * 2;
    const nextOffsetX = boundsW * viewScale <= fitScreenW ? Math.round(rect.width / 2 - trunkX * viewScale) : Math.round(marginScreen - minX * viewScale);
    const nextOffsetY =
      boundsH * viewScale <= fitScreenH ? Math.round(marginScreen + (fitScreenH - boundsH * viewScale) / 2 - minY * viewScale) : Math.round(marginScreen - minY * viewScale);
    setOffsetX(nextOffsetX);
    setOffsetY(nextOffsetY);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setScale((s) => {
          const next = s - e.deltaY * 0.001;
          return Math.max(0.2, Math.min(3, next));
        });
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("python_lab_canvas_routing_style", canvasRoutingStyle);
    } catch {}
  }, [canvasRoutingStyle]);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [revealLine, setRevealLine] = useState<number | null>(null);
  const [nodeInspectorOpen, setNodeInspectorOpen] = useState(false);
  const [nodeInspectorAnchorRect, setNodeInspectorAnchorRect] = useState<DOMRect | null>(null);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [connectFromPort, setConnectFromPort] = useState<PortSide | null>(null);
  const [variables, setVariables] = useState<VariableRow[]>([]);
  const tidyResult: FlowTidyResult | null = useMemo(() => {
    if (!pipelineMode) return null;
    if (!nodes.length) return null;
    return computeTidy(nodes, edges, { enabled: ruleSet.tidy.enabled });
  }, [edges, nodes, pipelineMode, ruleSet.tidy.enabled]);
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  useEffect(() => {
    let warnedThirdPartySelection = false;
    const onError = (event: ErrorEvent) => {
      const msg = String(event.message || "");
      const name = (event.error as any)?.name ? String((event.error as any).name) : "";
      const stack = (event.error as any)?.stack ? String((event.error as any).stack) : "";
      const file = (event as any)?.filename ? String((event as any).filename) : "";
      const isIndexSize = name === "IndexSizeError" || msg.includes("IndexSizeError");
      const isGetRangeAt = msg.includes("getRangeAt") || stack.includes("getRangeAt");
      const isThirdParty =
        file.includes("content.js") ||
        file.includes("content-script") ||
        file.startsWith("chrome-extension://") ||
        file.startsWith("moz-extension://") ||
        file.startsWith("safari-extension://") ||
        file.startsWith("ms-browser-extension://") ||
        stack.includes("content.js") ||
        stack.includes("content-script") ||
        msg.includes("content.js") ||
        msg.includes("content-script") ||
        stack.includes("Content.isSelection") ||
        stack.includes("Content.handleSelection") ||
        msg.includes("Content.isSelection") ||
        msg.includes("Content.handleSelection");
      if (isIndexSize && isGetRangeAt && isThirdParty) {
        if (!warnedThirdPartySelection) {
          warnedThirdPartySelection = true;
          console.info("检测到可能来自浏览器插件/注入脚本的 Selection(IndexSizeError) 噪音错误，已在页面层面忽略。");
        }
        // 尝试全面阻止冒泡和默认行为
        event.preventDefault();
        event.stopImmediatePropagation();
        event.stopPropagation();
        return true;
      }
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason: any = (event as any)?.reason;
      const msg = reason ? String(reason?.message || reason) : "";
      const name = reason?.name ? String(reason.name) : "";
      const stack = reason?.stack ? String(reason.stack) : "";
      const isIndexSize = name === "IndexSizeError" || msg.includes("IndexSizeError");
      const isGetRangeAt = msg.includes("getRangeAt") || stack.includes("getRangeAt");
      const isThirdParty =
        msg.includes("content.js") ||
        msg.includes("content-script") ||
        stack.includes("content.js") ||
        stack.includes("content-script") ||
        msg.includes("chrome-extension://") ||
        stack.includes("chrome-extension://") ||
        msg.includes("moz-extension://") ||
        stack.includes("moz-extension://") ||
        msg.includes("safari-extension://") ||
        stack.includes("safari-extension://") ||
        stack.includes("Content.isSelection") ||
        stack.includes("Content.handleSelection") ||
        msg.includes("Content.isSelection") ||
        msg.includes("Content.handleSelection");
      if (isIndexSize && isGetRangeAt && isThirdParty) {
        if (!warnedThirdPartySelection) {
          warnedThirdPartySelection = true;
          console.info("检测到可能来自浏览器插件/注入脚本的 Selection(IndexSizeError) 噪音错误，已在页面层面忽略。");
        }
        event.preventDefault();
        return;
      }
    };
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onUnhandledRejection, true);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onUnhandledRejection, true);
    };
  }, []);

  const { code, setCode, codeMode, setCodeMode, codeIr, generated, debugMap, flowDiagnostics, flowExpandFunctions, setFlowExpandFunctions } = usePythonFlowSync({
    starterCode: experiment?.starterCode,
    preferBackendCfg: true,
    beautifyParams: ruleSet.beautify.params,
    beautifyThresholds: ruleSet.beautify.thresholds,
    beautifyAlignMode: ruleSet.beautify.alignMode,
    autoLayout,
    interacting: interactionFlag,
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
  });

  const [structuredEmphasisLog, setStructuredEmphasisLog] = useState(() => {
    try {
      return localStorage.getItem("python_lab_structured_emphasis_log") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("python_lab_structured_emphasis_log", structuredEmphasisLog ? "1" : "0");
    } catch {}
  }, [structuredEmphasisLog]);

  const {
    ensureAuto,
    setNodesAuto,
    setEdgesAuto,
    setNodesAndEdgesAuto,
    setFlowAuto,
    addNode,
    removeSelected,
    clearAll,
    updateNodeTitle,
    setEdgeStraight,
    setEdgePolyline,
    clearEdgeAnchors,
    addEdgeAnchor,
    reverseEdge,
    loadDemoFlow,
    peekDemoFlow,
    demoOptions,
    variableColumns,
  } = usePythonLabActions({
    canvasRef,
    nextId,
    codeMode,
    setCodeMode,
    variables,
    setVariables,
    setNodes,
    setEdges,
    selectedNodeId,
    setSelectedNodeId,
    selectedEdgeId,
    setSelectedEdgeId,
    setConnectMode,
    setConnectFromId,
    setConnectFromPort,
  });

  const exportFlow = () => {
    const payload = { format: "pythonlab-flow-v1", nodes, edges };
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pythonlab_flow_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFlow = (jsonText: string) => {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return;
    }
    const normalized = normalizeFlowImport(parsed);
    if (!normalized) return;
    const { nodes: ns, edges: es } = normalized;
    setFlowAuto({ nodes: ns, edges: es, resetSelection: true, resetConnect: true });
    fitViewTo(ns, es);
  };

  const { onPortClick, onNodeClick, toggleConnect, resetConnectSelection } = useConnectMode({
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
    setEdges: setEdgesAuto,
    nextId,
    onSemanticEdit: ensureAuto,
  });

  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
    onNodeClick(nodeId);
    const n = nodes.find((x) => x.id === nodeId);
    setRevealLine(n?.sourceLine ?? null);
    setNodeInspectorAnchorRect((e.currentTarget as HTMLElement).getBoundingClientRect());
    setNodeInspectorOpen(true);
  };

  useEffect(() => {
    if (!selectedNodeId) setNodeInspectorOpen(false);
  }, [selectedNodeId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const active = document.activeElement;
      if (active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT")) return;
      if (!selectedEdgeId && !selectedNodeId) return;
      e.preventDefault();
      removeSelected();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [removeSelected, selectedEdgeId, selectedNodeId]);

  const {
    state: runner,
    error: runnerError,
    runAll,
    continueRun,
    pause,
    stepOver,
    stepInto,
    stepOut,
    reset: resetRun,
    clearOutput,
    clearBreakpoints,
    toggleBreakpoint,
    setBreakpointEnabled,
    setBreakpointCondition,
    setBreakpointHitCount,
    addWatch,
    removeWatch,
    evaluate,
    historyBack,
    historyForward,
    historyToLatest,
    setWatchExprs,
  } = useDapRunner({ code, debugMap, structuredEmphasisLog });
  const [terminalOpen, setTerminalOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("python_lab_pipeline_mode", pipelineMode ? "1" : "0");
    } catch {}
  }, [pipelineMode]);

  useEffect(() => {
    try {
      setRuleSet(loadEffectiveRuleSetV1(experiment?.id ?? ""));
    } catch {}
  }, [experiment?.id]);

  useEffect(() => {
    if (!pipelineMode) {
      setPseudocode(null);
      setPseudocodeLoading(false);
      setPseudocodeError(null);
      return;
    }
    const tid = window.setTimeout(async () => {
      setPseudocodeLoading(true);
      try {
        const resp = await pythonlabPseudocodeApi.parsePseudocode(code);
        setPseudocode(resp);
        setPseudocodeError(null);
      } catch (e: unknown) {
        const msg = toErrorMessage(e, "获取伪代码失败");
        setPseudocode(null);
        setPseudocodeError(msg);
      } finally {
        setPseudocodeLoading(false);
      }
    }, 350);
    return () => window.clearTimeout(tid);
  }, [code, pipelineMode]);

  useEffect(() => {
    if (!pipelineMode) {
      setBeautifyResult(null);
      setBeautifyLoading(false);
      setBeautifyError(null);
      return;
    }
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
        const resp = await computeBeautify(sorted.nodes, sorted.edges, ruleSet.beautify.params, ruleSet.beautify.thresholds, {
          snapToGrid: !ruleSet.beautify.alignMode,
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
  }, [beautifyRefreshToken, edges, nodes, pipelineMode, ruleSet.beautify.alignMode, ruleSet.beautify.params, ruleSet.beautify.thresholds]);

  const fitViewToCenter = useCallback(
    (nextNodes: FlowNode[], nextEdges: FlowEdge[]) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;

      for (const n of nextNodes) {
        const s = nodeSizeForTitle(n.shape, n.title);
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + s.w);
        maxY = Math.max(maxY, n.y + s.h);
      }
      for (const e of nextEdges) {
        const pts =
          e.style === "polyline" || e.style === "bezier"
            ? e.anchors && e.anchors.length
              ? e.anchors
              : e.anchor
                ? [e.anchor]
                : []
            : [];
        for (const p of pts) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
      }

      if (!Number.isFinite(minX)) return;
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
    },
    [setOffsetX, setOffsetY, setScale]
  );

  // Removed auto-open terminal effect since it is now embedded in RightPanel

  useEffect(() => {
    resetRun();
    clearOutput();
    clearBreakpoints();
    setWatchExprs([]);
    
    setRevealLine(null);
    setFlowAuto({ nodes: [], edges: [], resetSelection: true, resetConnect: true, resetVariables: true });
    setPanMode(false);
    setFollowMode(true);
    setNodeInspectorOpen(false);
    setTerminalOpen(false);

    if (experiment?.id === "seq_basic") {
      const demo = peekDemoFlow("seq_basic");
      setCanvasBusy(true);
      setFlowAuto({ nodes: [], edges: [], resetSelection: true, resetConnect: true, resetVariables: true });
      void (async () => {
        try {
          const sorted = sortFlowGraphStable({ nodes: demo.nodes, edges: demo.edges });
          const resp = await computeBeautify(sorted.nodes, sorted.edges, ruleSet.beautify.params, ruleSet.beautify.thresholds, {
            snapToGrid: !ruleSet.beautify.alignMode,
          });
          setNodes(resp.layout.nodes);
          setEdges(resp.layout.edges);
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
          setConnectFromId(null);
          setConnectFromPort(null);
          setVariables([]);
          requestAnimationFrame(() => fitViewToCenter(resp.layout.nodes, resp.layout.edges));
        } catch {
          setFlowAuto({ nodes: demo.nodes, edges: demo.edges, resetSelection: true, resetConnect: true, resetVariables: true });
          requestAnimationFrame(() => fitViewToCenter(demo.nodes, demo.edges));
        } finally {
          setCanvasBusy(false);
        }
      })();
    } else if (typeof experiment?.starterCode === "string") {
      setCodeMode("manual");
      setCode(experiment.starterCode);
    }
  }, [experiment?.id]);


  const runAllWithTerminal = () => {
    runAll();
  };
  const continueWithTerminal = () => {
    continueRun();
  };
  const stepOverWithTerminal = () => {
    stepOver();
  };
  const stepIntoWithTerminal = () => {
    stepInto();
  };
  const stepOutWithTerminal = () => {
    stepOut();
  };

  const followKey = useMemo(() => {
    const line = runner.activeLine ?? revealLine ?? null;
    if (!line) return "";
    const role = runner.activeFocusRole ?? "";
    return `${line}|${role}`;
  }, [revealLine, runner.activeFocusRole, runner.activeLine]);

  useEffect(() => {
    if (!followMode) return;
    if (!canvasRef.current) return;
    const [lineStr, roleRaw] = followKey.split("|");
    const line = lineStr ? Number(lineStr) : null;
    const focusRole = roleRaw || null;
    if (!line) return;
    const matchesLine = (n: any) => {
      const r = n?.sourceRange;
      if (r && Number.isFinite(r.startLine) && Number.isFinite(r.endLine)) {
        return line >= r.startLine && line <= r.endLine;
      }
      return n.sourceLine === line;
    };
    const byRole = focusRole ? nodes.filter((n: any) => matchesLine(n) && n.sourceRole === focusRole) : [];
    const targets = byRole.length ? byRole : nodes.filter((n: any) => matchesLine(n));
    if (!targets.length) return;
    const target = targets.slice().sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const margin = 40;
    const s = nodeSizeForTitle(target.shape, target.title);
    const targetL = target.x * scale + offsetX;
    const targetT = target.y * scale + offsetY;
    const targetR = (target.x + s.w) * scale + offsetX;
    const targetB = (target.y + s.h) * scale + offsetY;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const n of nodes) {
      const ns = nodeSizeForTitle(n.shape, n.title);
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + ns.w);
      maxY = Math.max(maxY, n.y + ns.h);
    }
    if (!Number.isFinite(minX)) return;
    const minOffsetX = Math.round(rect.width - margin - maxX * scale);
    const maxOffsetX = Math.round(margin - minX * scale);
    const minOffsetY = Math.round(rect.height - margin - maxY * scale);
    const maxOffsetY = Math.round(margin - minY * scale);

    let nextOffsetX = offsetX;
    let nextOffsetY = offsetY;
    if (targetL < margin) nextOffsetX += margin - targetL;
    else if (targetR > rect.width - margin) nextOffsetX -= targetR - (rect.width - margin);
    if (targetT < margin) nextOffsetY += margin - targetT;
    else if (targetB > rect.height - margin) nextOffsetY -= targetB - (rect.height - margin);

    nextOffsetX = clampBetween(Math.round(nextOffsetX), minOffsetX, maxOffsetX);
    nextOffsetY = clampBetween(Math.round(nextOffsetY), minOffsetY, maxOffsetY);
    if (nextOffsetX !== offsetX) setOffsetX(nextOffsetX);
    if (nextOffsetY !== offsetY) setOffsetY(nextOffsetY);
    setFollowTick((t) => t + 1);
  }, [followMode, nodes, followKey, offsetX, offsetY, scale]);

  const canvasMetricsRef = useRef(new Map());
  const edgeGeometryCacheRef = useRef(new Map());
  const { onNodePointerDown, onAnchorPointerDown, onSourcePointerDown, onTargetPointerDown, onCanvasPointerDown, consumePanClick, panning, interacting } =
    useFlowCanvasInteractions({
      canvasRef,
      scale,
      offsetX,
      offsetY,
      setOffsetX,
      setOffsetY,
      connectMode,
      panMode,
      nodes,
      edges,
      setNodes: setNodesAuto,
      setEdges: setEdgesAuto,
      canvasMetricsRef,
      edgeGeometryCacheRef,
      onSemanticEdit: ensureAuto,
    });

  useEffect(() => {
    setInteractionFlag(interacting);
  }, [interacting]);

  const { canvasMetrics, edgeGeometries } = useEdgeGeometries(nodes, edges, canvasRoutingStyle, interacting);
  useEffect(() => {
    canvasMetricsRef.current = canvasMetrics as any;
  }, [canvasMetrics]);
  useEffect(() => {
    edgeGeometryCacheRef.current = edgeGeometries.cache as any;
  }, [edgeGeometries.cache]);

  const { arrangeLayout } = useArrangeLayout({
    canvasRef,
    scale,
    setScale,
    setOffsetX,
    setOffsetY,
    nodes,
    edges,
    setNodes: setNodesAuto,
    setEdges: setEdgesAuto,
    codeMode,
    onSemanticEdit: ensureAuto,
    generatedIr: generated.ir,
    codeIr,
    setSelectedNodeId,
    setSelectedEdgeId,
    setConnectFromId,
    setConnectFromPort,
    beautifyParams: ruleSet.beautify.params,
    beautifyThresholds: ruleSet.beautify.thresholds,
    beautifyAlignMode: ruleSet.beautify.alignMode,
  });

  useEffect(() => {
    arrangeLayoutRef.current = arrangeLayout;
  }, [arrangeLayout]);

  useEffect(() => {
    if (demoAutoArrangeToken <= 0) return;
    if (demoAutoArrangeHandledRef.current === demoAutoArrangeToken) return;
    demoAutoArrangeHandledRef.current = demoAutoArrangeToken;
    void arrangeLayoutRef.current?.();
  }, [demoAutoArrangeToken]);

  const selectedEdge = useMemo(() => {
    if (!selectedEdgeId) return null;
    return edges.find((e) => e.id === selectedEdgeId) || null;
  }, [edges, selectedEdgeId]);

  const selectedEdgePosition = useMemo(() => {
    if (!selectedEdge) return null;
    const geom = edgeGeometries.cache.get(selectedEdge.id);
    if (!geom) return null;
    const p = pointAtT(geom.poly, 0.5);
    return { x: p.x, y: p.y };
  }, [edgeGeometries.cache, selectedEdge]);

  const setSelectedEdgeStraight = () => {
    if (!selectedEdgeId) return;
    setEdgeStraight(selectedEdgeId);
  };

  const setSelectedEdgePolyline = () => {
    if (!selectedEdgeId) return;
    setEdgePolyline(selectedEdgeId);
  };

  const clearSelectedEdgeAnchors = () => {
    if (!selectedEdgeId) return;
    clearEdgeAnchors(selectedEdgeId);
  };

  const addSelectedEdgeAnchor = () => {
    if (!selectedEdgeId) return;
    const geom = edgeGeometries.cache.get(selectedEdgeId);
    if (!geom) return;
    const p = pointAtT(geom.poly, 0.5);
    const pA = pointAtT(geom.poly, 0.48);
    const pB = pointAtT(geom.poly, 0.52);
    const dx = pB.x - pA.x;
    const dy = pB.y - pA.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const offset = 80;
    let ax = p.x + nx * offset;
    let ay = p.y + ny * offset;
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const pad = 16;
      const minX = (pad - offsetX) / scale;
      const maxX = (rect.width - pad - offsetX) / scale;
      const minY = (pad - offsetY) / scale;
      const maxY = (rect.height - pad - offsetY) / scale;
      ax = Math.max(minX, Math.min(maxX, ax));
      ay = Math.max(minY, Math.min(maxY, ay));
    }
    addEdgeAnchor(selectedEdgeId, { x: ax, y: ay });
  };

  const reverseSelectedEdge = () => {
    if (!selectedEdgeId) return;
    reverseEdge(selectedEdgeId);
  };

  return (
    <div style={{ height: "calc(100vh - 130px)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <Layout style={{ background: "transparent", height: "100%" }}>
        <Sider
          width={250}
          collapsedWidth={0}
          collapsible
          collapsed={leftCollapsed}
          trigger={null}
          theme="light"
          style={{ background: "transparent", height: "100%", overflow: "hidden", borderRight: "1px solid rgba(0,0,0,0.06)" }}
        >
          <div style={{ height: "100%" }}>
            <TemplatePalette basic={basicTemplates} advanced={advancedTemplates} onAddNode={addNode} />
          </div>
        </Sider>

        <Content style={{ padding: "0 0 0 16px", height: "100%", overflow: "hidden" }}>
          <Card
            title={
              <Space>
                <span style={{ fontSize: 16, fontWeight: 600 }}>画布</span>
                {experiment?.title ? <Tag color="blue">{experiment.title}</Tag> : <Tag color="blue">UI</Tag>}
                {experiment?.scenario && experiment.scenario !== experiment.title ? (
                  <Tag variant="filled">{experiment.scenario}</Tag>
                ) : null}
              </Space>
            }
            extra={
              <Space size={10}>
                <CanvasToolbar
                  leftCollapsed={leftCollapsed}
                  toggleLeft={() => setLeftCollapsed((v) => !v)}
                  demoOptions={demoOptions}
                  onLoadDemo={(key) => {
                    clearBreakpoints();
                    const demo = peekDemoFlow(key);
                    setCanvasBusy(true);
                    setFlowAuto({ nodes: [], edges: [], resetSelection: true, resetConnect: true, resetVariables: true });
                    if (demo.codeMode === "manual") {
                      setCodeMode("manual");
                      if (typeof demo.code === "string") setCode(demo.code);
                    } else {
                      setCodeMode("auto");
                    }
                    void (async () => {
                      try {
                        const sorted = sortFlowGraphStable({ nodes: demo.nodes, edges: demo.edges });
                        const resp = await computeBeautify(sorted.nodes, sorted.edges, ruleSet.beautify.params, ruleSet.beautify.thresholds, {
                          snapToGrid: !ruleSet.beautify.alignMode,
                        });
                        setNodes(resp.layout.nodes);
                        setEdges(resp.layout.edges);
                        setSelectedNodeId(null);
                        setSelectedEdgeId(null);
                        setConnectFromId(null);
                        setConnectFromPort(null);
                        setVariables([]);
                        requestAnimationFrame(() => fitViewToCenter(resp.layout.nodes, resp.layout.edges));
                      } catch {
                        setFlowAuto({ nodes: demo.nodes, edges: demo.edges, resetSelection: true, resetConnect: true, resetVariables: true });
                        requestAnimationFrame(() => fitViewToCenter(demo.nodes, demo.edges));
                      } finally {
                        setCanvasBusy(false);
                      }
                    })();
                  }}
                  onArrange={arrangeLayout}
                  autoLayout={autoLayout}
                  onToggleAutoLayout={() => setAutoLayout((v) => !v)}
                  connectMode={connectMode}
                  onToggleConnect={toggleConnect}
                  panMode={panMode}
                  onTogglePan={() => {
                    setPanMode((v) => {
                      const next = !v;
                      if (next && connectMode) toggleConnect();
                      return next;
                    });
                    if (connectMode) resetConnectSelection();
                  }}
                  followMode={followMode}
                  onToggleFollow={() => setFollowMode((v) => !v)}
                  canDelete={!!selectedNodeId || !!selectedEdgeId}
                  onDelete={removeSelected}
                  onClear={clearAll}
                  onExportFlow={exportFlow}
                  onImportFlow={importFlow}
                  scale={scale}
                  setScale={setScale}
                />
              </Space>
            }
            variant="borderless"
            style={{ borderRadius: 8, height: "100%", display: "flex", flexDirection: "column", boxShadow: "none" }}
            styles={{ body: { padding: 0, flex: 1, minHeight: 0 }, header: { padding: "0 16px", minHeight: 48 } }}
          >
            <div
              ref={canvasRef}
              style={{
                height: "100%",
                minHeight: 0,
                position: "relative",
                background:
                  "linear-gradient(0deg, rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
                borderTop: "1px solid rgba(0,0,0,0.06)",
                overflow: "hidden",
                cursor: panMode ? (panning ? "grabbing" : "grab") : "default",
              }}
              onPointerDown={(e) => onCanvasPointerDown(e)}
              onClick={() => {
                if (consumePanClick()) return;
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
                if (connectMode) {
                  resetConnectSelection();
                }
              }}
            >
              {canvasBusy && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(255,255,255,0.65)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 5,
                    userSelect: "none",
                    cursor: "wait",
                  }}
                >
                  <span style={{ color: "rgba(0,0,0,0.55)" }}>布局计算中…</span>
                </div>
              )}
              <FlowEdgesSvg
                canvasRef={canvasRef}
                canvasMetrics={canvasMetrics}
                edges={edges}
                edgeGeometries={edgeGeometries}
                scale={scale}
                offsetX={offsetX}
                offsetY={offsetY}
                selectedEdgeId={selectedEdgeId}
                setSelectedEdgeId={setSelectedEdgeId}
                setSelectedNodeId={setSelectedNodeId}
                connectMode={connectMode}
                connectFromId={connectFromId}
                connectFromPort={connectFromPort}
                setConnectFromId={setConnectFromId}
                setConnectFromPort={setConnectFromPort}
                setEdges={setEdgesAuto}
                nextId={nextId}
                onSourcePointerDown={onSourcePointerDown}
                onTargetPointerDown={onTargetPointerDown}
                onAnchorPointerDown={onAnchorPointerDown}
              />
              {selectedEdge && (
                <EdgeToolbar
                  canvasRef={canvasRef}
                  selectedEdge={selectedEdge}
                  anchorPoint={selectedEdgePosition}
                  scale={scale}
                  offsetX={offsetX}
                  offsetY={offsetY}
                  onDelete={removeSelected}
                  onReverse={reverseSelectedEdge}
                  onSetLabel={(v) => {
                    setEdgesAuto((prev) =>
                      prev.map((x) => {
                        if (x.id !== selectedEdge.id) return x;
                        const trimmed = v.trim();
                        return { ...x, label: trimmed ? v : undefined };
                      })
                    );
                  }}
                  onSetStraight={setSelectedEdgeStraight}
                  onSetPolyline={setSelectedEdgePolyline}
                  onAddAnchor={addSelectedEdgeAnchor}
                  onClearAnchors={clearSelectedEdgeAnchors}
                />
              )}
              {nodes.length === 0 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "rgba(0,0,0,0.45)",
                    pointerEvents: "none",
                    padding: 24,
                    textAlign: "center",
                  }}
                >
                  从左侧选择一个模块开始搭建流程图
                </div>
              )}
              <FlowNodesLayer
                nodes={nodes}
                scale={scale}
                offsetX={offsetX}
                offsetY={offsetY}
                selectedNodeId={selectedNodeId}
                selectedEdgeId={selectedEdgeId}
                selectedEdge={selectedEdge}
                activeNodeId={runner.activeNodeId}
                activeLine={runner.activeFlowLine ?? runner.activeLine}
                activeFocusRole={runner.activeFocusRole}
                followMode={followMode}
                followTick={followTick}
                connectMode={connectMode}
                connectFromId={connectFromId}
                connectFromPort={connectFromPort}
                onNodePointerDown={onNodePointerDown}
                onNodeClick={handleNodeClick}
                onPortClick={onPortClick}
              />
            </div>
          </Card>
        </Content>

        <Sider width={440} theme="light" style={{ background: "transparent", height: "100%", overflow: "hidden" }}>
          <RightPanel
            generated={generated}
            code={code}
            setCode={setCode}
            codeMode={codeMode}
            setCodeMode={setCodeMode}
            revealLine={revealLine}
            variableColumns={variableColumns}
            runner={runner}
            runnerError={runnerError}
            structuredEmphasisLog={structuredEmphasisLog}
            onToggleStructuredEmphasisLog={setStructuredEmphasisLog}
            flowDiagnostics={flowDiagnostics}
            flowExpandFunctions={flowExpandFunctions}
            setFlowExpandFunctions={setFlowExpandFunctions}
            onRun={runAllWithTerminal}
            onContinue={continueWithTerminal}
            onPause={pause}
            onStepOver={stepOverWithTerminal}
            onStepInto={stepIntoWithTerminal}
            onStepOut={stepOutWithTerminal}
            onReset={resetRun}
            onToggleBreakpoint={toggleBreakpoint}
            onSetBreakpointEnabled={setBreakpointEnabled}
            onSetBreakpointCondition={setBreakpointCondition}
            onSetBreakpointHitCount={setBreakpointHitCount}
            onAddWatch={addWatch}
            onRemoveWatch={removeWatch}
            onEvaluate={evaluate}
            onHistoryBack={historyBack}
            onHistoryForward={historyForward}
            onHistoryToLatest={historyToLatest}
            onOpenTerminal={() => setTerminalOpen(true)}
            pipelineMode={pipelineMode}
            onTogglePipelineMode={setPipelineMode}
            pseudocode={pseudocode}
            pseudocodeLoading={pseudocodeLoading}
            pseudocodeError={pseudocodeError}
            tidyResult={tidyResult}
            onApplyTidy={() => {
              if (!tidyResult) return;
              setNodesAndEdgesAuto(tidyResult.tidy.nodes, tidyResult.tidy.edges);
              fitViewTo(tidyResult.tidy.nodes, tidyResult.tidy.edges);
            }}
            beautifyParams={ruleSet.beautify.params}
            setBeautifyParams={(next) => setRuleSet((prev) => ({ ...prev, beautify: { ...prev.beautify, params: next } }))}
            beautifyResult={beautifyResult}
            beautifyLoading={beautifyLoading}
            beautifyError={beautifyError}
            onRefreshBeautify={() => setBeautifyRefreshToken((t) => t + 1)}
            onApplyBeautify={(mode) => {
              if (!beautifyResult) return;
              setNodesAuto(beautifyResult.layout.nodes);
              if ((mode ?? "nodes") === "nodes_edges") setEdgesAuto(beautifyResult.layout.edges);
              fitViewTo(beautifyResult.layout.nodes, (mode ?? "nodes") === "nodes_edges" ? beautifyResult.layout.edges : edges);
            }}
            canvasRoutingStyle={canvasRoutingStyle}
            setCanvasRoutingStyle={setCanvasRoutingStyle}
            ruleSet={ruleSet}
            setRuleSet={setRuleSet}
            experimentId={experiment?.id ?? ""}
          />
        </Sider>
      </Layout>

      <FloatingPopup
        open={!!selectedNode && nodeInspectorOpen}
        title="模块属性"
        anchorRect={nodeInspectorAnchorRect}
        initialSize={{ w: 320, h: 160 }}
        draggable={false}
        resizable={false}
        scrollable={false}
        onClose={() => setNodeInspectorOpen(false)}
      >
        {selectedNode ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <Text type="secondary">标题</Text>
              <Input
                size="small"
                value={selectedNode.title}
                onChange={(e) => {
                  updateNodeTitle(selectedNode.id, e.target.value);
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <Text type="secondary">代码行</Text>
              <Space size={8}>
                <Tag color="default" style={{ marginInlineEnd: 0 }}>
                  {selectedNode.sourceLine ? `第${selectedNode.sourceLine}行` : "（无）"}
                </Tag>
                <Button size="small" disabled={!selectedNode.sourceLine} onClick={() => setRevealLine(selectedNode.sourceLine ?? null)}>
                  跳到代码
                </Button>
              </Space>
            </div>
          </div>
        ) : null}
      </FloatingPopup>

      <TerminalPopup
        open={terminalOpen}
        stdout={runner.stdout}
        trace={runner.trace}
        error={runnerError ?? (runner.status === "error" ? runner.error ?? null : null)}
        onClose={() => setTerminalOpen(false)}
        onClear={clearOutput}
      />

    </div>
  );
};

export default PythonLabStudio;
