import { useCallback, useMemo } from "react";
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

  continueRun: () => void;
  pause: () => void;
  stepOver: () => void;
  stepInto: () => void;
  stepOut: () => void;
  resetAll: () => void;
  syncBreakpoints: (bps: Breakpoint[]) => void;
  syncWatchExprs: (exprs: string[]) => void;
  clearAllOutput: () => void;
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

  const continueRun = useCallback(() => { active?.continueRun?.(); }, [active]);
  const pause = useCallback(() => { active?.pause?.(); }, [active]);
  const stepOver = useCallback(() => { active?.stepOver?.(); }, [active]);
  const stepInto = useCallback(() => { active?.stepInto?.(); }, [active]);
  const stepOut = useCallback(() => { active?.stepOut?.(); }, [active]);

  const resetAll = useCallback(() => {
    dap.reset?.();
    py.reset?.();
  }, [dap, py]);

  const syncBreakpoints = useCallback((bps: Breakpoint[]) => {
    py.setBreakpoints?.(bps);
    dap.setBreakpoints?.(bps);
  }, [dap, py]);

  const syncWatchExprs = useCallback((exprs: string[]) => {
    dap.setWatchExprs?.(exprs);
    py.setWatchExprs?.(exprs);
  }, [dap, py]);

  const clearAllOutput = useCallback(() => {
    dap.clearOutput?.();
    py.clearOutput?.();
  }, [dap, py]);

  return useMemo(
    () => ({ dap, py, active, activeKind, continueRun, pause, stepOver, stepInto, stepOut, resetAll, syncBreakpoints, syncWatchExprs, clearAllOutput }),
    [dap, py, active, activeKind, continueRun, pause, stepOver, stepInto, stepOut, resetAll, syncBreakpoints, syncWatchExprs, clearAllOutput]
  );
}

