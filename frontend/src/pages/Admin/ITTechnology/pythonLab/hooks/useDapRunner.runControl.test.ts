import { act, cleanup, renderHook } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { createDebugCapabilityMapV1, resolveDebugControlMatrix } from "../adapters/debugCapabilityMap";
import type { DapMessage } from "../core/DebugController";
import { createPythonlabRunningTransition } from "../core/debugRunControl";
import type * as DebugSessionBootstrap from "../core/debugSessionBootstrap";
import { useDapRunner } from "./useDapRunner";

const fixture = vi.hoisted(() => ({
  sessionNumber: 0,
  createGate: null as Promise<void> | null,
  connectGate: null as Promise<void> | null,
  terminalAutoReady: true,
}));

vi.mock("../services/pythonlabSessionApi", () => ({
  pythonlabSessionApi: { stop: vi.fn(async () => ({ ok: true })) },
}));

vi.mock("../core/debugSessionBootstrap", async (importOriginal) => {
  const actual = await importOriginal<typeof DebugSessionBootstrap>();
  return {
    ...actual,
    createAndWaitForPythonlabSession: vi.fn(async (params: Parameters<typeof actual.createAndWaitForPythonlabSession>[0]) => {
      if (fixture.createGate) await fixture.createGate;
      if (!params.isCurrent()) return null;
      const session = { session_id: `synthetic-${++fixture.sessionNumber}`, status: "READY", ws_url: "" };
      params.onSessionCreated?.(session);
      return { session, readyMeta: { status: "READY", code_sha256: "" } };
    }),
    resolvePythonlabWsToken: vi.fn(async () => null),
    connectPythonlabDapController: vi.fn(async (params: Parameters<typeof actual.connectPythonlabDapController>[0]) => {
      const capabilities = await actual.connectPythonlabDapController(params);
      if (fixture.connectGate) await fixture.connectGate;
      return capabilities;
    }),
  };
});

// Only the transport is synthetic: requests, pending rejection, runtime event
// handlers, pause snapshots, reducer and control availability use product code.
class MemoryWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: MemoryWebSocket[] = [];

  readyState = 0;
  sent: DapMessage[] = [];
  line = 2;
  onopen: (() => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(_url: string) {
    MemoryWebSocket.instances.push(this);
    queueMicrotask(() => {
      if (this.readyState === MemoryWebSocket.CLOSED) return;
      this.readyState = MemoryWebSocket.OPEN;
      this.onopen?.();
    });
  }

  send(data: string) {
    const request = JSON.parse(data) as DapMessage;
    this.sent.push(request);
    if (["continue", "pause", "next", "stepIn", "stepOut", "disconnect"].includes(request.command || "")) return;
    queueMicrotask(() => {
      if (request.command === "attach") this.event("initialized");
      const bodies: Record<string, Record<string, unknown>> = {
        setBreakpoints: { breakpoints: [{ verified: true, line: 2 }] },
        stackTrace: { stackFrames: [{ id: 1, name: "<module>", line: this.line, source: { path: "/workspace/main.py" } }] },
        scopes: { scopes: [{ name: "Locals", variablesReference: 1 }] },
        variables: { variables: [{ name: "a", value: "1", type: "int" }] },
      };
      this.respond(request, true, bodies[request.command || ""] || {});
    });
  }

  event(event: string) {
    this.receive({ type: "event", event, body: { threadId: 1, reason: "breakpoint" } });
  }

  receive(message: DapMessage) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  respond(request: DapMessage, success = true, body: Record<string, unknown> = {}) {
    this.receive({ type: "response", request_seq: request.seq, command: request.command, success, body, message: success ? undefined : "synthetic rejection" });
  }

  lastRequest(command: string) {
    const request = this.sent.filter((message) => message.command === command).at(-1);
    if (!request) throw new Error(`Missing synthetic request: ${command}`);
    return request;
  }

  close() {
    this.closeWithCode(1000);
  }

  closeWithCode(code: number) {
    if (this.readyState === MemoryWebSocket.CLOSED) return;
    this.readyState = MemoryWebSocket.CLOSED;
    this.onclose?.({ code, reason: "synthetic close" } as CloseEvent);
  }
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  fixture.sessionNumber = 0;
  fixture.createGate = null;
  fixture.connectGate = null;
  fixture.terminalAutoReady = true;
  MemoryWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MemoryWebSocket);
});

