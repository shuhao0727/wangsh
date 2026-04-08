import { useCallback, useEffect, useReducer, useRef } from "react";
import { pythonlabSessionApi } from "../services/pythonlabSessionApi";
import type { DebugMap } from "../flow/debugMap";
import { summarizeDapBreakpointReport, type DapBreakpointReport } from "./dapBreakpointReport";
import { detectSourceMismatch } from "./sourceSync";
import { applyDebugStatusTarget, type DebugSessionStatus, type DebugStatusTransition } from "../core/debugStateMachine";
import { DebugController } from "../core/DebugController";
import { loadPythonlabPauseSnapshot } from "../core/debugPauseSnapshot";
import {
  addPythonlabWatchExpression,
  continuePythonlabDebugSession,
  evaluatePythonlabDebugExpression,
  pausePythonlabDebugSession,
  removePythonlabWatchExpression,
  stepPythonlabDebugSession,
  stopPythonlabDebugSession,
} from "../core/debugRunControl";
import {
  attachPythonlabDapRuntimeHandlers,
  buildPythonlabSessionWsUrl,
  connectPythonlabDapController,
  createAndWaitForPythonlabSession,
  resolvePythonlabWsToken,
  startPlainPythonlabSessionMonitor,
} from "../core/debugSessionBootstrap";
import { logger } from "@services/logger";

// --- Types ---

export type RunnerStatus = DebugSessionStatus;

export interface Variable {
  name: string;
  value: string;
  type: string;
  key?: string;
}

export interface Frame {
  id: number;
  name: string;
  line: number;
  file: string;
  variables: Variable[];
}

export interface WatchResult {
  expr: string;
  ok: boolean;
  value?: string;
  type?: string;
  error?: string;
}

export interface DapCapabilities {
  supportsStepBack?: boolean;
  supportsEvaluateForHovers?: boolean;
  supportsCompletionsRequest?: boolean;
  supportsSetVariable?: boolean;
  supportsConfigurationDoneRequest?: boolean;
}

type DapLaunchOptions = {
  stdinText?: unknown;
  initialBreakpoints?: InternalRunnerState["breakpoints"];
};

// Snapshot for history
export interface SnapshotEntry {
  step: number;
  activeLine: number | null;
  variables: Variable[];
}

export interface InternalRunnerState {
  status: RunnerStatus;
  statusTransitions: DebugStatusTransition[];
  trace: string[]; // For variable trace log
  activeLine: number | null;
  activeFlowLine: number | null;
  activeNodeId: string | null;
  frames: Frame[];
  selectedFrameIndex: number;
  variables: Variable[];
  changedVars: string[];
  watchExprs: string[];
  watchResults: WatchResult[];
  breakpoints: { line: number; enabled: boolean; condition?: string; hitCount?: number }[];
  breakpointReport: DapBreakpointReport;
  error: string | null;
  steps: number;
  history: SnapshotEntry[]; // Keep simple for now
  historyIndex: number;
  activeFocusRole: string | null;
  startTime: number | null; // 添加开始时间
  elapsedTime: number; // 添加已运行时间（秒）
  sessionId: string | null; // Exposed session ID for terminal connection
  pendingOutput: string[];
  dapCapabilities: DapCapabilities | null;
}

export interface RunnerState extends InternalRunnerState {
  ok: boolean;
  timeTravel: boolean;
  historyLength: number;
  callStack: string[];
  watch: WatchResult[];
  frame: string;
  warnings: string[];
  sourceMismatch: boolean;
  sourceMismatchMessage: string | null;
}

const initialState: InternalRunnerState = {
  status: "idle",
  statusTransitions: [],
  trace: [],
  activeLine: null,
  activeFlowLine: null,
  activeNodeId: null,
  frames: [],
  selectedFrameIndex: 0,
  variables: [],
  changedVars: [],
  watchExprs: [],
  watchResults: [],
  breakpoints: [],
  breakpointReport: null,
  error: null,
  steps: 0,
  history: [],
  historyIndex: 0,
  activeFocusRole: null,
  startTime: null,
  elapsedTime: 0,
  sessionId: null,
  pendingOutput: [],
  dapCapabilities: null,
};

const ACTIVE_DAP_RUNNER_STATUSES = new Set<RunnerStatus>(["starting", "running", "paused"]);
const NON_RECOVERABLE_DAP_CLOSE_CODES = new Set([4401, 4403, 4404, 4409, 4410, 4429, 4500]);
const MAX_DAP_RECONNECT_ATTEMPTS = 3;

function toDapCapabilitiesState(initCaps: Record<string, unknown> | null): DapCapabilities | null {
  if (!initCaps) return null;
  return {
    supportsStepBack: !!initCaps.supportsStepBack,
    supportsEvaluateForHovers: !!initCaps.supportsEvaluateForHovers,
    supportsCompletionsRequest: !!initCaps.supportsCompletionsRequest,
    supportsSetVariable: !!initCaps.supportsSetVariable,
    supportsConfigurationDoneRequest: !!initCaps.supportsConfigurationDoneRequest,
  };
}

function shouldAttemptDapReconnect(params: {
  mode: "debug" | "plain";
  status: RunnerStatus;
  sessionId: string | null;
  closeCode: number;
}): boolean {
  return (
    params.mode === "debug" &&
    !!params.sessionId &&
    ACTIVE_DAP_RUNNER_STATUSES.has(params.status) &&
    !NON_RECOVERABLE_DAP_CLOSE_CODES.has(params.closeCode)
  );
}

