import { shouldConnectBackendTerminal, shouldUseBackendTerminal } from "./terminalRenderer";

test("后端 DAP runner 优先使用后端 xterm 终端", () => {
  expect(shouldUseBackendTerminal({ activeRunnerKind: "dap", sessionId: null })).toBe(true);
});

test("已有后端 session 时使用后端 xterm 终端", () => {
  expect(shouldUseBackendTerminal({ activeRunnerKind: "pyodide", sessionId: "dbg_123" })).toBe(true);
});

test("本地 Pyodide runner 且无后端 session 时使用 Pyodide 终端", () => {
  expect(shouldUseBackendTerminal({ activeRunnerKind: "pyodide", sessionId: null })).toBe(false);
});

test("后端 session 启动中时暂不连接 xterm WebSocket", () => {
  expect(shouldConnectBackendTerminal({ sessionId: "dbg_123", runnerStatus: "starting" })).toBe(false);
});

test("后端 session 就绪后连接 xterm WebSocket", () => {
  expect(shouldConnectBackendTerminal({ sessionId: "dbg_123", runnerStatus: "running" })).toBe(true);
});
