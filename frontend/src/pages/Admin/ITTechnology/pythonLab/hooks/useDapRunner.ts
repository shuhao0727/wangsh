import { useCallback, useEffect, useReducer, useRef } from "react";
import { getStoredAccessToken } from "@services/api";
import { pythonlabSessionApi } from "../services/pythonlabSessionApi";
import { diffVarTrace, extractLatestTraceback, wsUrl } from "./dapRunnerHelpers";

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

export interface InternalRunnerState {
  status: RunnerStatus;
  stdout: string[];
  trace: string[]; // For variable trace log
  activeLine: number | null;
  frames: Frame[];
  selectedFrameIndex: number;
  variables: Variable[];
  watchExprs: string[];
  watchResults: WatchResult[];
  breakpoints: { line: number; enabled: boolean; condition?: string; hitCount?: number }[];
  error: string | null;
  steps: number;
  history: any[]; // Keep simple for now
  historyIndex: number;
  activeFocusRole: string | null;
}

export interface RunnerState extends InternalRunnerState {
  ok: boolean;
  timeTravel: boolean;
  historyLength: number;
  callStack: string[];
  watch: WatchResult[];
  frame: string;
  warnings: string[];
}

const initialState: InternalRunnerState = {
  status: "idle",
  stdout: [],
  trace: [],
  activeLine: null,
  frames: [],
  selectedFrameIndex: 0,
  variables: [],
  watchExprs: [],
  watchResults: [],
  breakpoints: [],
  error: null,
  steps: 0,
  history: [],
  historyIndex: 0,
  activeFocusRole: null,
};

type Action =
  | { type: "SET_STATUS"; payload: RunnerStatus }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "APPEND_STDOUT"; payload: string }
  | { type: "CLEAR_OUTPUT" }
  | { type: "SET_FRAMES"; payload: Frame[] }
  | { type: "SET_VARIABLES"; payload: Variable[] }
  | { type: "SET_ACTIVE_LINE"; payload: number | null }
  | { type: "SET_SELECTED_FRAME"; payload: number }
  | { type: "UPDATE_BREAKPOINTS"; payload: (prev: InternalRunnerState["breakpoints"]) => InternalRunnerState["breakpoints"] }
  | { type: "UPDATE_WATCH_EXPRS"; payload: string[] }
  | { type: "SET_WATCH_RESULTS"; payload: WatchResult[] }
  | { type: "INCREMENT_STEPS" }
  | { type: "RESET_SESSION" };

function reducer(state: InternalRunnerState, action: Action): InternalRunnerState {
  switch (action.type) {
    case "SET_STATUS":
      return { ...state, status: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload, status: action.payload ? "error" : state.status };
    case "APPEND_STDOUT":
      return { ...state, stdout: [...state.stdout, action.payload].slice(-2000) }; // Limit buffer
    case "CLEAR_OUTPUT":
      return { ...state, stdout: [], trace: [], steps: 0, activeLine: null, frames: [], variables: [], watchResults: [], error: null };
    case "SET_FRAMES":
      return { ...state, frames: action.payload };
    case "SET_VARIABLES":
      return { ...state, variables: action.payload };
    case "SET_ACTIVE_LINE":
      return { ...state, activeLine: action.payload };
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
      return { ...initialState, breakpoints: state.breakpoints, watchExprs: state.watchExprs };
    default:
      return state;
  }
}

// --- DAP Client Helper ---

class DapClient {
  private ws: WebSocket | null = null;
  private seq = 1;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();
  private handlers: Record<string, (msg: any) => void> = {};

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error("WebSocket connection failed"));
      this.ws.onclose = (ev) => {
        this.emit("close", ev);
      };
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

  on(event: string, handler: (msg: any) => void) {
    this.handlers[event] = handler;
  }

  emit(event: string, msg: any) {
    if (this.handlers[event]) this.handlers[event](msg);
  }

  private handleMessage(data: any) {
    try {
      const msg = JSON.parse(String(data));
      if (msg.type === "response") {
        const p = this.pending.get(msg.request_seq);
        if (p) {
          this.pending.delete(msg.request_seq);
          if (msg.success) p.resolve(msg);
          else p.reject(new Error(msg.message || "Request failed"));
        }
      } else if (msg.type === "event") {
        this.emit(msg.event, msg);
      }
    } catch (e) {
      console.error("Failed to parse DAP message", e);
    }
  }

  request(command: string, args: any = {}, timeout = 5000): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error("Not connected"));
    const seq = this.seq++;
    const req = { seq, type: "request", command, arguments: args };
    this.ws.send(JSON.stringify(req));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(seq);
        reject(new Error(`Timeout: ${command}`));
      }, timeout);
      this.pending.set(seq, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); }
      });
    });
  }
}

