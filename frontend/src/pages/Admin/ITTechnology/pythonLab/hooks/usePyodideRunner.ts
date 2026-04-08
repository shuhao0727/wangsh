import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { logger } from "@services/logger";

import { applyDebugStatusTarget } from "../core/debugStateMachine";
import type { InternalRunnerState, RunnerState, RunnerStatus } from "./useDapRunner";

type WorkerReady = { ok: boolean; error?: string };
type TerminalListener = (s: string) => void;

type Action =
  | { type: "SET_STATUS"; payload: RunnerStatus }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "CLEAR_OUTPUT" }
  | { type: "RESET_SESSION" }
  | { type: "UPDATE_ELAPSED_TIME"; payload: number }
  | { type: "SET_START_TIME"; payload: number | null };

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

function reducer(state: InternalRunnerState, action: Action): InternalRunnerState {
  switch (action.type) {
    case "SET_STATUS":
      return applyStatusTarget(state, action.payload);
    case "SET_ERROR":
      return { ...applyStatusTarget(state, "error"), error: action.payload };
    case "CLEAR_OUTPUT":
      return { ...state, trace: [] };
    case "RESET_SESSION": {
      const nextState = applyStatusTarget(state, "idle");
      return {
        ...nextState,
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
        watchExprs: [],
        watchResults: [],
      };
    }
    case "UPDATE_ELAPSED_TIME":
      return { ...state, elapsedTime: action.payload };
    case "SET_START_TIME":
      return { ...state, startTime: action.payload };
    default:
      return state;
  }
}

function applyStatusTarget(state: InternalRunnerState, target: RunnerStatus): InternalRunnerState {
  const next = applyDebugStatusTarget({
    status: state.status,
    transitions: state.statusTransitions,
    target,
  });
  if (!next.applied) {
    if (state.status === target) return state;
    return { ...state, status: target };
  }
  return {
    ...state,
    status: next.status,
    statusTransitions: next.transitions,
  };
}

