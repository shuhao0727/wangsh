import type { DebugFrontendMode } from "./debugFrontendAdapter";

export type DebugPauseEvent = {
  source: DebugFrontendMode;
  status: string | null;
  activeLine: number | null;
  activeFlowLine: number | null;
  activeNodeId: string | null;
  activeFocusRole: string | null;
  happenedAt: number;
};

export type DebugFlowActivation = {
  activeLine: number | null;
  activeNodeId: string | null;
  activeFocusRole: string | null;
  activeEnabled: boolean;
};

export function toDebugPauseEvent(params: { source: DebugFrontendMode; runner: any }): DebugPauseEvent | null {
  const { source, runner } = params;
  const status = typeof runner?.status === "string" ? runner.status : null;
  const activeLine = typeof runner?.activeLine === "number" ? runner.activeLine : null;
  const activeFlowLine = typeof runner?.activeFlowLine === "number" ? runner.activeFlowLine : null;
  const activeNodeId = typeof runner?.activeNodeId === "string" ? runner.activeNodeId : null;
  const activeFocusRole = typeof runner?.activeFocusRole === "string" ? runner.activeFocusRole : null;
  if (!activeNodeId && activeLine == null && activeFlowLine == null) return null;
  return {
    source,
    status,
    activeLine,
    activeFlowLine,
    activeNodeId,
    activeFocusRole,
    happenedAt: Date.now(),
  };
}

export function resolveFlowActivation(params: { event: DebugPauseEvent | null; runner: any }): DebugFlowActivation {
  const { event, runner } = params;
  const status = (event?.status ?? runner?.status ?? "").toString();
  return {
    activeLine:
      event?.activeFlowLine ??
      event?.activeLine ??
      (typeof runner?.activeFlowLine === "number" ? runner.activeFlowLine : null) ??
      (typeof runner?.activeLine === "number" ? runner.activeLine : null),
    activeNodeId:
      event?.activeNodeId ??
      (typeof runner?.activeNodeId === "string" ? runner.activeNodeId : null),
    activeFocusRole:
      event?.activeFocusRole ??
      (typeof runner?.activeFocusRole === "string" ? runner.activeFocusRole : null),
    activeEnabled: status === "paused" || status === "running",
  };
}
