import { attachPythonlabDapRuntimeHandlers } from "./debugSessionBootstrap";
import type { DebugController, DapMessage } from "./DebugController";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (error) {
    console.error(`not ok ${name}`);
    throw error;
  }
}

type HandlerMap = Record<string, ((payload: any) => void) | undefined>;

class FakeDebugController {
  handlers: HandlerMap = {};

  on(event: string, handler: (payload: any) => void) {
    this.handlers[event] = handler;
  }

  emit(event: string, payload: any) {
    const handler = this.handlers[event];
    if (!handler) {
      throw new Error(`Missing handler for ${event}`);
    }
    handler(payload);
  }
}

function setupCloseHarness(options?: { ignoreClose?: boolean }) {
  const client = new FakeDebugController();
  const closeResults: Array<{ ignored: boolean; errorMessage: string | null; code: number; reason: string }> = [];
  let clearedIgnore = 0;

  attachPythonlabDapRuntimeHandlers({
    client: client as unknown as DebugController,
    traceLifecycle: () => {},
    updateConnectionMeta: () => {},
    shouldIgnoreClose: () => Boolean(options?.ignoreClose),
    clearIgnoreClose: () => {
      clearedIgnore += 1;
    },
    onOutput: () => {},
    onStopped: () => {},
    onContinued: () => {},
    onTerminated: () => {},
    onClose: (result) => {
      closeResults.push(result);
    },
  });

  return { client, closeResults, getClearedIgnore: () => clearedIgnore };
}

test("attachPythonlabDapRuntimeHandlers maps 4401 close to auth-expired error", () => {
  const harness = setupCloseHarness();

  harness.client.emit("close", { code: 4401, reason: "" } as CloseEvent);

  assertEqual(harness.closeResults.length, 1);
  assertEqual(harness.closeResults[0].ignored, false);
  assertEqual(harness.closeResults[0].errorMessage, "登录已过期，请刷新页面");
  assertEqual(harness.closeResults[0].code, 4401);
});

test("attachPythonlabDapRuntimeHandlers maps 4429 taken_over close to takeover error", () => {
  const harness = setupCloseHarness();

  harness.client.emit("close", { code: 4429, reason: "taken_over" } as CloseEvent);

  assertEqual(harness.closeResults.length, 1);
  assertEqual(harness.closeResults[0].ignored, false);
  assertEqual(harness.closeResults[0].errorMessage, "当前调试会话已被新窗口接管");
  assertEqual(harness.closeResults[0].reason, "taken_over");
});

test("attachPythonlabDapRuntimeHandlers maps 4429 deny_in_use close to mutual-exclusion error", () => {
  const harness = setupCloseHarness();

  harness.client.emit("close", { code: 4429, reason: "deny_in_use" } as CloseEvent);

  assertEqual(harness.closeResults.length, 1);
  assertEqual(harness.closeResults[0].ignored, false);
  assertEqual(harness.closeResults[0].errorMessage, "该会话正在其他窗口调试，请先停止原窗口后重试");
  assertEqual(harness.closeResults[0].reason, "deny_in_use");
});

test("attachPythonlabDapRuntimeHandlers maps abnormal close to generic connection error", () => {
  const harness = setupCloseHarness();

  harness.client.emit("close", { code: 1006, reason: "" } as CloseEvent);

  assertEqual(harness.closeResults.length, 1);
  assertEqual(harness.closeResults[0].ignored, false);
  assertEqual(
    harness.closeResults[0].errorMessage,
    "连接已关闭（1006）：连接异常断开（可能是网络问题或服务器崩溃）",
  );
  assertEqual(harness.closeResults[0].code, 1006);
});

test("attachPythonlabDapRuntimeHandlers ignores expected close when told to do so", () => {
  const harness = setupCloseHarness({ ignoreClose: true });

  harness.client.emit("close", { code: 1000, reason: "cleanup" } as CloseEvent);

  assertEqual(harness.closeResults.length, 1);
  assertEqual(harness.closeResults[0].ignored, true);
  assertEqual(harness.closeResults[0].errorMessage, null);
  assertEqual(harness.closeResults[0].reason, "cleanup");
  assertEqual(harness.getClearedIgnore(), 1);
});

test("attachPythonlabDapRuntimeHandlers forwards stopped event metadata and thread id", () => {
  const client = new FakeDebugController();
  const seenMeta: Array<{ wsEpoch: number | null; wsConnId: string | null; clientConnId: string | null }> = [];
  const seenStopped: number[] = [];

  attachPythonlabDapRuntimeHandlers({
    client: client as unknown as DebugController,
    traceLifecycle: () => {},
    updateConnectionMeta: (meta) => {
      seenMeta.push(meta);
    },
    shouldIgnoreClose: () => false,
    clearIgnoreClose: () => {},
    onOutput: () => {},
    onStopped: (threadId) => {
      seenStopped.push(threadId);
    },
    onContinued: () => {},
    onTerminated: () => {},
    onClose: () => {},
  });

  const stoppedMessage = {
    type: "event",
    event: "stopped",
    body: { threadId: 7 },
    _meta: {
      ws_epoch: 3,
      conn_id: "conn-1",
      client_conn_id: "client-1",
    },
  } satisfies DapMessage;

  client.emit("stopped", stoppedMessage);

  assertEqual(seenStopped.length, 1);
  assertEqual(seenStopped[0], 7);
  assertEqual(seenMeta.length, 1);
  assertEqual(seenMeta[0].wsEpoch, 3);
  assertEqual(seenMeta[0].wsConnId, "conn-1");
  assertEqual(seenMeta[0].clientConnId, "client-1");
  assert(seenMeta[0].wsEpoch !== null, "expected ws epoch to be propagated");
});
