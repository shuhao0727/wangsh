import { useCallback, useEffect, useMemo, useRef } from "react";

import { showMessage } from "@/lib/toast";

import {
  createDebugCapabilityMapV1,
  applyDapNegotiatedCapabilities,
  applyDebugRunnerPolicy,
  type DebugCapabilityMapV1,
} from "../adapters/debugCapabilityMap";
import { resolveDebugFrontendMode, type DebugFrontendMode } from "../adapters/debugFrontendAdapter";
import { normalizeDebugSessionView } from "../adapters/debugSessionBridge";
import {
  launchPythonlabDebugAction,
  launchPythonlabRunAction,
  switchPythonlabRunner,
} from "../core/debugLaunchControl";
import type { DebugMap } from "../flow/debugMap";
import { decidePythonLabLaunchPlan } from "../launchPlan";
import { useDebug, type Breakpoint } from "../stores";
import type { DapCapabilities, RunnerState } from "./useDapRunner";
import { canUseSharedArrayBuffer, type PyodideTerminalBridge } from "./usePyodideRunner";
import { useUnifiedRunner } from "./useUnifiedRunner";
import type { TerminalConnectionState } from "../core/terminalReadiness";

type BreakpointUpdater = (prev: Breakpoint[]) => Breakpoint[];

export interface DebugSessionApi {
  breakpoints: Breakpoint[];
  debugMode: DebugFrontendMode;
  activeRunnerKind: "pyodide" | "dap";
  runnerView: RunnerState;
  runnerError: string | null;
  lastLaunchMode: "idle" | "run" | "debug";
  terminalBridge: PyodideTerminalBridge | null;
  debugCapabilities: DebugCapabilityMapV1;
  clearBreakpoints: () => void;
  resetSessionState: () => void;
  onRun: (stdinLines?: string[]) => void;
  onDebug: () => void;
  onContinue: () => void;
  onPause: () => void;
  onStepOver: () => void;
  onStepInto: () => void;
  onStepOut: () => void;
  onReset: () => void;
  onToggleBreakpoint: (line: number) => void;
  onSetBreakpointEnabled: (line: number, enabled: boolean) => void;
  onSetBreakpointCondition: (line: number, condition: string) => void;
  onSetBreakpointHitCount: (line: number, hitCount: number | null) => void;
  onAddWatch: (expr: string) => void;
  onRemoveWatch: (expr: string) => void;
  onEvaluate: (expr: string) => Promise<{ ok: boolean; value?: string; type?: string; error?: string }>;
  onHistoryBack: () => void;
  onHistoryForward: () => void;
  onHistoryToLatest: () => void;
  onClearPendingOutput: () => void;
  onTerminalConnection: (state: TerminalConnectionState) => void;
}

