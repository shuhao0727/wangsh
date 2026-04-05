import { useCallback, useEffect, useReducer, useRef } from "react";
import { authApi, getStoredAccessToken, getCookieToken, authTokenStorage } from "@services/api";
import { pythonlabSessionApi } from "../services/pythonlabSessionApi";
import { diffVarTrace, parseDapMessageMeta, parseDapOutputMeta, wsUrl, wsCloseHint } from "./dapRunnerHelpers";
import { computeDebugNodeSelection, type DebugMap } from "../flow/debugMap";
import { extractInputPrompts, promptAndInlineInputs } from "./inputInline";
import { summarizeDapBreakpointReport, type DapBreakpointReport } from "./dapBreakpointReport";
import { detectSourceMismatch } from "./sourceSync";
import { logger } from "@services/logger";

// --- Types ---

export type RunnerStatus = "idle" | "starting" | "running" | "paused" | "stopped" | "error";

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

// DAP protocol message types
interface DapMessage {
  type: "request" | "response" | "event";
  seq?: number;
  request_seq?: number;
  success?: boolean;
  message?: string;
  command?: string;
  event?: string;
  body?: Record<string, unknown>;
  arguments?: Record<string, unknown>;
}

type DapEventHandler = (msg: DapMessage) => void;
type DapCloseHandler = (ev: CloseEvent) => void;

interface DapStackFrame {
  id: number;
  name: string;
  line: number;
  source?: { path?: string };
}

interface DapScope {
  name: string;
  variablesReference: number;
}

interface DapVariable {
  name: string;
  value: string;
  type?: string;
}

// Snapshot for history
export interface SnapshotEntry {
  step: number;
  activeLine: number | null;
  variables: Variable[];
}

export interface InternalRunnerState {
  status: RunnerStatus;
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

function reducer(state: InternalRunnerState, action: Action): InternalRunnerState {
  switch (action.type) {
    case "SET_STATUS":
      return { ...state, status: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload, status: "error" };
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

// --- DAP Client Helper ---

class DapClient {
  private ws: WebSocket | null = null;
  private seq = 1;
  private pending = new Map<number, { resolve: (v: DapMessage) => void; reject: (e: Error) => void }>();
  private eventHandlers: Record<string, DapEventHandler> = {};
  private closeHandler: DapCloseHandler | null = null;

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error("WebSocket connection failed"));
      this.ws.onclose = (ev) => { if (this.closeHandler) this.closeHandler(ev); };
      this.ws.onmessage = (ev) => this.handleMessage(ev.data);
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.pending.forEach((p) => p.reject(new Error("Disconnected")));
    this.pending.clear();
  }

  on(event: "close", handler: DapCloseHandler): void;
  on(event: string, handler: DapEventHandler): void;
  on(event: string, handler: DapEventHandler | DapCloseHandler) {
    if (event === "close") {
      this.closeHandler = handler as DapCloseHandler;
    } else {
      this.eventHandlers[event] = handler as DapEventHandler;
    }
  }

  emit(event: string, msg: DapMessage) {
    if (this.eventHandlers[event]) this.eventHandlers[event](msg);
  }

  private handleMessage(data: unknown) {
    try {
      const msg = JSON.parse(String(data)) as DapMessage;
      if (msg.type === "response") {
        const p = this.pending.get(msg.request_seq!);
        if (p) {
          this.pending.delete(msg.request_seq!);
          if (msg.success) p.resolve(msg);
          else p.reject(new Error(msg.message || "Request failed"));
        }
      } else if (msg.type === "event") {
        this.emit(msg.event!, msg);
      }
    } catch (e) {
      logger.error("Failed to parse DAP message", e);
    }
  }

  request(command: string, args: Record<string, unknown> = {}, timeout = 5000): Promise<DapMessage> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error("Not connected"));
    const seq = this.seq++;
    this.pending.set(seq, { resolve: () => { }, reject: () => { } }); // Placeholder
    const promise = new Promise<DapMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(seq);
        reject(new Error(`Timeout: ${command}`));
      }, timeout);
      this.pending.set(seq, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); }
      });
    });

    const req = { seq, type: "request", command, arguments: args };
    this.ws.send(JSON.stringify(req));
    return promise;
  }

  sendStdin(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "stdin",
        body: { data: text }
      }));
    }
  }
}

// --- Hook ---

