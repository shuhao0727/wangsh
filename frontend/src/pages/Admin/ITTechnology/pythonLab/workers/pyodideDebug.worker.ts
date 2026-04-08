import { installPyodideStdIo } from "./pyodideStdIo";

export type PyodideWorkerInitMessage = {
  type: "init";
  pyodideBaseUrl: string;
  sharedBuffer: SharedArrayBuffer | null;
};

export type PyodideWorkerRunMessage = {
  type: "run";
  code: string;
  breakpoints: { line: number; enabled: boolean; condition?: string; hitCount?: number }[];
};

export type PyodideWorkerControlMessage =
  | { type: "setBreakpoints"; breakpoints: { line: number; enabled: boolean; condition?: string; hitCount?: number }[] }
  | { type: "eval"; expr: string }
  | { type: "noop" };

export type PyodideWorkerInMessage = PyodideWorkerInitMessage | PyodideWorkerRunMessage | PyodideWorkerControlMessage;

type OutMessage =
  | { type: "ready"; ok: boolean; debugCapable: boolean; error?: string }
  | { type: "stdout"; data: string }
  | { type: "stderr"; data: string }
  | { type: "paused"; line: number; variables: { name: string; value: string; type: string }[] }
  | { type: "evalResult"; ok: boolean; value?: string; valueType?: string; error?: string }
  | { type: "inputRequest"; prompt: string }
  | { type: "finished"; ok: boolean; error?: string };

declare const self: any;

let pyodide: any = null;
let sharedBuffer: SharedArrayBuffer | null = null;
let ctrl: Int32Array | null = null;
let inputText16: Uint16Array | null = null;
let evalText16: Uint16Array | null = null;
let breakpoints: { line: number; enabled: boolean; condition?: string; hitCount?: number }[] = [];
let stepMode = false;
let stopRequested = false;

const CTRL_WAIT_PAUSE = 0;
const CTRL_RESUME_COMMAND = 1;
const CTRL_PAUSE_REQUEST = 2;
const CTRL_INPUT_READY = 3;
const CTRL_INPUT_LEN = 4;
const CTRL_EVAL_LEN = 5;

const _CTRL_CMD_RESUME = 1;
const CTRL_CMD_STEP = 2;
const CTRL_CMD_STOP = 3;
const CTRL_CMD_EVAL = 4;

const CTRL_HEADER_I32_LEN = 64;
const INPUT_MAX_CODE_UNITS = 8192;
const EVAL_MAX_CODE_UNITS = 4096;

function post(msg: OutMessage) {
  self.postMessage(msg);
}

function isCrossOriginIsolatedAndSABAvailable() {
  try {
    return (self as any).crossOriginIsolated === true && typeof SharedArrayBuffer !== "undefined";
  } catch {
    return false;
  }
}

function initSharedViews(buf: SharedArrayBuffer | null) {
  sharedBuffer = buf;
  ctrl = null;
  inputText16 = null;
  evalText16 = null;
  if (!sharedBuffer) return;
  ctrl = new Int32Array(sharedBuffer, 0, CTRL_HEADER_I32_LEN);
  const inputOffset = CTRL_HEADER_I32_LEN * 4;
  inputText16 = new Uint16Array(sharedBuffer, inputOffset, INPUT_MAX_CODE_UNITS);
  const evalOffset = inputOffset + INPUT_MAX_CODE_UNITS * 2;
  evalText16 = new Uint16Array(sharedBuffer, evalOffset, EVAL_MAX_CODE_UNITS);
}

function _setInputToShared(text: string) {
  if (!ctrl || !inputText16) return;
  const len = Math.min(text.length, INPUT_MAX_CODE_UNITS);
  for (let i = 0; i < len; i++) inputText16[i] = text.charCodeAt(i);
  Atomics.store(ctrl, CTRL_INPUT_LEN, len);
  Atomics.store(ctrl, CTRL_INPUT_READY, 1);
  Atomics.notify(ctrl, CTRL_INPUT_READY, 1);
}

