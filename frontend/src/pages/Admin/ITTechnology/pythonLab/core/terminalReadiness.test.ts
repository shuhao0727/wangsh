import { afterEach, expect, test, vi } from "vitest";
import { createTerminalReadiness, isTerminalReadyFrame } from "./terminalReadiness";

afterEach(() => vi.useRealTimers());

test("terminal readiness waits for the current session's acknowledgement", async () => {
  const gate = createTerminalReadiness();
  gate.select("one");
  let released = false;
  const waiting = gate.wait("one").then(() => { released = true; });
  await Promise.resolve();
  gate.update("other", true);
  await Promise.resolve();
  expect(released).toBe(false);
  gate.update("one", true);
  await waiting;
  expect(released).toBe(true);
  gate.reset();
});

test("reset and replacement reject outstanding waiters and ignore stale ready", async () => {
  const gate = createTerminalReadiness();
  gate.select("old");
  const waiting = expect(gate.wait("old")).rejects.toThrow("已取消");
  gate.select("new");
  await waiting;
  gate.update("old", true);
  gate.update("new", true);
  await gate.wait("new");
  gate.reset();
  await expect(gate.wait("new")).rejects.toThrow("已取消");
});

test("disconnect invalidates readiness, bounded timeout is not a delay fallback", async () => {
  vi.useFakeTimers();
  const gate = createTerminalReadiness();
  gate.select("one");
  gate.update("one", true);
  await gate.wait("one");
  gate.update("one", false);
  const waiting = expect(gate.wait("one", 50)).rejects.toThrow("终端");
  await vi.advanceTimersByTimeAsync(50);
  await waiting;
  gate.reset();
});

test("external abort cancels a wait without accepting a later acknowledgement", async () => {
  const gate = createTerminalReadiness();
  const abort = new AbortController();
  gate.select("one");
  const waiting = expect(gate.wait("one", 1000, abort.signal)).rejects.toThrow("已取消");
  abort.abort();
  await waiting;
  gate.reset();
});

test("only the dedicated binary frame is control; user stdout is never swallowed", () => {
  const json = '{"type":"pythonlab.terminal.ready","version":1}';
  const bytes = Uint8Array.from([...json].map((char) => char.charCodeAt(0)));
  expect(isTerminalReadyFrame(bytes.buffer)).toBe(true);
  expect(isTerminalReadyFrame(json)).toBe(false);
  expect(isTerminalReadyFrame(new ArrayBuffer(0))).toBe(false);
  expect(isTerminalReadyFrame(Uint8Array.from([56, 10]).buffer)).toBe(false);
  expect(isTerminalReadyFrame(Uint8Array.from([0xff]).buffer)).toBe(false);
});
