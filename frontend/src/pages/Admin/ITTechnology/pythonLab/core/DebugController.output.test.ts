import { vi } from "vitest";
import { DebugController } from "./DebugController";

test("attach uses TTY as the single stdout/stderr source", async () => {
  const controller = new DebugController();
  const request = vi.spyOn(controller, "requestWithRetry").mockResolvedValue({ type: "response", success: true });
  await controller.attachPythonSession();
  expect(request).toHaveBeenCalledWith("attach", expect.objectContaining({ redirectOutput: false }), 20000, 1);
});