function waitForInput(prompt: string): string {
  if (!ctrl || !inputText16) return "";
  Atomics.store(ctrl, CTRL_INPUT_READY, 0);
  Atomics.store(ctrl, CTRL_INPUT_LEN, 0);
  post({ type: "inputRequest", prompt });
  Atomics.wait(ctrl, CTRL_INPUT_READY, 0);
  const len = Atomics.load(ctrl, CTRL_INPUT_LEN);
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(inputText16[i]);
  return s;
}

function shouldPauseAtLine(_line: number): { pause: boolean; step: boolean } {
  if (!ctrl) return { pause: false, step: false };
  if (stopRequested) return { pause: true, step: false };
  if (stepMode) return { pause: true, step: true };
  const req = Atomics.load(ctrl, CTRL_PAUSE_REQUEST);
  if (req === 1) {
    Atomics.store(ctrl, CTRL_PAUSE_REQUEST, 0);
    return { pause: true, step: false };
  }
  return { pause: false, step: false };
}

function pauseAndWait(line: number, variables: { name: string; value: string; type: string }[]) {
  if (!ctrl) return;
  post({ type: "paused", line, variables });
  while (true) {
    Atomics.store(ctrl, CTRL_WAIT_PAUSE, 0);
    Atomics.wait(ctrl, CTRL_WAIT_PAUSE, 0);
    const cmd = Atomics.load(ctrl, CTRL_RESUME_COMMAND);
    Atomics.store(ctrl, CTRL_RESUME_COMMAND, 0);
    if (cmd === CTRL_CMD_EVAL) {
      try {
        const r = evalExprSync(readEvalExpr());
        post({ type: "evalResult", ok: true, value: r.value, valueType: r.type });
      } catch (e: any) {
        post({ type: "evalResult", ok: false, error: e?.message || String(e) });
      }
      continue;
    }
    if (cmd === CTRL_CMD_STOP) {
      stopRequested = true;
      stepMode = false;
      break;
    }
    if (cmd === CTRL_CMD_STEP) {
      stopRequested = false;
      stepMode = true;
      break;
    }
    stopRequested = false;
    stepMode = false;
    break;
  }
}

function readEvalExpr(): string {
  if (!ctrl || !evalText16) return "";
  const len = Math.min(Math.max(0, Atomics.load(ctrl, CTRL_EVAL_LEN)), EVAL_MAX_CODE_UNITS);
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(evalText16[i]);
  return s;
}

