import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

export type Breakpoint = { line: number; enabled: boolean; condition?: string; hitCount?: number };

export interface DebugApi {
  breakpoints: Breakpoint[];
  activeRunnerKind: "pyodide" | "dap";
  lastLaunchMode: "idle" | "run" | "debug";
  lastDebugFallback: string | null;
  setBreakpoints: React.Dispatch<React.SetStateAction<Breakpoint[]>>;
  setActiveRunnerKind: React.Dispatch<React.SetStateAction<"pyodide" | "dap">>;
  setLastLaunchMode: React.Dispatch<React.SetStateAction<"idle" | "run" | "debug">>;
  setLastDebugFallback: React.Dispatch<React.SetStateAction<string | null>>;
  updateBreakpoints: (updater: (prev: Breakpoint[]) => Breakpoint[]) => void;
}

const DebugCtx = createContext<DebugApi | null>(null);

export function DebugProvider({ children }: { children: React.ReactNode }) {
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([]);
  const [activeRunnerKind, setActiveRunnerKind] = useState<"pyodide" | "dap">("pyodide");
  const [lastLaunchMode, setLastLaunchMode] = useState<"idle" | "run" | "debug">("idle");
  const [lastDebugFallback, setLastDebugFallback] = useState<string | null>(null);

  const updateBreakpoints = useCallback(
    (updater: (prev: Breakpoint[]) => Breakpoint[]) => {
      setBreakpoints((prev) => {
        const next = updater(prev);
        return next.slice().sort((a, b) => a.line - b.line);
      });
    },
    []
  );

  const api = useMemo<DebugApi>(
    () => ({
      breakpoints, activeRunnerKind, lastLaunchMode, lastDebugFallback,
      setBreakpoints, setActiveRunnerKind, setLastLaunchMode, setLastDebugFallback,
      updateBreakpoints,
    }),
    [breakpoints, activeRunnerKind, lastLaunchMode, lastDebugFallback, updateBreakpoints]
  );

  return <DebugCtx.Provider value={api}>{children}</DebugCtx.Provider>;
}

export function useDebug(): DebugApi {
  const ctx = useContext(DebugCtx);
  if (!ctx) throw new Error("useDebug must be used within DebugProvider");
  return ctx;
}
