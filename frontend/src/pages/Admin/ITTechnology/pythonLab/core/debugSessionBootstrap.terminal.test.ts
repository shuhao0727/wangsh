import { expect, test, vi } from "vitest";
import { connectPythonlabDapController } from "./debugSessionBootstrap";
import type { DebugController, DapMessage } from "./DebugController";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function controller() {
  const handlers = new Map<string, (message: DapMessage) => void>();
  const client = {
    on: vi.fn((name: string, handler: (message: DapMessage) => void) => { handlers.set(name, handler); }),
    connect: vi.fn(async () => {}),
    initializePythonSession: vi.fn(async () => ({ body: {} })),
    attachPythonSession: vi.fn(async () => { handlers.get("initialized")?.({ type: "event", event: "initialized" }); }),
    sendConfigurationDone: vi.fn(async () => ({ type: "response", success: true })),
  };
  return client;
}

test("an initialized event does not finish startup while terminal configuration is pending", async () => {
  const terminal = deferred();
  const client = controller();
  const beforeConfiguration = vi.fn(() => terminal.promise);
  const connecting = connectPythonlabDapController({ client: client as unknown as DebugController, url: "ws://synthetic.invalid", clientConnId: "synthetic", sessionId: "one", refreshBreakpoints: vi.fn(async () => {}), traceLifecycle: vi.fn(), beforeConfiguration });
  await vi.waitFor(() => expect(beforeConfiguration).toHaveBeenCalledTimes(1));
  expect(client.sendConfigurationDone).not.toHaveBeenCalled();
  terminal.resolve();
  await connecting;
  expect(client.sendConfigurationDone).toHaveBeenCalledTimes(1);
});

test("a cancelled terminal wait does not send configurationDone", async () => {
  const terminal = deferred();
  const client = controller();
  const beforeConfiguration = vi.fn(() => terminal.promise);
  const connecting = expect(connectPythonlabDapController({ client: client as unknown as DebugController, url: "ws://synthetic.invalid", clientConnId: "synthetic", sessionId: "one", refreshBreakpoints: vi.fn(async () => {}), traceLifecycle: vi.fn(), beforeConfiguration })).rejects.toThrow("cancelled");
  await vi.waitFor(() => expect(beforeConfiguration).toHaveBeenCalledTimes(1));
  terminal.reject(new Error("cancelled"));
  await connecting;
  expect(client.sendConfigurationDone).not.toHaveBeenCalled();
});