async function loadPyodideFrom(baseUrl: string) {
  const normalizedBase = `${baseUrl.replace(/\/+$/, "")}/`;
  // Module workers in Chrome expose importScripts but calling it throws TypeError.
  // Pyodide's compat.ts intentionally tries importScripts first, which can pause
  // DevTools when "pause on caught exceptions" is enabled. Provide a sync shim
  // that resolves relative URLs against indexURL and evals classic worker scripts.
  const importScriptsShim = (...urls: string[]) => {
    for (const rawUrl of urls) {
      const url = new URL(String(rawUrl), normalizedBase).toString();
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url, false);
      xhr.send();
      if ((xhr.status >= 200 && xhr.status < 300) || (xhr.status === 0 && xhr.responseText)) {
        (0, eval)(`${xhr.responseText}\n//# sourceURL=${url}`);
        continue;
      }
      throw new Error(`importScripts shim: failed to load ${url} (status ${xhr.status})`);
    }
  };
  try {
    (self as any).importScripts = importScriptsShim;
  } catch {}
  try {
    Object.defineProperty(self, "importScripts", {
      value: importScriptsShim,
      configurable: true,
      writable: true,
    });
  } catch {}

  const pyodideMod = await import(/* @vite-ignore */ `${normalizedBase}pyodide.mjs`);
  const loadPyodide = pyodideMod?.loadPyodide || (self as any).loadPyodide;
  if (typeof loadPyodide !== "function") {
    throw new Error("loadPyodide not found in pyodide.mjs");
  }
  pyodide = await loadPyodide({ indexURL: normalizedBase });
  const pyDbgBootstrap = `
import sys, json, traceback, builtins
from pyodide.ffi import to_js

__pydbg_frame = None
__pydbg_hits = {}

def __pydbg_safe_value(v):
    try:
        if v is None or isinstance(v, (bool, int, float, str)):
            return v
        if isinstance(v, (list, tuple, set)):
            return [__pydbg_safe_value(x) for x in list(v)[:50]]
        if isinstance(v, dict):
            out = {}
            for i, (k, val) in enumerate(v.items()):
                if i >= 50:
                    break
                out[str(k)] = __pydbg_safe_value(val)
            return out
        s = repr(v)
        if len(s) > 200:
            s = s[:200] + "…"
        return s
    except Exception:
        try:
            return str(v)
        except Exception:
            return "<unrepr>"

def __pydbg_vars(frame):
    items = []
    try:
        loc = frame.f_locals or {}
        for k, v in loc.items():
            if k.startswith("__") and k.endswith("__"):
                continue
            val = __pydbg_safe_value(v)
            t = type(v).__name__ if v is not None else "None"
            items.append({"name": str(k), "value": json.dumps(val, ensure_ascii=False) if not isinstance(val, str) else val, "type": t})
    except Exception:
        pass
    return items

def __pydbg_eval(expr):
    global __pydbg_frame
    if __pydbg_frame is None:
        raise RuntimeError("no frame")
    return eval(expr, __pydbg_frame.f_globals, __pydbg_frame.f_locals)

def __pydbg_eval_repr(expr):
    v = __pydbg_eval(expr)
    return {"type": type(v).__name__, "value": repr(v)}

def __pydbg_run(code, hooks):
    global __pydbg_frame, __pydbg_hits
    __pydbg_frame = None
    __pydbg_hits = {}
    js = hooks

    def _hget(name):
        try:
            return hooks[name]
        except Exception:
            try:
                return getattr(hooks, name)
            except Exception:
                return None

    _should_pause = _hget("should_pause")
    _pause = _hget("pause")
    _input = _hget("input")
    _should_stop = _hget("should_stop")
    _breakpoints = _hget("breakpoints")

    bp = {}
    def _bp_get(obj, key, default=None):
        try:
            if isinstance(obj, dict):
                return obj.get(key, default)
        except Exception:
            pass
        try:
            return obj[key]
        except Exception:
            pass
        try:
            return getattr(obj, key)
        except Exception:
            return default
    try:
        for it in ((_breakpoints() if _breakpoints else None) or []):
            ln = int(_bp_get(it, "line", 0) or 0)
            if ln <= 0:
                continue
            hit_count_raw = _bp_get(it, "hitCount", 0)
            bp[ln] = {
                "enabled": bool(_bp_get(it, "enabled", True)),
                "condition": str(_bp_get(it, "condition", "") or "").strip(),
                "hitCount": int(hit_count_raw or 0) if hit_count_raw else 0,
                "hits": 0,
            }
    except Exception:
        bp = {}

    def tracefn(frame, event, arg):
        global __pydbg_frame, __pydbg_hits
        if event != "line":
            return tracefn
        ln = int(frame.f_lineno or 0)
        need_pause = False
        b = bp.get(ln)
        if b and b.get("enabled", True):
            b["hits"] = int(b.get("hits") or 0) + 1
            hc = int(b.get("hitCount") or 0)
            cond = str(b.get("condition") or "").strip()
            ok = True
            if cond:
                try:
                    ok = bool(eval(cond, frame.f_globals, frame.f_locals))
                except Exception:
                    ok = False
            if hc > 0:
                ok = ok and (int(b["hits"]) >= hc)
            if ok:
                need_pause = True

        if not need_pause and (_should_pause(ln) if _should_pause else False) != True:
            return tracefn
        __pydbg_frame = frame
        if _pause:
            _pause(ln, to_js(__pydbg_vars(frame)))
        if (_should_stop() if _should_stop else False):
            raise SystemExit("stopped")
        return tracefn

    def input_override(prompt=""):
        if _input:
            return _input(str(prompt))
        return ""

    builtins.input = input_override
    sys.settrace(tracefn)
    try:
        g = {"__name__": "__main__"}
        exec(code, g, g)
    finally:
        sys.settrace(None)
`;
  await pyodide.runPythonAsync(pyDbgBootstrap);
}