export function useDapRunner(params: { code: string; debugMap: DebugMap | null }) {
  const { code, debugMap } = params;
  const [state, dispatch] = useReducer(reducer, initialState);
  const clientRef = useRef<DapClient>(new DapClient());
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
    if (plainStatusTimerRef.current) {
      clearInterval(plainStatusTimerRef.current);
      plainStatusTimerRef.current = null;
    }
    sourceMismatchRef.current = false;
    sourceMismatchMessageRef.current = null;
    wsEpochRef.current = null;
    wsConnIdRef.current = null;
    clientConnIdRef.current = null;
    ignoreNextCloseRef.current = true;
    clientRef.current.disconnect();
    if (!preserveSession && sessionIdRef.current) {
      pythonlabSessionApi.stop(sessionIdRef.current).catch(() => { });
      sessionIdRef.current = null;
    }
    if (!preserveSession) {
      dispatch({ type: "SET_SESSION_ID", payload: null });
    }
    dispatch({ type: "SET_ACTIVE_LINE", payload: null });
    dispatch({ type: "SET_ACTIVE_EMPHASIS", payload: { activeFlowLine: null, activeFocusRole: null, activeNodeId: null } });
    dispatch({ type: "SET_STATUS", payload: "stopped" });
  }, [traceLifecycle]);

  // --- Actions ---

  const refreshBreakpoints = useCallback(async (next?: InternalRunnerState["breakpoints"]) => {
    if (modeRef.current === "plain") {
      // Send empty breakpoints in plain mode
      const sourcePath = "/workspace/main.py";
      await clientRef.current.request("setBreakpoints", {
        source: { path: sourcePath },
        breakpoints: []
      });
      return;
    }

    const bps = (next ?? stateRef.current.breakpoints).filter(b => b.enabled);
    const sourcePath = "/workspace/main.py";
    const resp = await clientRef.current.request("setBreakpoints", {
      source: { path: sourcePath },
      breakpoints: bps.map(b => ({ line: b.line, condition: b.condition, hitCondition: b.hitCount ? String(b.hitCount) : undefined }))
    });
    dispatch({
      type: "SET_BREAKPOINT_REPORT",
      payload: summarizeDapBreakpointReport({ requested: bps.length, sourcePath, resp }),
    });
  }, []);

  const fetchStack = useCallback(async (threadId: number) => {
    try {
      const fetchSeq = ++stackFetchSeqRef.current;
      const stackResp = await clientRef.current.request("stackTrace", { threadId, startFrame: 0, levels: 20 });
      if (fetchSeq !== stackFetchSeqRef.current) return;
      const frames = (stackResp.body?.stackFrames || []) as DapStackFrame[];
      if (frames.length === 0) return;

      const isUserMainPath = (p: string) => {
        const path = String(p || "").replace(/\\/g, "/").toLowerCase();
        return path.endsWith("/workspace/main.py") || path.endsWith("/main.py") || path.endsWith("main.py");
      };
      const primaryFrameIndex = (() => {
        const idx = frames.findIndex((f) => isUserMainPath(String(f?.source?.path || "")));
        return idx >= 0 ? idx : 0;
      })();
      const orderedFrames = primaryFrameIndex <= 0
        ? frames
        : [frames[primaryFrameIndex], ...frames.slice(0, primaryFrameIndex), ...frames.slice(primaryFrameIndex + 1)];

      const topFrame = orderedFrames[0];
      const mappedFrames: Frame[] = orderedFrames.map((f) => ({
        id: f.id,
        name: f.name,
        line: f.line,
        file: f.source?.path || "",
        variables: []
      }));

      dispatch({ type: "SET_FRAMES", payload: mappedFrames });
      dispatch({ type: "SET_ACTIVE_LINE", payload: topFrame.line });

      // Fetch variables for top frame
      const scopesResp = await clientRef.current.request("scopes", { frameId: topFrame.id });
      if (fetchSeq !== stackFetchSeqRef.current) return;
      const scopes = (scopesResp.body?.scopes || []) as DapScope[];
      const localScope = scopes.find((s) => s.name === "Locals") || scopes[0];

      if (localScope) {
        const varsResp = await clientRef.current.request("variables", { variablesReference: localScope.variablesReference });
        if (fetchSeq !== stackFetchSeqRef.current) return;
        const vars = ((varsResp.body?.variables || []) as DapVariable[])
          .filter((v) => !v.name.startsWith("__") && !v.name.includes("special variables") && !v.name.includes("function variables"))
          .map((v) => ({
            name: v.name,
            value: v.value,
            type: v.type || "unknown"
          }));
        dispatch({ type: "SET_VARIABLES", payload: vars });

        const prevVars = prevVarsRef.current;
        const stepNo = stepsRef.current;
        const diff = diffVarTrace(stepNo, prevVars, vars);
        dispatch({ type: "SET_CHANGED_VARS", payload: diff.changed });
        if (diff.lines.length) dispatch({ type: "APPEND_TRACE_LINES", payload: diff.lines });

        const selection = computeDebugNodeSelection({
          debugMap: debugMapRef.current,
          activeLine: topFrame.line ?? null,
          prevActiveLine: prevActiveLineRef.current,
          prevStackDepth: prevStackDepthRef.current,
          nextStackDepth: mappedFrames.length,
          prevVars,
          nextVars: diff.next,
        });

        emphasisSeqRef.current += 1;
        const mySeq = emphasisSeqRef.current;
        if (emphasisTimerRef.current) {
          clearTimeout(emphasisTimerRef.current);
          emphasisTimerRef.current = null;
        }

        if (sourceMismatchRef.current) {
          dispatch({
            type: "SET_ACTIVE_EMPHASIS",
            payload: { activeFlowLine: topFrame.line ?? null, activeFocusRole: null, activeNodeId: null },
          });
          prevVarsRef.current = diff.next;
          prevActiveLineRef.current = topFrame.line ?? null;
          prevStackDepthRef.current = mappedFrames.length;
        } else {

          dispatch({
            type: "SET_ACTIVE_EMPHASIS",
            payload: { activeFlowLine: selection.activeFlowLine, activeFocusRole: selection.activeFocusRole, activeNodeId: selection.activeNodeId },
          });

          if (selection.transitionQueue.length >= 2) {
            const queue = selection.transitionQueue.slice(1);
            const MIN_STEP_DURATION = 500;

            const playNext = (idx: number) => {
              if (idx >= queue.length) {
                emphasisTimerRef.current = null;
                return;
              }
              const nextNodeId = queue[idx];
              const thenRole = idx === 0 ? (selection.inferred?.thenRole ?? null) : null;

              const tid = setTimeout(() => {
                if (emphasisSeqRef.current !== mySeq) return;
                if (stateRef.current.status !== "paused") return;
                dispatch({
                  type: "SET_ACTIVE_EMPHASIS",
                  payload: { activeFlowLine: selection.activeFlowLine, activeFocusRole: thenRole, activeNodeId: nextNodeId },
                });
                playNext(idx + 1);
              }, MIN_STEP_DURATION);
              emphasisTimerRef.current = tid;
            };

            playNext(0);
          }

          prevVarsRef.current = diff.next;
          prevActiveLineRef.current = topFrame.line ?? null;
          prevStackDepthRef.current = mappedFrames.length;
        }
      }
      if (stateRef.current.watchExprs.length > 0) {
        const watchResults: WatchResult[] = [];
        for (const expr of stateRef.current.watchExprs) {
          try {
            const resp = await clientRef.current.request("evaluate", { expression: expr, frameId: topFrame.id, context: "watch" });
            watchResults.push({ expr, ok: true, value: String(resp.body?.result ?? ""), type: String(resp.body?.type ?? "") });
          } catch (e: unknown) {
            watchResults.push({ expr, ok: false, error: (e instanceof Error ? e.message : String(e)) || "Error" });
          }
        }
        dispatch({ type: "SET_WATCH_RESULTS", payload: watchResults });
      }
    } catch (e) {
      logger.error("Fetch stack failed", e);
    }
  }, []);

  const startSession = useCallback(async (mode: "debug" | "plain", stdinText?: string) => {
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

    try {
      // Clean up previous session explicitly if it exists, BUT do not trigger full cleanup() 
      // because cleanup() increments startTokenRef, which would invalidate our current myToken!
      // This was the bug: calling cleanup() inside startSession invalidated the session we just started.
      if (sessionIdRef.current) {
        pythonlabSessionApi.stop(sessionIdRef.current).catch(() => { });
        sessionIdRef.current = null;
      }

      // Stop DAP client silently without full state reset (since we are about to reset it anyway)
      if (clientRef.current) {
        clientRef.current.disconnect();
      }

      dispatch({ type: "SET_SESSION_ID", payload: null });
      prevVarsRef.current = new Map();
      prevActiveLineRef.current = null;
      prevStackDepthRef.current = null;
      sourceMismatchRef.current = false;
      sourceMismatchMessageRef.current = null;
      ignoreNextCloseRef.current = false;

      // Removed redundant dispatch calls here since we did them above

      // No more pre-check for input() requirements since we support runtime stdin
      // But we can still keep extractInputPrompts if we want to visualize something?
      // Actually, with runtime stdin, we just run the code.
      // If code needs input, it blocks and waits for stdin.

      // 1. Create Session with timeout
      const createPromise = pythonlabSessionApi.create({
        title: "pythonlab",
        code: code, // Use raw code, no injection
        runtime_mode: mode === "debug" ? "debug" : "plain",
        entry_path: "main.py",
        requirements: [],
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("请求响应超时，请检查网络或后端服务状态")), 12000)
      );

      const session = await Promise.race([createPromise, timeoutPromise]);

      sessionIdRef.current = session.session_id;
      traceLifecycle("session_created", { mode, sessionId: session.session_id });

      // 2. Wait for Ready (Adaptive Polling)
      const maxWaitMs = 75000;
      const startTime = Date.now();
      let waited = 0;
      let readyMeta: Record<string, unknown> | null = null;

      while (waited < maxWaitMs) {
        if (startTokenRef.current !== myToken) return;
        let meta: Record<string, unknown>;
        try {
          meta = await pythonlabSessionApi.get(session.session_id) as Record<string, unknown>;
        } catch (e: unknown) {
          const err = e as { response?: { status?: number } };
          if (err?.response?.status === 404) throw new Error("会话不存在/已被清理，可点右侧会话查看后重试");
          throw e;
        }
        if (String(meta.status) === "READY") {
          readyMeta = meta;
          traceLifecycle("session_ready", { mode, sessionId: session.session_id });
          break;
        }
        if (String(meta.status) === "FAILED") throw new Error(String(meta.error_detail || "Session failed to start"));

        // Adaptive interval: 200ms for first 3s, then 500ms, then 1000ms
        const elapsed = Date.now() - startTime;
        const nextPoll = elapsed < 5000 ? 150 : elapsed < 15000 ? 350 : 700;
        await new Promise((r) => setTimeout(r, nextPoll));
        waited += nextPoll; // Approx
      }
      if (waited >= maxWaitMs) throw new Error("调试会话启动超时：容器/调试器仍在启动或队列拥堵；可点右侧“会话”查看后重试");
      dispatch({ type: "SET_SESSION_ID", payload: session.session_id });

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
        if (plainStatusTimerRef.current) {
          clearInterval(plainStatusTimerRef.current);
          plainStatusTimerRef.current = null;
        }
        plainStatusTimerRef.current = setInterval(async () => {
          if (startTokenRef.current !== myToken) {
            if (plainStatusTimerRef.current) {
              clearInterval(plainStatusTimerRef.current);
              plainStatusTimerRef.current = null;
            }
            return;
          }
          try {
            const m = await pythonlabSessionApi.get(session.session_id);
            if (m.status === "FAILED") {
              dispatch({ type: "SET_ERROR", payload: m.error_detail || "运行失败" });
              dispatch({ type: "SET_STATUS", payload: "error" });
              if (plainStatusTimerRef.current) {
                clearInterval(plainStatusTimerRef.current);
                plainStatusTimerRef.current = null;
              }
              return;
            }
            if (m.status === "TERMINATED") {
              if (stateRef.current.startTime) {
                const now = Date.now();
                const elapsed = (now - stateRef.current.startTime) / 1000;
                elapsedRef.current += elapsed;
          dispatch({ type: "UPDATE_ELAPSED_TIME", payload: elapsedRef.current });
                dispatch({ type: "SET_START_TIME", payload: null });
              }
              dispatch({ type: "SET_STATUS", payload: "stopped" });
              if (plainStatusTimerRef.current) {
                clearInterval(plainStatusTimerRef.current);
                plainStatusTimerRef.current = null;
              }
            }
          } catch {
          }
        }, 1000);
        return;
      }

      // 3. Acquire token for WS (prefer sessionStorage; fall back to refresh)
      let token = getStoredAccessToken();
      if (!token) token = getCookieToken();
      if (!token) {
        try {
          const r = await authApi.refreshToken(undefined);
          const data = r?.data as Record<string, string> | null;
          if (data?.access_token || data?.refresh_token) {
            authTokenStorage.set(data?.access_token ?? null, data?.refresh_token ?? null);
            token = String(data?.access_token || "");
          }
        } catch {
        }
      }

      const clientConnId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      clientConnIdRef.current = clientConnId;
      const wsPath = `/api/v1/debug/sessions/${session.session_id}/ws?client_conn_id=${encodeURIComponent(clientConnId)}`;
      const url = wsUrl(wsPath, token);
      traceLifecycle("ws_connecting", { sessionId: session.session_id });

      // Setup listeners
      const client = clientRef.current;
      client.disconnect(); // Ensure clean slate
      let configuredSent = false;
      let initializedResolved = false;
      let resolveInitialized: (() => void) | null = null;
      const initializedPromise = new Promise<void>((resolve) => {
        resolveInitialized = () => {
          if (initializedResolved) return;
          initializedResolved = true;
          resolve();
        };
      });
      const configureSessionOnce = async () => {
        if (configuredSent) return;
        configuredSent = true;
        await refreshBreakpoints();
        await client.request("configurationDone", {}, 10000);
      };

      client.on("output", (msg) => {
        const body = msg?.body;
        const meta = parseDapOutputMeta(body);
        wsEpochRef.current = meta.wsEpoch ?? wsEpochRef.current;
        wsConnIdRef.current = meta.connId ?? wsConnIdRef.current;
        clientConnIdRef.current = meta.clientConnId ?? clientConnIdRef.current;
        const category = String(body?.category || "").toLowerCase();
        if (body && typeof body.output === "string") {
          traceLifecycle("dap_output", {
            category: category || "unknown",
            length: body.output.length,
            outputSource: meta.source,
            sourceTs: meta.ts,
            sourceWsEpoch: meta.wsEpoch,
            sourceConnId: meta.connId,
            sourceClientConnId: meta.clientConnId,
          });
          dispatch({ type: "APPEND_OUTPUT", payload: body.output });
        }
      });

      client.on("stopped", (msg) => {
        const meta = parseDapMessageMeta(msg);
        wsEpochRef.current = meta.wsEpoch ?? wsEpochRef.current;
        wsConnIdRef.current = meta.connId ?? wsConnIdRef.current;
        clientConnIdRef.current = meta.clientConnId ?? clientConnIdRef.current;
        traceLifecycle("dap_stopped", { threadId: msg?.body?.threadId || 1, sourceWsEpoch: meta.wsEpoch, sourceConnId: meta.connId, sourceClientConnId: meta.clientConnId });
        if (stateRef.current.startTime) {
          const now = Date.now();
          const elapsed = (now - stateRef.current.startTime) / 1000;
          elapsedRef.current += elapsed;
          dispatch({ type: "UPDATE_ELAPSED_TIME", payload: elapsedRef.current });
          dispatch({ type: "SET_START_TIME", payload: null });
        }
        // Exception info is printed to TTY by Python traceback
        dispatch({ type: "SET_STATUS", payload: "paused" });
        dispatch({ type: "INCREMENT_STEPS" });
        stepsRef.current += 1;
        fetchStack(Number(msg.body?.threadId) || 1).catch((e) => {
          logger.error("fetchStack failed in stopped handler", e);
        });
      });

      client.on("continued", (msg) => {
        const meta = parseDapMessageMeta(msg);
        wsEpochRef.current = meta.wsEpoch ?? wsEpochRef.current;
        wsConnIdRef.current = meta.connId ?? wsConnIdRef.current;
        clientConnIdRef.current = meta.clientConnId ?? clientConnIdRef.current;
        traceLifecycle("dap_continued", { sourceWsEpoch: meta.wsEpoch, sourceConnId: meta.connId, sourceClientConnId: meta.clientConnId });
        dispatch({ type: "SET_STATUS", payload: "running" });
      });

      client.on("terminated", (msg) => {
        const meta = parseDapMessageMeta(msg);
        wsEpochRef.current = meta.wsEpoch ?? wsEpochRef.current;
        wsConnIdRef.current = meta.connId ?? wsConnIdRef.current;
        clientConnIdRef.current = meta.clientConnId ?? clientConnIdRef.current;
        traceLifecycle("dap_terminated", { sourceWsEpoch: meta.wsEpoch, sourceConnId: meta.connId, sourceClientConnId: meta.clientConnId });
        // dispatch({ type: "APPEND_STDOUT", payload: "程序已结束\n" });
        if (stateRef.current.startTime) {
          const now = Date.now();
          const elapsed = (now - stateRef.current.startTime) / 1000;
          elapsedRef.current += elapsed;
          dispatch({ type: "UPDATE_ELAPSED_TIME", payload: elapsedRef.current });
          dispatch({ type: "SET_START_TIME", payload: null });
        }
        cleanup({ preserveSession: true });
      });

      client.on("initialized", async () => {
        traceLifecycle("dap_initialized", { clientConnId });
        resolveInitialized?.();
        try {
          await configureSessionOnce();
        } catch (e) {
          logger.error("Failed to configure DAP", e);
        }
      });

      client.on("close", (ev: CloseEvent) => {
        traceLifecycle("dap_close", { code: ev.code, reason: ev.reason || "" });
        if (ignoreNextCloseRef.current) {
          ignoreNextCloseRef.current = false;
          dispatch({ type: "SET_STATUS", payload: "stopped" });
          return;
        }
        const hint = wsCloseHint(ev.code);
        if (ev.code === 4401) {
          dispatch({ type: "SET_ERROR", payload: "登录已过期，请刷新页面" });
        } else if (ev.code === 4429 && String(ev.reason || "").includes("taken_over")) {
          dispatch({ type: "SET_ERROR", payload: "当前调试会话已被新窗口接管" });
        } else if (ev.code === 4429 && String(ev.reason || "").includes("deny_in_use")) {
          dispatch({ type: "SET_ERROR", payload: "该会话正在其他窗口调试，请先停止原窗口后重试" });
        } else if (ev.code === 4429) {
          dispatch({ type: "SET_ERROR", payload: "该会话触发互斥策略关闭，请稍后重试" });
        } else if (ev.code !== 1000) {
          dispatch({ type: "SET_ERROR", payload: `连接已关闭（${ev.code}）：${hint || ev.reason || "未知原因"}` });
        }
        dispatch({ type: "SET_ACTIVE_LINE", payload: null });
        dispatch({ type: "SET_ACTIVE_EMPHASIS", payload: { activeFlowLine: null, activeFocusRole: null, activeNodeId: null } });
        dispatch({ type: "SET_STATUS", payload: "stopped" });
      });

      await client.connect(url);
      traceLifecycle("ws_connected", { sessionId: session.session_id });
      const requestWithRetry = async (command: string, args: Record<string, unknown>, timeout: number, retry = 1) => {
        let lastErr: unknown = null;
        for (let i = 0; i <= retry; i++) {
          try {
            return await client.request(command, args, timeout);
          } catch (err: unknown) {
            lastErr = err;
            if (i >= retry) break;
            await new Promise((r) => setTimeout(r, 300));
          }
        }
        throw lastErr;
      };

      // 4. Initialize DAP
      // Note: We do NOT await launch here. We await initialize, then send launch.
      // The server will send 'initialized' event when ready for breakpoints.

      const initializeResp = await requestWithRetry("initialize", {
        adapterID: "python",
        linesStartAt1: true,
        columnsStartAt1: true,
        pathFormat: "path"
      }, 20000, 2);
      const initCaps = (initializeResp as DapMessage)?.body || null;
      dispatch({
        type: "SET_DAP_CAPABILITIES",
        payload: initCaps
          ? {
            supportsStepBack: !!initCaps.supportsStepBack,
            supportsEvaluateForHovers: !!initCaps.supportsEvaluateForHovers,
            supportsCompletionsRequest: !!initCaps.supportsCompletionsRequest,
            supportsSetVariable: !!initCaps.supportsSetVariable,
            supportsConfigurationDoneRequest: !!initCaps.supportsConfigurationDoneRequest,
          }
          : null,
      });
      traceLifecycle("dap_initialize_ok");

      await requestWithRetry("attach", {
        name: "Remote",
        type: "python",
        request: "attach",
        redirectOutput: true,
        pathMappings: [
          {
            localRoot: "/workspace",
            remoteRoot: "/workspace"
          }
        ],
        justMyCode: true
      }, 20000, 1);
      traceLifecycle("dap_attach_ok");

      await Promise.race([
        initializedPromise,
        new Promise<void>((resolve) => setTimeout(resolve, 2000)),
      ]);

      await configureSessionOnce();
      traceLifecycle("dap_configured");

      dispatch({ type: "SET_STATUS", payload: "running" });

    } catch (e: unknown) {
      if (startTokenRef.current === myToken) {
        startInFlightRef.current = false;
        const msg = (e instanceof Error ? e.message : String(e)) || "启动失败";
        dispatch({ type: "SET_ERROR", payload: msg });
        dispatch({ type: "SET_STATUS", payload: "error" });
        throw e; // Re-throw to let UI handle it
      }
    } finally {
      if (startTokenRef.current === myToken) {
        startInFlightRef.current = false;
      }
    }
  }, [code, traceLifecycle]);

  const startDebug = useCallback((stdinText?: string) => startSession("debug", stdinText), [startSession]);
  const runPlain = useCallback((stdinText?: string) => startSession("plain", stdinText), [startSession]);

  const stopDebug = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (modeRef.current === "debug" && stateRef.current.status !== "idle" && stateRef.current.status !== "stopped") {
      try {
        await clientRef.current.request("disconnect", { terminateDebuggee: true }, 1200);
      } catch { }
    }
    cleanup({ preserveSession: true });
    if (sid) {
      try {
        await pythonlabSessionApi.stop(sid);
      } catch { }
    }
    sessionIdRef.current = null;
    dispatch({ type: "RESET_SESSION", payload: { preserveOutput: true } });
    dispatch({ type: "SET_SESSION_ID", payload: null });
    dispatch({ type: "SET_START_TIME", payload: null });
    dispatch({ type: "UPDATE_ELAPSED_TIME", payload: 0 });
  }, [cleanup]);

  const continueRun = useCallback(async () => {
    try {
      await clientRef.current.request("continue", { threadId: 1 });
      dispatch({ type: "SET_STATUS", payload: "running" });
    } catch (_e) { }
  }, []);

  const pauseRun = useCallback(async () => {
    try {
      await clientRef.current.request("pause", { threadId: 1 });
    } catch (_e) { }
  }, []);

  const stepOver = useCallback(async () => {
    try {
      await clientRef.current.request("next", { threadId: 1 });
      dispatch({ type: "SET_STATUS", payload: "running" });
    } catch (_e) { }
  }, []);

  const stepInto = useCallback(async () => {
    try {
      await clientRef.current.request("stepIn", { threadId: 1 });
      dispatch({ type: "SET_STATUS", payload: "running" });
    } catch (_e) { }
  }, []);

  const stepOut = useCallback(async () => {
    try {
      await clientRef.current.request("stepOut", { threadId: 1 });
      dispatch({ type: "SET_STATUS", payload: "running" });
    } catch (_e) { }
  }, []);

  const evaluate = useCallback(async (expr: string) => {
    try {
      // Use top frame
      const frameId = stateRef.current.frames[0]?.id;
      if (!frameId) throw new Error("No active frame");

      const resp = await clientRef.current.request("evaluate", { expression: expr, frameId, context: "repl" });
      return { ok: true, value: String(resp.body?.result ?? ""), type: String(resp.body?.type ?? "") };
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
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
    if (stateRef.current.watchExprs.includes(expr)) return;

    // 1. Update state
    dispatch({ type: "UPDATE_WATCH_EXPRS", payload: [...stateRef.current.watchExprs, expr] });

    // 2. If paused, evaluate immediately
    if (stateRef.current.status === "paused" && stateRef.current.frames.length > 0) {
      try {
        const frameId = stateRef.current.frames[0].id;
        const resp = await clientRef.current.request("evaluate", { expression: expr, frameId, context: "watch" });
        const result: WatchResult = { expr, ok: true, value: String(resp.body?.result ?? ""), type: String(resp.body?.type ?? "") };

        // Merge with existing results (dedupe by expr)
        dispatch({ type: "SET_WATCH_RESULTS", payload: [...stateRef.current.watchResults.filter(r => r.expr !== expr), result] });
      } catch (e: unknown) {
        dispatch({ type: "SET_WATCH_RESULTS", payload: [...stateRef.current.watchResults.filter(r => r.expr !== expr), { expr, ok: false, error: (e instanceof Error ? e.message : String(e)) || "Error" }] });
      }
    }
  }, []);

  const removeWatch = useCallback((expr: string) => {
    dispatch({ type: "UPDATE_WATCH_EXPRS", payload: stateRef.current.watchExprs.filter(e => e !== expr) });
    dispatch({ type: "SET_WATCH_RESULTS", payload: stateRef.current.watchResults.filter(r => r.expr !== expr) });
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
