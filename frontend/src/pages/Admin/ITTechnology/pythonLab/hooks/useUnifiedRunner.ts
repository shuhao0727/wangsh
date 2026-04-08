import { useCallback, useMemo, useRef } from "react";
import { useDapRunner } from "./useDapRunner";
import { usePyodideRunner } from "./usePyodideRunner";
import type { DebugMap } from "../flow/debugMap";

type Breakpoint = { line: number; enabled: boolean; condition?: string; hitCount?: number };

export type RunnerKind = "pyodide" | "dap";

export interface UnifiedRunnerApi {
  dap: ReturnType<typeof useDapRunner>;
  py: ReturnType<typeof usePyodideRunner>;
  active: ReturnType<typeof useDapRunner> | ReturnType<typeof usePyodideRunner>;
  activeKind: RunnerKind;

  continueRun: () => Promise<void> | void;
  pause: () => Promise<void> | void;
  stepOver: () => Promise<void> | void;
  stepInto: () => Promise<void> | void;
  stepOut: () => Promise<void> | void;
  resetAll: () => void;
  syncBreakpoints: (bps: Breakpoint[]) => void;
  syncWatchExprs: (exprs: string[]) => void;
  clearAllOutput: () => void;
  addWatch: (expr: string) => Promise<void> | void;
  removeWatch: (expr: string) => void;
  evaluate: (expr: string) => Promise<{ ok: boolean; value?: string; type?: string; error?: string }>;
  historyBack: () => void;
  historyForward: () => void;
  historyToLatest: () => void;
  clearPendingOutput: () => void;
}

export function useUnifiedRunner(params: {
  code: string;
  debugMap: DebugMap | null;
  activeKind: RunnerKind;
}): UnifiedRunnerApi {
  const { code, debugMap, activeKind } = params;
  const dap = useDapRunner({ code, debugMap });
  const py = usePyodideRunner({ code, debugMap });

  const active = activeKind === "dap" ? dap : py;
  const dapRef = useRef(dap);
  dapRef.current = dap;
  const pyRef = useRef(py);
  pyRef.current = py;
  const activeRef = useRef(active);
  activeRef.current = active;

  const continueRun = useCallback(() => activeRef.current?.continueRun?.(), []);
  const pause = useCallback(() => activeRef.current?.pause?.(), []);
  const stepOver = useCallback(() => activeRef.current?.stepOver?.(), []);
  const stepInto = useCallback(() => activeRef.current?.stepInto?.(), []);
  const stepOut = useCallback(() => activeRef.current?.stepOut?.(), []);

  const resetAll = useCallback(() => {
    dapRef.current.reset?.();
    pyRef.current.reset?.();
  }, []);

  const syncBreakpoints = useCallback((bps: Breakpoint[]) => {
    pyRef.current.setBreakpoints?.(bps);
    dapRef.current.setBreakpoints?.(bps);
  }, []);

  const syncWatchExprs = useCallback((exprs: string[]) => {
    dapRef.current.setWatchExprs?.(exprs);
    pyRef.current.setWatchExprs?.(exprs);
  }, []);

  const clearAllOutput = useCallback(() => {
    dapRef.current.clearOutput?.();
    pyRef.current.clearOutput?.();
  }, []);

  const addWatch = useCallback((expr: string) => activeRef.current?.addWatch?.(expr), []);
  const removeWatch = useCallback((expr: string) => activeRef.current?.removeWatch?.(expr), []);
  const evaluate = useCallback(
    (expr: string) => activeRef.current?.evaluate?.(expr) ?? Promise.resolve({ ok: false as const, error: "当前运行器不支持求值" }),
    []
  );
  const historyBack = useCallback(() => activeRef.current?.historyBack?.(), []);
  const historyForward = useCallback(() => activeRef.current?.historyForward?.(), []);
  const historyToLatest = useCallback(() => activeRef.current?.historyToLatest?.(), []);
  const clearPendingOutput = useCallback(() => {
    (activeRef.current as { clearPendingOutput?: () => void } | null)?.clearPendingOutput?.();
  }, []);

  return useMemo(
    () => ({
      dap,
      py,
      active,
      activeKind,
      continueRun,
      pause,
      stepOver,
      stepInto,
      stepOut,
      resetAll,
      syncBreakpoints,
      syncWatchExprs,
      clearAllOutput,
      addWatch,
      removeWatch,
      evaluate,
      historyBack,
      historyForward,
      historyToLatest,
      clearPendingOutput,
    }),
    [
      dap,
      py,
      active,
      activeKind,
      continueRun,
      pause,
      stepOver,
      stepInto,
      stepOut,
      resetAll,
      syncBreakpoints,
      syncWatchExprs,
      clearAllOutput,
      addWatch,
      removeWatch,
      evaluate,
      historyBack,
      historyForward,
      historyToLatest,
      clearPendingOutput,
    ]
  );
}
