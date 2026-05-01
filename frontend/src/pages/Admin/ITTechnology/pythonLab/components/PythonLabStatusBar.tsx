import React from "react";
import { Loader2, Play, Pause, Square, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { DebugSessionStatus } from "../core/debugStateMachine";

type StatusBarState = {
  status: DebugSessionStatus;
  runnerKind: "pyodide" | "dap";
  lastLaunchMode: "idle" | "run" | "debug";
  elapsed?: number;
  error?: string | null;
  sourceMismatch?: boolean;
};

const STATUS_CONFIG: Record<DebugSessionStatus, { icon: React.ReactNode; label: string; className: string }> = {
  idle: {
    icon: <CheckCircle2 className="h-3 w-3" />,
    label: "就绪",
    className: "text-text-tertiary bg-surface-2",
  },
  starting: {
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    label: "启动中",
    className: "text-primary bg-primary-soft",
  },
  running: {
    icon: <Play className="h-3 w-3" />,
    label: "运行中",
    className: "text-success bg-success-soft",
  },
  paused: {
    icon: <Pause className="h-3 w-3" />,
    label: "已暂停",
    className: "text-warning bg-warning-soft",
  },
  stopped: {
    icon: <Square className="h-3 w-3" />,
    label: "已停止",
    className: "text-text-tertiary bg-surface-2",
  },
  error: {
    icon: <AlertTriangle className="h-3 w-3" />,
    label: "出错",
    className: "text-destructive bg-error-soft",
  },
};

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const PythonLabStatusBar: React.FC<{
  state: StatusBarState;
}> = ({ state }) => {
  const { status, runnerKind, lastLaunchMode, elapsed, error } = state;
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle;

  const modeLabel = lastLaunchMode === "debug" ? "调试" : lastLaunchMode === "run" ? "运行" : "";
  const kindLabel = runnerKind === "dap" ? "DAP" : "Pyodide";

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary border-b border-border-secondary"
      role="status"
    >
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.className}`}>
        {cfg.icon}
        {cfg.label}
      </span>
      {modeLabel && (
        <span className="text-text-tertiary">
          · {modeLabel} · {kindLabel}
        </span>
      )}
      {elapsed != null && status === "running" && (
        <span className="text-text-tertiary tabular-nums">{formatElapsed(elapsed)}</span>
      )}
      {error && (
        <span className="truncate text-destructive" title={error}>
          {error}
        </span>
      )}
    </div>
  );
};
