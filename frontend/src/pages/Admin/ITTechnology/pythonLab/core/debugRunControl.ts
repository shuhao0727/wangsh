import { pythonlabSessionApi } from "../services/pythonlabSessionApi";
import { DebugController } from "./DebugController";

export interface DebugEvalResult {
  ok: boolean;
  value?: string;
  type?: string;
  error?: string;
}

export interface DebugWatchResult extends DebugEvalResult {
  expr: string;
}

async function requestRunningTransition(params: {
  request: () => Promise<unknown>;
  onRunning: () => void;
}): Promise<void> {
  const { request, onRunning } = params;
  try {
    await request();
    onRunning();
  } catch {}
}

export async function continuePythonlabDebugSession(params: {
  client: DebugController;
  onRunning: () => void;
}): Promise<void> {
  await requestRunningTransition({
    request: () => params.client.continueRun(1),
    onRunning: params.onRunning,
  });
}

export async function stepPythonlabDebugSession(params: {
  client: DebugController;
  kind: "over" | "into" | "out";
  onRunning: () => void;
}): Promise<void> {
  const request =
    params.kind === "over"
      ? () => params.client.stepOver(1)
      : params.kind === "into"
        ? () => params.client.stepInto(1)
        : () => params.client.stepOut(1);
  await requestRunningTransition({ request, onRunning: params.onRunning });
}

export async function pausePythonlabDebugSession(params: {
  client: DebugController;
}): Promise<void> {
  try {
    await params.client.pauseRun(1);
  } catch {}
}

export async function evaluatePythonlabDebugExpression(params: {
  client: DebugController;
  expr: string;
  frameId: number | null | undefined;
  context?: "repl" | "watch";
}): Promise<DebugEvalResult> {
  const { client, expr, frameId, context = "repl" } = params;
  try {
    if (!frameId) {
      throw new Error("No active frame");
    }

    const resp = await client.evaluateExpression(expr, { frameId, context });
    return {
      ok: true,
      value: String(resp.body?.result ?? ""),
      type: String(resp.body?.type ?? ""),
    };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function addPythonlabWatchExpression(params: {
  client: DebugController;
  expr: string;
  watchExprs: string[];
  watchResults: DebugWatchResult[];
  status: string;
  topFrameId: number | null | undefined;
  setWatchExprs: (exprs: string[]) => void;
  setWatchResults: (results: DebugWatchResult[]) => void;
}): Promise<void> {
  const {
    client,
    expr,
    watchExprs,
    watchResults,
    status,
    topFrameId,
    setWatchExprs,
    setWatchResults,
  } = params;

  if (watchExprs.includes(expr)) return;

  setWatchExprs([...watchExprs, expr]);

  if (status !== "paused" || !topFrameId) return;

  const result = await evaluatePythonlabDebugExpression({
    client,
    expr,
    frameId: topFrameId,
    context: "watch",
  });

  setWatchResults([
    ...watchResults.filter((item) => item.expr !== expr),
    { expr, ...result },
  ]);
}

export function removePythonlabWatchExpression(params: {
  expr: string;
  watchExprs: string[];
  watchResults: DebugWatchResult[];
  setWatchExprs: (exprs: string[]) => void;
  setWatchResults: (results: DebugWatchResult[]) => void;
}): void {
  const { expr, watchExprs, watchResults, setWatchExprs, setWatchResults } = params;
  setWatchExprs(watchExprs.filter((item) => item !== expr));
  setWatchResults(watchResults.filter((item) => item.expr !== expr));
}

export async function stopPythonlabDebugSession(params: {
  client: DebugController;
  sessionId: string | null;
  shouldDisconnect: boolean;
  cleanup: () => void;
  clearTrackedSessionId: () => void;
  resetState: () => void;
}): Promise<void> {
  const { client, sessionId, shouldDisconnect, cleanup, clearTrackedSessionId, resetState } = params;

  if (shouldDisconnect) {
    try {
      await client.disconnectSession(1200);
    } catch {}
  }

  cleanup();

  if (sessionId) {
    try {
      await pythonlabSessionApi.stop(sessionId);
    } catch {}
  }

  clearTrackedSessionId();
  resetState();
}
