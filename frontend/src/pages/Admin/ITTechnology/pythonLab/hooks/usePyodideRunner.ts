import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { computeDebugNodeSelection, type DebugMap } from "../flow/debugMap";
import type { Frame, InternalRunnerState, RunnerState, RunnerStatus, Variable, WatchResult } from "./useDapRunner";

type WorkerReady = { ok: boolean; debugCapable: boolean; error?: string };
type WorkerPaused = { line: number; variables: Variable[] };

type TerminalListener = (s: string) => void;

type Breakpoint = { line: number; enabled: boolean; condition?: string; hitCount?: number };
type WorkerMode = "plain" | "debug";

type Action =
  | { type: "SET_STATUS"; payload: RunnerStatus }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "APPEND_TRACE_LINES"; payload: string[] }
  | { type: "CLEAR_OUTPUT" }
  | { type: "SET_FRAMES"; payload: Frame[] }
  | { type: "SET_VARIABLES"; payload: Variable[] }
  | { type: "SET_ACTIVE_LINE"; payload: number | null }
  | { type: "SET_ACTIVE_EMPHASIS"; payload: { activeFlowLine: number | null; activeFocusRole: string | null; activeNodeId: string | null } }
  | { type: "SET_SELECTED_FRAME"; payload: number }
  | { type: "UPDATE_BREAKPOINTS"; payload: (prev: Breakpoint[]) => Breakpoint[] }
  | { type: "UPDATE_WATCH_EXPRS"; payload: string[] }
  | { type: "SET_WATCH_RESULTS"; payload: WatchResult[] }
  | { type: "INCREMENT_STEPS" }
  | { type: "RESET_SESSION" }
  | { type: "UPDATE_ELAPSED_TIME"; payload: number }
  | { type: "SET_START_TIME"; payload: number | null };

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
    case "SET_ACTIVE_LINE":
      return { ...state, activeLine: action.payload };
    case "SET_ACTIVE_EMPHASIS":
      return { ...state, ...action.payload };
    case "SET_SELECTED_FRAME":
      return { ...state, selectedFrameIndex: action.payload };
    case "UPDATE_BREAKPOINTS":
      return { ...state, breakpoints: action.payload(state.breakpoints) };
    case "UPDATE_WATCH_EXPRS":
      return { ...state, watchExprs: action.payload };
    case "SET_WATCH_RESULTS":
      return { ...state, watchResults: action.payload };
    case "INCREMENT_STEPS":
      return { ...state, steps: state.steps + 1 };
    case "RESET_SESSION":
      return {
        ...state,
        status: "idle",
        error: null,
        activeLine: null,
        activeFlowLine: null,
        activeNodeId: null,
        activeFocusRole: null,
        frames: [],
        variables: [],
        changedVars: [],
        breakpointReport: null,
        steps: 0,
        startTime: null,
        elapsedTime: 0,
        sessionId: null,
        pendingOutput: [],
      };
    case "UPDATE_ELAPSED_TIME":
      return { ...state, elapsedTime: action.payload };
    case "SET_START_TIME":
      return { ...state, startTime: action.payload };
    default:
      return state;
  }
}

function defaultPyodideBaseUrl() {
  const v = (process.env.REACT_APP_PYODIDE_BASE_URL || "").trim();
  return v || "/pyodide/";
}

function canUseSharedArrayBuffer() {
  try {
    return window.crossOriginIsolated === true && typeof SharedArrayBuffer !== "undefined";
  } catch {
    return false;
  }
}

const CTRL_HEADER_I32_LEN = 64;
const INPUT_MAX_CODE_UNITS = 8192;
const EVAL_MAX_CODE_UNITS = 4096;

export type PyodideTerminalBridge = {
  subscribe: (fn: TerminalListener) => () => void;
  sendInputLine: (line: string) => void;
};