export function useDebugSession(params: {
  code: string;
  debugMap: DebugMap | null;
  pythonlabRuntime: string;
  recoveryScope?: string;
  hasPriorSession?: boolean;
}): DebugSessionApi {
  const { code, debugMap, pythonlabRuntime, recoveryScope, hasPriorSession } = params;
  const {
    breakpoints,
    activeRunnerKind,
    lastLaunchMode,
    lastDebugFallback,
    setActiveRunnerKind,
    setLastLaunchMode,
    setLastDebugFallback,
    updateBreakpoints: updateBreakpointsRaw,
  } = useDebug();

  const unified = useUnifiedRunner({ code, debugMap, activeKind: activeRunnerKind, recoveryScope });
  const {
    dap: dapApi,
    py: pyApi,
    active: activeApi,
    continueRun: continueUnifiedRun,
    pause: pauseUnifiedRun,
    stepOver: stepOverUnifiedRun,
    stepInto: stepIntoUnifiedRun,
    stepOut: stepOutUnifiedRun,
    resetAll: resetAllRunners,
    syncBreakpoints,
    syncWatchExprs,
    clearAllOutput,
    addWatch: addUnifiedWatch,
    removeWatch: removeUnifiedWatch,
    evaluate: evaluateOnUnifiedRunner,
    historyBack: historyBackOnUnifiedRunner,
    historyForward: historyForwardOnUnifiedRunner,
    historyToLatest: historyToLatestOnUnifiedRunner,
    clearPendingOutput: clearUnifiedPendingOutput,
  } = unified;
  const dapApiRef = useRef(dapApi);
  dapApiRef.current = dapApi;
  const pyApiRef = useRef(pyApi);
  pyApiRef.current = pyApi;
  const runClickLockUntilRef = useRef(0);
  const stoppingRemoteRef = useRef(false);
  const launchScopeRef = useRef(recoveryScope);
  launchScopeRef.current = recoveryScope;

  const updateBreakpoints = useCallback(
    (updater: BreakpointUpdater) => {
      updateBreakpointsRaw(updater);
    },
    [updateBreakpointsRaw]
  );

  useEffect(() => {
    syncBreakpoints(breakpoints);
  }, [breakpoints, syncBreakpoints]);

  const enabledBreakpointCount = useMemo(() => breakpoints.filter((b) => b.enabled).length, [breakpoints]);
  const activeState = activeApi?.state;
  const runnerError = (activeApi?.error as string | null) ?? null;
  const debugMode = useMemo(() => resolveDebugFrontendMode(), []);
  const runnerView = useMemo<RunnerState>(() => {
    const base = (activeState as Record<string, unknown> | null) ?? {};
    const baseWarnings = Array.isArray(base?.warnings) ? (base.warnings as string[]) : [];
    const warnings: string[] = [];
    if (lastDebugFallback) warnings.push(lastDebugFallback);
    if (enabledBreakpointCount > 0) warnings.push(...baseWarnings);
    return normalizeDebugSessionView({
      ...(base as Record<string, unknown>),
      breakpoints,
      warnings,
    } as RunnerState);
  }, [activeState, breakpoints, enabledBreakpointCount, lastDebugFallback]);

  const launchAfterRemoteStop = useCallback(async (launch: () => void) => {
    if (stoppingRemoteRef.current) return;
    const scope = launchScopeRef.current;
    const dap = dapApiRef.current;
    if (dap.state.sessionId || dap.state.status === "starting") {
      stoppingRemoteRef.current = true;
      try {
        await dap.stopDebug();
      } catch (reason) {
        showMessage.error(reason instanceof Error ? reason.message : "停止未确认，请重试");
        return;
      } finally {
        stoppingRemoteRef.current = false;
      }
    }
    if (launchScopeRef.current === scope) launch();
  }, []);

  const onRun = useCallback(
    (stdinLines: string[] = []) => {
      if (hasPriorSession) {
        showMessage.info("请先停止刷新前的调试会话");
        return;
      }
      const now = Date.now();
      if (now < runClickLockUntilRef.current) {
        showMessage.info("操作过快，请稍候再试");
        return;
      }

      runClickLockUntilRef.current = now + 800;
      void launchAfterRemoteStop(() => {
        setLastLaunchMode("run");
        setLastDebugFallback(null);

        const plan = decidePythonLabLaunchPlan({
          enabledBreakpointCount: 0,
          pythonlabRuntime,
          sourceCode: code,
          supportsPyodideStdin: canUseSharedArrayBuffer(),
        });
        setLastDebugFallback(plan.debugFallbackReason);

        switchPythonlabRunner({
          runnerKind: plan.runnerKind,
          setActiveRunnerKind,
          dapRunner: dapApiRef.current,
          pyRunner: pyApiRef.current,
        });
        launchPythonlabRunAction({
          runnerKind: plan.runnerKind,
          dapRunner: dapApiRef.current,
          pyRunner: pyApiRef.current,
          stdinLines,
        });
      });
    },
    [code, hasPriorSession, launchAfterRemoteStop, pythonlabRuntime, setActiveRunnerKind, setLastDebugFallback, setLastLaunchMode]
  );

  const onDebug = useCallback(() => {
    if (hasPriorSession) {
      showMessage.info("请先停止刷新前的调试会话");
      return;
    }
    const now = Date.now();
    if (now < runClickLockUntilRef.current) return;
    if (runnerView.status === "starting" || runnerView.status === "running") return;
    runClickLockUntilRef.current = now + 800;

    if (enabledBreakpointCount <= 0) {
      showMessage.warning("请先设置断点");
      return;
    }

    void launchAfterRemoteStop(() => {
      const plan = decidePythonLabLaunchPlan({
        enabledBreakpointCount,
        pythonlabRuntime,
      });

      setLastLaunchMode("debug");
      if (plan.debugFallbackReason) {
        showMessage.warning(plan.debugFallbackReason);
      }
      setLastDebugFallback(null);

      switchPythonlabRunner({
        runnerKind: plan.runnerKind,
        setActiveRunnerKind,
        dapRunner: dapApiRef.current,
        pyRunner: pyApiRef.current,
      });
      launchPythonlabDebugAction({
        runnerKind: plan.runnerKind,
        dapRunner: dapApiRef.current,
        breakpoints: breakpoints.map((bp) => ({ ...bp })),
        onDapFailure: () => {
          setLastLaunchMode("idle");
        },
      });
    });
  }, [
    breakpoints,
    enabledBreakpointCount,
    hasPriorSession,
    launchAfterRemoteStop,
    pythonlabRuntime,
    runnerView.status,
    setActiveRunnerKind,
    setLastDebugFallback,
    setLastLaunchMode,
  ]);

  const onContinue = useCallback(() => {
    void continueUnifiedRun();
  }, [continueUnifiedRun]);
  const onPause = useCallback(() => {
    void pauseUnifiedRun();
  }, [pauseUnifiedRun]);
  const onStepOver = useCallback(() => {
    void stepOverUnifiedRun();
  }, [stepOverUnifiedRun]);
  const onStepInto = useCallback(() => {
    void stepIntoUnifiedRun();
  }, [stepIntoUnifiedRun]);
  const onStepOut = useCallback(() => {
    void stepOutUnifiedRun();
  }, [stepOutUnifiedRun]);
  const onReset = useCallback(() => {
    if (stoppingRemoteRef.current) return;
    stoppingRemoteRef.current = true;
    void (async () => {
      try {
        await dapApiRef.current.stopDebug();
        pyApiRef.current.reset();
        setLastLaunchMode("idle");
        setLastDebugFallback(null);
      } catch (reason) {
        showMessage.error(reason instanceof Error ? reason.message : "停止未确认，请重试");
      } finally {
        stoppingRemoteRef.current = false;
      }
    })();
  }, [setLastDebugFallback, setLastLaunchMode]);

  const debugCapabilityBase = useMemo(() => createDebugCapabilityMapV1(debugMode), [debugMode]);
  const runnerPolicy = activeRunnerKind;
  const dapNegotiatedCapabilities = useMemo(() => {
    if (activeRunnerKind !== "dap") return null;
    return (dapApi?.state?.dapCapabilities ?? null) as DapCapabilities | null;
  }, [activeRunnerKind, dapApi]);

  const resolvedDebugCapabilities = useMemo(
    () => {
      const policyBase = applyDebugRunnerPolicy(debugCapabilityBase, runnerPolicy);
      return runnerPolicy === "dap" ? applyDapNegotiatedCapabilities(policyBase, dapNegotiatedCapabilities) : policyBase;
    },
    [dapNegotiatedCapabilities, debugCapabilityBase, runnerPolicy]
  );

  const onToggleBreakpoint = useCallback(
    (line: number) => {
      updateBreakpoints((prev) => {
        const idx = prev.findIndex((b) => b.line === line);
        return idx >= 0 ? prev.filter((b) => b.line !== line) : [...prev, { line, enabled: true }];
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
      updateBreakpoints((prev) => prev.map((b) => (b.line === line ? { ...b, condition } : b)));
    },
    [updateBreakpoints]
  );

  const onSetBreakpointHitCount = useCallback(
    (line: number, hitCount: number | null) => {
      updateBreakpoints((prev) => prev.map((b) => (b.line === line ? { ...b, hitCount: hitCount || undefined } : b)));
    },
    [updateBreakpoints]
  );

  const clearBreakpoints = useCallback(() => {
    updateBreakpoints(() => []);
  }, [updateBreakpoints]);

  const onAddWatch = useCallback((expr: string) => {
    Promise.resolve(addUnifiedWatch(expr)).catch(() => {});
  }, [addUnifiedWatch]);

  const onRemoveWatch = useCallback((expr: string) => {
    removeUnifiedWatch(expr);
  }, [removeUnifiedWatch]);

  const onEvaluate = useCallback((expr: string) => {
    return evaluateOnUnifiedRunner(expr);
  }, [evaluateOnUnifiedRunner]);

  const onHistoryBack = useCallback(() => {
    historyBackOnUnifiedRunner();
  }, [historyBackOnUnifiedRunner]);

  const onHistoryForward = useCallback(() => {
    historyForwardOnUnifiedRunner();
  }, [historyForwardOnUnifiedRunner]);

  const onHistoryToLatest = useCallback(() => {
    historyToLatestOnUnifiedRunner();
  }, [historyToLatestOnUnifiedRunner]);

  const onTerminalConnection = useCallback((state: TerminalConnectionState) => {
    dapApiRef.current.onTerminalConnection(state);
  }, []);

  const onClearPendingOutput = useCallback(() => {
    clearUnifiedPendingOutput();
  }, [clearUnifiedPendingOutput]);

  const resetSessionState = useCallback(() => {
    resetAllRunners();
    clearAllOutput();
    updateBreakpoints(() => []);
    syncWatchExprs([]);
    setActiveRunnerKind("pyodide");
    setLastLaunchMode("idle");
    setLastDebugFallback(null);
  }, [clearAllOutput, resetAllRunners, setActiveRunnerKind, setLastDebugFallback, setLastLaunchMode, syncWatchExprs, updateBreakpoints]);

  return {
    breakpoints,
    debugMode,
    activeRunnerKind,
    runnerView,
    runnerError,
    lastLaunchMode,
    terminalBridge: activeRunnerKind === "pyodide" ? pyApi.terminal : null,
    debugCapabilities: resolvedDebugCapabilities,
    clearBreakpoints,
    resetSessionState,
    onRun,
    onDebug,
    onContinue,
    onPause,
    onStepOver,
    onStepInto,
    onStepOut,
    onReset,
    onToggleBreakpoint,
    onSetBreakpointEnabled,
    onSetBreakpointCondition,
    onSetBreakpointHitCount,
    onAddWatch,
    onRemoveWatch,
    onEvaluate,
    onHistoryBack,
    onHistoryForward,
    onHistoryToLatest,
    onClearPendingOutput,
    onTerminalConnection,
  };
}