function defaultPyodideBaseUrl() {
  const value = (process.env.REACT_APP_PYODIDE_BASE_URL || "").trim();
  return value || "/pyodide/";
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
const CTRL_INPUT_READY = 3;
const CTRL_INPUT_LEN = 4;

export type PyodideTerminalBridge = {
  subscribe: (fn: TerminalListener) => () => void;
  sendInputLine: (line: string) => void;
};

export function usePyodideRunner(params: { code: string }) {
  const { code } = params;
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const trace = useCallback((phase: string, extra?: Record<string, unknown>) => {
    try {
      const enabled =
        process.env.NODE_ENV !== "production" ||
        Boolean((window as { __PYTHONLAB_PYODIDE_TRACE__?: boolean }).__PYTHONLAB_PYODIDE_TRACE__) ||
        window.localStorage?.getItem("pythonlab:pyodide:trace") === "1";
      if (!enabled) return;
      logger.info("[pythonlab:pyodide]", { phase, status: stateRef.current.status, ts: Date.now(), ...(extra || {}) });
    } catch {}
  }, []);

  const workerRef = useRef<Worker | null>(null);
  const readyRef = useRef<WorkerReady | null>(null);
  const readyWaitersRef = useRef<Array<(ready: WorkerReady) => void>>([]);
  const listenersRef = useRef(new Set<TerminalListener>());
  const awaitingInputRef = useRef(false);
  const ctrlRef = useRef<Int32Array | null>(null);
  const inputText16Ref = useRef<Uint16Array | null>(null);
  const elapsedTimerRef = useRef<number | null>(null);

  const terminal = useMemo<PyodideTerminalBridge>(() => {
    return {
      subscribe: (listener) => {
        listenersRef.current.add(listener);
        return () => listenersRef.current.delete(listener);
      },
      sendInputLine: (line) => {
        if (!awaitingInputRef.current) return;
        if (!ctrlRef.current || !inputText16Ref.current) return;
        awaitingInputRef.current = false;
        const buffer = inputText16Ref.current;
        const text = String(line ?? "");
        const len = Math.min(text.length, INPUT_MAX_CODE_UNITS);
        for (let i = 0; i < len; i++) buffer[i] = text.charCodeAt(i);
        Atomics.store(ctrlRef.current, CTRL_INPUT_LEN, len);
        Atomics.store(ctrlRef.current, CTRL_INPUT_READY, 1);
        Atomics.notify(ctrlRef.current, CTRL_INPUT_READY, 1);
      },
    };
  }, []);

  const writeTerminal = useCallback((text: string) => {
    for (const listener of Array.from(listenersRef.current)) {
      try {
        listener(text);
      } catch {}
    }
  }, []);

  const startElapsedTimer = useCallback(() => {
    if (elapsedTimerRef.current) return;
    const startAt = Date.now();
    elapsedTimerRef.current = window.setInterval(() => {
      const current = stateRef.current;
      if (!current.startTime) return;
      const elapsed = (Date.now() - current.startTime) / 1000;
      dispatch({ type: "UPDATE_ELAPSED_TIME", payload: current.elapsedTime + elapsed });
      dispatch({ type: "SET_START_TIME", payload: Date.now() });
    }, 1000);
    if (!stateRef.current.startTime) {
      dispatch({ type: "SET_START_TIME", payload: startAt });
    }
  }, []);

  const stopElapsedTimer = useCallback(() => {
    if (elapsedTimerRef.current) {
      window.clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    dispatch({ type: "SET_START_TIME", payload: null });
  }, []);

  const setStatus = useCallback(
    (nextStatus: RunnerStatus) => {
      dispatch({ type: "SET_STATUS", payload: nextStatus });
      if (nextStatus === "running") startElapsedTimer();
      if (nextStatus === "stopped" || nextStatus === "idle" || nextStatus === "error") stopElapsedTimer();
    },
    [startElapsedTimer, stopElapsedTimer]
  );

  const resolveReadyWaiters = useCallback((ready: WorkerReady) => {
    const waiters = readyWaitersRef.current.splice(0);
    for (const resolve of waiters) {
      try {
        resolve(ready);
      } catch {}
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
        resolve({ ok: false, error: "Pyodide 初始化超时，请重试" });
      }, timeoutMs);
      readyWaitersRef.current.push((ready) => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        resolve(ready);
      });
    });
  }, []);

  const disposeWorker = useCallback(
    (reason?: string) => {
      try {
        workerRef.current?.terminate();
      } catch {}
      if (reason) {
        resolveReadyWaiters({ ok: false, error: reason });
      }
      workerRef.current = null;
      readyRef.current = null;
      ctrlRef.current = null;
      inputText16Ref.current = null;
      awaitingInputRef.current = false;
    },
    [resolveReadyWaiters]
  );

  const ensureWorker = useCallback(async () => {
    if (workerRef.current) {
      const ready = await waitForReady();
      if (ready.ok) return;
      disposeWorker();
    }

    const worker = new Worker(new URL("../workers/pyodideRunner.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;

    const sharedBuffer = canUseSharedArrayBuffer()
      ? new SharedArrayBuffer(CTRL_HEADER_I32_LEN * 4 + INPUT_MAX_CODE_UNITS * 2)
      : null;
    ctrlRef.current = sharedBuffer ? new Int32Array(sharedBuffer, 0, CTRL_HEADER_I32_LEN) : null;
    inputText16Ref.current = sharedBuffer ? new Uint16Array(sharedBuffer, CTRL_HEADER_I32_LEN * 4, INPUT_MAX_CODE_UNITS) : null;

    worker.onmessage = (event: MessageEvent<unknown>) => {
      const msg: any = event.data || {};
      if (msg.type === "ready") {
        readyRef.current = msg as WorkerReady;
        resolveReadyWaiters(readyRef.current);
        trace("ready", { ok: !!msg.ok, error: msg.error || null });
        if (!msg.ok) {
          dispatch({ type: "SET_ERROR", payload: msg.error || "Pyodide 初始化失败" });
        }
        return;
      }
      if (msg.type === "stdout" || msg.type === "stderr") {
        writeTerminal(String(msg.data || ""));
        return;
      }
      if (msg.type === "inputRequest") {
        awaitingInputRef.current = true;
        const prompt = String(msg.prompt || "");
        if (prompt) writeTerminal(prompt);
        return;
      }
      if (msg.type === "finished") {
        awaitingInputRef.current = false;
        trace("finished", { ok: !!msg.ok, error: msg.error || null });
        if (!msg.ok) {
          dispatch({ type: "SET_ERROR", payload: msg.error || "运行失败" });
        }
        setStatus(msg.ok ? "stopped" : "error");
      }
    };

    worker.postMessage({
      type: "init",
      pyodideBaseUrl: defaultPyodideBaseUrl(),
      sharedBuffer,
    });

    await waitForReady();
  }, [disposeWorker, resolveReadyWaiters, setStatus, trace, waitForReady, writeTerminal]);

  const startInFlightRef = useRef(false);
  const startTokenRef = useRef(0);

  const runPlain = useCallback(
    async (_stdinLines?: string[]) => {
      trace("run_plain");
      startInFlightRef.current = true;
      const myToken = (startTokenRef.current += 1);

      if (stateRef.current.status === "starting" || stateRef.current.status === "running") {
        disposeWorker("Pyodide worker 已重建，请重试");
      }

      dispatch({ type: "RESET_SESSION" });
      dispatch({ type: "CLEAR_OUTPUT" });
      dispatch({ type: "SET_STATUS", payload: "starting" });

      try {
        await ensureWorker();
        const ready = readyRef.current;
        if (!ready || !ready.ok) {
          throw new Error(ready?.error || "Pyodide 未就绪");
        }
        if (startTokenRef.current !== myToken) return;
        setStatus("running");
        workerRef.current?.postMessage({ type: "run", code });
      } catch (error: unknown) {
        trace("run_plain_error", { error: error instanceof Error ? error.message : "启动失败" });
        if (startTokenRef.current === myToken) {
          dispatch({ type: "SET_ERROR", payload: error instanceof Error ? error.message : "启动失败" });
          setStatus("error");
          throw error;
        }
      } finally {
        if (startTokenRef.current === myToken) {
          startInFlightRef.current = false;
        }
      }
    },
    [code, disposeWorker, ensureWorker, setStatus, trace]
  );

  const resetRunner = useCallback(async () => {
    disposeWorker("Pyodide 会话已停止");
    setStatus("stopped");
  }, [disposeWorker, setStatus]);

  useEffect(() => {
    return () => {
      disposeWorker("Pyodide worker 已销毁");
    };
  }, [disposeWorker]);

  const runnerState: RunnerState = useMemo(() => {
    return {
      ...state,
      ok: true,
      timeTravel: false,
      historyLength: 0,
      callStack: [],
      watch: [],
      frame: "",
      warnings: [],
      sourceMismatch: false,
      sourceMismatchMessage: null,
    };
  }, [state]);

  return {
    state: runnerState,
    error: state.error,
    runPlain,
    reset: resetRunner,
    clearOutput: () => dispatch({ type: "CLEAR_OUTPUT" }),
    terminal,
  };
}