type Action =
  | { type: "SET_STATUS"; payload: RunnerStatus }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "APPEND_TRACE_LINES"; payload: string[] }
  | { type: "CLEAR_OUTPUT" }
  | { type: "SET_FRAMES"; payload: Frame[] }
  | { type: "SET_VARIABLES"; payload: Variable[] }
  | { type: "SET_CHANGED_VARS"; payload: string[] }
  | { type: "SET_ACTIVE_LINE"; payload: number | null }
  | { type: "SET_ACTIVE_EMPHASIS"; payload: { activeFlowLine: number | null; activeFocusRole: string | null; activeNodeId: string | null } }
  | { type: "SET_SELECTED_FRAME"; payload: number }
  | { type: "UPDATE_BREAKPOINTS"; payload: (prev: InternalRunnerState["breakpoints"]) => InternalRunnerState["breakpoints"] }
  | { type: "SET_BREAKPOINT_REPORT"; payload: InternalRunnerState["breakpointReport"] }
  | { type: "UPDATE_WATCH_EXPRS"; payload: string[] }
  | { type: "SET_WATCH_RESULTS"; payload: WatchResult[] }
  | { type: "INCREMENT_STEPS" }
  | { type: "RESET_SESSION"; payload?: { preserveOutput?: boolean } }
  | { type: "UPDATE_ELAPSED_TIME"; payload: number }
  | { type: "SET_START_TIME"; payload: number | null }
  | { type: "SET_SESSION_ID"; payload: string | null }
  | { type: "APPEND_OUTPUT"; payload: string }
  | { type: "CLEAR_PENDING_OUTPUT" }
  | { type: "SET_DAP_CAPABILITIES"; payload: DapCapabilities | null };

function applyStatusTarget(state: InternalRunnerState, target: RunnerStatus): InternalRunnerState {
  const next = applyDebugStatusTarget({
    status: state.status,
    transitions: state.statusTransitions,
    target,
  });
  if (!next.applied) {
    if (state.status === target) return state;
    // Preserve legacy behavior while status writes are still being extracted from hooks.
    return { ...state, status: target };
  }
  return {
    ...state,
    status: next.status,
    statusTransitions: next.transitions,
  };
}

function reducer(state: InternalRunnerState, action: Action): InternalRunnerState {
  switch (action.type) {
    case "SET_STATUS":
      return applyStatusTarget(state, action.payload);
    case "SET_ERROR":
      return { ...applyStatusTarget(state, "error"), error: action.payload };
    case "APPEND_TRACE_LINES":
      return { ...state, trace: [...state.trace, ...action.payload] };
    case "CLEAR_OUTPUT":
      return { ...state, trace: [] };
    case "SET_FRAMES":
      return { ...state, frames: action.payload, selectedFrameIndex: 0 };
    case "SET_VARIABLES":
      return { ...state, variables: action.payload };
    case "SET_CHANGED_VARS":
      return { ...state, changedVars: action.payload };
    case "SET_ACTIVE_LINE":
      return { ...state, activeLine: action.payload };
    case "SET_ACTIVE_EMPHASIS":
      return {
        ...state,
        activeFlowLine: action.payload.activeFlowLine,
        activeFocusRole: action.payload.activeFocusRole,
        activeNodeId: action.payload.activeNodeId,
      };
    case "SET_SELECTED_FRAME":
      return { ...state, selectedFrameIndex: action.payload };
    case "UPDATE_BREAKPOINTS":
      return { ...state, breakpoints: action.payload(state.breakpoints) };
    case "SET_BREAKPOINT_REPORT":
      return { ...state, breakpointReport: action.payload };
    case "UPDATE_WATCH_EXPRS":
      return { ...state, watchExprs: action.payload };
    case "SET_WATCH_RESULTS":
      return { ...state, watchResults: action.payload };
    case "INCREMENT_STEPS":
      return { ...state, steps: state.steps + 1 };
    case "RESET_SESSION":
      return {
        ...state,
        trace: [],
        frames: [],
        variables: [],
        changedVars: [],
        watchResults: [],
        breakpointReport: null,
        error: null,
        steps: 0,
        activeLine: null,
        activeFlowLine: null,
        activeNodeId: null,
        activeFocusRole: null,
        startTime: null,
        elapsedTime: 0,
        sessionId: null,
        pendingOutput: action.payload?.preserveOutput ? state.pendingOutput : [],
        dapCapabilities: null,
      };
    case "UPDATE_ELAPSED_TIME":
      return { ...state, elapsedTime: action.payload };
    case "SET_START_TIME":
      return { ...state, startTime: action.payload };
    case "SET_SESSION_ID":
      return { ...state, sessionId: action.payload };
    case "APPEND_OUTPUT":
      return { ...state, pendingOutput: [...state.pendingOutput, action.payload] };
    case "CLEAR_PENDING_OUTPUT":
      return { ...state, pendingOutput: [] };
    case "SET_DAP_CAPABILITIES":
      return { ...state, dapCapabilities: action.payload };
    default:
      return state;
  }
}

// --- Hook ---

