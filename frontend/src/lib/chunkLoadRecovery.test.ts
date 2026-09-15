import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installChunkLoadRecovery } from "@/utils/chunkLoadRecovery";

describe("installChunkLoadRecovery", () => {
  const reload = vi.fn();
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    window.sessionStorage.clear();
    reload.mockClear();
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    window.sessionStorage.clear();
  });

  it("reloads once and suppresses the stale chunk error", () => {
    cleanup = installChunkLoadRecovery({ reload });
    const event = new Event("vite:preloadError", { cancelable: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not loop when the reload still cannot load the chunk", () => {
    window.sessionStorage.setItem("wangsh:chunk-load-recovery-at", String(Date.now()));
    cleanup = installChunkLoadRecovery({ reload });
    const event = new Event("vite:preloadError", { cancelable: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("removes the listener during cleanup", () => {
    cleanup = installChunkLoadRecovery({ reload });
    cleanup();
    cleanup = undefined;

    window.dispatchEvent(new Event("vite:preloadError", { cancelable: true }));

    expect(reload).not.toHaveBeenCalled();
  });
});
