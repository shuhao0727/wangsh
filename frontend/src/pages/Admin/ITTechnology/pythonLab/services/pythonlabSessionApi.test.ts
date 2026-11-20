import { AxiosHeaders } from "axios";
import { afterEach, expect, test, vi } from "vitest";
import { pythonlabV2Client } from "./pythonlabApiBase";
import { pythonlabSessionApi, stopAndWaitForPythonlabSession, trackedPythonlabSession, trackPythonlabSession } from "./pythonlabSessionApi";

vi.mock("./pythonlabApiBase", () => ({ pythonlabV2Client: { get: vi.fn(), post: vi.fn() } }));
const response = (data: unknown) => ({ data, status: 200, statusText: "OK", headers: {}, config: { headers: new AxiosHeaders() } });
afterEach(() => { vi.resetAllMocks(); vi.useRealTimers(); sessionStorage.clear(); });

test("refresh only finds a session for the same account and experiment", () => {
  trackPythonlabSession("1:seq", "session-a");
  expect(trackedPythonlabSession("1:seq")).toBe("session-a");
  expect(trackedPythonlabSession("1:loops")).toBeNull();
  expect(trackedPythonlabSession("2:seq")).toBeNull();
});

test("does not clear tracking on dispatch failure; retry waits for confirmed worker stop", async () => {
  vi.useFakeTimers();
  trackPythonlabSession("1:seq", "session-a");
  vi.mocked(pythonlabV2Client.post)
    .mockRejectedValueOnce(new Error("派发未确认"))
    .mockResolvedValueOnce(response({ ok: true, status: "TERMINATING" }));
  vi.mocked(pythonlabV2Client.get)
    .mockResolvedValueOnce(response({ status: "TERMINATED", stop_confirmed: false }))
    .mockResolvedValueOnce(response({ status: "TERMINATED", stop_confirmed: true }));
  await expect(stopAndWaitForPythonlabSession("session-a", "1:seq")).rejects.toThrow();
  expect(trackedPythonlabSession("1:seq")).toBe("session-a");
  const stopped = stopAndWaitForPythonlabSession("session-a", "1:seq");
  await vi.advanceTimersByTimeAsync(500);
  expect(trackedPythonlabSession("1:seq")).toBe("session-a");
  await vi.advanceTimersByTimeAsync(500);
  await stopped;
  expect(trackedPythonlabSession("1:seq")).toBeNull();
  expect(pythonlabV2Client.post).toHaveBeenCalledTimes(2);
});

test("preserves tracking when the worker could not verify resource cleanup", async () => {
  vi.useFakeTimers();
  trackPythonlabSession("1:seq", "session-a");
  vi.mocked(pythonlabV2Client.post).mockResolvedValue(response({ ok: true, status: "TERMINATING" }));
  vi.mocked(pythonlabV2Client.get).mockResolvedValue(response({ status: "TERMINATING", error_code: "SANDBOX_STOP_FAILED" }));
  const stopped = stopAndWaitForPythonlabSession("session-a", "1:seq");
  const rejected = expect(stopped).rejects.toThrow(/重试/);
  await vi.advanceTimersByTimeAsync(500);
  await rejected;
  expect(trackedPythonlabSession("1:seq")).toBe("session-a");
});

test("creation does not overwrite the tracked session with a prewarm ID", async () => {
  vi.mocked(pythonlabV2Client.post).mockResolvedValue(response({ session_id: "prewarm" }));
  trackPythonlabSession("1:seq", "session-a");
  await pythonlabSessionApi.create({ code: "pass", title: "pythonlab_prewarm" });
  expect(trackedPythonlabSession("1:seq")).toBe("session-a");
});
