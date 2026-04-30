import { createContext, useContext } from "react";
import type React from "react";

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

export const DebugCtx = createContext<DebugApi | null>(null);

export function useDebug(): DebugApi {
  const ctx = useContext(DebugCtx);
  if (!ctx) throw new Error("useDebug must be used within DebugProvider");
  return ctx;
}