function makeHooksObject() {
  return {
    should_pause: (line: number) => shouldPauseAtLine(line).pause,
    pause: (line: number, vars: any) => {
      const varsArr = Array.isArray(vars) ? vars : [];
      pauseAndWait(line, varsArr);
    },
    input: (prompt: string) => {
      return waitForInput(prompt);
    },
    should_stop: () => {
      return stopRequested;
    },
    breakpoints: () => breakpoints,
  };
}

async function runCode(code: string) {
  if (!pyodide) throw new Error("pyodide not ready");
  if (!ctrl) {
    await pyodide.runPythonAsync(code);
    return;
  }
  stepMode = false;
  stopRequested = false;
  const hooks = makeHooksObject();
  const hooksProxy = pyodide.toPy(hooks);
  try {
    const runFn = pyodide.globals.get("__pydbg_run");
    await runFn(code, hooksProxy);
  } finally {
    try {
      hooksProxy.destroy();
    } catch { }
  }
}

async function _evalExpr(expr: string) {
  if (!pyodide) throw new Error("pyodide not ready");
  const fn = pyodide.globals.get("__pydbg_eval_repr");
  const obj = fn(expr);
  const type = String(obj.get("type") || "");
  const value = String(obj.get("value") || "");
  try {
    obj.destroy();
  } catch { }
  return { type, value };
}

function evalExprSync(expr: string) {
  if (!pyodide) throw new Error("pyodide not ready");
  const fn = pyodide.globals.get("__pydbg_eval_repr");
  const obj = fn(expr);
  const type = String(obj.get("type") || "");
  const value = String(obj.get("value") || "");
  try {
    obj.destroy();
  } catch { }
  return { type, value };
}

async function handleInit(msg: PyodideWorkerInitMessage) {
  initSharedViews(msg.sharedBuffer);
  const debugCapable = isCrossOriginIsolatedAndSABAvailable() && !!msg.sharedBuffer;
  try {
    await loadPyodideFrom(msg.pyodideBaseUrl);
    post({ type: "ready", ok: true, debugCapable });
  } catch (e: any) {
    post({ type: "ready", ok: false, debugCapable: false, error: e?.message || String(e) });
  }
}

self.onmessage = async (ev: MessageEvent<PyodideWorkerInMessage>) => {
  const msg = ev.data;
  try {
    if (msg.type === "init") {
      await handleInit(msg);
      return;
    }
    if (msg.type === "setBreakpoints") {
      breakpoints = msg.breakpoints || [];
      return;
    }
    if (msg.type === "run") {
      breakpoints = msg.breakpoints || [];
      if (ctrl) {
        Atomics.store(ctrl, CTRL_RESUME_COMMAND, 0);
        Atomics.store(ctrl, CTRL_PAUSE_REQUEST, 0);
        Atomics.store(ctrl, CTRL_WAIT_PAUSE, 0);
        Atomics.store(ctrl, CTRL_EVAL_LEN, 0);
      }
      const stdio = installPyodideStdIo({
        pyodide,
        onStdout: (s) => post({ type: "stdout", data: String(s ?? "") }),
        onStderr: (s) => post({ type: "stderr", data: String(s ?? "") }),
      });
      try {
        await runCode(msg.code);
        await stdio.flush();
        post({ type: "finished", ok: true });
      } catch (e: any) {
        await stdio.flush();
        post({ type: "finished", ok: false, error: e?.message || String(e) });
      }
      return;
    }
  } catch (e: any) {
    post({ type: "stderr", data: e?.message || String(e) });
  }
};
