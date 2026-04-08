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
  const py = usePyodideRunner({ code });

  const active = activeKind === "dap" ? dap : py;
  const dapRef = useRef(dap);
  dapRef.current = dap;
  const pyRef = useRef(py);
  pyRef.current = py;

  const continueRun = useCallback(() => {
    if (activeKind !== "dap") return;
    return dapRef.current?.continueRun?.();
  }, [activeKind]);
  const pause = useCallback(() => {
    if (activeKind !== "dap") return;
    return dapRef.current?.pause?.();
  }, [activeKind]);
  const stepOver = useCallback(() => {
    if (activeKind !== "dap") return;
    return dapRef.current?.stepOver?.();
  }, [activeKind]);
  const stepInto = useCallback(() => {
    if (activeKind !== "dap") return;
    return dapRef.current?.stepInto?.();
  }, [activeKind]);
  const stepOut = useCallback(() => {
    if (activeKind !== "dap") return;
    return dapRef.current?.stepOut?.();
  }, [activeKind]);

  const resetAll = useCallback(() => {
    dapRef.current.reset?.();
    pyRef.current.reset?.();
  }, []);

  const syncBreakpoints = useCallback((bps: Breakpoint[]) => {
    dapRef.current.setBreakpoints?.(bps);
  }, []);

  const syncWatchExprs = useCallback((exprs: string[]) => {
    dapRef.current.setWatchExprs?.(exprs);
  }, []);

  const clearAllOutput = useCallback(() => {
    dapRef.current.clearOutput?.();
    pyRef.current.clearOutput?.();
  }, []);

  const addWatch = useCallback((expr: string) => {
    if (activeKind !== "dap") return;
    return dapRef.current?.addWatch?.(expr);
  }, [activeKind]);
  const removeWatch = useCallback((expr: string) => {
    if (activeKind !== "dap") return;
    return dapRef.current?.removeWatch?.(expr);
  }, [activeKind]);
  const evaluate = useCallback(
    (expr: string) => {
      if (activeKind !== "dap") {
        return Promise.resolve({ ok: false as const, error: "当前运行模式不支持调试求值" });
      }
      return dapRef.current?.evaluate?.(expr) ?? Promise.resolve({ ok: false as const, error: "调试器未就绪" });
    },
    [activeKind]
  );
  const historyBack = useCallback(() => {
    if (activeKind !== "dap") return;
    return dapRef.current?.historyBack?.();
  }, [activeKind]);
  const historyForward = useCallback(() => {
    if (activeKind !== "dap") return;
    return dapRef.current?.historyForward?.();
  }, [activeKind]);
  const historyToLatest = useCallback(() => {
    if (activeKind !== "dap") return;
    return dapRef.current?.historyToLatest?.();
  }, [activeKind]);
  const clearPendingOutput = useCallback(() => {
    if (activeKind !== "dap") return;
    (dapRef.current as { clearPendingOutput?: () => void } | null)?.clearPendingOutput?.();
  }, [activeKind]);

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
