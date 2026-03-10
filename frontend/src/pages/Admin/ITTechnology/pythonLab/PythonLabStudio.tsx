import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App, Button, Card, Grid, Input, Layout, Space, Tag, Typography } from "antd";
import type { PythonLabExperiment } from "./types";
import { normalizeFlowImport, type FlowEdge, type FlowNode, type PortSide } from "./flow/model";
import { calculateFitView, calculateFitViewCenter } from "./flow/viewUtils";
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
import { usePyodideRunner } from "./hooks/usePyodideRunner";
import { computeBeautify, type FlowBeautifyResult } from "./flow/beautify";
import { sortFlowGraphStable } from "./flow/determinism";
import { loadEffectiveRuleSetV1, type PythonLabRuleSetV1 } from "./pipeline/rules";
import { ensurePythonLabStorageCompatible } from "./storageCompat";
import { toErrorMessage } from "./errorMessage";
import { decidePythonLabLaunchPlan } from "./launchPlan";
import { createDebugFrontendAdapter } from "./adapters/debugFrontendAdapter";
import { resolveFlowActivation, toDebugPauseEvent } from "./adapters/debugEventBridge";
import { normalizeDebugSessionView } from "./adapters/debugSessionBridge";
import { applyDapNegotiatedCapabilities } from "./adapters/debugCapabilityMap";
import { pythonlabSessionApi } from "./services/pythonlabSessionApi";

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
  const screens = Grid.useBreakpoint();
  const isCompactViewport = !screens.sm;
  const { message } = App.useApp();

  useEffect(() => {
    console.log("PythonLabStudio mounted - HMR Check");
    message.info("PythonLab环境已就绪");
    ensurePythonLabStorageCompatible();
  }, []);
  const [ruleSet, setRuleSet] = useState<PythonLabRuleSetV1>(() => loadEffectiveRuleSetV1(experiment?.id ?? ""));
  const [beautifyResult, setBeautifyResult] = useState<FlowBeautifyResult | null>(null);
  const [beautifyLoading, setBeautifyLoading] = useState(false);
  const [beautifyError, setBeautifyError] = useState<string | null>(null);
  const [beautifyRefreshToken, setBeautifyRefreshToken] = useState(0);
  const [canvasRoutingStyle] = useState<"orthogonal" | "direct">(() => {
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
  const [autoLayout, setAutoLayout] = useState(false);

  const pythonlabRuntime = ((process.env.REACT_APP_PYTHONLAB_RUNTIME || "pyodide") + "").toLowerCase();
  const canFrontendDebug = useMemo(() => {
    try {
      return typeof window !== "undefined" && (window as any).crossOriginIsolated === true && typeof SharedArrayBuffer !== "undefined";
    } catch {
      return false;
    }
  }, []);

  const arrangeLayoutRef = useRef<null | (() => Promise<void>)>(null);

  const fitViewTo = (nextNodes: FlowNode[], nextEdges: FlowEdge[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const result = calculateFitView(nextNodes, nextEdges, rect.width, rect.height);
    if (result) {
      setScale(result.scale);
      setOffsetX(result.offsetX);
      setOffsetY(result.offsetY);
    }
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
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  useEffect(() => {
    let warnedThirdPartySelection = false;
    const shouldSuppressSelectionNoise = (msg: string, name: string, stack: string, file: string) => {
      const normalizedMessage = `${msg}\n${stack}`.toLowerCase();
      const isIndexSize =
        name === "IndexSizeError" ||
        normalizedMessage.includes("indexsizeerror") ||
        normalizedMessage.includes("the index is not in the allowed range");
      const isGetRangeAt =
        normalizedMessage.includes("getrangeat") ||
        normalizedMessage.includes("selection") ||
        normalizedMessage.includes("domexception");
      const isLikelyExternal =
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
      const isLikelySelectionNoise = normalizedMessage.includes("range 0") || normalizedMessage.includes("selection");
      return isIndexSize && isGetRangeAt && (isLikelyExternal || isLikelySelectionNoise);
    };
    const onError = (event: ErrorEvent) => {
      const msg = String(event.message || "");
      const name = (event.error as any)?.name ? String((event.error as any).name) : "";
      const stack = (event.error as any)?.stack ? String((event.error as any).stack) : "";
      const file = (event as any)?.filename ? String((event as any).filename) : "";
      if (shouldSuppressSelectionNoise(msg, name, stack, file)) {
        if (!warnedThirdPartySelection) {
          warnedThirdPartySelection = true;
          console.info("检测到可能来自浏览器插件/注入脚本的 Selection(IndexSizeError) 噪音错误，已在页面层面忽略。");
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        event.stopPropagation();
        (event as any).returnValue = true;
        return true;
      }
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason: any = (event as any)?.reason;
      const msg = reason ? String(reason?.message || reason) : "";
      const name = reason?.name ? String(reason.name) : "";
      const stack = reason?.stack ? String(reason.stack) : "";
      if (shouldSuppressSelectionNoise(msg, name, stack, "")) {
        if (!warnedThirdPartySelection) {
          warnedThirdPartySelection = true;
          console.info("检测到可能来自浏览器插件/注入脚本的 Selection(IndexSizeError) 噪音错误，已在页面层面忽略。");
        }
        event.preventDefault();
        return;
      }
    };
    const prevOnError = window.onerror;
    window.onerror = (message, source, _lineno, _colno, error) => {
      const msg = String(message || "");
      const name = error?.name ? String(error.name) : "";
      const stack = error?.stack ? String(error.stack) : "";
      const file = String(source || "");
      if (shouldSuppressSelectionNoise(msg, name, stack, file)) {
        return true;
      }
      if (typeof prevOnError === "function") {
        return !!prevOnError(message, source, _lineno, _colno, error);
      }
      return false;
    };
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onUnhandledRejection, true);
    return () => {
      window.onerror = prevOnError;
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onUnhandledRejection, true);
    };
  }, []);

  const { code, setCode, codeMode, setCodeMode, codeIr, generated, debugMap, flowDiagnostics, flowExpandFunctions, setFlowExpandFunctions, rebuildFlowFromCode } = usePythonFlowSync({
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

  const {
    ensureAuto,
    setNodesAuto,
    setEdgesAuto,
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
    if (isCompactViewport) {
      setLeftCollapsed(true);
    }
  }, [isCompactViewport]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if ((e as any).isComposing || (e as any).keyCode === 229) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.(".monaco-editor")) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT" || active.isContentEditable)) return;
      if (!selectedEdgeId && !selectedNodeId) return;
      e.preventDefault();
      removeSelected();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [removeSelected, selectedEdgeId, selectedNodeId]);

  const dapApi = useDapRunner({ code, debugMap });
  const pyApi = usePyodideRunner({ code, debugMap });

  const [breakpoints, setBreakpoints] = useState<Array<{ line: number; enabled: boolean; condition?: string; hitCount?: number }>>([]);
  const [activeRunnerKind, setActiveRunnerKind] = useState<"pyodide" | "dap">("pyodide");
  const [lastLaunchMode, setLastLaunchMode] = useState<"idle" | "run" | "debug">("idle");
  const [lastDebugFallback, setLastDebugFallback] = useState<string | null>(null);

  const updateBreakpoints = useCallback(
    (updater: (prev: Array<{ line: number; enabled: boolean; condition?: string; hitCount?: number }>) => Array<{ line: number; enabled: boolean; condition?: string; hitCount?: number }>) => {
      setBreakpoints((prev) => {
        const next = updater(prev);
        const sorted = next.slice().sort((a, b) => a.line - b.line);
        (pyApi as any).setBreakpoints?.(sorted);
        (dapApi as any).setBreakpoints?.(sorted);
        return sorted;
      });
    },
    [dapApi, pyApi]
  );

  const enabledBreakpointCount = useMemo(() => breakpoints.filter((b) => b.enabled).length, [breakpoints]);

  const activeApi = activeRunnerKind === "pyodide" ? (pyApi as any) : (dapApi as any);
  const runnerError = (activeApi?.error as string | null) ?? null;
  const runner = useMemo(() => {
    const base = (activeApi?.state as any) ?? {};
    const baseWarnings = Array.isArray(base?.warnings) ? base.warnings : [];
    const warnings: string[] = [];
    if (lastDebugFallback) warnings.push(lastDebugFallback);
    if (enabledBreakpointCount > 0) warnings.push(...baseWarnings);
    return { ...base, breakpoints, warnings };
  }, [activeApi, breakpoints, enabledBreakpointCount, lastDebugFallback, lastLaunchMode]);
  const runnerView = useMemo(() => normalizeDebugSessionView(runner), [runner]);

  const needsStdin = useMemo(() => /\binput\s*\(/.test(code), [code]);

  useEffect(() => {
    try {
      setRuleSet(loadEffectiveRuleSetV1(experiment?.id ?? ""));
    } catch {}
  }, [experiment?.id]);

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
  }, [beautifyRefreshToken, edges, nodes, ruleSet.beautify.alignMode, ruleSet.beautify.params, ruleSet.beautify.thresholds]);

  const fitViewToCenter = useCallback(
    (nextNodes: FlowNode[], nextEdges: FlowEdge[]) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const result = calculateFitViewCenter(nextNodes, nextEdges, rect.width, rect.height);
      if (result) {
        setScale(result.scale);
        setOffsetX(result.offsetX);
        setOffsetY(result.offsetY);
      }
    },
    [setOffsetX, setOffsetY, setScale]
  );

  // Removed auto-open terminal effect since it is now embedded in RightPanel
  const resetTokenRef = useRef<string>("");
  const runClickLockUntilRef = useRef(0);

  useEffect(() => {
    const token = `${experiment?.id ?? ""}|${typeof experiment?.starterCode === "string" ? experiment.starterCode : ""}`;
    if (resetTokenRef.current === token) return;
    resetTokenRef.current = token;

    (dapApi as any).reset?.();
    (pyApi as any).reset?.();
    (dapApi as any).clearOutput?.();
    (pyApi as any).clearOutput?.();
    updateBreakpoints(() => []);
    (dapApi as any).setWatchExprs?.([]);
    (pyApi as any).setWatchExprs?.([]);
    setActiveRunnerKind("pyodide");
    setLastLaunchMode("idle");
    setLastDebugFallback(null);
    
    setRevealLine(null);
    setFlowAuto({ nodes: [], edges: [], resetSelection: true, resetConnect: true, resetVariables: true });
    setPanMode(false);
    setFollowMode(true);
    setNodeInspectorOpen(false);

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
  }, [dapApi, experiment?.id, experiment?.starterCode, fitViewToCenter, peekDemoFlow, pyApi, ruleSet.beautify.alignMode, ruleSet.beautify.params, ruleSet.beautify.thresholds, setCode, setCodeMode, setFlowAuto, updateBreakpoints]);

  const onRun = useCallback(
    (_stdinLines: string[] = []) => {
      // Idempotency: relying on runner status is better than ad-hoc lock for logic,
      // but lock is good for debounce.
      const now = Date.now();
      if (now < runClickLockUntilRef.current) {
        message.info("操作过快，请稍候再试");
        return;
      }
      
      // Auto-restart logic: If running or starting, stop first then restart
      const isRestart = runner.status === "starting" || runner.status === "running" || runner.status === "paused";
      if (isRestart) {
        console.log("Auto-restarting session...");
        // If it's DAP, we might need to stop it explicitly if we want clean restart,
        // but runner.runPlain/startDebug handles internal state reset.
        // However, stopping the previous session on backend is good practice to free resources.
        if (runner.sessionId) {
           pythonlabSessionApi.stop(runner.sessionId).catch(() => {});
        }
        // We don't return here, we proceed to start new run which will overwrite state
      }
      
      // Set lock to prevent double-clicks
      runClickLockUntilRef.current = now + 800;

      setLastLaunchMode("run");
      setLastDebugFallback(null);

      const plan = decidePythonLabLaunchPlan({ enabledBreakpointCount: 0, pythonlabRuntime, canFrontendDebug, needsStdin });

      // Clean logic: just call the runner. The runner handles tokens and status updates.
      if (plan.runnerKind === "dap") {
        setActiveRunnerKind("dap");
        (pyApi as any).reset?.();
        const run = (dapApi as any).runPlain;
        if (typeof run !== "function") {
          message.error("运行器未就绪，请刷新页面后重试");
          return;
        }
        // No need for extra Promise wrapper, but catching is good practice
        Promise.resolve(run()).catch((e: any) => {
          // If the runner threw a "starting" error (idempotency), we can ignore or show info.
          // But we expect runner to throw specific errors.
          // If it's the "start in flight" error, we can suppress or show info.
          const msg = e?.message || "启动运行失败";
          if (msg.includes("会话正在启动中")) {
             // If we just triggered a restart, this might happen if user spam clicks
             message.info(msg);
          } else {
             message.error(msg);
          }
        });
        return;
      }
      
      setActiveRunnerKind("pyodide");
      const dapStatus = (dapApi as any)?.state?.status;
      if (dapStatus === "starting" || dapStatus === "running" || dapStatus === "paused") {
        Promise.resolve((dapApi as any).stopDebug?.()).catch(() => {});
      }
      const run = (pyApi as any).runPlain;
      if (typeof run !== "function") {
        message.error("前端运行器未就绪，请刷新页面后重试");
        return;
      }
      Promise.resolve(run()).catch((e: any) => {
          const msg = e?.message || "启动运行失败";
          if (msg.includes("会话正在启动中")) {
             message.info(msg);
          } else {
             message.error(msg);
          }
      });
    },
    [canFrontendDebug, dapApi, needsStdin, pyApi, pythonlabRuntime, runner.sessionId, runner.status, message]
  );

  const onDebug = useCallback(() => {
    const now = Date.now();
    if (now < runClickLockUntilRef.current) return;
    if (runner.status === "starting" || runner.status === "running") return;
    runClickLockUntilRef.current = now + 800;

    if (enabledBreakpointCount <= 0) {
      message.warning("请先设置断点");
      return;
    }

    const plan = decidePythonLabLaunchPlan({ enabledBreakpointCount, pythonlabRuntime, canFrontendDebug, needsStdin });
    if (plan.mode !== "debug" && plan.debugFallbackReason) {
      message.warning(plan.debugFallbackReason);
      return;
    }

    setLastLaunchMode("debug");
    setLastDebugFallback(null);

    // Force DAP for debug
    setActiveRunnerKind("dap");
    (pyApi as any).reset?.();
    Promise.resolve((dapApi as any).startDebug?.()).catch((e: any) => {
      message.error(e?.message || "启动调试失败");
    });
  }, [enabledBreakpointCount, pythonlabRuntime, canFrontendDebug, needsStdin, dapApi, pyApi, runner.status, message]);

  const onContinue = useCallback(() => {
    activeApi?.continueRun?.();
  }, [activeApi]);
  const onPause = useCallback(() => {
    activeApi?.pause?.();
  }, [activeApi]);
  const onStepOver = useCallback(() => {
    activeApi?.stepOver?.();
  }, [activeApi]);
  const onStepInto = useCallback(() => {
    activeApi?.stepInto?.();
  }, [activeApi]);
  const onStepOut = useCallback(() => {
    activeApi?.stepOut?.();
  }, [activeApi]);
  const onReset = useCallback(() => {
    (dapApi as any).reset?.();
    (pyApi as any).reset?.();
    setLastLaunchMode("idle");
    setLastDebugFallback(null);
  }, [dapApi, pyApi]);

  const debugFrontendAdapter = useMemo(
    () =>
      createDebugFrontendAdapter({
        run: onRun,
        debug: onDebug,
        continueRun: onContinue,
        pause: onPause,
        stepOver: onStepOver,
        stepInto: onStepInto,
        stepOut: onStepOut,
        reset: onReset,
      }),
    [onContinue, onDebug, onPause, onReset, onRun, onStepInto, onStepOut, onStepOver]
  );
  const dapNegotiatedCapabilities = useMemo(() => {
    if (activeRunnerKind !== "dap") return null;
    return ((dapApi as any)?.state?.dapCapabilities ?? null) as any;
  }, [activeRunnerKind, dapApi]);
  const resolvedDebugCapabilities = useMemo(
    () => applyDapNegotiatedCapabilities(debugFrontendAdapter.capabilities, dapNegotiatedCapabilities),
    [dapNegotiatedCapabilities, debugFrontendAdapter.capabilities]
  );
  const debugPauseEvent = useMemo(
    () => toDebugPauseEvent({ source: debugFrontendAdapter.mode, runner: runnerView }),
    [debugFrontendAdapter.mode, runnerView]
  );
  const flowActivation = useMemo(
    () => resolveFlowActivation({ event: debugPauseEvent, runner: runnerView }),
    [debugPauseEvent, runnerView]
  );

  const onToggleBreakpoint = useCallback(
    (line: number) => {
      updateBreakpoints((prev) => {
        const idx = prev.findIndex((b) => b.line === line);
        const next = idx >= 0 ? prev.filter((b) => b.line !== line) : [...prev, { line, enabled: true }];
        return next;
      });
    },
    [updateBreakpoints]
  );

  const onSetBreakpointEnabled = useCallback(
    (line: number, enabled: boolean) => {
      updateBreakpoints((prev) => prev.map((b) => (b.line === line ? { ...b, enabled } : b)));
    },
    [updateBreakpoints]
  );
  const onSetBreakpointCondition = useCallback(
    (line: number, condition: string) => {
      updateBreakpoints((prev) => prev.map((b) => (b.line === line ? { ...b, condition: condition || undefined } : b)));
    },
    [updateBreakpoints]
  );
  const onSetBreakpointHitCount = useCallback(
    (line: number, hitCount: number | null) => {
      updateBreakpoints((prev) => prev.map((b) => (b.line === line ? { ...b, hitCount: typeof hitCount === "number" ? hitCount : undefined } : b)));
    },
    [updateBreakpoints]
  );

  const followKey = useMemo(() => {
    const nodeId = runner.activeNodeId ?? "";
    const line = runner.activeLine ?? revealLine ?? null;
    const role = runner.activeFocusRole ?? "";
    return `${nodeId}|${line ?? ""}|${role}`;
  }, [revealLine, runner.activeFocusRole, runner.activeLine, runner.activeNodeId]);

  useEffect(() => {
    if (!followMode) return;
    if (!canvasRef.current) return;
    const [nodeIdRaw, lineStr, roleRaw] = followKey.split("|");
    const nodeId = nodeIdRaw || null;
    const line = lineStr ? Number(lineStr) : null;
    const focusRole = roleRaw || null;
    if (!nodeId && !line) return;
    const matchesLine = (n: any) => {
      if (!line) return false;
      const r = n?.sourceRange;
      if (r && Number.isFinite(r.startLine) && Number.isFinite(r.endLine)) {
        return line >= r.startLine && line <= r.endLine;
      }
      return n.sourceLine === line;
    };
    const byId = nodeId ? nodes.filter((n: any) => n.id === nodeId) : [];
    const byRole = !byId.length && line && focusRole ? nodes.filter((n: any) => matchesLine(n) && n.sourceRole === focusRole) : [];
    const targets = byId.length ? byId : byRole.length ? byRole : line ? nodes.filter((n: any) => matchesLine(n)) : [];
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
      <Layout style={{ background: "transparent", height: "100%", flexDirection: isCompactViewport ? "column" : "row" }}>
        <Sider
          width={isCompactViewport ? "100%" : 250}
          collapsedWidth={0}
          collapsible
          collapsed={leftCollapsed}
          trigger={null}
          theme="light"
          style={{
            background: "transparent",
            height: isCompactViewport ? "auto" : "100%",
            overflow: "hidden",
            borderRight: isCompactViewport ? "none" : "1px solid var(--ws-color-border-secondary)",
            borderBottom: isCompactViewport && !leftCollapsed ? "1px solid var(--ws-color-border-secondary)" : "none",
          }}
        >
          <div style={{ height: "100%" }}>
            <TemplatePalette basic={basicTemplates} advanced={advancedTemplates} onAddNode={addNode} />
          </div>
        </Sider>

        <Content style={{ padding: isCompactViewport ? "8px 0 0 0" : "0 0 0 16px", height: "100%", overflow: "hidden" }}>
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
                    updateBreakpoints(() => []);
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
            style={{ borderRadius: "var(--ws-radius-lg)", height: "100%", display: "flex", flexDirection: "column", boxShadow: "none", border: "1px solid var(--ws-color-border)" }}
            styles={{ body: { padding: 0, flex: 1, minHeight: 0 }, header: { padding: "0 16px", minHeight: 48, borderBottom: "1px solid var(--ws-color-border-secondary)" } }}
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
                activeNodeId={flowActivation.activeNodeId}
                activeLine={flowActivation.activeLine}
                activeFocusRole={flowActivation.activeFocusRole}
                activeEnabled={flowActivation.activeEnabled}
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

        <Sider
          width={isCompactViewport ? "100%" : 440}
          theme="light"
          style={{ background: "transparent", height: isCompactViewport ? "42vh" : "100%", overflow: "hidden" }}
        >
          <RightPanel
            generated={generated}
            code={code}
            setCode={setCode}
            codeMode={codeMode}
            setCodeMode={setCodeMode}
            revealLine={revealLine}
            variableColumns={variableColumns}
            runner={runnerView}
            debugCapabilities={resolvedDebugCapabilities}
            runnerError={runnerError}
            lastLaunchMode={lastLaunchMode}
            terminalBridge={activeRunnerKind === "pyodide" ? (pyApi as any).terminal : null}
            flowDiagnostics={flowDiagnostics}
            flowExpandFunctions={flowExpandFunctions}
            setFlowExpandFunctions={setFlowExpandFunctions}
            onRebuildFlowFromCode={rebuildFlowFromCode}
            onRun={debugFrontendAdapter.run}
            onDebug={debugFrontendAdapter.debug}
            onTerminalInput={() => { }}
            onContinue={debugFrontendAdapter.continueRun}
            onPause={debugFrontendAdapter.pause}
            onStepOver={debugFrontendAdapter.stepOver}
            onStepInto={debugFrontendAdapter.stepInto}
            onStepOut={debugFrontendAdapter.stepOut}
            onReset={debugFrontendAdapter.reset}
            onToggleBreakpoint={onToggleBreakpoint}
            onSetBreakpointEnabled={onSetBreakpointEnabled}
            onSetBreakpointCondition={onSetBreakpointCondition}
            onSetBreakpointHitCount={onSetBreakpointHitCount}
            onAddWatch={(expr) => activeApi?.addWatch?.(expr)}
            onRemoveWatch={(expr) => activeApi?.removeWatch?.(expr)}
            onEvaluate={(expr) =>
              typeof activeApi?.evaluate === "function"
                ? activeApi.evaluate(expr)
                : Promise.resolve({ ok: false, error: "当前运行器不支持求值" })
            }
            onHistoryBack={() => activeApi?.historyBack?.()}
            onHistoryForward={() => activeApi?.historyForward?.()}
            onHistoryToLatest={() => activeApi?.historyToLatest?.()}
            beautifyResult={beautifyResult}
            beautifyLoading={beautifyLoading}
            beautifyError={beautifyError}
            onRefreshBeautify={() => setBeautifyRefreshToken((t) => t + 1)}
            onClearPendingOutput={() => activeApi?.clearPendingOutput?.()}
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
                id="pythonlab-node-title-input"
                name="pythonlab-node-title-input"
                aria-label="节点标题"
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

    </div>
  );
};

export default PythonLabStudio;
