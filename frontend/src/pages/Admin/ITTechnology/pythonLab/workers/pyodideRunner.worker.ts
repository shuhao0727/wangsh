import { installPyodideStdIo } from "./pyodideStdIo";

export type PyodideWorkerInitMessage = {
  type: "init";
  pyodideBaseUrl: string;
  sharedBuffer: SharedArrayBuffer | null;
};

export type PyodideWorkerRunMessage = {
  type: "run";
  code: string;
};

export type PyodideWorkerInMessage = PyodideWorkerInitMessage | PyodideWorkerRunMessage;

type OutMessage =
  | { type: "ready"; ok: boolean; error?: string }
  | { type: "stdout"; data: string }
  | { type: "stderr"; data: string }
  | { type: "inputRequest"; prompt: string }
  | { type: "finished"; ok: boolean; error?: string };

declare const self: any;

let pyodide: any = null;
let sharedBuffer: SharedArrayBuffer | null = null;
let ctrl: Int32Array | null = null;
let inputText16: Uint16Array | null = null;

const CTRL_HEADER_I32_LEN = 64;
const INPUT_MAX_CODE_UNITS = 8192;
const CTRL_INPUT_READY = 3;
const CTRL_INPUT_LEN = 4;

function post(message: OutMessage) {
  self.postMessage(message);
}

function initSharedViews(buffer: SharedArrayBuffer | null) {
  sharedBuffer = buffer;
  ctrl = null;
  inputText16 = null;
  if (!sharedBuffer) return;
  ctrl = new Int32Array(sharedBuffer, 0, CTRL_HEADER_I32_LEN);
  const inputOffset = CTRL_HEADER_I32_LEN * 4;
  inputText16 = new Uint16Array(sharedBuffer, inputOffset, INPUT_MAX_CODE_UNITS);
}

function waitForInput(prompt: string): string {
  if (!ctrl || !inputText16) return "";
  Atomics.store(ctrl, CTRL_INPUT_READY, 0);
  Atomics.store(ctrl, CTRL_INPUT_LEN, 0);
  post({ type: "inputRequest", prompt });
  Atomics.wait(ctrl, CTRL_INPUT_READY, 0);
  const len = Atomics.load(ctrl, CTRL_INPUT_LEN);
  let value = "";
  for (let i = 0; i < len; i++) value += String.fromCharCode(inputText16[i]);
  return value;
}

async function loadPyodideFrom(baseUrl: string) {
  const normalizedBase = `${baseUrl.replace(/\/+$/, "")}/`;

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

  const pyodideModule = await import(/* @vite-ignore */ `${normalizedBase}pyodide.mjs`);
  const loadPyodide = pyodideModule?.loadPyodide || (self as any).loadPyodide;
  if (typeof loadPyodide !== "function") {
    throw new Error("loadPyodide not found in pyodide.mjs");
  }

  pyodide = await loadPyodide({ indexURL: normalizedBase });

  const plainRunnerBootstrap = `
import builtins

def __py_run_plain(code, hooks):
    def _hget(name):
        try:
            return hooks[name]
        except Exception:
            try:
                return getattr(hooks, name)
            except Exception:
                return None

    _input = _hget("input")
    original_input = builtins.input

    def input_override(prompt=""):
        if _input:
            return _input(str(prompt))
        return ""

    builtins.input = input_override
    try:
        g = {"__name__": "__main__"}
        exec(code, g, g)
    finally:
        builtins.input = original_input
`;

  await pyodide.runPythonAsync(plainRunnerBootstrap);
}

function makeHooksObject() {
  return {
    input: (prompt: string) => waitForInput(prompt),
  };
}

async function runCode(code: string) {
  if (!pyodide) throw new Error("pyodide not ready");
  if (!ctrl) {
    await pyodide.runPythonAsync(code);
    return;
  }

  const hooksProxy = pyodide.toPy(makeHooksObject());
  try {
    const runFunction = pyodide.globals.get("__py_run_plain");
    await runFunction(code, hooksProxy);
  } finally {
    try {
      hooksProxy.destroy();
    } catch {}
  }
}

async function handleInit(message: PyodideWorkerInitMessage) {
  initSharedViews(message.sharedBuffer);
  try {
    await loadPyodideFrom(message.pyodideBaseUrl);
    post({ type: "ready", ok: true });
  } catch (error: any) {
    post({ type: "ready", ok: false, error: error?.message || String(error) });
  }
}

self.onmessage = async (event: MessageEvent<PyodideWorkerInMessage>) => {
  const message = event.data;
  try {
    if (message.type === "init") {
      await handleInit(message);
      return;
    }

    if (message.type === "run") {
      const stdio = installPyodideStdIo({
        pyodide,
        onStdout: (text) => post({ type: "stdout", data: String(text ?? "") }),
        onStderr: (text) => post({ type: "stderr", data: String(text ?? "") }),
      });

      try {
        await runCode(message.code);
        await stdio.flush();
        post({ type: "finished", ok: true });
      } catch (error: any) {
        await stdio.flush();
        post({ type: "finished", ok: false, error: error?.message || String(error) });
      }
    }
  } catch (error: any) {
    post({ type: "stderr", data: error?.message || String(error) });
  }
};