export function usePyodideRunner(params: { code: string; debugMap: DebugMap | null }) {
  const { code, debugMap } = params;
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const trace = useCallback((phase: string, extra?: Record<string, unknown>) => {
    try {
      const enabled =
        process.env.NODE_ENV !== "production" ||
        Boolean((window as unknown as { __PYTHONLAB_PYODIDE_TRACE__?: boolean }).__PYTHONLAB_PYODIDE_TRACE__) ||
        window.localStorage?.getItem("pythonlab:pyodide:trace") === "1";
      if (!enabled) return;
      console.info("[pythonlab:pyodide]", { phase, status: stateRef.current.status, ts: Date.now(), ...(extra || {}) });
    } catch {}
  }, []);

  const workerRef = useRef<Worker | null>(null);
  const workerModeRef = useRef<WorkerMode | null>(null);
  const readyRef = useRef<WorkerReady | null>(null);
  const readyWaitersRef = useRef<Array<(ready: WorkerReady) => void>>([]);
  const listenersRef = useRef(new Set<TerminalListener>());
  const awaitingInputRef = useRef(false);
  const ctrlRef = useRef<Int32Array | null>(null);
  const inputText16Ref = useRef<Uint16Array | null>(null);
  const evalText16Ref = useRef<Uint16Array | null>(null);
  const elapsedTimerRef = useRef<number | null>(null);
  const prevVarsRef = useRef<Map<string, { value: string; type: string }>>(new Map());
  const debugCapable = readyRef.current?.debugCapable ?? false;

  const terminal = useMemo<PyodideTerminalBridge>(() => {
    return {
      subscribe: (fn) => {
        listenersRef.current.add(fn);
        return () => listenersRef.current.delete(fn);
      },
      sendInputLine: (line) => {
        if (!awaitingInputRef.current) return;
        if (!ctrlRef.current || !inputText16Ref.current) return;
        awaitingInputRef.current = false;
        const ctrl = ctrlRef.current;
        const buf = inputText16Ref.current;
        const text = String(line ?? "");
        const len = Math.min(text.length, INPUT_MAX_CODE_UNITS);
        for (let i = 0; i < len; i++) buf[i] = text.charCodeAt(i);
        Atomics.store(ctrl, 4, len);
        Atomics.store(ctrl, 3, 1);
        Atomics.notify(ctrl, 3, 1);
      },
    };
  }, []);

  const writeTerminal = useCallback((s: string) => {
    for (const fn of Array.from(listenersRef.current)) {
      try {
        fn(s);
      } catch { }
    }
  }, []);

  const startElapsedTimer = useCallback(() => {
    if (elapsedTimerRef.current) return;
    const startAt = Date.now();
    elapsedTimerRef.current = window.setInterval(() => {
      const st = stateRef.current;
      if (!st.startTime) return;
      const elapsed = (Date.now() - st.startTime) / 1000;
      dispatch({ type: "UPDATE_ELAPSED_TIME", payload: st.elapsedTime + elapsed });
      dispatch({ type: "SET_START_TIME", payload: Date.now() });
    }, 1000);
    if (!stateRef.current.startTime) dispatch({ type: "SET_START_TIME", payload: startAt });
  }, []);

  const stopElapsedTimer = useCallback(() => {
    if (elapsedTimerRef.current) {
      window.clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    dispatch({ type: "SET_START_TIME", payload: null });
  }, []);

  const setStatus = useCallback(
    (st: RunnerStatus) => {
      dispatch({ type: "SET_STATUS", payload: st });
      if (st === "running") startElapsedTimer();
      if (st === "paused" || st === "stopped" || st === "idle" || st === "error") stopElapsedTimer();
    },
    [startElapsedTimer, stopElapsedTimer]
  );

  const breakpointsRef = useRef<Breakpoint[]>([]);

  const updateBreakpointsToWorker = useCallback((bps: Breakpoint[]) => {
    breakpointsRef.current = bps;
    if (!workerRef.current) return;
    if (stateRef.current.status === "paused") return;
    try {
      workerRef.current.postMessage({ type: "setBreakpoints", breakpoints: bps });
    } catch { }
  }, []);

  const pendingEvalResolveRef = useRef<((msg: { ok: boolean; value?: unknown; valueType?: unknown; error?: string }) => void) | null>(null);

  const resolveReadyWaiters = useCallback((ready: WorkerReady) => {
    const waiters = readyWaitersRef.current.splice(0);
    for (const resolve of waiters) {
      try {
        resolve(ready);
      } catch { }
    }
  }, []);

  const waitForReady = useCallback(async (timeoutMs = 8000): Promise<WorkerReady> => {
    const current = readyRef.current;
    if (current) return current;
    return await new Promise<WorkerReady>((resolve) => {
      let done = false;
      const timer = window.setTimeout(() => {
        if (done) return;
        done = true;
        resolve({ ok: false, debugCapable: false, error: "Pyodide 初始化超时，请重试" });
      }, timeoutMs);
      readyWaitersRef.current.push((ready) => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        resolve(ready);
      });
    });
  }, []);

  const evaluate = useCallback(async (expr: string) => {
    if (stateRef.current.status !== "paused") return { ok: false, error: "仅在暂停时可求值" };
    if (!ctrlRef.current || !evalText16Ref.current) return { ok: false, error: "未启用断点能力" };
    const ctrl = ctrlRef.current;
    const buf = evalText16Ref.current;
    const text = String(expr ?? "");
    const len = Math.min(text.length, EVAL_MAX_CODE_UNITS);
    for (let i = 0; i < len; i++) buf[i] = text.charCodeAt(i);
    Atomics.store(ctrl, 5, len);
    const p = new Promise<{ ok: boolean; value?: unknown; valueType?: unknown; error?: string }>((resolve) => {
      pendingEvalResolveRef.current = resolve;
    });
    Atomics.store(ctrl, 1, 4);
    Atomics.store(ctrl, 0, 1);
    Atomics.notify(ctrl, 0, 1);
    const r = await p;
    if (!r?.ok) return { ok: false, error: r?.error || "求值失败" };
    return { ok: true, value: String(r.value ?? ""), type: String(r.valueType ?? "") };
  }, []);

  const refreshWatchResults = useCallback(async () => {
    const exprs = stateRef.current.watchExprs.slice();
    if (!exprs.length) return;
    if (stateRef.current.status !== "paused") return;
    const results: WatchResult[] = [];
    for (const expr of exprs) {
      try {
        const r = await evaluate(expr);
        if (r.ok) results.push({ expr, ok: true, value: r.value, type: r.type });
        else results.push({ expr, ok: false, error: r.error || "Error" });
      } catch (e: unknown) {
        results.push({ expr, ok: false, error: e?.message || "Error" });
      }
    }
    dispatch({ type: "SET_WATCH_RESULTS", payload: results });
  }, [evaluate]);

  const ensureWorker = useCallback(async (mode: WorkerMode) => {
    if (workerRef.current && workerModeRef.current === mode) {
      await waitForReady();
      return;
    }
    if (workerRef.current && workerModeRef.current !== mode) {
      try {
        workerRef.current.terminate();
      } catch { }
      resolveReadyWaiters({ ok: false, debugCapable: false, error: "Pyodide worker 已重建，请重试" });
      workerRef.current = null;
      workerModeRef.current = null;
      ctrlRef.current = null;
      inputText16Ref.current = null;
      evalText16Ref.current = null;
      readyRef.current = null;
      awaitingInputRef.current = false;
    }
    const w = new Worker(new URL("../workers/pyodideDebug.worker.ts", import.meta.url));
    workerRef.current = w;
    workerModeRef.current = mode;

    const sab = canUseSharedArrayBuffer()
      ? new SharedArrayBuffer(CTRL_HEADER_I32_LEN * 4 + INPUT_MAX_CODE_UNITS * 2 + EVAL_MAX_CODE_UNITS * 2)
      : null;
    ctrlRef.current = sab ? new Int32Array(sab, 0, CTRL_HEADER_I32_LEN) : null;
    inputText16Ref.current = sab ? new Uint16Array(sab, CTRL_HEADER_I32_LEN * 4, INPUT_MAX_CODE_UNITS) : null;
    evalText16Ref.current = sab ? new Uint16Array(sab, CTRL_HEADER_I32_LEN * 4 + INPUT_MAX_CODE_UNITS * 2, EVAL_MAX_CODE_UNITS) : null;

    w.onmessage = async (ev: MessageEvent<unknown>) => {
      const msg = ev.data || {};
      if (msg.type === "ready") {
        readyRef.current = msg as WorkerReady;
        resolveReadyWaiters(readyRef.current);
        trace("ready", { ok: !!msg.ok, debugCapable: !!msg.debugCapable, error: msg.error || null, mode });
        if (!msg.ok) dispatch({ type: "SET_ERROR", payload: msg.error || "Pyodide 初始化失败" });
        return;
      }
      if (msg.type === "stdout") {
        writeTerminal(String(msg.data || ""));
        return;
      }
      if (msg.type === "stderr") {
        writeTerminal(String(msg.data || ""));
        return;
      }
      if (msg.type === "inputRequest") {
        awaitingInputRef.current = true;
        const p = String(msg.prompt || "");
        if (p) writeTerminal(p);
        return;
      }
      if (msg.type === "paused") {
        const p = msg as WorkerPaused;
        const line = Number(p.line || 0) || null;
        const vars = Array.isArray(p.variables) ? p.variables : [];
        const nextVars = new Map<string, { value: string; type: string }>();
        for (const v of vars) nextVars.set(v.name, { value: v.value, type: v.type });
        const prevVars = prevVarsRef.current;
        const sel = computeDebugNodeSelection({
          debugMap,
          activeLine: line,
          prevActiveLine: stateRef.current.activeLine,
          prevVars,
          nextVars,
        });
        prevVarsRef.current = nextVars;
        dispatch({ type: "SET_ACTIVE_LINE", payload: line });
        dispatch({ type: "SET_VARIABLES", payload: vars });
        dispatch({ type: "SET_ACTIVE_EMPHASIS", payload: { activeFlowLine: sel.activeFlowLine, activeFocusRole: sel.activeFocusRole, activeNodeId: sel.activeNodeId } });
        setStatus("paused");
        dispatch({ type: "INCREMENT_STEPS" });
        await refreshWatchResults();
        return;
      }
      if (msg.type === "evalResult") {
        pendingEvalResolveRef.current?.(msg);
        pendingEvalResolveRef.current = null;
        return;
      }
      if (msg.type === "finished") {
        trace("finished", { ok: !!msg.ok, error: msg.error || null });
        if (!msg.ok) dispatch({ type: "SET_ERROR", payload: msg.error || "运行失败" });
        dispatch({ type: "SET_ACTIVE_LINE", payload: null });
        dispatch({ type: "SET_ACTIVE_EMPHASIS", payload: { activeFlowLine: null, activeFocusRole: null, activeNodeId: null } });
        setStatus(msg.ok ? "stopped" : "error");
        return;
      }
    };

    w.postMessage({ type: "init", pyodideBaseUrl: defaultPyodideBaseUrl(), sharedBuffer: sab });
    await waitForReady();
  }, [debugMap, refreshWatchResults, resolveReadyWaiters, setStatus, trace, waitForReady, writeTerminal]);

  const startInFlightRef = useRef(false);
  const startTokenRef = useRef(0);

  const startDebug = useCallback(async () => {
    trace("start_debug");
    // If starting, we should technically wait or reject, but user wants "force restart".
    // If we are already starting, we can try to override.
    // However, ensureWorker has its own locks.
    // Let's reset the inflight flag if we are forcing a restart from a previous stuck state.
    if (stateRef.current.status === "starting" && startInFlightRef.current) {
       // If it's "starting", we can't easily cancel the previous promise, 
       // but we can invalidate its token so it doesn't update state when it returns.
       // We don't throw here anymore, we proceed to start a NEW token.
    }
    
    startInFlightRef.current = true;
    const myToken = (startTokenRef.current += 1);

    dispatch({ type: "RESET_SESSION" });
    dispatch({ type: "CLEAR_OUTPUT" });
    dispatch({ type: "SET_STATUS", payload: "starting" }); // Immediate feedback

    try {
      await ensureWorker("debug");
      const ready = readyRef.current;
      if (!ready || !ready.ok) {
        const msg = ready?.error || "Pyodide 未就绪";
        throw new Error(msg);
      }
      if (startTokenRef.current !== myToken) return;
      setStatus("running");
      breakpointsRef.current = stateRef.current.breakpoints || [];
      workerRef.current!.postMessage({ type: "run", code, breakpoints: breakpointsRef.current });
    } catch (e: unknown) {
      trace("start_debug_error", { error: e instanceof Error ? e.message : "启动失败" });
      if (startTokenRef.current === myToken) {
        dispatch({ type: "SET_ERROR", payload: e instanceof Error ? e.message : "启动失败" });
        setStatus("error");
        throw e;
      }
    } finally {
      if (startTokenRef.current === myToken) {
        startInFlightRef.current = false;
      }
    }
  }, [code, ensureWorker, setStatus, trace]);

  const runPlain = useCallback(async () => {
    trace("run_plain");
    // Force restart logic similar to startDebug
    if (stateRef.current.status === "starting" && startInFlightRef.current) {
       // Proceed to invalidate old token
    }

    startInFlightRef.current = true;
    const myToken = (startTokenRef.current += 1);

    dispatch({ type: "RESET_SESSION" });
    dispatch({ type: "CLEAR_OUTPUT" });
    dispatch({ type: "SET_STATUS", payload: "starting" }); // Immediate feedback

    try {
      await ensureWorker("plain");
      const ready = readyRef.current;
      if (!ready || !ready.ok) {
        const msg = ready?.error || "Pyodide 未就绪";
        throw new Error(msg);
      }
      if (startTokenRef.current !== myToken) return;
      setStatus("running");
      workerRef.current!.postMessage({ type: "run", code, breakpoints: [] });
    } catch (e: unknown) {
      trace("run_plain_error", { error: e instanceof Error ? e.message : "启动失败" });
      if (startTokenRef.current === myToken) {
        dispatch({ type: "SET_ERROR", payload: e instanceof Error ? e.message : "启动失败" });
        setStatus("error");
        throw e;
      }
    } finally {
      if (startTokenRef.current === myToken) {
        startInFlightRef.current = false;
      }
    }
  }, [code, ensureWorker, setStatus, trace]);

  const stopDebug = useCallback(async () => {
    try {
      workerRef.current?.terminate();
    } catch { }
    resolveReadyWaiters({ ok: false, debugCapable: false, error: "调试会话已停止" });
    workerRef.current = null;
    ctrlRef.current = null;
    inputText16Ref.current = null;
    evalText16Ref.current = null;
    readyRef.current = null;
    awaitingInputRef.current = false;
    dispatch({ type: "SET_ACTIVE_LINE", payload: null });
    dispatch({ type: "SET_ACTIVE_EMPHASIS", payload: { activeFlowLine: null, activeFocusRole: null, activeNodeId: null } });
    setStatus("stopped");
  }, [resolveReadyWaiters, setStatus]);

  const continueRun = useCallback(async () => {
    if (stateRef.current.status !== "paused") return;
    setStatus("running");
    const ctrl = ctrlRef.current;
    if (!ctrl) return;
    Atomics.store(ctrl, 1, 1);
    Atomics.store(ctrl, 0, 1);
    Atomics.notify(ctrl, 0, 1);
  }, [setStatus]);

  const pauseRun = useCallback(async () => {
    if (!debugCapable) {
      return;
    }
    if (stateRef.current.status !== "running") return;
    const ctrl = ctrlRef.current;
    if (!ctrl) return;
    Atomics.store(ctrl, 2, 1);
  }, [debugCapable]);

  const stepOver = useCallback(async () => {
    if (!debugCapable) return;
    if (stateRef.current.status !== "paused") return;
    setStatus("running");
    const ctrl = ctrlRef.current;
    if (!ctrl) return;
    Atomics.store(ctrl, 1, 2);
    Atomics.store(ctrl, 0, 1);
    Atomics.notify(ctrl, 0, 1);
  }, [debugCapable, setStatus]);

  const stepInto = stepOver;
  const stepOut = stepOver;

  const setBreakpoints = useCallback(
    (bps: Breakpoint[]) => {
      dispatch({ type: "UPDATE_BREAKPOINTS", payload: () => bps });
      updateBreakpointsToWorker(bps);
    },
    [updateBreakpointsToWorker]
  );

  const toggleBreakpoint = useCallback(
    (line: number) => {
      dispatch({
        type: "UPDATE_BREAKPOINTS",
        payload: (prev) => {
          const next = prev.slice();
          const idx = next.findIndex((b) => b.line === line);
          if (idx >= 0) next.splice(idx, 1);
          else next.push({ line, enabled: true });
          next.sort((a, b) => a.line - b.line);
          updateBreakpointsToWorker(next);
          return next;
        },
      });
    },
    [updateBreakpointsToWorker]
  );

  const setBreakpointEnabled = useCallback(
    (line: number, enabled: boolean) => {
      dispatch({
        type: "UPDATE_BREAKPOINTS",
        payload: (prev) => {
          const next = prev.map((b) => (b.line === line ? { ...b, enabled } : b));
          updateBreakpointsToWorker(next);
          return next;
        },
      });
    },
    [updateBreakpointsToWorker]
  );

  const setBreakpointCondition = useCallback(
    (line: number, condition: string) => {
      dispatch({
        type: "UPDATE_BREAKPOINTS",
        payload: (prev) => {
          const next = prev.map((b) => (b.line === line ? { ...b, condition: condition || undefined } : b));
          updateBreakpointsToWorker(next);
          return next;
        },
      });
    },
    [updateBreakpointsToWorker]
  );

  const setBreakpointHitCount = useCallback(
    (line: number, hitCount: number | null) => {
      dispatch({
        type: "UPDATE_BREAKPOINTS",
        payload: (prev) => {
          const next = prev.map((b) => (b.line === line ? { ...b, hitCount: typeof hitCount === "number" ? hitCount : undefined } : b));
          updateBreakpointsToWorker(next);
          return next;
        },
      });
    },
    [updateBreakpointsToWorker]
  );

  const addWatch = useCallback(
    async (expr: string) => {
      if (stateRef.current.watchExprs.includes(expr)) return;
      dispatch({ type: "UPDATE_WATCH_EXPRS", payload: [...stateRef.current.watchExprs, expr] });
      if (stateRef.current.status === "paused") await refreshWatchResults();
    },
    [refreshWatchResults]
  );

  const removeWatch = useCallback((expr: string) => {
    dispatch({ type: "UPDATE_WATCH_EXPRS", payload: stateRef.current.watchExprs.filter((e) => e !== expr) });
    dispatch({ type: "SET_WATCH_RESULTS", payload: stateRef.current.watchResults.filter((r) => r.expr !== expr) });
  }, []);

  useEffect(() => {
    return () => {
      try {
        workerRef.current?.terminate();
      } catch { }
      resolveReadyWaiters({ ok: false, debugCapable: false, error: "Pyodide worker 已销毁" });
      workerRef.current = null;
    };
  }, [resolveReadyWaiters]);

  const runnerState: RunnerState = useMemo(() => {
    return {
      ...state,
      ok: true,
      timeTravel: false,
      historyLength: 0,
      callStack: state.frames.map((f) => f.name),
      watch: state.watchResults,
      frame: state.frames[state.selectedFrameIndex]?.name || "",
      sourceMismatch: false,
      sourceMismatchMessage: null,
      warnings: [],
    };
  }, [debugCapable, state]);

  return {
    state: runnerState,
    error: state.error,
    startDebug,
    stopDebug,
    runPlain,
    continueRun,
    pause: pauseRun,
    stepOver,
    stepInto,
    stepOut,
    reset: stopDebug,
    clearOutput: () => dispatch({ type: "CLEAR_OUTPUT" }),
    clearBreakpoints: () => setBreakpoints([]),
    setBreakpoints,
    toggleBreakpoint,
    setBreakpointEnabled,
    setBreakpointCondition,
    setBreakpointHitCount,
    addWatch,
    removeWatch,
    evaluate,
    terminal,
    historyBack: () => { },
    historyForward: () => { },
    historyToLatest: () => { },
    setHistoryIndex: () => { },
    setSelectedFrameIndex: (idx: number) => dispatch({ type: "SET_SELECTED_FRAME", payload: idx }),
    selectFrame: (idx: number) => dispatch({ type: "SET_SELECTED_FRAME", payload: idx }),
    setWatchExprs: (exprs: string[]) => dispatch({ type: "UPDATE_WATCH_EXPRS", payload: exprs }),
  };
}