export function useDapRunner(params: { code: string; debugMap: DebugMap | null }) {
  const { code, debugMap } = params;
  const [state, dispatch] = useReducer(reducer, initialState);
  const clientRef = useRef<DebugController>(new DebugController());
  const sessionIdRef = useRef<string | null>(null);
  const startInFlightRef = useRef(false);
  const startCooldownUntilRef = useRef(0);
  const startTokenRef = useRef(0);
  const ignoreNextCloseRef = useRef(false);
  const prevVarsRef = useRef(new Map<string, { value: string; type: string }>());
  const prevActiveLineRef = useRef<number | null>(null);
  const prevStackDepthRef = useRef<number | null>(null);
  const stackFetchSeqRef = useRef(0);
  const emphasisSeqRef = useRef(0);
  const emphasisTimerRef = useRef<NodeJS.Timeout | null>(null);
  const plainStatusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const debugMapRef = useRef<DebugMap | null>(debugMap);
  const modeRef = useRef<"debug" | "plain">("debug");
  const lifecycleEpochRef = useRef(0);
  const wsEpochRef = useRef<number | null>(null);
  const wsConnIdRef = useRef<string | null>(null);
  const clientConnIdRef = useRef<string | null>(null);
  const sourceMismatchRef = useRef(false);
  const sourceMismatchMessageRef = useRef<string | null>(null);
  const stepsRef = useRef(0);
  const elapsedRef = useRef(0);
  const reconnectInFlightRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);

  // Sync state to ref for callbacks if needed, but try to avoid it.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    debugMapRef.current = debugMap;
  }, [debugMap]);
  const shouldTraceLifecycle = useCallback(() => {
    try {
      const globalFlag = Boolean((window as unknown as Record<string, unknown>).__PYTHONLAB_DAP_TRACE__);
      const storageFlag = window.localStorage?.getItem("pythonlab:dap:trace") === "1";
      return globalFlag || storageFlag;
    } catch {
      return false;
    }
  }, []);
  const traceLifecycle = useCallback((phase: string, extra?: Record<string, unknown>) => {
    if (!shouldTraceLifecycle()) return;
    try {
      logger.info("[pythonlab:dap]", {
        phase,
        token: startTokenRef.current,
        epoch: lifecycleEpochRef.current,
        sessionId: sessionIdRef.current,
        status: stateRef.current.status,
        wsEpoch: wsEpochRef.current,
        wsConnId: wsConnIdRef.current,
        clientConnId: clientConnIdRef.current,
        ts: Date.now(),
        ...(extra || {}),
      });
    } catch { }
  }, [shouldTraceLifecycle]);

  // 计时器逻辑
  // 优化：不再在 reducer 中高频 dispatch 更新时间，改为由 UI 组件自行根据 startTime 渲染动画
  // 这里只负责在开始时记录 startTime，在结束时记录最终的 elapsedTime
  useEffect(() => {
    if (state.status === "running") {
      if (!state.startTime) {
        dispatch({ type: "SET_START_TIME", payload: Date.now() });
      }
    }
  }, [state.status, state.startTime]);

  const clearPauseVisualState = useCallback((options?: { clearWatchResults?: boolean }) => {
    stackFetchSeqRef.current += 1;
    emphasisSeqRef.current += 1;
    if (emphasisTimerRef.current) {
      clearTimeout(emphasisTimerRef.current);
      emphasisTimerRef.current = null;
    }
    prevActiveLineRef.current = null;
    prevStackDepthRef.current = 0;
    prevVarsRef.current = new Map();
    dispatch({ type: "SET_FRAMES", payload: [] });
    dispatch({ type: "SET_VARIABLES", payload: [] });
    dispatch({ type: "SET_CHANGED_VARS", payload: [] });
    dispatch({ type: "SET_ACTIVE_LINE", payload: null });
    dispatch({ type: "SET_ACTIVE_EMPHASIS", payload: { activeFlowLine: null, activeFocusRole: null, activeNodeId: null } });
    if (options?.clearWatchResults !== false) {
      dispatch({ type: "SET_WATCH_RESULTS", payload: [] });
    }
  }, []);

  const clearPlainStatusMonitor = useCallback(() => {
    if (plainStatusTimerRef.current) {
      clearInterval(plainStatusTimerRef.current);
      plainStatusTimerRef.current = null;
    }
  }, []);

  const resetReconnectState = useCallback(() => {
    reconnectInFlightRef.current = false;
    reconnectAttemptsRef.current = 0;
  }, []);

  const consumeElapsedRuntime = useCallback(() => {
    if (!stateRef.current.startTime) return;
    const now = Date.now();
    const elapsed = (now - stateRef.current.startTime) / 1000;
    elapsedRef.current += elapsed;
    dispatch({ type: "UPDATE_ELAPSED_TIME", payload: elapsedRef.current });
    dispatch({ type: "SET_START_TIME", payload: null });
  }, []);

  const clearTrackedSessionId = useCallback(() => {
    sessionIdRef.current = null;
    dispatch({ type: "SET_SESSION_ID", payload: null });
  }, []);

  const stopTrackedSession = useCallback((sessionId: string | null) => {
    if (!sessionId) return;
    pythonlabSessionApi.stop(sessionId).catch(() => { });
  }, []);

  const resetLaunchTransientRefs = useCallback(() => {
    prevVarsRef.current = new Map();
    prevActiveLineRef.current = null;
    prevStackDepthRef.current = null;
    sourceMismatchRef.current = false;
    sourceMismatchMessageRef.current = null;
    ignoreNextCloseRef.current = false;
    resetReconnectState();
  }, [resetReconnectState]);

  const applyStoppedVisualState = useCallback(() => {
    dispatch({ type: "SET_ACTIVE_LINE", payload: null });
    dispatch({ type: "SET_ACTIVE_EMPHASIS", payload: { activeFlowLine: null, activeFocusRole: null, activeNodeId: null } });
    dispatch({ type: "SET_STATUS", payload: "stopped" });
  }, []);

  const handleStartFailure = useCallback((message: string) => {
    const sid = sessionIdRef.current;
    resetReconnectState();
    if (sid) {
      stopTrackedSession(sid);
      clearTrackedSessionId();
    }
    dispatch({ type: "SET_ERROR", payload: message });
    dispatch({ type: "SET_STATUS", payload: "error" });
  }, [clearTrackedSessionId, resetReconnectState, stopTrackedSession]);

  const cleanup = useCallback((options?: { preserveSession?: boolean }) => {
    const preserveSession = options?.preserveSession === true;
    startTokenRef.current += 1;
    lifecycleEpochRef.current += 1;
    traceLifecycle("cleanup", { preserveSession });
    emphasisSeqRef.current += 1;
    stackFetchSeqRef.current += 1;
    if (emphasisTimerRef.current) {
      clearTimeout(emphasisTimerRef.current);
      emphasisTimerRef.current = null;
    }
    clearPlainStatusMonitor();
    resetReconnectState();
    sourceMismatchRef.current = false;
    sourceMismatchMessageRef.current = null;
    wsEpochRef.current = null;
    wsConnIdRef.current = null;
    clientConnIdRef.current = null;
    ignoreNextCloseRef.current = true;
    clientRef.current.disconnect();
    if (!preserveSession && sessionIdRef.current) {
      stopTrackedSession(sessionIdRef.current);
      sessionIdRef.current = null;
    }
    if (!preserveSession) {
      dispatch({ type: "SET_SESSION_ID", payload: null });
    }
    applyStoppedVisualState();
  }, [applyStoppedVisualState, clearPlainStatusMonitor, resetReconnectState, stopTrackedSession, traceLifecycle]);

  // --- Actions ---

  const refreshBreakpoints = useCallback(async (next?: InternalRunnerState["breakpoints"]) => {
    if (modeRef.current === "plain") {
      // Send empty breakpoints in plain mode
      const sourcePath = "/workspace/main.py";
      await clientRef.current.setSourceBreakpoints(sourcePath, []);
      return;
    }

    const bps = (next ?? stateRef.current.breakpoints).filter(b => b.enabled);
    const sourcePath = "/workspace/main.py";
    const resp = await clientRef.current.setSourceBreakpoints(
      sourcePath,
      bps.map((b) => ({
        line: b.line,
        condition: b.condition,
        hitCondition: b.hitCount ? String(b.hitCount) : undefined,
      }))
    );
    dispatch({
      type: "SET_BREAKPOINT_REPORT",
      payload: summarizeDapBreakpointReport({ requested: bps.length, sourcePath, resp }),
    });
  }, []);

  const fetchStack = useCallback(async (threadId: number) => {
    try {
      const fetchSeq = ++stackFetchSeqRef.current;
      const snapshot = await loadPythonlabPauseSnapshot({
        client: clientRef.current,
        threadId,
        traceLifecycle: (phase, extra) => traceLifecycle(phase, { fetchSeq, ...(extra || {}) }),
        isCurrent: () => fetchSeq === stackFetchSeqRef.current,
        debugMap: debugMapRef.current,
        prevVars: prevVarsRef.current,
        prevActiveLine: prevActiveLineRef.current,
        prevStackDepth: prevStackDepthRef.current,
        stepNo: stepsRef.current,
        watchExprs: stateRef.current.watchExprs,
      });
      if (!snapshot) return;

      dispatch({ type: "SET_FRAMES", payload: snapshot.frames });
      dispatch({ type: "SET_ACTIVE_LINE", payload: snapshot.topFrameLine });

      if (snapshot.variables) {
        dispatch({ type: "SET_VARIABLES", payload: snapshot.variables });
      }
      if (snapshot.changedVars.length) {
        dispatch({ type: "SET_CHANGED_VARS", payload: snapshot.changedVars });
      } else if (snapshot.variables) {
        dispatch({ type: "SET_CHANGED_VARS", payload: [] });
      }
      if (snapshot.traceLines.length) {
        dispatch({ type: "APPEND_TRACE_LINES", payload: snapshot.traceLines });
      }

      emphasisSeqRef.current += 1;
      const mySeq = emphasisSeqRef.current;
      if (emphasisTimerRef.current) {
        clearTimeout(emphasisTimerRef.current);
        emphasisTimerRef.current = null;
      }

      if (snapshot.selection && snapshot.nextVars) {
        if (sourceMismatchRef.current) {
          dispatch({
            type: "SET_ACTIVE_EMPHASIS",
            payload: { activeFlowLine: snapshot.topFrameLine, activeFocusRole: null, activeNodeId: null },
          });
        } else {
          dispatch({
            type: "SET_ACTIVE_EMPHASIS",
            payload: {
              activeFlowLine: snapshot.selection.activeFlowLine,
              activeFocusRole: snapshot.selection.activeFocusRole,
              activeNodeId: snapshot.selection.activeNodeId,
            },
          });

          if (snapshot.selection.transitionQueue.length >= 2) {
            const queue = snapshot.selection.transitionQueue.slice(1);
            const MIN_STEP_DURATION = 500;

            const playNext = (idx: number) => {
              if (idx >= queue.length) {
                emphasisTimerRef.current = null;
                return;
              }
              const nextNodeId = queue[idx];
              const thenRole = idx === 0 ? (snapshot.selection?.inferred?.thenRole ?? null) : null;

              const tid = setTimeout(() => {
                if (emphasisSeqRef.current !== mySeq) return;
                if (stateRef.current.status !== "paused") return;
                dispatch({
                  type: "SET_ACTIVE_EMPHASIS",
                  payload: { activeFlowLine: snapshot.selection?.activeFlowLine ?? null, activeFocusRole: thenRole, activeNodeId: nextNodeId },
                });
                playNext(idx + 1);
              }, MIN_STEP_DURATION);
              emphasisTimerRef.current = tid;
            };

            playNext(0);
          }
        }

        prevVarsRef.current = snapshot.nextVars;
        prevActiveLineRef.current = snapshot.topFrameLine;
        prevStackDepthRef.current = snapshot.nextStackDepth;
      }

      if (snapshot.watchResults) {
        dispatch({ type: "SET_WATCH_RESULTS", payload: snapshot.watchResults });
      }
    } catch (e) {
      traceLifecycle("fetch_stack_failed", {
        threadId,
        error: e instanceof Error ? e.message : String(e),
      });
      logger.error("Fetch stack failed", e);
    }
  }, [traceLifecycle]);

  const reconnectCurrentDebugSession = useCallback(async (params: {
    expectedSessionId: string;
    expectedEpoch: number;
    previousStatus: RunnerStatus;
    closeCode: number;
    closeReason: string;
  }): Promise<{ ok: boolean; aborted: boolean; errorMessage: string | null }> => {
    const isCurrent = () =>
      lifecycleEpochRef.current === params.expectedEpoch &&
      sessionIdRef.current === params.expectedSessionId &&
      modeRef.current === "debug";

    if (!isCurrent()) {
      return { ok: false, aborted: true, errorMessage: null };
    }
    if (reconnectInFlightRef.current) {
      return { ok: false, aborted: true, errorMessage: null };
    }

    reconnectInFlightRef.current = true;
    let lastError: string | null = null;

    try {
      for (let attempt = 1; attempt <= MAX_DAP_RECONNECT_ATTEMPTS; attempt += 1) {
        if (!isCurrent()) {
          return { ok: false, aborted: true, errorMessage: null };
        }

        reconnectAttemptsRef.current = attempt;
        traceLifecycle("ws_reconnect_attempt", {
          attempt,
          previousStatus: params.previousStatus,
          closeCode: params.closeCode,
          closeReason: params.closeReason,
        });

        try {
          const token = await resolvePythonlabWsToken();
          if (!isCurrent()) {
            return { ok: false, aborted: true, errorMessage: null };
          }

          clientRef.current.disconnect();
          const clientConnId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
          clientConnIdRef.current = clientConnId;
          const url = buildPythonlabSessionWsUrl({
            sessionId: params.expectedSessionId,
            clientConnId,
            token,
          });

          const initCaps = await connectPythonlabDapController({
            client: clientRef.current,
            url,
            clientConnId,
            sessionId: params.expectedSessionId,
            refreshBreakpoints: () => refreshBreakpoints(),
            traceLifecycle: (phase, extra) =>
              traceLifecycle(phase, {
                reconnect: true,
                reconnectAttempt: attempt,
                ...(extra || {}),
              }),
          });

          if (!isCurrent()) {
            return { ok: false, aborted: true, errorMessage: null };
          }

          dispatch({ type: "SET_DAP_CAPABILITIES", payload: toDapCapabilitiesState(initCaps) });
          reconnectAttemptsRef.current = 0;
          traceLifecycle("ws_reconnect_ok", {
            attempt,
            previousStatus: params.previousStatus,
          });

          if (params.previousStatus === "starting" || params.previousStatus === "running") {
            dispatch({ type: "SET_STATUS", payload: "running" });
          }

          return { ok: true, aborted: false, errorMessage: null };
        } catch (e: unknown) {
          lastError = (e instanceof Error ? e.message : String(e)) || "调试连接恢复失败";
          traceLifecycle("ws_reconnect_attempt_failed", {
            attempt,
            error: lastError,
          });
          logger.error("Reconnect current debug session failed", e);
          clientRef.current.disconnect();
          if (attempt < MAX_DAP_RECONNECT_ATTEMPTS) {
            await new Promise((resolve) => setTimeout(resolve, Math.min(1000, attempt * 300)));
          }
        }
      }

      return {
        ok: false,
        aborted: false,
        errorMessage: lastError || "调试连接恢复失败，请重新启动调试",
      };
    } finally {
      reconnectInFlightRef.current = false;
    }
  }, [refreshBreakpoints, traceLifecycle]);

  const startSession = useCallback(async (mode: "debug" | "plain", options?: DapLaunchOptions) => {
    const stdinText = options?.stdinText;
    const launchBreakpoints =
      mode === "debug" && Array.isArray(options?.initialBreakpoints)
        ? options.initialBreakpoints.map((bp) => ({ ...bp }))
        : undefined;

    modeRef.current = mode;
    // If running, send stdin to backend
    if (stateRef.current.status === "running" && stdinText !== undefined) {
      // Real-time stdin is now handled by the separate terminal WS in XtermTerminal.
      // We don't send it via DAP client anymore.
      return;
    }

    // Force restart logic:
    // If starting, we override. If running, caller should have stopped it (but we double check).
    if (stateRef.current.status === "starting" && startInFlightRef.current) {
      // Proceed to invalidate old token
    }

    // Allow retrying if last attempt was cleanup/stopped recently, 
    // but prevent rapid-fire clicks. 
    // If status is "starting", we already handled it above (override).
    // If status is "idle" or "stopped", cooldown applies.
    const now = Date.now();
    if (now < startCooldownUntilRef.current) {
      // Cooldown is still useful for preventing accidental double-clicks (debounce),
      // but user wants "force", so maybe we relax this or ensure it's short.
      // We'll keep it short (e.g. 500ms) in UI, but here let's allow if user really insists?
      // Actually, let's keep cooldown to prevent network flooding, but make sure UI handles it gracefully.
      const msg = "请求过于频繁：请稍等片刻后重试";
      dispatch({ type: "SET_ERROR", payload: msg });
      throw new Error(msg);
    }

    // Critical Fix: Ensure we are not in a cleanup race condition.
    // If we are restarting, we must wait for any pending effects to settle or use a new token.
    // The previous token increment happens here.

    startInFlightRef.current = true;
    const myToken = (startTokenRef.current += 1);
    const myEpoch = (lifecycleEpochRef.current += 1);
    traceLifecycle("start_session", { mode, token: myToken, epoch: myEpoch });

    // Immediate status update
    dispatch({ type: "RESET_SESSION" });
    stepsRef.current = 0;
    elapsedRef.current = 0;
    dispatch({ type: "SET_STATUS", payload: "starting" });
    dispatch({ type: "SET_START_TIME", payload: Date.now() });
    dispatch({ type: "UPDATE_ELAPSED_TIME", payload: 0 });
    if (launchBreakpoints) {
      dispatch({ type: "UPDATE_BREAKPOINTS", payload: () => launchBreakpoints });
    }

    try {
      // Clean up previous session explicitly if it exists, BUT do not trigger full cleanup() 
      // because cleanup() increments startTokenRef, which would invalidate our current myToken!
      // This was the bug: calling cleanup() inside startSession invalidated the session we just started.
      if (sessionIdRef.current) {
        stopTrackedSession(sessionIdRef.current);
        sessionIdRef.current = null;
      }

      // Stop DAP client silently without full state reset (since we are about to reset it anyway)
      if (clientRef.current) {
        clientRef.current.disconnect();
      }

      dispatch({ type: "SET_SESSION_ID", payload: null });
      resetLaunchTransientRefs();

      // Removed redundant dispatch calls here since we did them above


      // No more pre-check for input() requirements since we support runtime stdin
      // But we can still keep extractInputPrompts if we want to visualize something?
      // Actually, with runtime stdin, we just run the code.
      // If code needs input, it blocks and waits for stdin.

      const sessionBoot = await createAndWaitForPythonlabSession({
        code,
        mode,
        isCurrent: () => startTokenRef.current === myToken,
        traceLifecycle,
        onSessionCreated: (session) => {
          sessionIdRef.current = session.session_id;
          dispatch({ type: "SET_SESSION_ID", payload: session.session_id });
        },
      });
      if (!sessionBoot) return;

      const { session, readyMeta } = sessionBoot;
      const sourceMismatch = detectSourceMismatch({
        sessionCodeSha: String(readyMeta?.code_sha256 ?? ""),
        debugMapCodeSha: debugMapRef.current?.codeSha256,
      });
      if (sourceMismatch.mismatch) {
        sourceMismatchRef.current = true;
        sourceMismatchMessageRef.current = sourceMismatch.message;
        dispatch({
          type: "SET_ACTIVE_EMPHASIS",
          payload: { activeFlowLine: null, activeFocusRole: null, activeNodeId: null },
        });
      }

      if (mode === "plain") {
        dispatch({ type: "SET_STATUS", payload: "running" });
        clearPlainStatusMonitor();
        plainStatusTimerRef.current = startPlainPythonlabSessionMonitor({
          sessionId: session.session_id,
          isCurrent: () => {
            const current = startTokenRef.current === myToken;
            if (!current) clearPlainStatusMonitor();
            return current;
          },
          onFailed: (message) => {
            dispatch({ type: "SET_ERROR", payload: message });
            dispatch({ type: "SET_STATUS", payload: "error" });
            clearPlainStatusMonitor();
          },
          onTerminated: () => {
            consumeElapsedRuntime();
            dispatch({ type: "SET_STATUS", payload: "stopped" });
            clearPlainStatusMonitor();
          },
        });
        return;
      }

      // 3. Acquire token for WS (prefer stored token; fall back to refresh)
      const token = await resolvePythonlabWsToken();

      const clientConnId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      clientConnIdRef.current = clientConnId;
      const url = buildPythonlabSessionWsUrl({
        sessionId: session.session_id,
        clientConnId,
        token,
      });
      traceLifecycle("ws_connecting", { sessionId: session.session_id });

      // Setup listeners
      const client = clientRef.current;
      client.disconnect(); // Ensure clean slate
      attachPythonlabDapRuntimeHandlers({
        client,
        traceLifecycle,
        updateConnectionMeta: (meta) => {
          wsEpochRef.current = meta.wsEpoch ?? wsEpochRef.current;
          wsConnIdRef.current = meta.wsConnId ?? wsConnIdRef.current;
          clientConnIdRef.current = meta.clientConnId ?? clientConnIdRef.current;
        },
        shouldIgnoreClose: () => ignoreNextCloseRef.current,
        clearIgnoreClose: () => {
          ignoreNextCloseRef.current = false;
        },
        onOutput: (output) => {
          dispatch({ type: "APPEND_OUTPUT", payload: output });
        },
        onStopped: (threadId) => {
          resetReconnectState();
          consumeElapsedRuntime();
          dispatch({ type: "SET_STATUS", payload: "paused" });
          dispatch({ type: "INCREMENT_STEPS" });
          stepsRef.current += 1;
          fetchStack(threadId).catch((e) => {
            logger.error("fetchStack failed in stopped handler", e);
          });
        },
        onContinued: () => {
          resetReconnectState();
          clearPauseVisualState();
          dispatch({ type: "SET_STATUS", payload: "running" });
        },
        onTerminated: () => {
          resetReconnectState();
          consumeElapsedRuntime();
          cleanup({ preserveSession: true });
        },
        onClose: ({ ignored, errorMessage, code, reason }) => {
          if (ignored) {
            resetReconnectState();
            dispatch({ type: "SET_STATUS", payload: "stopped" });
            return;
          }

          const previousStatus = stateRef.current.status;
          const expectedSessionId = sessionIdRef.current;
          const expectedEpoch = lifecycleEpochRef.current;
          if (
            shouldAttemptDapReconnect({
              mode: modeRef.current,
              status: previousStatus,
              sessionId: expectedSessionId,
              closeCode: code,
            }) &&
            expectedSessionId
          ) {
            void (async () => {
              const result = await reconnectCurrentDebugSession({
                expectedSessionId,
                expectedEpoch,
                previousStatus,
                closeCode: code,
                closeReason: reason,
              });
              if (result.ok || result.aborted) return;
              if (lifecycleEpochRef.current !== expectedEpoch || sessionIdRef.current !== expectedSessionId) return;
              resetReconnectState();
              dispatch({
                type: "SET_ERROR",
                payload: result.errorMessage || errorMessage || `连接已关闭（${code}）：${reason || "未知原因"}`,
              });
              applyStoppedVisualState();
            })();
            return;
          }

          resetReconnectState();
          if (errorMessage) {
            dispatch({ type: "SET_ERROR", payload: errorMessage });
          }
          applyStoppedVisualState();
        },
      });

      const initCaps = await connectPythonlabDapController({
        client,
        url,
        clientConnId,
        sessionId: session.session_id,
        // Use the launch snapshot so "click breakpoint then immediately debug"
        // does not race against the store->runner breakpoint sync effect.
        refreshBreakpoints: () => refreshBreakpoints(launchBreakpoints),
        traceLifecycle,
      });
      resetReconnectState();
      dispatch({ type: "SET_DAP_CAPABILITIES", payload: toDapCapabilitiesState(initCaps) });
      dispatch({ type: "SET_STATUS", payload: "running" });

    } catch (e: unknown) {
      if (startTokenRef.current === myToken) {
        if (mode === "debug" && reconnectInFlightRef.current && sessionIdRef.current) {
          traceLifecycle("start_session_waiting_for_reconnect", { epoch: myEpoch });
          return;
        }
        startInFlightRef.current = false;
        const msg = (e instanceof Error ? e.message : String(e)) || "启动失败";
        handleStartFailure(msg);
        throw e; // Re-throw to let UI handle it
      }
    } finally {
      if (startTokenRef.current === myToken) {
        startInFlightRef.current = false;
      }
    }
  }, [
    applyStoppedVisualState,
    clearPauseVisualState,
    clearPlainStatusMonitor,
    code,
    consumeElapsedRuntime,
    handleStartFailure,
    reconnectCurrentDebugSession,
    refreshBreakpoints,
    resetLaunchTransientRefs,
    resetReconnectState,
    stopTrackedSession,
    traceLifecycle,
  ]);

  const startDebug = useCallback(
    (options?: Pick<DapLaunchOptions, "initialBreakpoints">) => startSession("debug", options),
    [startSession]
  );
  const runPlain = useCallback((stdinText?: unknown) => startSession("plain", { stdinText }), [startSession]);

  const stopDebug = useCallback(async () => {
    await stopPythonlabDebugSession({
      client: clientRef.current,
      sessionId: sessionIdRef.current,
      shouldDisconnect: modeRef.current === "debug" && stateRef.current.status !== "idle" && stateRef.current.status !== "stopped",
      cleanup: () => cleanup({ preserveSession: true }),
      clearTrackedSessionId,
      resetState: () => {
        dispatch({ type: "RESET_SESSION", payload: { preserveOutput: true } });
        dispatch({ type: "SET_START_TIME", payload: null });
        dispatch({ type: "UPDATE_ELAPSED_TIME", payload: 0 });
      },
    });
  }, [clearTrackedSessionId, cleanup]);

  const continueRun = useCallback(async () => {
    await continuePythonlabDebugSession({
      client: clientRef.current,
      onRunning: () => dispatch({ type: "SET_STATUS", payload: "running" }),
    });
  }, []);

  const pauseRun = useCallback(async () => {
    await pausePythonlabDebugSession({ client: clientRef.current });
  }, []);

  const stepOver = useCallback(async () => {
    await stepPythonlabDebugSession({
      client: clientRef.current,
      kind: "over",
      onRunning: () => dispatch({ type: "SET_STATUS", payload: "running" }),
    });
  }, []);

  const stepInto = useCallback(async () => {
    await stepPythonlabDebugSession({
      client: clientRef.current,
      kind: "into",
      onRunning: () => dispatch({ type: "SET_STATUS", payload: "running" }),
    });
  }, []);

  const stepOut = useCallback(async () => {
    await stepPythonlabDebugSession({
      client: clientRef.current,
      kind: "out",
      onRunning: () => dispatch({ type: "SET_STATUS", payload: "running" }),
    });
  }, []);

  const evaluate = useCallback(async (expr: string) => {
    return evaluatePythonlabDebugExpression({
      client: clientRef.current,
      expr,
      frameId: stateRef.current.frames[0]?.id,
      context: "repl",
    });
  }, []);

  // --- Breakpoint Helpers ---
  const toggleBreakpoint = useCallback((line: number) => {
    dispatch({
      type: "UPDATE_BREAKPOINTS", payload: (prev) => {
        const idx = prev.findIndex(b => b.line === line);
        if (idx >= 0) return prev.filter(b => b.line !== line);
        return [...prev, { line, enabled: true }];
      }
    });
  }, []);

  const setBreakpointEnabled = useCallback((line: number, enabled: boolean) => {
    dispatch({ type: "UPDATE_BREAKPOINTS", payload: (prev) => prev.map(b => b.line === line ? { ...b, enabled } : b) });
  }, []);

  const setBreakpointCondition = useCallback((line: number, condition: string) => {
    dispatch({ type: "UPDATE_BREAKPOINTS", payload: (prev) => prev.map(b => b.line === line ? { ...b, condition } : b) });
  }, []);

  const setBreakpointHitCount = useCallback((line: number, hitCount: number | null) => {
    dispatch({ type: "UPDATE_BREAKPOINTS", payload: (prev) => prev.map(b => b.line === line ? { ...b, hitCount: hitCount || undefined } : b) });
  }, []);

  const setBreakpoints = useCallback(async (bps: InternalRunnerState["breakpoints"]) => {
    dispatch({ type: "UPDATE_BREAKPOINTS", payload: () => bps });
    try {
      if (stateRef.current.status === "running" || stateRef.current.status === "paused") {
        await refreshBreakpoints(bps);
      }
    } catch { }
  }, [refreshBreakpoints]);

  // Sync breakpoints when they change (if running)
  useEffect(() => {
    if (state.status === "running" || state.status === "paused") {
      refreshBreakpoints().catch(() => { });
    }
  }, [state.breakpoints, refreshBreakpoints, state.status]);

  const addWatch = useCallback(async (expr: string) => {
    await addPythonlabWatchExpression({
      client: clientRef.current,
      expr,
      watchExprs: stateRef.current.watchExprs,
      watchResults: stateRef.current.watchResults,
      status: stateRef.current.status,
      topFrameId: stateRef.current.frames[0]?.id,
      setWatchExprs: (watchExprs) => dispatch({ type: "UPDATE_WATCH_EXPRS", payload: watchExprs }),
      setWatchResults: (watchResults) => dispatch({ type: "SET_WATCH_RESULTS", payload: watchResults as WatchResult[] }),
    });
  }, []);

  const removeWatch = useCallback((expr: string) => {
    removePythonlabWatchExpression({
      expr,
      watchExprs: stateRef.current.watchExprs,
      watchResults: stateRef.current.watchResults,
      setWatchExprs: (watchExprs) => dispatch({ type: "UPDATE_WATCH_EXPRS", payload: watchExprs }),
      setWatchResults: (watchResults) => dispatch({ type: "SET_WATCH_RESULTS", payload: watchResults as WatchResult[] }),
    });
  }, []);

  return {
    state: {
      ...state,
      // Compatibility with old interface
      ok: true,
      timeTravel: false,
      historyLength: 0,
      callStack: state.frames.map(f => f.name),
      watch: state.watchResults,
      frame: state.frames[state.selectedFrameIndex]?.name || "",
      sourceMismatch: sourceMismatchRef.current,
      sourceMismatchMessage: sourceMismatchMessageRef.current,
      warnings: (() => {
        const w: string[] = [];
        const r = state.breakpointReport;
        if (r && r.requested > 0) {
          w.push(`断点：已下发 ${r.requested} 个，已验证 ${r.verified} 个（source: ${r.sourcePath}）`);
          if (r.verified <= 0) {
            w.push("断点未生效：断点均未验证；请确认已进入后端调试且行号对应当前代码版本");
          } else if (r.unverified > 0) {
            w.push("断点部分未生效：存在未验证断点；可尝试移动断点到可执行语句行后重试");
          }
          if (r.unverifiedLines.length > 0) {
            w.push(`未验证断点行：${r.unverifiedLines.join(", ")}`);
          }
          if (r.unverifiedMessages.length > 0) {
            w.push(`断点验证提示：${r.unverifiedMessages.join("；")}`);
          }
        }
        if (sourceMismatchRef.current && sourceMismatchMessageRef.current) {
          w.push(sourceMismatchMessageRef.current);
        }
        return w;
      })(),
    },
    error: state.error,
    startDebug,
    runPlain,
    stopDebug,
    continueRun,
    pause: pauseRun,
    stepOver,
    stepInto,
    stepOut,
    reset: stopDebug,
    clearOutput: () => dispatch({ type: "CLEAR_OUTPUT" }),
    clearBreakpoints: () => dispatch({ type: "UPDATE_BREAKPOINTS", payload: () => [] }),
    setBreakpoints,
    toggleBreakpoint,
    setBreakpointEnabled,
    setBreakpointCondition,
    setBreakpointHitCount,
    addWatch,
    removeWatch,
    evaluate,
    // History stubs to satisfy interface
    historyBack: () => { },
    historyForward: () => { },
    historyToLatest: () => { },
    setHistoryIndex: () => { },
    setSelectedFrameIndex: (idx: number) => dispatch({ type: "SET_SELECTED_FRAME", payload: idx }),
    selectFrame: (idx: number) => dispatch({ type: "SET_SELECTED_FRAME", payload: idx }),
    setWatchExprs: (exprs: string[]) => dispatch({ type: "UPDATE_WATCH_EXPRS", payload: exprs }),
    clearPendingOutput: () => dispatch({ type: "CLEAR_PENDING_OUTPUT" }),
  };
}
