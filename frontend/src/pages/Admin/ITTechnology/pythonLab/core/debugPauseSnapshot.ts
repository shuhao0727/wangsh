import { computeDebugNodeSelection, type DebugMap } from "../flow/debugMap";
import { diffVarTrace } from "../hooks/varTrace";
import { DebugController } from "./DebugController";

type TraceLifecycle = (phase: string, extra?: Record<string, unknown>) => void;

type DapStackFrame = {
  id: number;
  name: string;
  line: number;
  source?: { path?: string };
};

type DapScope = {
  name: string;
  variablesReference: number;
};

type DapVariable = {
  name: string;
  value: string;
  type?: string;
};

export type PauseSnapshotVariable = {
  name: string;
  value: string;
  type: string;
};

export type PauseSnapshotFrame = {
  id: number;
  name: string;
  line: number;
  file: string;
  variables: PauseSnapshotVariable[];
};

export type PauseSnapshotWatchResult = {
  expr: string;
  ok: boolean;
  value?: string;
  type?: string;
  error?: string;
};

export type PauseSnapshotResult = {
  frames: PauseSnapshotFrame[];
  topFrameId: number;
  topFrameLine: number | null;
  variables: PauseSnapshotVariable[] | null;
  changedVars: string[];
  traceLines: string[];
  selection: ReturnType<typeof computeDebugNodeSelection> | null;
  nextVars: Map<string, { value: string; type: string }> | null;
  nextStackDepth: number;
  watchResults: PauseSnapshotWatchResult[] | null;
};

export async function loadPythonlabPauseSnapshot(params: {
  client: DebugController;
  threadId: number;
  traceLifecycle: TraceLifecycle;
  isCurrent: () => boolean;
  debugMap: DebugMap | null;
  prevVars: Map<string, { value: string; type: string }>;
  prevActiveLine: number | null;
  prevStackDepth: number | null;
  stepNo: number;
  watchExprs: string[];
}): Promise<PauseSnapshotResult | null> {
  const {
    client,
    threadId,
    traceLifecycle,
    isCurrent,
    debugMap,
    prevVars,
    prevActiveLine,
    prevStackDepth,
    stepNo,
    watchExprs,
  } = params;

  const stackResp = await client.getStackTrace(threadId, 0, 20);
  if (!isCurrent()) return null;
  const frames = (stackResp.body?.stackFrames || []) as DapStackFrame[];
  traceLifecycle("fetch_stack_frames", {
    threadId,
    frameCount: frames.length,
    topFrameId: frames[0]?.id ?? null,
    topFrameLine: frames[0]?.line ?? null,
    topFramePath: frames[0]?.source?.path ?? null,
  });
  if (frames.length === 0) return null;

  const isUserMainPath = (pathInput: string) => {
    const path = String(pathInput || "").replace(/\\/g, "/").toLowerCase();
    return path.endsWith("/workspace/main.py") || path.endsWith("/main.py") || path.endsWith("main.py");
  };

  const primaryFrameIndex = (() => {
    const idx = frames.findIndex((frame) => isUserMainPath(String(frame?.source?.path || "")));
    return idx >= 0 ? idx : 0;
  })();

  const orderedFrames =
    primaryFrameIndex <= 0
      ? frames
      : [frames[primaryFrameIndex], ...frames.slice(0, primaryFrameIndex), ...frames.slice(primaryFrameIndex + 1)];

  const topFrame = orderedFrames[0];
  const mappedFrames: PauseSnapshotFrame[] = orderedFrames.map((frame) => ({
    id: frame.id,
    name: frame.name,
    line: frame.line,
    file: frame.source?.path || "",
    variables: [],
  }));

  const scopesResp = await client.getScopes(topFrame.id);
  if (!isCurrent()) return null;
  const scopes = (scopesResp.body?.scopes || []) as DapScope[];
  const localScope = scopes.find((scope) => scope.name === "Locals") || scopes[0];
  traceLifecycle("fetch_stack_scopes", {
    threadId,
    frameId: topFrame.id,
    scopeCount: scopes.length,
    selectedScopeName: localScope?.name ?? null,
    selectedVariablesReference: localScope?.variablesReference ?? null,
  });

  let variables: PauseSnapshotVariable[] | null = null;
  let changedVars: string[] = [];
  let traceLines: string[] = [];
  let selection: ReturnType<typeof computeDebugNodeSelection> | null = null;
  let nextVars: Map<string, { value: string; type: string }> | null = null;

  if (localScope) {
    const varsResp = await client.getVariables(localScope.variablesReference);
    if (!isCurrent()) return null;
    const rawVars = (varsResp.body?.variables || []) as DapVariable[];
    variables = rawVars
      .filter((variable) => !variable.name.startsWith("__") && !variable.name.includes("special variables") && !variable.name.includes("function variables"))
      .map((variable) => ({
        name: variable.name,
        value: variable.value,
        type: variable.type || "unknown",
      }));

    traceLifecycle("fetch_stack_variables", {
      threadId,
      frameId: topFrame.id,
      variablesReference: localScope.variablesReference,
      rawVarCount: rawVars.length,
      visibleVarCount: variables.length,
      visibleVarNames: variables.map((variable) => variable.name).slice(0, 10),
    });

    const diff = diffVarTrace(stepNo, prevVars, variables);
    changedVars = diff.changed;
    traceLines = diff.lines;
    nextVars = diff.next;
    selection = computeDebugNodeSelection({
      debugMap,
      activeLine: topFrame.line ?? null,
      prevActiveLine,
      prevStackDepth,
      nextStackDepth: mappedFrames.length,
      prevVars,
      nextVars: diff.next,
    });
  }

  let watchResults: PauseSnapshotWatchResult[] | null = null;
  if (watchExprs.length > 0) {
    watchResults = [];
    for (const expr of watchExprs) {
      try {
        const resp = await client.evaluateExpression(expr, { frameId: topFrame.id, context: "watch" });
        watchResults.push({
          expr,
          ok: true,
          value: String(resp.body?.result ?? ""),
          type: String(resp.body?.type ?? ""),
        });
      } catch (e: unknown) {
        watchResults.push({
          expr,
          ok: false,
          error: (e instanceof Error ? e.message : String(e)) || "Error",
        });
      }
    }
  }

  return {
    frames: mappedFrames,
    topFrameId: topFrame.id,
    topFrameLine: topFrame.line ?? null,
    variables,
    changedVars,
    traceLines,
    selection,
    nextVars,
    nextStackDepth: mappedFrames.length,
    watchResults,
  };
}
