import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { showMessage } from "@/lib/toast";
import { useDebugSession } from "./useDebugSession";

const f = vi.hoisted(() => {
  const breakpoints = [{ line: 2, enabled: true }];
  const noop = () => {};
  return { breakpoints, noop, stopDebug: vi.fn(), launch: vi.fn(), requestStop: vi.fn(), state: { sessionId: "existing", status: "paused" } };
});
vi.mock("../services/pythonlabSessionApi", () => ({ pythonlabSessionApi: { stop: f.requestStop } }));
vi.mock("@/lib/toast", () => ({ showMessage: { info: vi.fn(), warning: vi.fn(), error: vi.fn() } }));
vi.mock("../stores", () => ({ useDebug: () => ({
  breakpoints: f.breakpoints, activeRunnerKind: "dap", lastLaunchMode: "debug", lastDebugFallback: null,
  setActiveRunnerKind: f.noop, setLastLaunchMode: f.noop, setLastDebugFallback: f.noop, updateBreakpoints: f.noop,
}) }));
vi.mock("./usePyodideRunner", () => ({ canUseSharedArrayBuffer: () => true }));
vi.mock("./useUnifiedRunner", () => ({ useUnifiedRunner: () => {
  const dap = { state: f.state, stopDebug: f.stopDebug, runPlain: f.launch, startDebug: f.launch };
  const py = { runPlain: f.launch, reset: f.noop };
  return { dap, py, active: dap, syncBreakpoints: f.noop };
} }));

afterEach(() => vi.resetAllMocks());

test.each(["onRun", "onDebug"] as const)("%s waits for old remote cleanup before launching", async (action) => {
  let confirm!: () => void;
  f.stopDebug.mockReturnValue(new Promise<void>((resolve) => { confirm = resolve; }));
  f.requestStop.mockResolvedValue({ ok: true, status: "TERMINATING" });
  const { result } = renderHook(() => useDebugSession({ code: "a=1", debugMap: null, pythonlabRuntime: "remote" }));
  await act(async () => { result.current[action](); });
  expect(f.launch).not.toHaveBeenCalled();
  expect(f.stopDebug).toHaveBeenCalledOnce();
  await act(async () => { confirm(); });
  expect(f.launch).toHaveBeenCalledOnce();
});

test.each(["onRun", "onDebug"] as const)("%s does not launch when old cleanup is unconfirmed", async (action) => {
  f.stopDebug.mockRejectedValue(new Error("停止未确认，请重试"));
  f.requestStop.mockRejectedValue(new Error("停止未确认，请重试"));
  const { result } = renderHook(() => useDebugSession({ code: "a=1", debugMap: null, pythonlabRuntime: "remote" }));
  await act(async () => { result.current[action](); });
  expect(f.launch).not.toHaveBeenCalled();
  expect(showMessage.error).toHaveBeenCalledWith("停止未确认，请重试");
  expect(result.current.runnerView.sessionId).toBe("existing");
});