afterEach(async () => {
  await act(async () => { MemoryWebSocket.instances.forEach((socket) => socket.close()); });
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function renderRunner() {
  return renderHook(() => {
    const runner = useDapRunner({ code: "a = 1\nprint(a)\n", debugMap: null });
    // Simulate the terminal component's acknowledgement, not the DAP transport.
    const { onTerminalConnection } = runner;
    const sessionId = runner.state.sessionId;
    useEffect(() => {
      if (fixture.terminalAutoReady && sessionId) {
        onTerminalConnection({ sessionId, ready: true });
      }
    }, [onTerminalConnection, sessionId]);
    return runner;
  });
}

async function startPaused() {
  const hook = renderRunner();
  let starting!: Promise<void>;
  await act(async () => { starting = hook.result.current.startDebug({ initialBreakpoints: [{ line: 2, enabled: true }] }); });
  await act(async () => { await starting; });
  const socket = MemoryWebSocket.instances.at(-1)!;
  await act(async () => { socket.event("stopped"); });
  expect(hook.result.current.state.status).toBe("paused");
  expect(hook.result.current.state.activeLine).toBe(2);
  return { ...hook, socket };
}

test("startup waits for the terminal acknowledgement before opening DAP", async () => {
  fixture.terminalAutoReady = false;
  const { result } = renderRunner();
  let starting!: Promise<void>;
  await act(async () => { starting = result.current.startDebug(); });
  expect(result.current.state.status).toBe("starting");
  expect(result.current.state.sessionId).toBe("synthetic-1");
  expect(MemoryWebSocket.instances).toHaveLength(0);
  await act(async () => { result.current.onTerminalConnection({ sessionId: "old", ready: true }); });
  expect(MemoryWebSocket.instances).toHaveLength(0);
  await act(async () => {
    result.current.onTerminalConnection({ sessionId: "synthetic-1", ready: true });
    await starting;
  });
  expect(MemoryWebSocket.instances).toHaveLength(1);
  expect(result.current.state.status).toBe("running");
});

test("unmount cancels startup while waiting for terminal readiness", async () => {
  fixture.terminalAutoReady = false;
  const { result, unmount } = renderRunner();
  let starting!: Promise<void>;
  await act(async () => { starting = result.current.startDebug(); });
  unmount();
  await starting;
  expect(MemoryWebSocket.instances).toHaveLength(0);
});

test.each(["continueRun", "stepOver", "stepInto", "stepOut"] as const)("%s waits for terminal reattachment and reset cancels it", async (action) => {
  const { result, socket } = await startPaused();
  fixture.terminalAutoReady = false;
  await act(async () => { result.current.onTerminalConnection({ sessionId: "synthetic-1", ready: false }); });
  const before = socket.sent.length;
  const control = result.current[action]();
  expect(socket.sent).toHaveLength(before);
  const stopping = result.current.reset();
  await act(async () => {
    socket.respond(socket.lastRequest("disconnect"));
    await stopping;
    await control;
    result.current.onTerminalConnection({ sessionId: "synthetic-1", ready: true });
  });
  expect(socket.sent.filter((message) => ["continue", "next", "stepIn", "stepOut"].includes(message.command || ""))).toHaveLength(0);
  expect(result.current.state.status).toBe("stopped");
});

function controls(status: ReturnType<typeof useDapRunner>["state"]["status"]) {
  return resolveDebugControlMatrix(status, createDebugCapabilityMapV1("legacy"));
}

test("a close immediately after ready prevents the queued Continue from running", async () => {
  const { result, socket } = await startPaused();
  await act(async () => { result.current.onTerminalConnection({ sessionId: "synthetic-1", ready: false }); });
  const before = socket.sent.length;
  const control = result.current.continueRun();
  await act(async () => {
    result.current.onTerminalConnection({ sessionId: "synthetic-1", ready: true });
    result.current.onTerminalConnection({ sessionId: "synthetic-1", ready: false });
    await control;
  });
  expect(socket.sent).toHaveLength(before);
  expect(result.current.state.status).toBe("paused");
});

test.each(["generation", "lifecycleEpoch", "sessionId"] as const)("the running fallback validates %s independently", (changed) => {
  const generation = { current: 0 };
  const lifecycleEpoch = { current: 1 };
  const sessionId = { current: "session-1" };
  const onRunning = vi.fn();
  const apply = createPythonlabRunningTransition({ generation, lifecycleEpoch, sessionId, onRunning });
  if (changed === "sessionId") sessionId.current = "session-2";
  else if (changed === "generation") generation.current += 1;
  else lifecycleEpoch.current += 1;
  apply();
  expect(onRunning).not.toHaveBeenCalled();
});

test("a newer stopped event wins over a late Continue response in the same turn", async () => {
  const { result, socket } = await startPaused();
  const continuing = result.current.continueRun();
  const request = socket.lastRequest("continue");
  await act(async () => {
    socket.line = 4;
    socket.event("stopped");
    socket.respond(request);
    await continuing;
  });
  expect(result.current.state.status).toBe("paused");
  expect(result.current.state.activeLine).toBe(4);
  expect(controls(result.current.state.status).continue).toBe(true);
});

test("a successful Continue response still resumes without a continued event", async () => {
  const { result, socket } = await startPaused();
  const continuing = result.current.continueRun();
  await act(async () => {
    socket.respond(socket.lastRequest("continue"));
    await continuing;
  });
  expect(result.current.state.status).toBe("running");
  expect(controls(result.current.state.status).continue).toBe(false);
});

test("a rejected Continue response does not fabricate running", async () => {
  const { result, socket } = await startPaused();
  const continuing = result.current.continueRun();
  await act(async () => {
    socket.respond(socket.lastRequest("continue"), false);
    await continuing;
  });
  expect(result.current.state.status).toBe("paused");
  expect(controls(result.current.state.status).continue).toBe(true);
});

test("a newer control request invalidates an older Continue response", async () => {
  const { result, socket } = await startPaused();
  const continuing = result.current.continueRun();
  const oldRequest = socket.lastRequest("continue");
  const stepping = result.current.stepOver();
  await act(async () => {
    socket.respond(oldRequest);
    await continuing;
  });
  const statusWhileStepping = result.current.state.status;
  await act(async () => {
    socket.respond(socket.lastRequest("next"));
    await stepping;
  });
  expect(statusWhileStepping).toBe("paused");
  expect(result.current.state.status).toBe("running");
});

test("Pause invalidates the earlier Continue fallback before its stopped event", async () => {
  const { result, socket } = await startPaused();
  const continuing = result.current.continueRun();
  const pausing = result.current.pause();
  await act(async () => {
    socket.respond(socket.lastRequest("continue"));
    socket.respond(socket.lastRequest("pause"));
    await Promise.all([continuing, pausing]);
  });
  expect(result.current.state.status).toBe("paused");
});

test.each(["stopDebug", "reset"] as const)("%s invalidates Continue while waiting for disconnect acknowledgement", async (action) => {
  const { result, socket } = await startPaused();
  const continuing = result.current.continueRun();
  const stopping = result.current[action]();
  await act(async () => {
    socket.respond(socket.lastRequest("continue"));
    await continuing;
  });
  const statusWhileStopping = result.current.state.status;
  await act(async () => {
    socket.respond(socket.lastRequest("disconnect"));
    await stopping;
  });
  expect(statusWhileStopping).toBe("paused");
  expect(result.current.state.status).toBe("stopped");
  expect(result.current.state.sessionId).toBeNull();
});

test("termination disconnects and rejects an actually pending Continue", async () => {
  const { result, socket } = await startPaused();
  const continuing = result.current.continueRun();
  const request = socket.lastRequest("continue");
  await act(async () => {
    socket.event("terminated");
    await continuing;
    socket.respond(request);
  });
  expect(socket.readyState).toBe(MemoryWebSocket.CLOSED);
  expect(result.current.state.status).toBe("stopped");
});

test("an already settled Continue response cannot resume after termination", async () => {
  const { result, socket } = await startPaused();
  const continuing = result.current.continueRun();
  await act(async () => {
    socket.respond(socket.lastRequest("continue"));
    socket.event("terminated");
    await continuing;
  });
  expect(result.current.state.status).toBe("stopped");
});

test("an already settled response cannot overwrite a replacement session startup", async () => {
  const { result, socket } = await startPaused();
  const gate = deferred();
  fixture.createGate = gate.promise;
  const continuing = result.current.continueRun();
  let replacement!: Promise<void>;
  await act(async () => {
    socket.respond(socket.lastRequest("continue"));
    replacement = result.current.startDebug();
    await continuing;
  });
  const statusBeforeReady = result.current.state.status;
  await act(async () => { gate.resolve(); });
  await act(async () => { await replacement; });
  expect(statusBeforeReady).toBe("starting");
  expect(result.current.state.sessionId).toBe("synthetic-2");
  expect(result.current.state.status).toBe("running");
});

test("a replaced pending Continue is rejected by the real controller disconnect", async () => {
  const { result, socket } = await startPaused();
  const gate = deferred();
  fixture.createGate = gate.promise;
  const continuing = result.current.continueRun();
  const request = socket.lastRequest("continue");
  let replacement!: Promise<void>;
  await act(async () => {
    replacement = result.current.startDebug();
    await continuing;
    socket.respond(request);
  });
  const statusBeforeReady = result.current.state.status;
  await act(async () => { gate.resolve(); });
  await act(async () => { await replacement; });
  expect(statusBeforeReady).toBe("starting");
  expect(socket.readyState).toBe(MemoryWebSocket.CLOSED);
  expect(result.current.state.sessionId).toBe("synthetic-2");
});

test.each(["stopped", "terminated"])("startup completion does not overwrite %s during handshake", async (event) => {
  const gate = deferred();
  fixture.connectGate = gate.promise;
  const { result } = renderRunner();
  let starting!: Promise<void>;
  await act(async () => { starting = result.current.startDebug(); });
  const socket = MemoryWebSocket.instances.at(-1)!;
  await act(async () => {
    socket.event(event);
    gate.resolve();
    await starting;
  });
  expect(result.current.state.status).toBe(event === "stopped" ? "paused" : "stopped");
  expect(controls(result.current.state.status).continue).toBe(event === "stopped");
});

test("reconnect completion preserves a stopped event received during the new handshake", async () => {
  const { result, socket } = await startPaused();
  const continuing = result.current.continueRun();
  await act(async () => {
    socket.respond(socket.lastRequest("continue"));
    await continuing;
  });
  const gate = deferred();
  fixture.connectGate = gate.promise;
  await act(async () => { socket.closeWithCode(1011); });
  const reconnected = MemoryWebSocket.instances.at(-1)!;
  expect(reconnected).not.toBe(socket);
  await act(async () => {
    reconnected.event("stopped");
    gate.resolve();
  });
  expect(result.current.state.status).toBe("paused");
  expect(controls(result.current.state.status).continue).toBe(true);
});

test.each([
  ["stepOver", "next"],
  ["stepInto", "stepIn"],
  ["stepOut", "stepOut"],
] as const)("%s keeps the normal response-then-stopped lifecycle", async (action, command) => {
  const { result, socket } = await startPaused();
  const stepping = result.current[action]();
  await act(async () => {
    socket.respond(socket.lastRequest(command));
    await stepping;
  });
  expect(result.current.state.status).toBe("running");
  await act(async () => { socket.event("stopped"); });
  expect(result.current.state.status).toBe("paused");
  expect(controls(result.current.state.status).continue).toBe(true);
});