// --- Hook ---

export function useDapRunner(code: string) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const clientRef = useRef<DapClient>(new DapClient());
  const sessionIdRef = useRef<string | null>(null);
  const startInFlightRef = useRef(false);
  const startCooldownUntilRef = useRef(0);
  const startTokenRef = useRef(0);

  // Sync state to ref for callbacks if needed, but try to avoid it.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const cleanup = useCallback(() => {
    startTokenRef.current += 1;
    clientRef.current.disconnect();
    if (sessionIdRef.current) {
      pythonlabSessionApi.stop(sessionIdRef.current).catch(() => {});
      sessionIdRef.current = null;
    }
    dispatch({ type: "SET_STATUS", payload: "stopped" });
  }, []);

  // --- Actions ---

  const refreshBreakpoints = useCallback(async () => {
    const bps = stateRef.current.breakpoints.filter(b => b.enabled);
    await clientRef.current.request("setBreakpoints", {
      source: { path: "/workspace/main.py" },
      breakpoints: bps.map(b => ({ line: b.line, condition: b.condition, hitCondition: b.hitCount ? String(b.hitCount) : undefined }))
    });
  }, []);

  const fetchStack = useCallback(async (threadId: number) => {
    try {
      const stackResp = await clientRef.current.request("stackTrace", { threadId, startFrame: 0, levels: 20 });
      const frames = stackResp.body?.stackFrames || [];
      if (frames.length === 0) return;

      const topFrame = frames[0];
      const mappedFrames: Frame[] = frames.map((f: any) => ({
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
      const scopes = scopesResp.body?.scopes || [];
      const localScope = scopes.find((s: any) => s.name === "Locals") || scopes[0];
      
      if (localScope) {
        const varsResp = await clientRef.current.request("variables", { variablesReference: localScope.variablesReference });
        const vars = (varsResp.body?.variables || [])
            .filter((v: any) => !v.name.startsWith("__") && !v.name.includes("special variables") && !v.name.includes("function variables"))
            .map((v: any) => ({
                name: v.name,
                value: v.value,
                type: v.type || "unknown"
            }));
        dispatch({ type: "SET_VARIABLES", payload: vars });
      }

      // Process Watch Expressions
      if (stateRef.current.watchExprs.length > 0) {
          const watchResults: WatchResult[] = [];
          for (const expr of stateRef.current.watchExprs) {
              try {
                  const resp = await clientRef.current.request("evaluate", { expression: expr, frameId: topFrame.id, context: "watch" });
                  watchResults.push({ expr, ok: true, value: resp.body.result, type: resp.body.type });
              } catch (e: any) {
                  watchResults.push({ expr, ok: false, error: e.message || "Error" });
              }
          }
          dispatch({ type: "SET_WATCH_RESULTS", payload: watchResults });
      }
    } catch (e) {
      console.error("Fetch stack failed", e);
    }
  }, []);

  const startDebug = useCallback(async () => {
    if (startInFlightRef.current || stateRef.current.status === "starting") return;
    const now = Date.now();
    if (now < startCooldownUntilRef.current) {
      dispatch({ type: "SET_ERROR", payload: "请求过于频繁：请稍等片刻后重试" });
      return;
    }
    startInFlightRef.current = true;
    const myToken = (startTokenRef.current += 1);
    try {
      dispatch({ type: "RESET_SESSION" });
      dispatch({ type: "SET_STATUS", payload: "starting" });
      
      // 1. Create Session
      const session = await pythonlabSessionApi.create({ 
        title: "pythonlab", 
        code, 
        entry_path: "main.py", 
        requirements: [] 
      });
      sessionIdRef.current = session.session_id;

      // 2. Wait for Ready
      const maxWaitMs = 90000;
      const pollMs = 750;
      let retries = Math.ceil(maxWaitMs / pollMs);
      while (retries-- > 0) {
        if (startTokenRef.current !== myToken) return;
        let meta: any;
        try {
          meta = await pythonlabSessionApi.get(session.session_id);
        } catch (e: any) {
          if (e?.response?.status === 404) throw new Error("会话不存在/已被清理：可点右侧“会话”查看后重试");
          throw e;
        }
        if (meta.status === "READY") break;
        if (meta.status === "FAILED") throw new Error(meta.error_detail || "Session failed to start");
        await new Promise((r) => setTimeout(r, pollMs));
      }
      if (retries <= 0) throw new Error("调试会话启动超时：容器/调试器仍在启动或队列拥堵；可点右侧“会话”查看后重试");

      // 3. Connect WS
      let token = getStoredAccessToken();
      // If no token, we try to refresh it or proceed with empty token if configured to allow anonymous
      // But DAP usually requires auth. We will try to proceed but warn.
      if (!token) {
         try {
             // Attempt to refresh token if possible (though api.ts usually handles this automatically)
             // For now, we just don't block immediately, let the backend decide or user re-login.
             // But to avoid "Not logged in" error loop, we can check if refresh token exists
         } catch {}
      }
      
      const url = wsUrl(`/api/v1/debug/sessions/${session.session_id}/ws`, token);
      
      // Setup listeners
      const client = clientRef.current;
      client.disconnect(); // Ensure clean slate
      
      client.on("output", (msg) => {
        if (msg.body?.output) dispatch({ type: "APPEND_STDOUT", payload: msg.body.output });
      });
      
      client.on("stopped", (msg) => {
        dispatch({ type: "SET_STATUS", payload: "paused" });
        dispatch({ type: "INCREMENT_STEPS" });
        fetchStack(msg.body?.threadId || 1);
      });
      
      client.on("continued", () => {
        dispatch({ type: "SET_STATUS", payload: "running" });
      });
      
      client.on("terminated", () => {
        dispatch({ type: "SET_STATUS", payload: "stopped" });
        cleanup();
      });

      client.on("initialized", async () => {
         // DAP Lifecycle: After 'initialized' event, we must send breakpoints and then configurationDone
         try {
            await refreshBreakpoints();
            await client.request("configurationDone");
         } catch (e) {
            console.error("Failed to configure DAP", e);
         }
      });

      client.on("close", (ev: CloseEvent) => {
         if (ev.code === 4401) {
            dispatch({ type: "SET_ERROR", payload: "登录已过期，请刷新页面" });
         } else if (ev.code !== 1000) {
            // dispatch({ type: "SET_ERROR", payload: `Connection closed: ${ev.code} ${ev.reason}` });
         }
         dispatch({ type: "SET_STATUS", payload: "stopped" });
      });

      await client.connect(url);

      // 4. Initialize DAP
      // Note: We do NOT await launch here. We await initialize, then send launch.
      // The server will send 'initialized' event when ready for breakpoints.
      
      await client.request("initialize", { 
        adapterID: "python", 
        linesStartAt1: true, 
        columnsStartAt1: true,
        pathFormat: "path"
      });
      
      await client.request("launch", {
        name: "PythonLab",
        type: "python",
        request: "launch",
        program: "/workspace/main.py",
        console: "internalConsole",
        justMyCode: true
      });
      
      dispatch({ type: "SET_STATUS", payload: "running" });

    } catch (e: any) {
      let msg = e.message || "启动调试会话失败";
      
      // Handle 429 specifically
      if (e.response && e.response.status === 429) {
          msg = "并发调试会话数已达上限，请先停止其他会话或稍后再试";
          startCooldownUntilRef.current = Date.now() + 10000;
      } else if (e.response && e.response.data && e.response.data.detail) {
          // Handle standard FastAPI error details
          msg = typeof e.response.data.detail === "string" ? e.response.data.detail : JSON.stringify(e.response.data.detail);
      } else if (msg === "[object Object]") {
          msg = "启动失败，服务器返回了未知错误";
      }

      dispatch({ type: "SET_ERROR", payload: msg });
      cleanup();
    } finally {
      startInFlightRef.current = false;
    }
  }, [code, cleanup, fetchStack, refreshBreakpoints]);

  const stopDebug = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const continueRun = useCallback(async () => {
    try {
      await clientRef.current.request("continue", { threadId: 1 });
      dispatch({ type: "SET_STATUS", payload: "running" });
    } catch (e) {}
  }, []);

  const pauseRun = useCallback(async () => {
    try {
      await clientRef.current.request("pause", { threadId: 1 });
    } catch (e) {}
  }, []);

  const stepOver = useCallback(async () => {
    try {
      await clientRef.current.request("next", { threadId: 1 });
      dispatch({ type: "SET_STATUS", payload: "running" });
    } catch (e) {}
  }, []);

  const stepInto = useCallback(async () => {
    try {
      await clientRef.current.request("stepIn", { threadId: 1 });
      dispatch({ type: "SET_STATUS", payload: "running" });
    } catch (e) {}
  }, []);

  const stepOut = useCallback(async () => {
    try {
      await clientRef.current.request("stepOut", { threadId: 1 });
      dispatch({ type: "SET_STATUS", payload: "running" });
    } catch (e) {}
  }, []);

  const evaluate = useCallback(async (expr: string) => {
    try {
      // Use top frame
      const frameId = stateRef.current.frames[0]?.id;
      if (!frameId) throw new Error("No active frame");
      
      const resp = await clientRef.current.request("evaluate", { expression: expr, frameId, context: "repl" });
      return { ok: true, value: resp.body.result, type: resp.body.type };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }, []);

  // --- Breakpoint Helpers ---
  const toggleBreakpoint = useCallback((line: number) => {
    dispatch({ type: "UPDATE_BREAKPOINTS", payload: (prev) => {
      const idx = prev.findIndex(b => b.line === line);
      if (idx >= 0) return prev.filter(b => b.line !== line);
      return [...prev, { line, enabled: true }];
    }});
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

  // Sync breakpoints when they change (if running)
  useEffect(() => {
    if (state.status === "running" || state.status === "paused") {
      refreshBreakpoints().catch(() => {});
    }
  }, [state.breakpoints, refreshBreakpoints, state.status]);

  const addWatch = useCallback(async (expr: string) => {
    // 1. Update state
    dispatch({ type: "UPDATE_WATCH_EXPRS", payload: [...stateRef.current.watchExprs, expr] });
    
    // 2. If paused, evaluate immediately
    if (stateRef.current.status === "paused" && stateRef.current.frames.length > 0) {
        try {
            const frameId = stateRef.current.frames[0].id;
            const resp = await clientRef.current.request("evaluate", { expression: expr, frameId, context: "watch" });
            const result: WatchResult = { expr, ok: true, value: resp.body.result, type: resp.body.type };
            
            // Merge with existing results (dedupe by expr)
            dispatch({ type: "SET_WATCH_RESULTS", payload: [...stateRef.current.watchResults.filter(r => r.expr !== expr), result] });
        } catch (e: any) {
            dispatch({ type: "SET_WATCH_RESULTS", payload: [...stateRef.current.watchResults.filter(r => r.expr !== expr), { expr, ok: false, error: e.message || "Error" }] });
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
       warnings: [],
    },
    error: state.error,
    startDebug,
    stopDebug,
    runAll: startDebug,
    continueRun,
    pause: pauseRun,
    stepOver,
    stepInto,
    stepOut,
    reset: stopDebug,
    clearOutput: () => dispatch({ type: "CLEAR_OUTPUT" }),
    clearBreakpoints: () => dispatch({ type: "UPDATE_BREAKPOINTS", payload: () => [] }),
    toggleBreakpoint,
    setBreakpointEnabled,
    setBreakpointCondition,
    setBreakpointHitCount,
    addWatch,
    removeWatch,
    evaluate,
    // History stubs to satisfy interface
    historyBack: () => {},
    historyForward: () => {},
    historyToLatest: () => {},
    setHistoryIndex: () => {},
    setSelectedFrameIndex: (idx: number) => dispatch({ type: "SET_SELECTED_FRAME", payload: idx }),
    selectFrame: (idx: number) => dispatch({ type: "SET_SELECTED_FRAME", payload: idx }),
    setWatchExprs: (exprs: string[]) => dispatch({ type: "UPDATE_WATCH_EXPRS", payload: exprs }),
  };
}
