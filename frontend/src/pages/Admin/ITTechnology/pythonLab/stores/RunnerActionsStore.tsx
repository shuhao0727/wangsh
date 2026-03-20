import React, { createContext, useContext } from "react";
import type { RunnerState } from "../hooks/useDapRunner";
import type { PyodideTerminalBridge } from "../hooks/usePyodideRunner";
import type { DebugCapabilityMapV1 } from "../adapters/debugCapabilityMap";
import type { FlowBeautifyResult } from "../flow/beautify";

export interface RunnerActionsApi {
  runner: RunnerState;
  runnerError: string | null;
  lastLaunchMode: "idle" | "run" | "debug";
  terminalBridge: PyodideTerminalBridge | null;
  debugCapabilities?: DebugCapabilityMapV1;
  onRun: (stdinLines?: string[]) => void;
  onDebug: () => void;
  onTerminalInput: (text: string) => void;
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
  beautifyResult: FlowBeautifyResult | null;
  beautifyLoading: boolean;
  beautifyError: string | null;
  onRefreshBeautify: () => void;
  autoOptimizeCode: boolean;
  setAutoOptimizeCode: (v: boolean) => void;
  onOptimizeCode: () => void;
}

const RunnerActionsCtx = createContext<RunnerActionsApi | null>(null);

export const RunnerActionsProvider = RunnerActionsCtx.Provider;

export function useRunnerActions(): RunnerActionsApi {
  const ctx = useContext(RunnerActionsCtx);
  if (!ctx) throw new Error("useRunnerActions must be used within RunnerActionsProvider");
  return ctx;
}
